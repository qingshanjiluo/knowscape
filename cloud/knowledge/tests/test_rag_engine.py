import os
import tempfile
from datetime import datetime
from pathlib import Path

import pytest
import pytest_asyncio
from fastapi.testclient import TestClient

import sys

sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent))

from cloud.knowledge.models import IndexingStatus, KnowledgeChapter, KnowledgeDocument, DistillEntry
from cloud.knowledge.storage.sqlite_store import SQLiteStore
from cloud.knowledge.rag.api import create_app
from cloud.knowledge.rag.history import ConversationStore
from cloud.knowledge.rag.retriever import DualSourceRetriever
from cloud.knowledge.rag.service import RAGChatService


@pytest.fixture
def rag_db_path():
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
        path = f.name
    yield path
    for suffix in ["", "-wal", "-shm"]:
        file_path = path + suffix
        if os.path.exists(file_path):
            try:
                os.unlink(file_path)
            except PermissionError:
                pass


@pytest_asyncio.fixture
async def seeded_store(rag_db_path):
    store = SQLiteStore(rag_db_path, vector_dim=16)
    await store.initialize()

    doc = KnowledgeDocument(
        doc_id="book-systems",
        title="系统思维导论",
        author="测试作者",
        full_text=(
            "系统思维强调要素之间的关系。"
            "延迟效应会让人误判因果。"
            "理解反馈回路有助于改善决策。"
            "跨章节综合时需要同时看到原则与案例。"
        ),
        total_chapters=2,
        indexing_status=IndexingStatus.COMPLETED,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    await store.upsert_document(doc)

    chapters = [
        KnowledgeChapter(
            chapter_id="book-systems-ch1",
            doc_id=doc.doc_id,
            index=0,
            title="第一章 系统思维",
            content="系统思维强调关系、反馈回路与整体视角。",
            word_count=20,
            start_pos=0,
            end_pos=20,
        ),
        KnowledgeChapter(
            chapter_id="book-systems-ch2",
            doc_id=doc.doc_id,
            index=1,
            title="第二章 决策延迟",
            content="延迟效应会让人误判因果，只有结合反馈回路才能看清长期影响。",
            word_count=31,
            start_pos=21,
            end_pos=52,
        ),
    ]
    for chapter in chapters:
        await store.upsert_chapter(chapter)

    distills = [
        DistillEntry(
            entry_id="distill-1",
            doc_id=doc.doc_id,
            chapter_id=chapters[0].chapter_id,
            chapter_index=0,
            chapter_title=chapters[0].title,
            point="系统思维的核心是关系与反馈回路，而不是孤立分析单点。",
            evidence="作者强调整体视角比线性拆解更能解释复杂系统。",
            quote="系统思维强调关系、反馈回路与整体视角。",
            category="principles",
            depth="medium",
        ),
    ]
    for distill in distills:
        await store.upsert_distill_entry(distill)

    await store.rebuild_fts_index(doc.doc_id)
    yield store
    await store.close()


@pytest.mark.asyncio
async def test_dual_source_retriever_prioritizes_distill_and_backfills_original(seeded_store):
    retriever = DualSourceRetriever(seeded_store)

    bundle = await retriever.retrieve(
        doc_id="book-systems",
        question="系统思维和延迟效应有什么关系？",
        history=[],
    )

    assert bundle.items
    assert bundle.items[0].source_type == "distill"
    assert any(item.source_type == "original" for item in bundle.items)
    assert any("延迟效应" in item.content for item in bundle.items if item.source_type == "original")


@pytest.mark.asyncio
async def test_rag_chat_service_supports_follow_up_and_citation_mapping(seeded_store):
    history_store = ConversationStore(seeded_store)
    service = RAGChatService(store=seeded_store, history_store=history_store)

    await service.ask(
        book_id="book-systems",
        question="什么是系统思维？",
        session_id="session-001",
    )
    response = await service.ask(
        book_id="book-systems",
        question="它和延迟效应有什么关系？",
        session_id="session-001",
    )

    assert "[引1]" in response.answer
    assert response.citations
    assert response.citations[0].chapter_index == 1
    assert response.citations[0].position["start"] < response.citations[0].position["end"]
    assert len(response.suggestions) == 3

    history = await history_store.get_session_messages("session-001")
    assert len(history) == 4
    assert history[-1].citations


def test_rag_api_stream_and_history_endpoints(rag_db_path):
    app = create_app(db_path=rag_db_path)

    with TestClient(app) as client:
        seed_resp = client.post(
            "/api/v1/debug/seed-rag-demo",
            json={"book_id": "book-systems"},
        )
        assert seed_resp.status_code == 200

        response = client.post(
            "/api/v1/ask-question",
            json={
                "book_id": "book-systems",
                "question": "系统思维和延迟效应有什么关系？",
                "session_id": "session-api",
            },
        )
        assert response.status_code == 200
        assert response.headers["content-type"].startswith("text/event-stream")
        assert '"done": true' in response.text
        assert '"citations"' in response.text

        history = client.get("/api/v1/get-chat-history", params={"session_id": "session-api"})
        assert history.status_code == 200
        payload = history.json()
        assert payload["success"] is True
        assert len(payload["data"]) == 2
        assert payload["data"][-1]["citations"]

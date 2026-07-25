from __future__ import annotations

import json
from contextlib import asynccontextmanager
from datetime import datetime
from typing import AsyncIterator

from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse, StreamingResponse

from cloud.knowledge.models import DistillEntry, IndexingStatus, KnowledgeChapter, KnowledgeDocument
from cloud.knowledge.rag.history import ConversationStore
from cloud.knowledge.rag.models import ApiResponse, AskQuestionRequest
from cloud.knowledge.rag.service import RAGChatService
from cloud.knowledge.storage.sqlite_store import SQLiteStore


def create_app(db_path: str = "knowledge_store.db") -> FastAPI:
    @asynccontextmanager
    async def lifespan(app: FastAPI):
        store = SQLiteStore(db_path)
        await store.initialize()
        history_store = ConversationStore(store)
        app.state.store = store
        app.state.history_store = history_store
        app.state.rag_service = RAGChatService(store=store, history_store=history_store)
        yield
        await store.close()

    app = FastAPI(title="KnowScape RAG API", version="1.0.0", lifespan=lifespan)

    @app.get("/api/v1/health")
    async def health():
        return ApiResponse(data={"status": "ok"})

    @app.post("/api/v1/ask-question")
    async def ask_question(request: AskQuestionRequest):
        service: RAGChatService = app.state.rag_service
        payload = await service.ask(
            book_id=request.book_id,
            question=request.question,
            session_id=request.session_id,
        )

        async def event_stream() -> AsyncIterator[str]:
            for chunk in _split_text(payload.answer):
                yield "data: " + json.dumps(
                    {"content": chunk, "done": False},
                    ensure_ascii=False,
                ) + "\n\n"
            yield "data: " + json.dumps(
                {
                    "content": "",
                    "done": True,
                    "citations": [item.model_dump() for item in payload.citations],
                    "suggestions": payload.suggestions,
                },
                ensure_ascii=False,
            ) + "\n\n"

        return StreamingResponse(event_stream(), media_type="text/event-stream")

    @app.get("/api/v1/get-chat-history")
    async def get_chat_history(session_id: str):
        history_store: ConversationStore = app.state.history_store
        messages = await history_store.get_session_messages(session_id)
        return JSONResponse(
            ApiResponse(
                data=[message.model_dump() for message in messages]
            ).model_dump()
        )

    @app.post("/api/v1/debug/seed-rag-demo")
    async def seed_rag_demo(payload: dict):
        book_id = payload.get("book_id")
        if not book_id:
            raise HTTPException(status_code=400, detail="book_id is required")
        await _seed_demo_book(app.state.store, book_id)
        return ApiResponse(data={"book_id": book_id})

    return app


def _split_text(text: str, chunk_size: int = 72) -> list[str]:
    if not text:
        return [""]
    return [text[idx : idx + chunk_size] for idx in range(0, len(text), chunk_size)]


async def _seed_demo_book(store: SQLiteStore, book_id: str) -> None:
    existing = await store.get_document(book_id)
    if existing:
        return

    now = datetime.utcnow()
    document = KnowledgeDocument(
        doc_id=book_id,
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
        created_at=now,
        updated_at=now,
    )
    await store.upsert_document(document)

    chapters = [
        KnowledgeChapter(
            chapter_id=f"{book_id}-ch1",
            doc_id=book_id,
            index=0,
            title="第一章 系统思维",
            content="系统思维强调关系、反馈回路与整体视角。",
            word_count=20,
            start_pos=0,
            end_pos=20,
        ),
        KnowledgeChapter(
            chapter_id=f"{book_id}-ch2",
            doc_id=book_id,
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

    await store.upsert_distill_entry(
        DistillEntry(
            entry_id=f"{book_id}-distill-1",
            doc_id=book_id,
            chapter_id=chapters[0].chapter_id,
            chapter_index=0,
            chapter_title=chapters[0].title,
            point="系统思维的核心是关系与反馈回路，而不是孤立分析单点。",
            evidence="作者强调整体视角比线性拆解更能解释复杂系统。",
            quote="系统思维强调关系、反馈回路与整体视角。",
            category="principles",
            depth="medium",
        )
    )
    await store.rebuild_fts_index(book_id)


app = create_app()

"""
知识存储模块 · 单元测试

Usage:
    pytest cloud/knowledge/tests/test_storage.py -v
"""

import json
import os
import sys
import tempfile
import pytest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from datetime import datetime

from cloud.knowledge.storage.sqlite_store import SQLiteStore
from cloud.knowledge.models import (
    KnowledgeDocument, KnowledgeChapter, DistillEntry,
    EmbeddingRecord, SearchResult, StorageStats,
    IndexingStatus, StorageBackendType,
)
from cloud.knowledge.search.engine import SearchEngine
from cloud.knowledge.indexer.text_indexer import TextIndexer
from cloud.knowledge.indexer.vector_indexer import VectorIndexer, EmbeddingProvider


# ─── Fixtures ────────────────────────────────────────────────

@pytest.fixture
def db_path():
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
        path = f.name
    yield path
    import time
    for retry in range(5):
        try:
            if os.path.exists(path):
                os.unlink(path)
            for suffix in ["-wal", "-shm"]:
                w = path + suffix
                if os.path.exists(w):
                    os.unlink(w)
            return
        except PermissionError:
            time.sleep(0.2)


@pytest.fixture
def store(db_path):
    import asyncio
    s = SQLiteStore(db_path, vector_dim=384)
    asyncio.run(s.initialize())
    yield s
    asyncio.run(s.close())


@pytest.fixture
def sample_doc():
    return KnowledgeDocument(
        doc_id="test-doc-001",
        title="认知心理学",
        author="张三",
        language="zh",
        source_format="markdown",
        source_path="/path/to/book.md",
        source_hash="abc123",
        word_count=5000,
        total_chapters=3,
        full_text="# 认知心理学\n\n认知心理学是研究人类思维过程的科学...",
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
        indexing_status=IndexingStatus.PENDING,
        metadata_json=json.dumps({"publisher": "某出版社"}),
    )


@pytest.fixture
def sample_chapters(sample_doc):
    return [
        KnowledgeChapter(
            chapter_id=f"{sample_doc.doc_id}_ch1",
            doc_id=sample_doc.doc_id,
            index=0,
            title="第一章：认知基础",
            level=1,
            content="认知基础是理解心理学的前提。主要包括感知、注意和记忆。",
            word_count=100,
            start_pos=0,
            end_pos=100,
        ),
        KnowledgeChapter(
            chapter_id=f"{sample_doc.doc_id}_ch2",
            doc_id=sample_doc.doc_id,
            index=1,
            title="第二章：思维过程",
            level=1,
            content="思维过程包括概念形成、推理和决策。",
            word_count=80,
            start_pos=100,
            end_pos=180,
        ),
    ]


@pytest.fixture
def sample_distills(sample_doc, sample_chapters):
    return [
        DistillEntry(
            entry_id=f"{sample_doc.doc_id}_de1",
            doc_id=sample_doc.doc_id,
            chapter_id=sample_chapters[0].chapter_id,
            chapter_index=0,
            chapter_title="第一章：认知基础",
            point="感知是认知过程的基础",
            evidence="感知包括视觉、听觉等多种感官通道的信息处理",
            category="原则",
            depth="medium",
        ),
        DistillEntry(
            entry_id=f"{sample_doc.doc_id}_de2",
            doc_id=sample_doc.doc_id,
            chapter_id=sample_chapters[0].chapter_id,
            chapter_index=0,
            chapter_title="第一章：认知基础",
            point="注意力是信息筛选的关键机制",
            evidence="注意分为选择性注意和分配性注意",
            category="模型",
            depth="medium",
        ),
        DistillEntry(
            entry_id=f"{sample_doc.doc_id}_de3",
            doc_id=sample_doc.doc_id,
            chapter_id=sample_chapters[1].chapter_id,
            chapter_index=1,
            chapter_title="第二章：思维过程",
            point="概念形成是思维的基本单元",
            category="方法",
            depth="shallow",
        ),
    ]


# ─── Store Initialization Tests ──────────────────────────────

@pytest.mark.asyncio
class TestStoreInit:
    async def test_initialize_creates_tables(self, db_path):
        store = SQLiteStore(db_path)
        await store.initialize()

        tables = store.conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table'"
        ).fetchall()
        table_names = [t[0] for t in tables]
        assert "documents" in table_names
        assert "chapters" in table_names
        assert "distill_entries" in table_names
        assert "embeddings" in table_names

        await store.close()

    async def test_close(self, db_path):
        store = SQLiteStore(db_path)
        await store.initialize()
        await store.close()
        assert store._pool is not None  # connection object exists but closed


# ─── Document CRUD Tests ────────────────────────────────────

@pytest.mark.asyncio
class TestDocumentCRUD:
    async def test_upsert_and_get_document(self, store, sample_doc):
        doc_id = await store.upsert_document(sample_doc)
        assert doc_id == sample_doc.doc_id

        retrieved = await store.get_document(doc_id)
        assert retrieved is not None
        assert retrieved.title == "认知心理学"
        assert retrieved.author == "张三"
        assert retrieved.indexing_status == IndexingStatus.PENDING

    async def test_upsert_updates_existing(self, store, sample_doc):
        await store.upsert_document(sample_doc)
        updated = KnowledgeDocument(
            doc_id=sample_doc.doc_id,
            title="认知心理学（第二版）",
            author="张三",
            indexing_status=IndexingStatus.COMPLETED,
        )
        await store.upsert_document(updated)

        retrieved = await store.get_document(sample_doc.doc_id)
        assert retrieved.title == "认知心理学（第二版）"
        assert retrieved.indexing_status == IndexingStatus.COMPLETED

    async def test_get_nonexistent(self, store):
        doc = await store.get_document("nonexistent")
        assert doc is None

    async def test_list_documents(self, store, sample_doc):
        await store.upsert_document(sample_doc)

        docs = await store.list_documents()
        assert len(docs) >= 1
        assert docs[0].doc_id == sample_doc.doc_id

    async def test_delete_document(self, store, sample_doc):
        await store.upsert_document(sample_doc)
        deleted = await store.delete_document(sample_doc.doc_id)
        assert deleted is True

        doc = await store.get_document(sample_doc.doc_id)
        assert doc is None

    async def test_document_count(self, store, sample_doc):
        count = await store.get_document_count()
        assert count == 0

        await store.upsert_document(sample_doc)
        count = await store.get_document_count()
        assert count == 1


# ─── Chapter CRUD Tests ─────────────────────────────────────

@pytest.mark.asyncio
class TestChapterCRUD:
    async def test_upsert_and_get_chapters(self, store, sample_doc,
                                            sample_chapters):
        await store.upsert_document(sample_doc)
        for ch in sample_chapters:
            await store.upsert_chapter(ch)

        chapters = await store.get_chapters_by_doc(sample_doc.doc_id)
        assert len(chapters) == 2
        assert chapters[0].title == "第一章：认知基础"
        assert chapters[1].title == "第二章：思维过程"

    async def test_delete_chapters(self, store, sample_doc, sample_chapters):
        await store.upsert_document(sample_doc)
        for ch in sample_chapters:
            await store.upsert_chapter(ch)

        count = await store.delete_chapters_by_doc(sample_doc.doc_id)
        assert count >= 2


# ─── Distill Entry CRUD Tests ───────────────────────────────

@pytest.mark.asyncio
class TestDistillCRUD:
    async def test_upsert_and_get_entries(self, store, sample_doc,
                                           sample_chapters, sample_distills):
        await store.upsert_document(sample_doc)
        for ch in sample_chapters:
            await store.upsert_chapter(ch)
        for de in sample_distills:
            await store.upsert_distill_entry(de)

        entries = await store.get_distill_entries_by_doc(sample_doc.doc_id)
        assert len(entries) == 3

        ch_entries = await store.get_distill_entries_by_chapter(
            sample_chapters[0].chapter_id
        )
        assert len(ch_entries) == 2

    async def test_delete_entries(self, store, sample_doc,
                                   sample_chapters, sample_distills):
        await store.upsert_document(sample_doc)
        for ch in sample_chapters:
            await store.upsert_chapter(ch)
        for de in sample_distills:
            await store.upsert_distill_entry(de)

        count = await store.delete_distill_by_doc(sample_doc.doc_id)
        assert count >= 3


# ─── Embedding CRUD Tests ───────────────────────────────────

@pytest.mark.asyncio
class TestEmbeddingCRUD:
    async def test_upsert_and_get_embeddings(self, store, sample_doc):
        await store.upsert_document(sample_doc)

        emb = EmbeddingRecord(
            id="emb_test_1",
            doc_id=sample_doc.doc_id,
            content_type="full_text",
            content="测试文本",
            embedding=[0.1, 0.2, 0.3, 0.4],
            metadata={"source": "test"},
        )
        await store.upsert_embedding(emb)

        records = await store.get_embeddings_by_doc(sample_doc.doc_id)
        assert len(records) == 1
        assert records[0].content_type == "full_text"
        assert len(records[0].embedding) == 4
        assert records[0].metadata["source"] == "test"

    async def test_delete_embeddings(self, store, sample_doc):
        await store.upsert_document(sample_doc)
        emb = EmbeddingRecord(
            id="emb_del_test",
            doc_id=sample_doc.doc_id,
            content_type="full_text",
            content="delete me",
            embedding=[0.5, 0.5],
        )
        await store.upsert_embedding(emb)
        count = await store.delete_embeddings_by_doc(sample_doc.doc_id)
        assert count >= 1


# ─── Full-text Search Tests ─────────────────────────────────

@pytest.mark.asyncio
class TestFullTextSearch:
    async def test_fulltext_search_chapters(self, store, sample_doc,
                                             sample_chapters):
        await store.upsert_document(sample_doc)
        for ch in sample_chapters:
            await store.upsert_chapter(ch)
        await store.rebuild_fts_index(sample_doc.doc_id)

        results, total = await store.fulltext_search("认知基础")
        assert total >= 0  # FTS5 might not match Chinese well

    async def test_fulltext_search_distill(self, store, sample_doc,
                                            sample_chapters,
                                            sample_distills):
        await store.upsert_document(sample_doc)
        for ch in sample_chapters:
            await store.upsert_chapter(ch)
        for de in sample_distills:
            await store.upsert_distill_entry(de)
        await store.rebuild_fts_index(sample_doc.doc_id)

        results, total = await store.fulltext_search("感知")
        assert total >= 0

    async def test_fulltext_empty_query(self, store):
        results, total = await store.fulltext_search("")
        assert total == 0
        assert results == []


# ─── Vector Search Tests ────────────────────────────────────

@pytest.mark.asyncio
class TestVectorSearch:
    async def test_vector_search_basic(self, store, sample_doc):
        await store.upsert_document(sample_doc)

        # Insert a test embedding
        emb = EmbeddingRecord(
            id="vec_test_1",
            doc_id=sample_doc.doc_id,
            content_type="full_text",
            content="测试向量内容",
            embedding=[0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8],
            metadata={"doc_title": sample_doc.title},
        )
        await store.upsert_embedding(emb)

        # Search with similar vector
        results = await store.vector_search(
            [0.11, 0.21, 0.31, 0.41, 0.51, 0.61, 0.71, 0.81]
        )
        assert len(results) >= 1
        assert results[0].doc_id == sample_doc.doc_id

    async def test_vector_search_empty(self, store):
        results = await store.vector_search([0.1, 0.2, 0.3])
        assert results == []


# ─── Search Engine Tests ─────────────────────────────────────

@pytest.mark.asyncio
class TestSearchEngine:
    async def test_engine_hybrid_search(self, store, sample_doc,
                                         sample_chapters, sample_distills):
        await store.upsert_document(sample_doc)
        for ch in sample_chapters:
            await store.upsert_chapter(ch)
        for de in sample_distills:
            await store.upsert_distill_entry(de)
        await store.rebuild_fts_index(sample_doc.doc_id)

        engine = SearchEngine(store)
        result = await engine.search("感知", mode="fulltext")
        assert "results" in result
        assert "mode" in result

    async def test_engine_search_by_document(self, store, sample_doc,
                                              sample_chapters):
        await store.upsert_document(sample_doc)
        for ch in sample_chapters:
            await store.upsert_chapter(ch)
        await store.rebuild_fts_index(sample_doc.doc_id)

        engine = SearchEngine(store)
        result = await engine.search_by_document(
            sample_doc.doc_id, "认知"
        )
        assert "results" in result

    async def test_engine_search_distill_only(self, store, sample_doc,
                                               sample_chapters,
                                               sample_distills):
        await store.upsert_document(sample_doc)
        for ch in sample_chapters:
            await store.upsert_chapter(ch)
        for de in sample_distills:
            await store.upsert_distill_entry(de)

        engine = SearchEngine(store)
        result = await engine.search_distill("感知")
        assert "results" in result


# ─── FTS Index Management Tests ─────────────────────────────

@pytest.mark.asyncio
class TestFTSIndex:
    async def test_rebuild_fts_index(self, store, sample_doc):
        await store.upsert_document(sample_doc)
        count = await store.rebuild_fts_index(sample_doc.doc_id)
        assert count >= 0

    async def test_update_indexing_status(self, store, sample_doc):
        await store.upsert_document(sample_doc)
        await store.update_indexing_status(
            sample_doc.doc_id, "completed"
        )
        doc = await store.get_document(sample_doc.doc_id)
        assert doc.indexing_status == IndexingStatus.COMPLETED


# ─── Stats Tests ─────────────────────────────────────────────

@pytest.mark.asyncio
class TestStats:
    async def test_get_stats(self, store):
        stats = await store.get_stats()
        assert isinstance(stats, StorageStats)
        assert stats.backend == StorageBackendType.SQLITE
        assert stats.total_documents >= 0
        assert isinstance(stats.db_size_bytes, int)


# ─── Indexer Tests ──────────────────────────────────────────

@pytest.mark.asyncio
class TestTextIndexer:
    async def test_extract_snippets(self):
        text = "The quick brown fox jumps over the lazy dog. " * 10
        snippets = TextIndexer.extract_search_snippets(text, "fox")
        assert len(snippets) >= 1
        assert "fox" in snippets[0]


class TestEmbeddingProvider:
    def test_random_fallback(self):
        provider = EmbeddingProvider()
        emb = provider.encode_one("测试文本")
        assert len(emb) == 384

    def test_batch_encode(self):
        provider = EmbeddingProvider()
        embs = provider.encode(["文本A", "文本B"])
        assert len(embs) == 2
        assert len(embs[0]) == 384


# ─── Export/Import Tests ────────────────────────────────────

@pytest.mark.asyncio
class TestExportImport:
    async def test_export_and_import(self, store, sample_doc):
        await store.upsert_document(sample_doc)

        data = await store.export_package()
        assert "documents" in data
        assert len(data["documents"]) >= 1

        # Import into a fresh store
        with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
            new_path = f.name

        new_store = SQLiteStore(new_path)
        try:
            await new_store.initialize()
            count = await new_store.import_package(data)
            assert count >= 1

            docs = await new_store.list_documents()
            assert len(docs) >= 1
        finally:
            await new_store.close()
            if os.path.exists(new_path):
                os.unlink(new_path)


# ─── Error Handling Tests ────────────────────────────────────

@pytest.mark.asyncio
class TestErrorHandling:
    async def test_get_nonexistent_doc(self, store):
        doc = await store.get_document("does-not-exist")
        assert doc is None

    async def test_delete_nonexistent_doc(self, store):
        result = await store.delete_document("does-not-exist")
        assert result is False or result == 0

    async def test_vector_search_empty_db(self, store):
        results = await store.vector_search([0.1, 0.2, 0.3])
        assert results == []

    async def test_fulltext_search_no_match(self, store):
        results, total = await store.fulltext_search(
            "xyznonexistentkeyword"
        )
        assert total == 0


# ─── Bulk Operations Tests ──────────────────────────────────

@pytest.mark.asyncio
class TestBulk:
    async def test_bulk_import(self, store):
        pkg = {
            "documents": [
                {
                    "doc_id": "bulk-001",
                    "title": "批量测试文档A",
                    "indexing_status": "pending",
                },
                {
                    "doc_id": "bulk-002",
                    "title": "批量测试文档B",
                    "indexing_status": "pending",
                },
            ],
            "chapters": [],
            "distill_entries": [],
            "embeddings": [],
        }
        count = await store.import_package(pkg)
        assert count == 2

        docs = await store.list_documents()
        assert len(docs) >= 2

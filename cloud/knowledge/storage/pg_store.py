"""
PostgreSQL + pgvector storage backend.
Requires: pip install asyncpg pgvector

Usage:
    pg_dsn = "postgresql+asyncpg://user:pass@localhost:5432/knowscape"
    store = PGStore(pg_dsn)
    await store.initialize()
"""

import json
import math
import uuid
from datetime import datetime
from typing import Dict, List, Optional, Tuple

try:
    import asyncpg
except ImportError:
    asyncpg = None

from cloud.knowledge.models import (
    KnowledgeDocument, KnowledgeChapter, DistillEntry,
    EmbeddingRecord, SearchResult, StorageStats,
    StorageBackendType, IndexingStatus,
)
from cloud.knowledge.storage.base import StorageBackend


class PGStore(StorageBackend):
    """PostgreSQL + pgvector backend."""

    def __init__(self, dsn: str, vector_dim: int = 384):
        self.dsn = dsn
        self.vector_dim = vector_dim
        self._pool: Optional[asyncpg.Pool] = None
        self._available = asyncpg is not None

    def is_available(self) -> bool:
        return self._available

    async def initialize(self):
        if not self._available:
            raise RuntimeError(
                "asyncpg not installed. Run: pip install asyncpg"
            )
        self._pool = await asyncpg.create_pool(
            self.dsn, min_size=1, max_size=5
        )
        async with self._pool.acquire() as conn:
            await conn.execute('CREATE EXTENSION IF NOT EXISTS vector')
            await conn.execute(
                f'CREATE EXTENSION IF NOT EXISTS pg_trgm'
            )

            await conn.execute("""
                CREATE TABLE IF NOT EXISTS documents (
                    doc_id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    author TEXT DEFAULT '',
                    language TEXT DEFAULT 'zh',
                    source_format TEXT DEFAULT '',
                    source_path TEXT DEFAULT '',
                    source_hash TEXT DEFAULT '',
                    word_count INTEGER DEFAULT 0,
                    total_chapters INTEGER DEFAULT 0,
                    full_text TEXT DEFAULT '',
                    created_at TIMESTAMPTZ DEFAULT NOW(),
                    updated_at TIMESTAMPTZ DEFAULT NOW(),
                    indexing_status TEXT DEFAULT 'pending',
                    metadata_json JSONB DEFAULT '{}'
                )
            """)

            await conn.execute(f"""
                CREATE TABLE IF NOT EXISTS chapters (
                    chapter_id TEXT PRIMARY KEY,
                    doc_id TEXT NOT NULL REFERENCES documents(doc_id)
                        ON DELETE CASCADE,
                    idx INTEGER NOT NULL,
                    title TEXT NOT NULL,
                    level INTEGER DEFAULT 1,
                    content TEXT DEFAULT '',
                    word_count INTEGER DEFAULT 0,
                    start_pos INTEGER DEFAULT 0,
                    end_pos INTEGER DEFAULT 0
                )
            """)

            await conn.execute(f"""
                CREATE TABLE IF NOT EXISTS distill_entries (
                    entry_id TEXT PRIMARY KEY,
                    doc_id TEXT NOT NULL REFERENCES documents(doc_id)
                        ON DELETE CASCADE,
                    chapter_id TEXT NOT NULL,
                    chapter_index INTEGER NOT NULL,
                    chapter_title TEXT DEFAULT '',
                    point TEXT NOT NULL,
                    evidence TEXT,
                    quote TEXT,
                    category TEXT,
                    depth TEXT DEFAULT 'medium'
                )
            """)

            await conn.execute(f"""
                CREATE TABLE IF NOT EXISTS embeddings (
                    id TEXT PRIMARY KEY,
                    doc_id TEXT NOT NULL REFERENCES documents(doc_id)
                        ON DELETE CASCADE,
                    chapter_id TEXT,
                    entry_id TEXT,
                    content_type TEXT NOT NULL,
                    content TEXT NOT NULL,
                    embedding vector({self.vector_dim}),
                    metadata_json JSONB DEFAULT '{{}}'::jsonb
                )
            """)

            await conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_embeddings_vector
                    ON embeddings
                    USING ivfflat (embedding vector_cosine_ops)
                    WITH (lists = 100)
            """)

            await conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_embeddings_doc
                    ON embeddings(doc_id)
            """)

            await conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_embeddings_type
                    ON embeddings(content_type)
            """)

    async def close(self):
        if self._pool:
            await self._pool.close()

    async def _execute(self, query: str, *args):
        async with self._pool.acquire() as conn:
            return await conn.execute(query, *args)

    async def _fetch(self, query: str, *args):
        async with self._pool.acquire() as conn:
            return await conn.fetch(query, *args)

    async def _fetchrow(self, query: str, *args):
        async with self._pool.acquire() as conn:
            return await conn.fetchrow(query, *args)

    # ─── Document CRUD ─────────────────────────────────────────

    async def upsert_document(self, doc: KnowledgeDocument) -> str:
        await self._execute("""
            INSERT INTO documents
                (doc_id, title, author, language, source_format,
                 source_path, source_hash, word_count, total_chapters,
                 full_text, indexing_status, metadata_json)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
            ON CONFLICT (doc_id) DO UPDATE SET
                title=EXCLUDED.title, author=EXCLUDED.author,
                language=EXCLUDED.language,
                source_format=EXCLUDED.source_format,
                source_path=EXCLUDED.source_path,
                source_hash=EXCLUDED.source_hash,
                word_count=EXCLUDED.word_count,
                total_chapters=EXCLUDED.total_chapters,
                full_text=EXCLUDED.full_text,
                updated_at=NOW(),
                indexing_status=EXCLUDED.indexing_status,
                metadata_json=EXCLUDED.metadata_json
        """,
            doc.doc_id, doc.title, doc.author, doc.language,
            doc.source_format, doc.source_path, doc.source_hash,
            doc.word_count, doc.total_chapters, doc.full_text,
            doc.indexing_status.value, doc.metadata_json,
        )
        return doc.doc_id

    async def get_document(
        self, doc_id: str
    ) -> Optional[KnowledgeDocument]:
        row = await self._fetchrow(
            "SELECT * FROM documents WHERE doc_id=$1", doc_id
        )
        if not row:
            return None
        return KnowledgeDocument(
            doc_id=row["doc_id"], title=row["title"],
            author=row.get("author", ""),
            language=row.get("language", "zh"),
            source_format=row.get("source_format", ""),
            source_path=row.get("source_path", ""),
            source_hash=row.get("source_hash", ""),
            word_count=row.get("word_count", 0),
            total_chapters=row.get("total_chapters", 0),
            full_text=row.get("full_text", ""),
            created_at=row["created_at"],
            updated_at=row["updated_at"],
            indexing_status=IndexingStatus(
                row.get("indexing_status", "pending")
            ),
            metadata_json=json.dumps(
                row.get("metadata_json", {})
            ),
        )

    async def list_documents(
        self, offset: int = 0, limit: int = 50
    ) -> List[KnowledgeDocument]:
        rows = await self._fetch(
            "SELECT * FROM documents ORDER BY updated_at DESC "
            "LIMIT $1 OFFSET $2",
            limit, offset,
        )
        return [await self.get_document(r["doc_id"]) for r in rows]

    async def delete_document(self, doc_id: str) -> bool:
        r = await self._execute(
            "DELETE FROM documents WHERE doc_id=$1", doc_id
        )
        return "DELETE 1" in r if r else False

    async def get_document_count(self) -> int:
        row = await self._fetchrow(
            "SELECT COUNT(*) as cnt FROM documents"
        )
        return row["cnt"] if row else 0

    # ─── Chapter CRUD ──────────────────────────────────────────

    async def upsert_chapter(self, chapter: KnowledgeChapter) -> str:
        await self._execute("""
            INSERT INTO chapters
                (chapter_id, doc_id, idx, title, level,
                 content, word_count, start_pos, end_pos)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
            ON CONFLICT (chapter_id) DO NOTHING
        """,
            chapter.chapter_id, chapter.doc_id, chapter.index,
            chapter.title, chapter.level, chapter.content,
            chapter.word_count, chapter.start_pos, chapter.end_pos,
        )
        return chapter.chapter_id

    async def get_chapters_by_doc(
        self, doc_id: str
    ) -> List[KnowledgeChapter]:
        rows = await self._fetch(
            "SELECT * FROM chapters WHERE doc_id=$1 ORDER BY idx",
            doc_id,
        )
        return [
            KnowledgeChapter(
                chapter_id=r["chapter_id"], doc_id=r["doc_id"],
                index=r["idx"], title=r["title"],
                level=r["level"], content=r["content"],
                word_count=r["word_count"],
                start_pos=r["start_pos"], end_pos=r["end_pos"],
            ) for r in rows
        ]

    async def delete_chapters_by_doc(self, doc_id: str) -> int:
        r = await self._execute(
            "DELETE FROM chapters WHERE doc_id=$1", doc_id
        )
        return int(r.split()[-1]) if r else 0

    # ─── Distill Entry CRUD ────────────────────────────────────

    async def upsert_distill_entry(self, entry: DistillEntry) -> str:
        await self._execute("""
            INSERT INTO distill_entries
                (entry_id, doc_id, chapter_id, chapter_index,
                 chapter_title, point, evidence, quote,
                 category, depth)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
            ON CONFLICT (entry_id) DO UPDATE SET
                point=EXCLUDED.point, evidence=EXCLUDED.evidence,
                quote=EXCLUDED.quote, category=EXCLUDED.category,
                depth=EXCLUDED.depth
        """,
            entry.entry_id, entry.doc_id, entry.chapter_id,
            entry.chapter_index, entry.chapter_title,
            entry.point, entry.evidence, entry.quote,
            entry.category, entry.depth,
        )
        return entry.entry_id

    async def get_distill_entries_by_doc(
        self, doc_id: str
    ) -> List[DistillEntry]:
        rows = await self._fetch(
            "SELECT * FROM distill_entries WHERE doc_id=$1 "
            "ORDER BY chapter_index",
            doc_id,
        )
        return [DistillEntry(**dict(r)) for r in rows]

    async def get_distill_entries_by_chapter(
        self, chapter_id: str
    ) -> List[DistillEntry]:
        rows = await self._fetch(
            "SELECT * FROM distill_entries WHERE chapter_id=$1",
            chapter_id,
        )
        return [DistillEntry(**dict(r)) for r in rows]

    async def delete_distill_by_doc(self, doc_id: str) -> int:
        r = await self._execute(
            "DELETE FROM distill_entries WHERE doc_id=$1", doc_id
        )
        return int(r.split()[-1]) if r else 0

    # ─── Embedding CRUD ────────────────────────────────────────

    async def upsert_embedding(self, record: EmbeddingRecord) -> str:
        vec = f"[{','.join(str(x) for x in record.embedding)}]"
        await self._execute("""
            INSERT INTO embeddings
                (id, doc_id, chapter_id, entry_id,
                 content_type, content, embedding, metadata_json)
            VALUES ($1,$2,$3,$4,$5,$6,$7::vector,$8::jsonb)
            ON CONFLICT (id) DO UPDATE SET
                embedding=$7::vector,
                content_type=EXCLUDED.content_type,
                content=EXCLUDED.content,
                metadata_json=EXCLUDED.metadata_json
        """,
            record.id, record.doc_id, record.chapter_id,
            record.entry_id, record.content_type, record.content,
            vec, json.dumps(record.metadata),
        )
        return record.id

    async def get_embeddings_by_doc(
        self, doc_id: str
    ) -> List[EmbeddingRecord]:
        rows = await self._fetch(
            "SELECT * FROM embeddings WHERE doc_id=$1", doc_id
        )
        return [self._row_to_embedding(r) for r in rows]

    async def delete_embeddings_by_doc(self, doc_id: str) -> int:
        r = await self._execute(
            "DELETE FROM embeddings WHERE doc_id=$1", doc_id
        )
        return int(r.split()[-1]) if r else 0

    def _row_to_embedding(self, row) -> EmbeddingRecord:
        return EmbeddingRecord(
            id=row["id"], doc_id=row["doc_id"],
            chapter_id=row.get("chapter_id"),
            entry_id=row.get("entry_id"),
            content_type=row["content_type"],
            content=row["content"],
            embedding=list(row["embedding"]),
            metadata=row.get("metadata_json", {}),
        )

    # ─── Full-text Search (PostgreSQL tsvector) ────────────────

    async def fulltext_search(
        self, query: str, limit: int = 20, offset: int = 0
    ) -> Tuple[List[SearchResult], int]:
        sanitized = " & ".join(
            w for w in query.split() if len(w) > 0
        )
        if not sanitized:
            return [], 0

        rows = await self._fetch("""
            SELECT
                de.entry_id,
                de.doc_id,
                d.title as doc_title,
                de.chapter_title,
                de.point,
                de.evidence,
                de.category,
                ts_rank(
                    to_tsvector('simple', de.point || ' ' || COALESCE(de.evidence, '')),
                    plainto_tsquery('simple', $1)
                ) as rank
            FROM distill_entries de
            JOIN documents d ON d.doc_id = de.doc_id
            WHERE
                to_tsvector('simple', de.point || ' ' || COALESCE(de.evidence, ''))
                @@ plainto_tsquery('simple', $1)
            ORDER BY rank DESC
            LIMIT $2 OFFSET $3
        """, query, limit, offset)

        results = []
        for r in rows:
            results.append(SearchResult(
                score=float(r["rank"]) if r["rank"] else 0.5,
                doc_id=r["doc_id"],
                doc_title=r["doc_title"],
                content_type="distill",
                content=f"{r['point']} | {r['evidence'] or ''}"[:300],
                source="fulltext",
                chapter_title=r["chapter_title"],
                category=r.get("category"),
                highlight=r["point"],
            ))

        total = len(results)
        results.sort(key=lambda x: x.score, reverse=True)
        return results[:limit], total

    # ─── Vector Search (pgvector) ─────────────────────────────

    async def vector_search(
        self, embedding: List[float], limit: int = 20
    ) -> List[SearchResult]:
        vec = f"[{','.join(str(x) for x in embedding)}]"
        rows = await self._fetch("""
            SELECT
                e.id, e.doc_id, e.content_type, e.content,
                e.chapter_id, e.entry_id, e.metadata_json,
                d.title as doc_title,
                1 - (e.embedding <=> $1::vector) as sim
            FROM embeddings e
            JOIN documents d ON d.doc_id = e.doc_id
            ORDER BY e.embedding <=> $1::vector
            LIMIT $2
        """, vec, limit)

        results = []
        for r in rows:
            meta = r["metadata_json"] or {}
            results.append(SearchResult(
                score=float(r["sim"]),
                doc_id=r["doc_id"],
                doc_title=r["doc_title"],
                content_type=r["content_type"],
                content=r["content"][:300],
                source="vector",
                chapter_title=meta.get("chapter_title"),
                chapter_id=r["chapter_id"],
                category=meta.get("category"),
            ))
        return results

    # ─── FTS Index Management ──────────────────────────────────

    async def rebuild_fts_index(
        self, doc_id: Optional[str] = None
    ) -> int:
        if doc_id:
            await self._execute("""
                UPDATE documents SET indexing_status='pending'
                WHERE doc_id=$1
            """, doc_id)
        else:
            await self._execute("""
                UPDATE documents SET indexing_status='pending'
            """)
        return 0

    async def update_indexing_status(
        self, doc_id: str, status: str
    ) -> None:
        await self._execute(
            "UPDATE documents SET indexing_status=$1, updated_at=NOW() "
            "WHERE doc_id=$2",
            status, doc_id,
        )

    # ─── Stats ─────────────────────────────────────────────────

    async def get_stats(self) -> StorageStats:
        doc_count = await self._fetchrow(
            "SELECT COUNT(*) FROM documents"
        )
        indexed = await self._fetchrow(
            "SELECT COUNT(*) FROM documents "
            "WHERE indexing_status='completed'"
        )
        emb_count = await self._fetchrow(
            "SELECT COUNT(*) FROM embeddings"
        )
        return StorageStats(
            backend=StorageBackendType.POSTGRESQL,
            total_documents=doc_count[0] if doc_count else 0,
            total_chapters=0,
            total_distill_entries=0,
            total_embeddings=emb_count[0] if emb_count else 0,
            indexed_documents=indexed[0] if indexed else 0,
            details={"dsn": self.dsn.split("@")[-1] if "@" in self.dsn else self.dsn},
        )

    # ─── Bulk ──────────────────────────────────────────────────

    async def import_package(self, data: dict) -> int:
        count = 0
        for doc_data in data.get("documents", []):
            doc = KnowledgeDocument(**doc_data)
            await self.upsert_document(doc)
            count += 1
        for ch_data in data.get("chapters", []):
            ch = KnowledgeChapter(**ch_data)
            await self.upsert_chapter(ch)
        for de_data in data.get("distill_entries", []):
            de = DistillEntry(**de_data)
            await self.upsert_distill_entry(de)
        for emb_data in data.get("embeddings", []):
            emb = EmbeddingRecord(**emb_data)
            await self.upsert_embedding(emb)
        return count

    async def export_package(
        self, doc_ids: Optional[List[str]] = None
    ) -> dict:
        if doc_ids:
            docs = []
            for did in doc_ids:
                d = await self.get_document(did)
                if d:
                    docs.append(d)
        else:
            docs = await self.list_documents(limit=9999)

        from datetime import datetime
        return {
            "version": "1.0",
            "exported_at": datetime.utcnow().isoformat(),
            "documents": [d.model_dump() for d in docs],
            "chapters": [],
            "distill_entries": [],
            "embeddings": [],
            "metadata": {"doc_count": len(docs)},
        }

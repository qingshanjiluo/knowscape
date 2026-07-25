import json
import math
import os
import sqlite3
import uuid
from datetime import datetime
from typing import Dict, List, Optional, Tuple
from contextlib import asynccontextmanager

from cloud.knowledge.models import (
    KnowledgeDocument, KnowledgeChapter, DistillEntry,
    EmbeddingRecord, SearchResult, StorageStats,
    StorageBackendType, IndexingStatus,
)
from cloud.knowledge.storage.base import StorageBackend


class SQLiteStore(StorageBackend):
    """SQLite storage backend with FTS5 full-text search
    and BLOB-based vector storage (cosine similarity computed in Python).
    """

    def __init__(self, db_path: str, vector_dim: int = 384):
        self.db_path = db_path
        self.vector_dim = vector_dim
        self._pool: Optional[sqlite3.Connection] = None

    async def initialize(self):
        self._pool = sqlite3.connect(self.db_path, check_same_thread=False)
        self._pool.execute("PRAGMA journal_mode=WAL")
        self._pool.execute("PRAGMA synchronous=NORMAL")
        self._pool.execute("PRAGMA foreign_keys=ON")
        self._create_tables()
        self._create_fts_tables()

    async def close(self):
        if self._pool:
            self._pool.close()

    @property
    def conn(self) -> sqlite3.Connection:
        assert self._pool is not None, "Store not initialized"
        return self._pool

    # ─── Schema ────────────────────────────────────────────────

    def _create_tables(self):
        c = self.conn
        c.executescript("""
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
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now')),
            indexing_status TEXT DEFAULT 'pending',
            metadata_json TEXT DEFAULT '{}'
        );

        CREATE TABLE IF NOT EXISTS chapters (
            chapter_id TEXT PRIMARY KEY,
            doc_id TEXT NOT NULL REFERENCES documents(doc_id) ON DELETE CASCADE,
            idx INTEGER NOT NULL,
            title TEXT NOT NULL,
            level INTEGER DEFAULT 1,
            content TEXT DEFAULT '',
            word_count INTEGER DEFAULT 0,
            start_pos INTEGER DEFAULT 0,
            end_pos INTEGER DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS distill_entries (
            entry_id TEXT PRIMARY KEY,
            doc_id TEXT NOT NULL REFERENCES documents(doc_id) ON DELETE CASCADE,
            chapter_id TEXT NOT NULL,
            chapter_index INTEGER NOT NULL,
            chapter_title TEXT DEFAULT '',
            point TEXT NOT NULL,
            evidence TEXT,
            quote TEXT,
            category TEXT,
            depth TEXT DEFAULT 'medium'
        );

        CREATE TABLE IF NOT EXISTS embeddings (
            id TEXT PRIMARY KEY,
            doc_id TEXT NOT NULL REFERENCES documents(doc_id) ON DELETE CASCADE,
            chapter_id TEXT,
            entry_id TEXT,
            content_type TEXT NOT NULL,
            content TEXT NOT NULL,
            embedding TEXT NOT NULL,
            metadata_json TEXT DEFAULT '{}'
        );

        CREATE INDEX IF NOT EXISTS idx_chapters_doc ON chapters(doc_id);
        CREATE INDEX IF NOT EXISTS idx_distill_doc ON distill_entries(doc_id);
        CREATE INDEX IF NOT EXISTS idx_distill_chapter ON distill_entries(chapter_id);
        CREATE INDEX IF NOT EXISTS idx_embeddings_doc ON embeddings(doc_id);
        CREATE INDEX IF NOT EXISTS idx_embeddings_type ON embeddings(content_type);
        CREATE INDEX IF NOT EXISTS idx_docs_status ON documents(indexing_status);
        """)

    def _create_fts_tables(self):
        c = self.conn
        try:
            c.executescript("""
            CREATE VIRTUAL TABLE IF NOT EXISTS fts_documents USING fts5(
                doc_id UNINDEXED, title, full_text,
                content='documents', content_rowid='rowid'
            );

            CREATE VIRTUAL TABLE IF NOT EXISTS fts_chapters USING fts5(
                chapter_id UNINDEXED, doc_id UNINDEXED, title, content,
                content='chapters', content_rowid='rowid'
            );

            CREATE VIRTUAL TABLE IF NOT EXISTS fts_distill USING fts5(
                entry_id UNINDEXED, doc_id UNINDEXED, chapter_title,
                point, evidence, quote,
                content='distill_entries', content_rowid='rowid'
            );
            """)
        except sqlite3.OperationalError:
            pass  # already exists

    # ─── Helpers ────────────────────────────────────────────────

    def _row_to_doc(self, row: sqlite3.Row) -> KnowledgeDocument:
        return KnowledgeDocument(
            doc_id=row["doc_id"], title=row["title"],
            author=row["author"], language=row["language"],
            source_format=row["source_format"],
            source_path=row["source_path"],
            source_hash=row["source_hash"],
            word_count=row["word_count"],
            total_chapters=row["total_chapters"],
            full_text=row["full_text"],
            created_at=datetime.fromisoformat(row["created_at"]),
            updated_at=datetime.fromisoformat(row["updated_at"]),
            indexing_status=IndexingStatus(row["indexing_status"]),
            metadata_json=row["metadata_json"],
        )

    def _row_to_chapter(self, row: sqlite3.Row) -> KnowledgeChapter:
        return KnowledgeChapter(
            chapter_id=row["chapter_id"], doc_id=row["doc_id"],
            index=row["idx"], title=row["title"],
            level=row["level"], content=row["content"],
            word_count=row["word_count"],
            start_pos=row["start_pos"], end_pos=row["end_pos"],
        )

    def _row_to_distill(self, row: sqlite3.Row) -> DistillEntry:
        return DistillEntry(
            entry_id=row["entry_id"], doc_id=row["doc_id"],
            chapter_id=row["chapter_id"],
            chapter_index=row["chapter_index"],
            chapter_title=row["chapter_title"],
            point=row["point"], evidence=row["evidence"],
            quote=row["quote"], category=row["category"],
            depth=row["depth"],
        )

    def _row_to_embedding(self, row: sqlite3.Row) -> EmbeddingRecord:
        return EmbeddingRecord(
            id=row["id"], doc_id=row["doc_id"],
            chapter_id=row["chapter_id"],
            entry_id=row["entry_id"],
            content_type=row["content_type"],
            content=row["content"],
            embedding=json.loads(row["embedding"]),
            metadata=json.loads(row["metadata_json"]),
        )

    # ─── Document CRUD ─────────────────────────────────────────

    async def upsert_document(self, doc: KnowledgeDocument) -> str:
        c = self.conn
        now = datetime.utcnow().isoformat()
        c.execute("""
            INSERT INTO documents
                (doc_id, title, author, language, source_format,
                 source_path, source_hash, word_count, total_chapters,
                 full_text, created_at, updated_at, indexing_status,
                 metadata_json)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
            ON CONFLICT(doc_id) DO UPDATE SET
                title=excluded.title, author=excluded.author,
                language=excluded.language,
                source_format=excluded.source_format,
                source_path=excluded.source_path,
                source_hash=excluded.source_hash,
                word_count=excluded.word_count,
                total_chapters=excluded.total_chapters,
                full_text=excluded.full_text,
                updated_at=excluded.updated_at,
                indexing_status=excluded.indexing_status,
                metadata_json=excluded.metadata_json
        """, (
            doc.doc_id, doc.title, doc.author, doc.language,
            doc.source_format, doc.source_path, doc.source_hash,
            doc.word_count, doc.total_chapters, doc.full_text,
            now, now, doc.indexing_status.value, doc.metadata_json,
        ))
        c.commit()
        return doc.doc_id

    async def get_document(self, doc_id: str) -> Optional[KnowledgeDocument]:
        c = self.conn
        c.row_factory = sqlite3.Row
        row = c.execute(
            "SELECT * FROM documents WHERE doc_id=?", (doc_id,)
        ).fetchone()
        return self._row_to_doc(row) if row else None

    async def list_documents(
        self, offset: int = 0, limit: int = 50
    ) -> List[KnowledgeDocument]:
        c = self.conn
        c.row_factory = sqlite3.Row
        rows = c.execute(
            "SELECT * FROM documents ORDER BY updated_at DESC LIMIT ? OFFSET ?",
            (limit, offset),
        ).fetchall()
        return [self._row_to_doc(r) for r in rows]

    async def delete_document(self, doc_id: str) -> bool:
        c = self.conn
        c.execute("DELETE FROM documents WHERE doc_id=?", (doc_id,))
        deleted = c.execute(
            "SELECT changes()"
        ).fetchone()[0] > 0
        c.commit()
        return deleted

    async def get_document_count(self) -> int:
        row = self.conn.execute(
            "SELECT COUNT(*) as cnt FROM documents"
        ).fetchone()
        return row[0] if row else 0

    # ─── Chapter CRUD ──────────────────────────────────────────

    async def upsert_chapter(self, chapter: KnowledgeChapter) -> str:
        c = self.conn
        c.execute("""
            INSERT INTO chapters
                (chapter_id, doc_id, idx, title, level,
                 content, word_count, start_pos, end_pos)
            VALUES (?,?,?,?,?,?,?,?,?)
            ON CONFLICT(chapter_id) DO UPDATE SET
                title=excluded.title, level=excluded.level,
                content=excluded.content,
                word_count=excluded.word_count,
                start_pos=excluded.start_pos,
                end_pos=excluded.end_pos
        """, (
            chapter.chapter_id, chapter.doc_id, chapter.index,
            chapter.title, chapter.level, chapter.content,
            chapter.word_count, chapter.start_pos, chapter.end_pos,
        ))
        c.commit()
        return chapter.chapter_id

    async def get_chapters_by_doc(
        self, doc_id: str
    ) -> List[KnowledgeChapter]:
        c = self.conn
        c.row_factory = sqlite3.Row
        rows = c.execute(
            "SELECT * FROM chapters WHERE doc_id=? ORDER BY idx",
            (doc_id,),
        ).fetchall()
        return [self._row_to_chapter(r) for r in rows]

    async def delete_chapters_by_doc(self, doc_id: str) -> int:
        c = self.conn
        c.execute("DELETE FROM chapters WHERE doc_id=?", (doc_id,))
        count = c.total_changes
        c.commit()
        return count

    # ─── Distill Entry CRUD ────────────────────────────────────

    async def upsert_distill_entry(self, entry: DistillEntry) -> str:
        c = self.conn
        c.execute("""
            INSERT INTO distill_entries
                (entry_id, doc_id, chapter_id, chapter_index,
                 chapter_title, point, evidence, quote,
                 category, depth)
            VALUES (?,?,?,?,?,?,?,?,?,?)
            ON CONFLICT(entry_id) DO UPDATE SET
                point=excluded.point, evidence=excluded.evidence,
                quote=excluded.quote, category=excluded.category,
                depth=excluded.depth
        """, (
            entry.entry_id, entry.doc_id, entry.chapter_id,
            entry.chapter_index, entry.chapter_title,
            entry.point, entry.evidence, entry.quote,
            entry.category, entry.depth,
        ))
        c.commit()
        return entry.entry_id

    async def get_distill_entries_by_doc(
        self, doc_id: str
    ) -> List[DistillEntry]:
        c = self.conn
        c.row_factory = sqlite3.Row
        rows = c.execute(
            "SELECT * FROM distill_entries WHERE doc_id=? ORDER BY chapter_index",
            (doc_id,),
        ).fetchall()
        return [self._row_to_distill(r) for r in rows]

    async def get_distill_entries_by_chapter(
        self, chapter_id: str
    ) -> List[DistillEntry]:
        c = self.conn
        c.row_factory = sqlite3.Row
        rows = c.execute(
            "SELECT * FROM distill_entries WHERE chapter_id=?",
            (chapter_id,),
        ).fetchall()
        return [self._row_to_distill(r) for r in rows]

    async def delete_distill_by_doc(self, doc_id: str) -> int:
        c = self.conn
        c.execute("DELETE FROM distill_entries WHERE doc_id=?", (doc_id,))
        count = c.total_changes
        c.commit()
        return count

    # ─── Embedding CRUD ────────────────────────────────────────

    async def upsert_embedding(self, record: EmbeddingRecord) -> str:
        c = self.conn
        c.execute("""
            INSERT INTO embeddings
                (id, doc_id, chapter_id, entry_id,
                 content_type, content, embedding, metadata_json)
            VALUES (?,?,?,?,?,?,?,?)
            ON CONFLICT(id) DO UPDATE SET
                embedding=excluded.embedding,
                content_type=excluded.content_type,
                content=excluded.content,
                metadata_json=excluded.metadata_json
        """, (
            record.id, record.doc_id, record.chapter_id,
            record.entry_id, record.content_type, record.content,
            json.dumps(record.embedding),
            json.dumps(record.metadata),
        ))
        c.commit()
        return record.id

    async def get_embeddings_by_doc(
        self, doc_id: str
    ) -> List[EmbeddingRecord]:
        c = self.conn
        c.row_factory = sqlite3.Row
        rows = c.execute(
            "SELECT * FROM embeddings WHERE doc_id=?",
            (doc_id,),
        ).fetchall()
        return [self._row_to_embedding(r) for r in rows]

    async def delete_embeddings_by_doc(self, doc_id: str) -> int:
        c = self.conn
        c.execute("DELETE FROM embeddings WHERE doc_id=?", (doc_id,))
        count = c.total_changes
        c.commit()
        return count

    # ─── Full-text Search (FTS5) ───────────────────────────────

    async def fulltext_search(
        self, query: str, limit: int = 20, offset: int = 0
    ) -> Tuple[List[SearchResult], int]:
        results = []
        sanitized = " ".join(
            w for w in query.split() if len(w) > 0
        )
        if not sanitized:
            return [], 0

        # Search chapters
        c = self.conn
        c.row_factory = sqlite3.Row

        rows = c.execute("""
            SELECT c.chapter_id, c.doc_id, c.title, c.content,
                   d.title as doc_title,
                   rank FROM fts_chapters
            JOIN chapters c ON c.chapter_id = fts_chapters.chapter_id
            JOIN documents d ON d.doc_id = c.doc_id
            WHERE fts_chapters MATCH ?
            ORDER BY rank
            LIMIT ? OFFSET ?
        """, (sanitized, limit, offset)).fetchall()

        for r in rows:
            results.append(SearchResult(
                score=1.0 / (1.0 + abs(r["rank"])) if r["rank"] else 0.5,
                doc_id=r["doc_id"],
                doc_title=r["doc_title"],
                content_type="chapter",
                content=r["content"][:200],
                source="fulltext",
                chapter_title=r["title"],
                chapter_id=r["chapter_id"],
                highlight=r["content"][:150],
            ))

        # Search distill entries
        rows = c.execute("""
            SELECT de.entry_id, de.doc_id, de.chapter_title,
                   de.point, de.evidence, de.quote, de.category,
                   d.title as doc_title,
                   rank FROM fts_distill
            JOIN distill_entries de
                ON de.entry_id = fts_distill.entry_id
            JOIN documents d ON d.doc_id = de.doc_id
            WHERE fts_distill MATCH ?
            ORDER BY rank
            LIMIT ? OFFSET ?
        """, (sanitized, limit, offset)).fetchall()

        for r in rows:
            snippet = r["point"]
            if r["evidence"]:
                snippet += f" | {r['evidence']}"
            results.append(SearchResult(
                score=1.0 / (1.0 + abs(r["rank"])) if r["rank"] else 0.5,
                doc_id=r["doc_id"],
                doc_title=r["doc_title"],
                content_type="distill",
                content=snippet[:300],
                source="fulltext",
                chapter_title=r["chapter_title"],
                category=r.get("category"),
                highlight=f"{r['point']}",
            ))

        total = len(results)
        results.sort(key=lambda r: r.score, reverse=True)
        return results[:limit], total

    # ─── Vector Search ─────────────────────────────────────────

    async def vector_search(
        self, embedding: List[float], limit: int = 20
    ) -> List[SearchResult]:
        c = self.conn
        c.row_factory = sqlite3.Row
        rows = c.execute("""
            SELECT e.id, e.doc_id, e.content_type, e.content,
                   e.embedding, e.chapter_id, e.entry_id,
                   e.metadata_json, d.title as doc_title
            FROM embeddings e
            JOIN documents d ON d.doc_id = e.doc_id
        """).fetchall()

        scored = []
        for r in rows:
            stored = json.loads(r["embedding"])
            sim = self._cosine_similarity(embedding, stored)
            meta = json.loads(r["metadata_json"]) if r["metadata_json"] else {}

            chapter_title = meta.get("chapter_title", "")
            category = meta.get("category", "")

            if r["content_type"] == "distill_point" and r["entry_id"]:
                de = c.execute(
                    "SELECT point, evidence FROM distill_entries "
                    "WHERE entry_id=?",
                    (r["entry_id"],),
                ).fetchone()
                content = de[0] if de else r["content"]
                if de and de[1]:
                    content += f" | {de[1]}"
            else:
                content = r["content"]

            scored.append(SearchResult(
                score=sim,
                doc_id=r["doc_id"],
                doc_title=r["doc_title"],
                content_type=r["content_type"],
                content=content[:300],
                source="vector",
                chapter_title=chapter_title or None,
                chapter_id=r["chapter_id"],
                category=category or None,
            ))

        scored.sort(key=lambda r: r.score, reverse=True)
        return scored[:limit]

    # ─── FTS Index Management ──────────────────────────────────

    async def rebuild_fts_index(
        self, doc_id: Optional[str] = None
    ) -> int:
        c = self.conn
        count = 0

        if doc_id:
            c.execute(
                "INSERT INTO fts_chapters(fts_chapters) VALUES('rebuild')"
            )
            c.execute(
                "INSERT INTO fts_documents(fts_documents) VALUES('rebuild')"
            )
            c.execute(
                "INSERT INTO fts_distill(fts_distill) VALUES('rebuild')"
            )
        else:
            c.execute(
                "INSERT INTO fts_chapters(fts_chapters) VALUES('rebuild')"
            )
            c.execute(
                "INSERT INTO fts_documents(fts_documents) VALUES('rebuild')"
            )
            c.execute(
                "INSERT INTO fts_distill(fts_distill) VALUES('rebuild')"
            )
        c.commit()
        return count

    async def update_indexing_status(
        self, doc_id: str, status: str
    ) -> None:
        now = datetime.utcnow().isoformat()
        self.conn.execute(
            "UPDATE documents SET indexing_status=?, updated_at=? "
            "WHERE doc_id=?",
            (status, now, doc_id),
        )
        self.conn.commit()

    # ─── Stats ─────────────────────────────────────────────────

    async def get_stats(self) -> StorageStats:
        c = self.conn
        doc_count = c.execute(
            "SELECT COUNT(*) FROM documents"
        ).fetchone()[0]
        ch_count = c.execute(
            "SELECT COUNT(*) FROM chapters"
        ).fetchone()[0]
        de_count = c.execute(
            "SELECT COUNT(*) FROM distill_entries"
        ).fetchone()[0]
        emb_count = c.execute(
            "SELECT COUNT(*) FROM embeddings"
        ).fetchone()[0]
        indexed = c.execute(
            "SELECT COUNT(*) FROM documents WHERE indexing_status='completed'"
        ).fetchone()[0]

        size = os.path.getsize(self.db_path) if os.path.exists(self.db_path) else 0

        return StorageStats(
            backend=StorageBackendType.SQLITE,
            total_documents=doc_count,
            total_chapters=ch_count,
            total_distill_entries=de_count,
            total_embeddings=emb_count,
            indexed_documents=indexed,
            db_size_bytes=size,
            details={"db_path": self.db_path},
        )

    # ─── Bulk / Import-Export ──────────────────────────────────

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

        self.conn.commit()
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

        chapters = []
        entries = []
        embeddings = []
        for d in docs:
            chapters.extend(await self.get_chapters_by_doc(d.doc_id))
            entries.extend(
                await self.get_distill_entries_by_doc(d.doc_id)
            )
            embeddings.extend(
                await self.get_embeddings_by_doc(d.doc_id)
            )

        return {
            "version": "1.0",
            "exported_at": datetime.utcnow().isoformat(),
            "documents": [d.model_dump() for d in docs],
            "chapters": [c.model_dump() for c in chapters],
            "distill_entries": [e.model_dump() for e in entries],
            "embeddings": [
                {**e.model_dump(),
                 "embedding": e.embedding[:3] + ["..."]
                 if len(e.embedding) > 3 else e.embedding}
                for e in embeddings
            ],
            "metadata": {
                "doc_count": len(docs),
                "ch_count": len(chapters),
                "entry_count": len(entries),
                "emb_count": len(embeddings),
            },
        }

    # ─── Utility ────────────────────────────────────────────────

    @staticmethod
    def _cosine_similarity(a: List[float], b: List[float]) -> float:
        if not a or not b:
            return 0.0
        dot = sum(x * y for x, y in zip(a, b))
        na = math.sqrt(sum(x * x for x in a))
        nb = math.sqrt(sum(x * x for x in b))
        if na == 0 or nb == 0:
            return 0.0
        return dot / (na * nb)

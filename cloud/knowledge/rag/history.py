from __future__ import annotations

import json
import uuid
from datetime import datetime
from typing import List, Optional

from cloud.knowledge.rag.models import (
    ChatMessageRecord,
    ChatSessionRecord,
    CitationRecord,
)
from cloud.knowledge.storage.sqlite_store import SQLiteStore


class ConversationStore:
    """Persists chat sessions and messages in the same SQLite knowledge DB."""

    def __init__(self, store: SQLiteStore):
        self.store = store
        self._ensure_tables()

    def _ensure_tables(self) -> None:
        conn = self.store.conn
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS chat_sessions (
                id TEXT PRIMARY KEY,
                book_id TEXT NOT NULL,
                title TEXT DEFAULT '新对话',
                message_count INTEGER DEFAULT 0,
                last_message_at TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS chat_messages (
                id TEXT PRIMARY KEY,
                session_id TEXT NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
                role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
                content TEXT NOT NULL,
                citations_json TEXT DEFAULT '[]',
                suggestions_json TEXT DEFAULT '[]',
                related_points TEXT DEFAULT '[]',
                tokens_used INTEGER DEFAULT 0,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS citations (
                id TEXT PRIMARY KEY,
                book_id TEXT NOT NULL,
                chapter_id TEXT NOT NULL,
                ref_tag TEXT NOT NULL,
                title TEXT,
                content TEXT NOT NULL,
                start_pos INTEGER,
                end_pos INTEGER,
                source_type TEXT DEFAULT 'original',
                created_at TEXT NOT NULL,
                UNIQUE(book_id, ref_tag)
            );

            CREATE INDEX IF NOT EXISTS idx_sessions_book ON chat_sessions(book_id);
            CREATE INDEX IF NOT EXISTS idx_messages_session ON chat_messages(session_id);
            CREATE INDEX IF NOT EXISTS idx_messages_time ON chat_messages(created_at);
            CREATE INDEX IF NOT EXISTS idx_citations_book ON citations(book_id);
            CREATE INDEX IF NOT EXISTS idx_citations_chapter ON citations(chapter_id);
            """
        )
        conn.commit()

    async def ensure_session(
        self, session_id: str, book_id: str, title: Optional[str] = None
    ) -> ChatSessionRecord:
        conn = self.store.conn
        conn.row_factory = None
        now = datetime.utcnow().isoformat()
        existing = conn.execute(
            "SELECT id, book_id, title, message_count, last_message_at, created_at, updated_at "
            "FROM chat_sessions WHERE id=?",
            (session_id,),
        ).fetchone()
        if existing:
            return ChatSessionRecord(
                id=existing[0],
                book_id=existing[1],
                title=existing[2],
                message_count=existing[3],
                last_message_at=existing[4],
                created_at=existing[5],
                updated_at=existing[6],
            )

        session = ChatSessionRecord(
            id=session_id,
            book_id=book_id,
            title=title or "新对话",
            created_at=now,
            updated_at=now,
        )
        conn.execute(
            """
            INSERT INTO chat_sessions(id, book_id, title, message_count, last_message_at, created_at, updated_at)
            VALUES (?, ?, ?, 0, NULL, ?, ?)
            """,
            (session.id, session.book_id, session.title, session.created_at, session.updated_at),
        )
        conn.commit()
        return session

    async def append_message(
        self,
        session_id: str,
        role: str,
        content: str,
        citations: Optional[List[CitationRecord]] = None,
        suggestions: Optional[List[str]] = None,
        related_points: Optional[List[str]] = None,
    ) -> ChatMessageRecord:
        now = datetime.utcnow().isoformat()
        message = ChatMessageRecord(
            id=str(uuid.uuid4()),
            role=role,
            content=content,
            citations=citations or [],
            suggestions=suggestions or [],
            timestamp=now,
            metadata={"related_points": related_points or []},
        )

        conn = self.store.conn
        conn.execute(
            """
            INSERT INTO chat_messages(
                id, session_id, role, content, citations_json, suggestions_json, related_points, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                message.id,
                session_id,
                message.role,
                message.content,
                json.dumps([c.model_dump() for c in message.citations], ensure_ascii=False),
                json.dumps(message.suggestions, ensure_ascii=False),
                json.dumps(message.metadata["related_points"], ensure_ascii=False),
                message.timestamp,
            ),
        )
        conn.execute(
            """
            UPDATE chat_sessions
            SET message_count = message_count + 1, last_message_at=?, updated_at=?
            WHERE id=?
            """,
            (message.timestamp, message.timestamp, session_id),
        )
        conn.commit()
        return message

    async def store_citations(
        self, book_id: str, citations: List[CitationRecord]
    ) -> None:
        conn = self.store.conn
        now = datetime.utcnow().isoformat()
        for citation in citations:
            conn.execute(
                """
                INSERT INTO citations(
                    id, book_id, chapter_id, ref_tag, title, content,
                    start_pos, end_pos, source_type, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(book_id, ref_tag) DO UPDATE SET
                    title=excluded.title,
                    content=excluded.content,
                    start_pos=excluded.start_pos,
                    end_pos=excluded.end_pos,
                    source_type=excluded.source_type,
                    created_at=excluded.created_at
                """,
                (
                    citation.id,
                    book_id,
                    citation.chapter_id or "",
                    f"[引{citation.id}]",
                    citation.chapter_title or "",
                    citation.text,
                    citation.position.get("start", 0),
                    citation.position.get("end", 0),
                    citation.source_type,
                    now,
                ),
            )
        conn.commit()

    async def get_session_messages(self, session_id: str) -> List[ChatMessageRecord]:
        conn = self.store.conn
        rows = conn.execute(
            """
            SELECT id, role, content, citations_json, suggestions_json, created_at
            FROM chat_messages
            WHERE session_id=?
            ORDER BY created_at ASC
            """,
            (session_id,),
        ).fetchall()

        messages: List[ChatMessageRecord] = []
        for row in rows:
            citations = [
                CitationRecord(**item)
                for item in json.loads(row[3] or "[]")
            ]
            suggestions = json.loads(row[4] or "[]")
            messages.append(
                ChatMessageRecord(
                    id=row[0],
                    role=row[1],
                    content=row[2],
                    citations=citations,
                    suggestions=suggestions,
                    timestamp=row[5],
                )
            )
        return messages

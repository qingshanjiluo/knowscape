from __future__ import annotations

from typing import Optional

from cloud.knowledge.rag.generator import AnswerGenerator
from cloud.knowledge.rag.history import ConversationStore
from cloud.knowledge.rag.models import AnswerPayload
from cloud.knowledge.rag.retriever import DualSourceRetriever
from cloud.knowledge.storage.sqlite_store import SQLiteStore


class RAGChatService:
    def __init__(
        self,
        store: SQLiteStore,
        history_store: Optional[ConversationStore] = None,
        retriever: Optional[DualSourceRetriever] = None,
        generator: Optional[AnswerGenerator] = None,
    ):
        self.store = store
        self.history_store = history_store or ConversationStore(store)
        self.retriever = retriever or DualSourceRetriever(store)
        self.generator = generator or AnswerGenerator()

    async def ask(
        self,
        book_id: str,
        question: str,
        session_id: str,
    ) -> AnswerPayload:
        existing_history = await self.history_store.get_session_messages(session_id)
        title = self._make_session_title(existing_history, question)
        await self.history_store.ensure_session(session_id, book_id, title=title)
        await self.history_store.append_message(
            session_id=session_id,
            role="user",
            content=question,
        )

        bundle = await self.retriever.retrieve(
            doc_id=book_id,
            question=question,
            history=existing_history,
        )
        payload = self.generator.generate(bundle)
        await self.history_store.store_citations(book_id, payload.citations)
        await self.history_store.append_message(
            session_id=session_id,
            role="assistant",
            content=payload.answer,
            citations=payload.citations,
            suggestions=payload.suggestions,
            related_points=[item.id for item in payload.contexts],
        )
        return payload

    @staticmethod
    def _make_session_title(existing_history, question: str) -> str:
        if existing_history:
            return "继续追问"
        trimmed = question.strip().replace("\n", " ")
        return trimmed[:18] if trimmed else "新对话"

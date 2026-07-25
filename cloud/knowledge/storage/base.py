import abc
from typing import Dict, List, Optional, Tuple
from cloud.knowledge.models import (
    KnowledgeDocument, KnowledgeChapter, DistillEntry,
    EmbeddingRecord, SearchResult, StorageStats,
)


class StorageBackend(abc.ABC):
    @abc.abstractmethod
    async def initialize(self):
        ...

    @abc.abstractmethod
    async def close(self):
        ...

    # ─── Document CRUD ───

    @abc.abstractmethod
    async def upsert_document(self, doc: KnowledgeDocument) -> str:
        ...

    @abc.abstractmethod
    async def get_document(self, doc_id: str) -> Optional[KnowledgeDocument]:
        ...

    @abc.abstractmethod
    async def list_documents(self, offset: int = 0, limit: int = 50) -> List[KnowledgeDocument]:
        ...

    @abc.abstractmethod
    async def delete_document(self, doc_id: str) -> bool:
        ...

    @abc.abstractmethod
    async def get_document_count(self) -> int:
        ...

    # ─── Chapter CRUD ───

    @abc.abstractmethod
    async def upsert_chapter(self, chapter: KnowledgeChapter) -> str:
        ...

    @abc.abstractmethod
    async def get_chapters_by_doc(self, doc_id: str) -> List[KnowledgeChapter]:
        ...

    @abc.abstractmethod
    async def delete_chapters_by_doc(self, doc_id: str) -> int:
        ...

    # ─── Distill Entry CRUD ───

    @abc.abstractmethod
    async def upsert_distill_entry(self, entry: DistillEntry) -> str:
        ...

    @abc.abstractmethod
    async def get_distill_entries_by_doc(self, doc_id: str) -> List[DistillEntry]:
        ...

    @abc.abstractmethod
    async def get_distill_entries_by_chapter(self, chapter_id: str) -> List[DistillEntry]:
        ...

    @abc.abstractmethod
    async def delete_distill_by_doc(self, doc_id: str) -> int:
        ...

    # ─── Embedding CRUD ───

    @abc.abstractmethod
    async def upsert_embedding(self, record: EmbeddingRecord) -> str:
        ...

    @abc.abstractmethod
    async def get_embeddings_by_doc(self, doc_id: str) -> List[EmbeddingRecord]:
        ...

    @abc.abstractmethod
    async def delete_embeddings_by_doc(self, doc_id: str) -> int:
        ...

    # ─── Full-text Search ───

    @abc.abstractmethod
    async def fulltext_search(
        self, query: str, limit: int = 20, offset: int = 0
    ) -> Tuple[List[SearchResult], int]:
        ...

    # ─── Vector Search ───

    @abc.abstractmethod
    async def vector_search(
        self, embedding: List[float], limit: int = 20
    ) -> List[SearchResult]:
        ...

    # ─── FTS Index Management ───

    @abc.abstractmethod
    async def rebuild_fts_index(self, doc_id: Optional[str] = None) -> int:
        ...

    @abc.abstractmethod
    async def update_indexing_status(
        self, doc_id: str, status: str
    ) -> None:
        ...

    # ─── Stats ───

    @abc.abstractmethod
    async def get_stats(self) -> StorageStats:
        ...

    # ─── Bulk Operations ───

    @abc.abstractmethod
    async def import_package(self, data: dict) -> int:
        ...

    @abc.abstractmethod
    async def export_package(
        self, doc_ids: Optional[List[str]] = None
    ) -> dict:
        ...

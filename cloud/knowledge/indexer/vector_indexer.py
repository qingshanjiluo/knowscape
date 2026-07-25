import json
import logging
import uuid
from typing import Any, Dict, List, Optional, Tuple
from cloud.knowledge.models import (
    KnowledgeDocument, KnowledgeChapter, DistillEntry,
    EmbeddingRecord, IndexConfig,
)
from cloud.knowledge.storage.base import StorageBackend

logger = logging.getLogger("knowscape.vector_indexer")


class EmbeddingProvider:
    """Generate embeddings using sentence-transformers or a fallback."""

    def __init__(self, model_name: str = "all-MiniLM-L6-v2"):
        self.model_name = model_name
        self._model = None

    def _lazy_load(self):
        if self._model is None:
            try:
                from sentence_transformers import SentenceTransformer
                self._model = SentenceTransformer(self.model_name)
                logger.info("Loaded embedding model: %s (dim=%d)",
                             self.model_name,
                             self._model.get_sentence_embedding_dimension())
            except ImportError:
                logger.warning(
                    "sentence-transformers not installed; "
                    "using random fallback embeddings"
                )
                self._model = None

    def encode(self, texts: List[str]) -> List[List[float]]:
        self._lazy_load()
        if self._model:
            return self._model.encode(texts, show_progress_bar=False).tolist()
        return self._random_embedding(len(texts))

    def encode_one(self, text: str) -> List[float]:
        return self.encode([text])[0]

    @property
    def dimension(self) -> int:
        self._lazy_load()
        if self._model:
            return self._model.get_sentence_embedding_dimension()
        return 384

    @staticmethod
    def _random_embedding(count: int, dim: int = 384) -> List[List[float]]:
        import random
        return [
            [random.uniform(-0.1, 0.1) for _ in range(dim)]
            for _ in range(count)
        ]


class VectorIndexer:
    """Build vector embeddings for documents, chapters, and distill entries."""

    def __init__(
        self,
        store: StorageBackend,
        config: Optional[IndexConfig] = None,
        provider: Optional[EmbeddingProvider] = None,
    ):
        self.store = store
        self.config = config or IndexConfig()
        self.provider = provider or EmbeddingProvider()

    async def index_document(
        self, doc: KnowledgeDocument
    ) -> int:
        """Generate and store all embeddings for a document."""
        if not self.config.enable_vector:
            logger.info("Vector indexing disabled")
            return 0

        logger.info("Vector indexing document: %s", doc.title)

        # Delete existing embeddings for this doc
        await self.store.delete_embeddings_by_doc(doc.doc_id)

        total = 0
        batches = self._prepare_chunks(doc)
        texts = [b["content"] for b in batches]

        if not texts:
            logger.warning("No content to embed for %s", doc.doc_id)
            return 0

        logger.info("Generating %d embeddings for %s", len(texts), doc.title)
        embeddings = self.provider.encode(texts)

        for batch, emb in zip(batches, embeddings):
            record = EmbeddingRecord(
                id=batch["id"],
                doc_id=doc.doc_id,
                chapter_id=batch.get("chapter_id"),
                entry_id=batch.get("entry_id"),
                content_type=batch["content_type"],
                content=batch["content"],
                embedding=emb,
                metadata=batch.get("metadata", {}),
            )
            await self.store.upsert_embedding(record)
            total += 1

        logger.info("Vector index complete: %d embeddings for %s",
                     total, doc.title)
        return total

    def _prepare_chunks(
        self, doc: KnowledgeDocument
    ) -> List[Dict[str, Any]]:
        """Break document into embeddable chunks."""
        batches = []
        cfg = self.config
        chunk_size = cfg.chunk_size
        overlap = cfg.chunk_overlap

        # 1. Full-text chunks
        full = doc.full_text or doc.title
        chunks = self._chunk_text(full, chunk_size, overlap)
        for i, chunk in enumerate(chunks):
            batches.append({
                "id": f"{doc.doc_id}_full_{i}",
                "content_type": "full_text",
                "content": chunk,
                "metadata": {
                    "chunk_index": i,
                    "total_chunks": len(chunks),
                    "doc_title": doc.title,
                },
            })

        return batches

    async def index_chapters(
        self, chapters: List[KnowledgeChapter]
    ) -> int:
        """Index chapters for vector search."""
        if not chapters:
            return 0

        texts = [c.content or c.title for c in chapters]
        embeddings = self.provider.encode(texts)
        total = 0

        for ch, emb in zip(chapters, embeddings):
            record = EmbeddingRecord(
                id=f"{ch.chapter_id}_vec",
                doc_id=ch.doc_id,
                chapter_id=ch.chapter_id,
                content_type="chapter",
                content=ch.content[:self.config.chunk_size],
                embedding=emb,
                metadata={
                    "chapter_title": ch.title,
                    "chapter_index": ch.index,
                    "doc_id": ch.doc_id,
                },
            )
            await self.store.upsert_embedding(record)
            total += 1

        return total

    async def index_distill_entries(
        self, entries: List[DistillEntry]
    ) -> int:
        """Index distill entries for vector search."""
        if not entries:
            return 0

        texts = []
        for e in entries:
            part = e.point
            if e.evidence:
                part += f" {e.evidence}"
            if e.quote:
                part += f" {e.quote}"
            texts.append(part)

        embeddings = self.provider.encode(texts)
        total = 0

        for e, emb in zip(entries, embeddings):
            record = EmbeddingRecord(
                id=f"{e.entry_id}_vec",
                doc_id=e.doc_id,
                chapter_id=e.chapter_id,
                entry_id=e.entry_id,
                content_type="distill_point",
                content=e.point[:self.config.chunk_size],
                embedding=emb,
                metadata={
                    "chapter_title": e.chapter_title,
                    "chapter_index": e.chapter_index,
                    "category": e.category,
                    "depth": e.depth,
                },
            )
            await self.store.upsert_embedding(record)
            total += 1

        return total

    @staticmethod
    def _chunk_text(text: str, chunk_size: int, overlap: int) -> List[str]:
        """Split text into overlapping chunks."""
        if not text:
            return [""]
        if len(text) <= chunk_size:
            return [text]

        chunks = []
        start = 0
        while start < len(text):
            end = min(start + chunk_size, len(text))
            chunks.append(text[start:end])

            step = chunk_size - overlap
            if step <= 0:
                step = chunk_size // 2
            start += step

        return chunks

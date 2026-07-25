import logging
import re
from typing import List, Optional
from cloud.knowledge.models import (
    KnowledgeDocument, KnowledgeChapter, DistillEntry, IndexConfig,
)
from cloud.knowledge.storage.base import StorageBackend

logger = logging.getLogger("knowscape.text_indexer")


class TextIndexer:
    """Build and maintain FTS (full-text search) indexes."""

    def __init__(self, store: StorageBackend, config: Optional[IndexConfig] = None):
        self.store = store
        self.config = config or IndexConfig()

    async def index_document(self, doc: KnowledgeDocument) -> int:
        """Index a document and all its chapters/distill entries for FTS."""
        if not self.config.enable_fts:
            logger.info("FTS indexing disabled, skipping")
            return 0

        logger.info("Indexing document for FTS: %s (%d chars)",
                     doc.title, len(doc.full_text))

        await self.store.update_indexing_status(doc.doc_id, "indexing")

        try:
            chapters = await self.store.get_chapters_by_doc(doc.doc_id)
            entries = await self.store.get_distill_entries_by_doc(doc.doc_id)

            await self.store.rebuild_fts_index(doc.doc_id)
            await self.store.update_indexing_status(doc.doc_id, "completed")

            total = len(chapters) + len(entries)
            logger.info("FTS index complete for %s: %d items", doc.title, total)
            return total

        except Exception as e:
            logger.error("FTS indexing failed for %s: %s", doc.doc_id, e)
            await self.store.update_indexing_status(doc.doc_id, "failed")
            raise

    @staticmethod
    def extract_search_snippets(
        text: str, query: str, context_chars: int = 100
    ) -> List[str]:
        """Extract relevant snippets around query matches."""
        snippets = []
        pattern = re.compile(re.escape(query), re.IGNORECASE)

        for match in pattern.finditer(text):
            start = max(0, match.start() - context_chars)
            end = min(len(text), match.end() + context_chars)

            snippet = text[start:end]
            if start > 0:
                snippet = "..." + snippet
            if end < len(text):
                snippet = snippet + "..."

            snippets.append(snippet)

            if len(snippets) >= 3:
                break

        return snippets

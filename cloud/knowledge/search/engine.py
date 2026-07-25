import logging
from typing import Dict, List, Optional, Tuple
from cloud.knowledge.models import (
    KnowledgeDocument, SearchResult, IndexConfig,
)
from cloud.knowledge.storage.base import StorageBackend
from cloud.knowledge.indexer.vector_indexer import EmbeddingProvider

logger = logging.getLogger("knowscape.search")


class SearchEngine:
    """Unified search: vector + full-text + hybrid retrieval."""

    def __init__(
        self,
        store: StorageBackend,
        config: Optional[IndexConfig] = None,
        embedding_provider: Optional[EmbeddingProvider] = None,
    ):
        self.store = store
        self.config = config or IndexConfig()
        self.embedder = embedding_provider or EmbeddingProvider()

    async def search(
        self,
        query: str,
        mode: str = "hybrid",
        limit: int = 20,
        offset: int = 0,
        doc_id: Optional[str] = None,
        content_type: Optional[str] = None,
        category: Optional[str] = None,
    ) -> Dict:
        """
        Unified search entry point.

        Args:
            query: search query string
            mode: 'fulltext', 'vector', or 'hybrid'
            limit: max results
            offset: pagination offset
            doc_id: filter by document
            content_type: filter by type (chapter, distill, full_text)
            category: filter by category

        Returns:
            {"results": List[SearchResult], "total": int, "mode": str}
        """
        results = []
        total = 0

        if mode in ("fulltext", "hybrid"):
            ft_results, ft_total = await self.store.fulltext_search(
                query, limit, offset
            )
            results.extend(ft_results)
            total = max(total, ft_total)

        if mode in ("vector", "hybrid"):
            query_emb = self.embedder.encode_one(query)
            vec_results = await self.store.vector_search(
                query_emb, limit
            )
            results.extend(vec_results)
            total = max(total, len(vec_results))

        # Merge and deduplicate for hybrid
        if mode == "hybrid":
            results = self._merge_hybrid(results, limit)
        else:
            results = results[:limit]

        # Apply filters
        if doc_id:
            results = [r for r in results if r.doc_id == doc_id]
        if content_type:
            results = [r for r in results if r.content_type == content_type]
        if category:
            results = [r for r in results if r.category == category]

        return {
            "results": results,
            "total": len(results),
            "mode": mode,
            "query": query,
        }

    async def search_by_document(
        self, doc_id: str, query: str, limit: int = 20
    ) -> Dict:
        """Search within a specific document."""
        return await self.search(
            query=query, mode="hybrid", limit=limit, doc_id=doc_id
        )

    async def search_distill(
        self, query: str, limit: int = 20
    ) -> Dict:
        """Search only distill entries."""
        return await self.search(
            query=query, mode="hybrid", limit=limit,
            content_type="distill_point",
        )

    async def find_similar(
        self,
        text: str,
        limit: int = 10,
        doc_id: Optional[str] = None,
    ) -> List[SearchResult]:
        """Find semantically similar content."""
        query_emb = self.embedder.encode_one(text)
        results = await self.store.vector_search(query_emb, limit)
        if doc_id:
            results = [r for r in results if r.doc_id == doc_id]
        return results

    async def search_across_documents(
        self, query: str, limit: int = 50
    ) -> Dict:
        """Search across all documents, grouped by document."""
        raw = await self.search(query=query, mode="hybrid", limit=limit)

        grouped: Dict[str, dict] = {}
        for r in raw["results"]:
            if r.doc_id not in grouped:
                grouped[r.doc_id] = {
                    "doc_id": r.doc_id,
                    "doc_title": r.doc_title,
                    "results": [],
                    "max_score": 0.0,
                }
            grouped[r.doc_id]["results"].append(r)
            grouped[r.doc_id]["max_score"] = max(
                grouped[r.doc_id]["max_score"], r.score
            )

        docs = sorted(
            grouped.values(),
            key=lambda x: x["max_score"],
            reverse=True,
        )

        return {
            "total_documents": len(docs),
            "total_results": len(raw["results"]),
            "documents": docs,
            "query": query,
        }

    @staticmethod
    def _merge_hybrid(
        results: List[SearchResult], limit: int
    ) -> List[SearchResult]:
        """Deduplicate and re-rank hybrid results using RRF."""
        seen = set()
        deduped = []

        for r in results:
            key = f"{r.doc_id}:{r.content_type}:{r.content[:50]}"
            if key not in seen:
                seen.add(key)
                deduped.append(r)

        deduped.sort(key=lambda r: r.score, reverse=True)
        return deduped[:limit]

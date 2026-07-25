import json
import logging
import os
import shutil
import tempfile
import zipfile
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

from cloud.knowledge.models import KnowledgePackage, IndexConfig
from cloud.knowledge.storage.base import StorageBackend

logger = logging.getLogger("knowscape.package_io")

EXPORT_DIR_LAYOUT = [
    "documents/",
    "documents/{doc_id}/",
    "documents/{doc_id}/全书概览.md",
    "documents/{doc_id}/全书框架.md",
    "documents/{doc_id}/内容类型索引.md",
    "documents/{doc_id}/章节蒸馏/",
    "documents/{doc_id}/章节蒸馏/第{index}章_核心.md",
    "documents/{doc_id}/深度文档/",
    "documents/{doc_id}/原文引用/",
    "documents/{doc_id}/原文引用/原文片段索引.md",
    "metadata/",
    "metadata/{doc_id}.json",
]


class KnowledgePackageIO:
    """Import/export knowledge packages as JSON archives."""

    def __init__(self, store: Optional[StorageBackend] = None):
        self.store = store

    async def export_to_json(
        self,
        output_path: str,
        doc_ids: Optional[List[str]] = None,
        include_embeddings: bool = True,
    ) -> str:
        """Export knowledge base to a JSON file."""
        if not self.store:
            raise RuntimeError("Storage backend not configured")

        data = await self.store.export_package(doc_ids)
        if not include_embeddings:
            data["embeddings"] = []

        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

        logger.info("Exported %d docs to %s", len(data["documents"]), output_path)
        return output_path

    async def import_from_json(self, input_path: str) -> int:
        """Import knowledge base from a JSON file."""
        if not self.store:
            raise RuntimeError("Storage backend not configured")

        with open(input_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        count = await self.store.import_package(data)
        logger.info("Imported %d documents from %s", count, input_path)
        return count

    async def export_to_zip(
        self,
        output_path: str,
        distill_root: Optional[str] = None,
    ) -> str:
        """Export to a ZIP file with directory layout matching distill output."""
        if self.store:
            data = await self.store.export_package()
        else:
            data = {"documents": [], "chapters": [],
                    "distill_entries": [], "embeddings": []}

        with zipfile.ZipFile(output_path, "w", zipfile.ZIP_DEFLATED) as zf:
            # Write metadata JSON
            meta_content = json.dumps(data, ensure_ascii=False, indent=2)
            zf.writestr("metadata/export.json", meta_content)

            # Include distill directory if provided
            if distill_root and os.path.exists(distill_root):
                dist_path = Path(distill_root)
                for fpath in dist_path.rglob("*"):
                    if fpath.is_file():
                        arcname = f"distill/{fpath.relative_to(distill_root)}"
                        zf.write(str(fpath), arcname)

            # Write per-doc metadata
            for doc in data.get("documents", []):
                meta = {
                    "title": doc.title if hasattr(doc, "title") else doc.get("title"),
                    "author": doc.author if hasattr(doc, "author") else doc.get("author", ""),
                    "total_chapters": doc.total_chapters if hasattr(doc, "total_chapters") else doc.get("total_chapters", 0),
                    "word_count": doc.word_count if hasattr(doc, "word_count") else doc.get("word_count", 0),
                    "indexing_status": doc.indexing_status.value if hasattr(doc, "indexing_status") and hasattr(doc.indexing_status, "value") else doc.get("indexing_status", "unknown"),
                    "created_at": str(doc.created_at) if hasattr(doc, "created_at") else doc.get("created_at", ""),
                }
                doc_id = doc.doc_id if hasattr(doc, "doc_id") else doc.get("doc_id", "unknown")
                zf.writestr(f"metadata/{doc_id}.json",
                            json.dumps(meta, ensure_ascii=False, indent=2))

        logger.info("ZIP export complete: %s", output_path)
        return output_path

    async def import_from_zip(self, input_path: str) -> int:
        """Import from ZIP archive."""
        if not self.store:
            raise RuntimeError("Storage backend not configured")

        count = 0
        with zipfile.ZipFile(input_path, "r") as zf:
            if "metadata/export.json" in zf.namelist():
                data = json.loads(zf.read("metadata/export.json"))
                count = await self.store.import_package(data)

        logger.info("Imported from ZIP: %s (%d docs)", input_path, count)
        return count

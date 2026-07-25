from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple
from pydantic import BaseModel, Field


class IndexingStatus(str, Enum):
    PENDING = "pending"
    INDEXING = "indexing"
    COMPLETED = "completed"
    FAILED = "failed"


class StorageBackendType(str, Enum):
    SQLITE = "sqlite"
    POSTGRESQL = "postgresql"


class IndexConfig(BaseModel):
    enable_fts: bool = Field(True, description="Enable full-text search index")
    enable_vector: bool = Field(True, description="Enable vector index")
    vector_dimension: int = Field(384, description="Embedding dimension")
    chunk_size: int = Field(512, description="Max chars per chunk for embedding")
    chunk_overlap: int = Field(64, description="Overlap between adjacent chunks")


class KnowledgeDocument(BaseModel):
    """Top-level document (a book)."""
    doc_id: str
    title: str
    author: str = ""
    language: str = "zh"
    source_format: str = ""
    source_path: str = ""
    source_hash: str = ""
    word_count: int = 0
    total_chapters: int = 0
    full_text: str = ""
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    indexing_status: IndexingStatus = IndexingStatus.PENDING
    metadata_json: str = "{}"


class KnowledgeChapter(BaseModel):
    """A single chapter inside a document."""
    chapter_id: str
    doc_id: str
    index: int
    title: str
    level: int = 1
    content: str
    word_count: int = 0
    start_pos: int = 0
    end_pos: int = 0


class DistillEntry(BaseModel):
    """Distilled knowledge point from a chapter."""
    entry_id: str
    doc_id: str
    chapter_id: str
    chapter_index: int
    chapter_title: str
    point: str
    evidence: Optional[str] = None
    quote: Optional[str] = None
    category: Optional[str] = None
    depth: str = "medium"
    embedding: Optional[List[float]] = None


class EmbeddingRecord(BaseModel):
    """Raw embedding record for vector search."""
    id: str
    doc_id: str
    chapter_id: Optional[str] = None
    entry_id: Optional[str] = None
    content_type: str  # "full_text", "chapter", "distill_point"
    content: str
    embedding: List[float]
    metadata: Dict[str, Any] = Field(default_factory=dict)


class SearchResult(BaseModel):
    """Single search hit."""
    score: float
    doc_id: str
    doc_title: str
    content_type: str
    content: str
    source: str  # "vector", "fulltext", "hybrid"
    chapter_title: Optional[str] = None
    chapter_id: Optional[str] = None
    category: Optional[str] = None
    highlight: Optional[str] = None


class KnowledgePackage(BaseModel):
    """Portable export/import format."""
    version: str = "1.0"
    exported_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
    documents: List[Dict[str, Any]] = Field(default_factory=list)
    chapters: List[Dict[str, Any]] = Field(default_factory=list)
    distill_entries: List[Dict[str, Any]] = Field(default_factory=list)
    embeddings: List[Dict[str, Any]] = Field(default_factory=list)
    directory_layout: List[str] = Field(default_factory=list)
    metadata: Dict[str, Any] = Field(default_factory=dict)


class StorageStats(BaseModel):
    backend: StorageBackendType
    total_documents: int
    total_chapters: int
    total_distill_entries: int
    total_embeddings: int
    indexed_documents: int
    db_size_bytes: int = 0
    details: Dict[str, Any] = Field(default_factory=dict)

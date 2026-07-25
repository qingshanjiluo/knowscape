from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field


class CitationRecord(BaseModel):
    id: str
    text: str
    chapter_index: int
    position: Dict[str, int]
    source_page: Optional[int] = None
    chapter_id: Optional[str] = None
    chapter_title: Optional[str] = None
    source_type: Literal["original", "distill"] = "original"


class ChatMessageRecord(BaseModel):
    id: str
    role: Literal["user", "assistant", "system"]
    content: str
    citations: List[CitationRecord] = Field(default_factory=list)
    suggestions: List[str] = Field(default_factory=list)
    timestamp: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
    metadata: Dict[str, Any] = Field(default_factory=dict)


class ChatSessionRecord(BaseModel):
    id: str
    book_id: str
    title: str = "新对话"
    message_count: int = 0
    last_message_at: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())


class RetrievedContext(BaseModel):
    id: str
    doc_id: str
    chapter_id: str
    chapter_index: int
    chapter_title: str
    source_type: Literal["distill", "original"]
    content: str
    original_excerpt: str
    score: float
    start_pos: int
    end_pos: int
    metadata: Dict[str, Any] = Field(default_factory=dict)


class RetrievalBundle(BaseModel):
    question: str
    resolved_question: str
    items: List[RetrievedContext] = Field(default_factory=list)


class AnswerPayload(BaseModel):
    answer: str
    citations: List[CitationRecord] = Field(default_factory=list)
    suggestions: List[str] = Field(default_factory=list)
    resolved_question: str
    contexts: List[RetrievedContext] = Field(default_factory=list)


class AskQuestionRequest(BaseModel):
    book_id: str
    question: str
    session_id: str


class ApiResponse(BaseModel):
    success: bool = True
    data: Any = None
    error: Optional[str] = None

from __future__ import annotations

import re
from typing import Iterable, List, Sequence, Set

from cloud.knowledge.models import DistillEntry, KnowledgeChapter
from cloud.knowledge.rag.models import (
    ChatMessageRecord,
    RetrievalBundle,
    RetrievedContext,
)
from cloud.knowledge.storage.sqlite_store import SQLiteStore


FOLLOW_UP_HINTS = ("它", "这个", "这一点", "这种", "那个", "其", "这和", "那和")


class DualSourceRetriever:
    """Retrieves both distilled points and original passages for one question."""

    def __init__(
        self,
        store: SQLiteStore,
        max_distill: int = 2,
        max_original: int = 3,
    ):
        self.store = store
        self.max_distill = max_distill
        self.max_original = max_original

    async def retrieve(
        self,
        doc_id: str,
        question: str,
        history: Sequence[ChatMessageRecord],
    ) -> RetrievalBundle:
        resolved_question = self.resolve_question(question, history)
        tokens = self._tokenize(resolved_question)

        distills = await self.store.get_distill_entries_by_doc(doc_id)
        chapters = await self.store.get_chapters_by_doc(doc_id)

        distill_items = self._rank_distills(doc_id, distills, chapters, tokens)
        original_items = self._rank_originals(doc_id, chapters, tokens)

        items: List[RetrievedContext] = []
        items.extend(distill_items[: self.max_distill])

        used_chapters = {item.chapter_id for item in items}
        for item in original_items:
            if len([ctx for ctx in items if ctx.source_type == "original"]) >= self.max_original:
                break
            if item.chapter_id not in used_chapters or self._adds_new_signal(item, items):
                items.append(item)
                used_chapters.add(item.chapter_id)

        if not any(item.source_type == "original" for item in items) and original_items:
            items.append(original_items[0])

        items.sort(
            key=lambda item: (
                1 if item.source_type == "distill" else 0,
                item.score,
            ),
            reverse=True,
        )
        return RetrievalBundle(
            question=question,
            resolved_question=resolved_question,
            items=items,
        )

    @staticmethod
    def resolve_question(
        question: str, history: Sequence[ChatMessageRecord]
    ) -> str:
        cleaned = question.strip()
        if not history:
            return cleaned
        if not any(hint in cleaned for hint in FOLLOW_UP_HINTS):
            return cleaned

        for message in reversed(history):
            if message.role == "user":
                return f"{message.content.strip()} {cleaned}"
        return cleaned

    def _rank_distills(
        self,
        doc_id: str,
        distills: Sequence[DistillEntry],
        chapters: Sequence[KnowledgeChapter],
        tokens: Set[str],
    ) -> List[RetrievedContext]:
        chapter_map = {chapter.chapter_id: chapter for chapter in chapters}
        items: List[RetrievedContext] = []
        for entry in distills:
            score = self._score_text(
                f"{entry.point} {entry.evidence or ''} {entry.quote or ''}",
                tokens,
            )
            if score <= 0:
                continue
            chapter = chapter_map.get(entry.chapter_id)
            if not chapter:
                continue
            excerpt = entry.quote or entry.evidence or entry.point
            start_pos, end_pos = self._locate_excerpt(chapter, excerpt)
            items.append(
                RetrievedContext(
                    id=entry.entry_id,
                    doc_id=doc_id,
                    chapter_id=entry.chapter_id,
                    chapter_index=entry.chapter_index,
                    chapter_title=entry.chapter_title,
                    source_type="distill",
                    content=self._truncate(f"{entry.point} {entry.evidence or ''}".strip()),
                    original_excerpt=excerpt,
                    score=score + 0.25,
                    start_pos=start_pos,
                    end_pos=end_pos,
                    metadata={
                        "category": entry.category or "",
                        "depth": entry.depth,
                    },
                )
            )
        items.sort(key=lambda item: item.score, reverse=True)
        return items

    def _rank_originals(
        self,
        doc_id: str,
        chapters: Sequence[KnowledgeChapter],
        tokens: Set[str],
    ) -> List[RetrievedContext]:
        items: List[RetrievedContext] = []
        for chapter in chapters:
            score = self._score_text(f"{chapter.title} {chapter.content}", tokens)
            if score <= 0:
                continue
            excerpt = self._best_excerpt(chapter.content, tokens)
            start_pos, end_pos = self._locate_excerpt(chapter, excerpt)
            items.append(
                RetrievedContext(
                    id=chapter.chapter_id,
                    doc_id=doc_id,
                    chapter_id=chapter.chapter_id,
                    chapter_index=chapter.index,
                    chapter_title=chapter.title,
                    source_type="original",
                    content=self._truncate(excerpt),
                    original_excerpt=excerpt,
                    score=score,
                    start_pos=start_pos,
                    end_pos=end_pos,
                )
            )
        items.sort(key=lambda item: item.score, reverse=True)
        return items

    @staticmethod
    def _adds_new_signal(
        candidate: RetrievedContext, existing: Sequence[RetrievedContext]
    ) -> bool:
        existing_text = " ".join(item.content for item in existing)
        return candidate.content not in existing_text

    @staticmethod
    def _tokenize(text: str) -> Set[str]:
        normalized = re.sub(
            r"(是什么|有什么|为什么|如何|怎么|哪些|关系|之间|以及|并且|还有|那么|这个|那个|它|他|她|吗|呢|呀|和|与|及)",
            " ",
            text,
        )
        cjk_tokens = re.findall(r"[\u4e00-\u9fff]{2,8}", normalized)
        latin_tokens = re.findall(r"[a-zA-Z0-9]+", text.lower())
        raw_tokens = cjk_tokens + latin_tokens
        return {token.strip() for token in raw_tokens if token.strip()}

    def _score_text(self, text: str, tokens: Set[str]) -> float:
        if not text or not tokens:
            return 0.0
        lowered = text.lower()
        hits = 0.0
        for token in tokens:
            if token.lower() in lowered:
                hits += 1.0 + min(len(token) / 10.0, 0.4)
        return hits / max(len(tokens), 1)

    @staticmethod
    def _truncate(text: str, limit: int = 180) -> str:
        text = re.sub(r"\s+", " ", text).strip()
        if len(text) <= limit:
            return text
        return text[: limit - 3] + "..."

    def _best_excerpt(self, content: str, tokens: Set[str]) -> str:
        sentences = re.split(r"[。！？!?]", content)
        sentences = [sentence.strip() for sentence in sentences if sentence.strip()]
        if not sentences:
            return content[:120]
        ranked = sorted(
            sentences,
            key=lambda sentence: self._score_text(sentence, tokens),
            reverse=True,
        )
        return ranked[0]

    @staticmethod
    def _locate_excerpt(chapter: KnowledgeChapter, excerpt: str) -> tuple[int, int]:
        excerpt = excerpt.strip()
        if not excerpt:
            return chapter.start_pos, chapter.start_pos
        local_start = chapter.content.find(excerpt)
        if local_start < 0:
            fallback = excerpt[:12]
            local_start = chapter.content.find(fallback)
        if local_start < 0:
            local_start = 0
        start_pos = chapter.start_pos + local_start
        end_pos = start_pos + max(len(excerpt), 1)
        return start_pos, end_pos

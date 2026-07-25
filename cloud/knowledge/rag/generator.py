from __future__ import annotations

from typing import Sequence

from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.runnables import RunnableLambda

from cloud.knowledge.rag.models import (
    AnswerPayload,
    CitationRecord,
    RetrievalBundle,
)


class AnswerGenerator:
    """LangChain-based answer composer with an offline extractive fallback."""

    def __init__(self):
        self.prompt = ChatPromptTemplate.from_messages(
            [
                (
                    "system",
                    "你是“知境”的对话问答引擎。回答必须依据提供的蒸馏要点与原文片段，"
                    "优先引用蒸馏结论，再补充原文依据，并在句尾标注 [引N]。",
                ),
                (
                    "human",
                    "问题：{question}\n"
                    "改写后问题：{resolved_question}\n"
                    "上下文：\n{context}\n"
                    "请生成结构化回答。",
                ),
            ]
        )
        self.chain = RunnableLambda(self._compose_answer) | StrOutputParser()

    def generate(self, bundle: RetrievalBundle) -> AnswerPayload:
        ordered_contexts = self._order_contexts_for_answer(bundle)
        citations = self._build_citations(ordered_contexts)
        rendered_context = self._render_context(bundle)
        prompt_value = self.prompt.invoke(
            {
                "question": bundle.question,
                "resolved_question": bundle.resolved_question,
                "context": rendered_context,
            }
        )
        answer = self.chain.invoke(
            {
                "prompt": prompt_value.to_string(),
                "bundle": bundle,
                "ordered_contexts": ordered_contexts,
                "citations": citations,
            }
        )
        return AnswerPayload(
            answer=answer,
            citations=citations,
            suggestions=self._build_suggestions(bundle),
            resolved_question=bundle.resolved_question,
            contexts=bundle.items,
        )

    def _compose_answer(self, payload: dict) -> str:
        bundle: RetrievalBundle = payload["bundle"]
        ordered_contexts = payload["ordered_contexts"]
        citations: Sequence[CitationRecord] = payload["citations"]
        if not bundle.items:
            return "暂时没有检索到足够依据，请尝试换一种问法或补充章节线索。"

        main_points = []
        if ordered_contexts:
            first = ordered_contexts[0]
            main_points.append(
                f"综合全书检索结果，{self._to_statement(first.original_excerpt)}[引1]"
            )
        if len(ordered_contexts) > 1:
            second = ordered_contexts[1]
            main_points.append(
                f"蒸馏结论进一步指出，{self._to_statement(second.content)}[引2]"
            )
        if len(ordered_contexts) > 2:
            third = ordered_contexts[2]
            main_points.append(
                f"结合跨章节信息，还可以看到 {self._to_statement(third.content)}[引3]"
            )

        evidence_lines = []
        for idx, citation in enumerate(citations[:3], start=1):
            evidence_lines.append(
                f"{idx}. {citation.chapter_title or f'第{citation.chapter_index + 1}章'}：{citation.text}"
            )

        answer = (
            "\n\n".join(main_points)
            + "\n\n"
            + "依据片段：\n"
            + "\n".join(evidence_lines)
        )
        return answer.strip()

    @staticmethod
    def _to_statement(text: str) -> str:
        cleaned = text.strip().rstrip("。！？!?")
        if not cleaned:
            return "书中提供了相关依据"
        return cleaned

    @staticmethod
    def _render_context(bundle: RetrievalBundle) -> str:
        lines = []
        for idx, item in enumerate(bundle.items, start=1):
            lines.append(
                f"[{idx}] source={item.source_type} chapter={item.chapter_title} "
                f"score={item.score:.2f} content={item.content}"
            )
        return "\n".join(lines)

    @staticmethod
    def _build_citations(ordered_contexts) -> list[CitationRecord]:
        citations: list[CitationRecord] = []
        for idx, item in enumerate(ordered_contexts[:3], start=1):
            citations.append(
                CitationRecord(
                    id=str(idx),
                    text=item.original_excerpt,
                    chapter_index=item.chapter_index,
                    position={"start": item.start_pos, "end": item.end_pos},
                    chapter_id=item.chapter_id,
                    chapter_title=item.chapter_title,
                    source_type="original" if item.source_type == "original" else "distill",
                )
            )
        return citations

    @staticmethod
    def _order_contexts_for_answer(bundle: RetrievalBundle):
        return sorted(
            bundle.items,
            key=lambda item: (
                1 if item.source_type == "original" else 0,
                item.score,
            ),
            reverse=True,
        )

    @staticmethod
    def _build_suggestions(bundle: RetrievalBundle) -> list[str]:
        seed = bundle.resolved_question.replace("？", "").replace("?", "").strip()
        return [
            f"{seed}在其他章节还有哪些呼应？",
            "如果结合具体案例，这个问题该怎么理解？",
            "继续追问：作者给出的实践建议是什么？",
        ]

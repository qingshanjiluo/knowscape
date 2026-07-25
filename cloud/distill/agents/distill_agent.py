"""
知境 · 蒸馏引擎（蒸馏Agent）

职责：
1. 逐章读取，提取核心论点
2. 支持浅/中/深三种深度
3. 流式输出蒸馏进度
4. 标注引用来源
"""

import logging
import json
from typing import List, Optional, Iterator, Dict, Any
from cloud.distill.models import (
    ParsedChapter, ChapterDistill, DistillPoint,
    DistillDepth, DistillProgress,
)
from cloud.distill.core.progress import ProgressTracker

logger = logging.getLogger("knowscape.distill_agent")

DEPTH_PROMPTS = {
    DistillDepth.SHALLOW: """
为以下章节提炼核心论点（3-5条）。
每条论点用一句话概括。

输出 JSON 格式:
```json
{{
  "summary": "本章一句话总结",
  "key_points": [
    "论点1",
    "论点2"
  ]
}}
```""",

    DistillDepth.MEDIUM: """
为以下章节提炼核心论点，每条论点附支撑论据。

输出 JSON 格式:
```json
{{
  "summary": "本章一句话总结",
  "key_points": [
    {{
      "point": "核心论点",
      "evidence": "支撑论据/案例"
    }}
  ]
}}
```""",

    DistillDepth.DEEP: """
为以下章节进行深度蒸馏：
1. 核心论点（清晰表述）
2. 支撑论据/推理过程
3. 关键引文（带双引号原文引用）

输出 JSON 格式:
```json
{{
  "summary": "本章一句话总结",
  "key_points": [
    {{
      "point": "核心论点",
      "evidence": "支撑论据/推理过程",
      "quote": "关键引文（原文片段）"
    }}
  ]
}}
```""",
}

# 无LLM时的模板深度
DEPTH_TEMPLATES = {
    DistillDepth.SHALLOW: """## {title} — 核心论点

{points}
""",
    DistillDepth.MEDIUM: """## {title} — 核心论点与论据

{points}
""",
    DistillDepth.DEEP: """## {title} — 深度蒸馏

{points}
""",
}


class DistillAgent:
    """蒸馏Agent — 逐章提取核心论点"""

    def __init__(self, llm=None, depth: DistillDepth = DistillDepth.MEDIUM):
        self.llm = llm
        self.depth = depth

    def set_depth(self, depth: DistillDepth):
        self.depth = depth

    def distill_chapter(
        self,
        chapter: ParsedChapter,
        progress: Optional[ProgressTracker] = None,
    ) -> ChapterDistill:
        """
        蒸馏单个章节

        Args:
            chapter: 已解析的章节
            progress: 进度追踪器

        Returns:
            ChapterDistill 蒸馏结果
        """
        logger.info(f"蒸馏章节: [{chapter.index+1}] {chapter.title}")

        if progress:
            progress.stage_distill(
                chapter_index=chapter.index,
                chapter_title=chapter.title,
            )

        if self.llm:
            return self._distill_with_llm(chapter)
        else:
            return self._distill_fallback(chapter)

    def distill_all(
        self,
        chapters: List[ParsedChapter],
        progress: Optional[ProgressTracker] = None,
    ) -> List[ChapterDistill]:
        """
        蒸馏所有章节

        Args:
            chapters: 章节列表
            progress: 进度追踪器

        Returns:
            蒸馏结果列表
        """
        results = []
        total = len(chapters)

        for i, ch in enumerate(chapters):
            if progress:
                progress.stage_distill(i, total, ch.title)

            result = self.distill_chapter(ch)
            results.append(result)

        if progress:
            progress.update("distill", "章节蒸馏", 1.0,
                             message=f"完成 {total}/{total} 章")

        return results

    def _distill_with_llm(self, chapter: ParsedChapter) -> ChapterDistill:
        """使用 LLM 进行蒸馏"""
        prompt = f"""你是知境（KnowScape）深度阅读蒸馏助手。
请对以下章节内容进行知识蒸馏。

章节标题：{chapter.title}
章节内容：
{chapter.content[:6000]}

{DEPTH_PROMPTS[self.depth]}
"""
        try:
            response = self.llm.invoke(prompt)
            return self._parse_llm_output(chapter, response.content)

        except Exception as e:
            logger.error(f"LLM蒸馏失败 ({chapter.title}): {e}")
            return self._distill_fallback(chapter)

    def _parse_llm_output(
        self, chapter: ParsedChapter, text: str
    ) -> ChapterDistill:
        """解析LLM输出为结构化数据"""
        # 尝试从 JSON 块中提取
        import re
        json_match = re.search(r'```(?:json)?\s*\n?(.*?)\n?```', text, re.DOTALL)
        if json_match:
            try:
                data = json.loads(json_match.group(1).strip())
                points = []
                for kp in data.get("key_points", []):
                    if isinstance(kp, str):
                        points.append(DistillPoint(point=kp))
                    elif isinstance(kp, dict):
                        points.append(DistillPoint(**kp))

                return ChapterDistill(
                    chapter_index=chapter.index,
                    chapter_title=chapter.title,
                    depth=self.depth,
                    summary=data.get("summary", f"{chapter.title} 蒸馏结果"),
                    key_points=points,
                    word_count=sum(len(p.point) for p in points),
                )
            except (json.JSONDecodeError, KeyError) as e:
                logger.warning(f"JSON解析失败: {e}")

        # 回退：纯文本解析
        return ChapterDistill(
            chapter_index=chapter.index,
            chapter_title=chapter.title,
            depth=self.depth,
            summary=f"{chapter.title} 蒸馏结果",
            key_points=[DistillPoint(point=line.strip())
                        for line in text.split("\n")
                        if line.strip() and not line.startswith("#")][:5],
            word_count=len(text),
        )

    def _distill_fallback(self, chapter: ParsedChapter) -> ChapterDistill:
        """无 LLM 时的回退蒸馏（基于规则）"""
        text = chapter.content
        sentences = [s.strip() for s in text.replace("\n", "。").split("。")
                     if len(s.strip()) > 10]

        # 取前5句作为论点
        points = [DistillPoint(point=s) for s in sentences[:5]]

        return ChapterDistill(
            chapter_index=chapter.index,
            chapter_title=chapter.title,
            depth=self.depth,
            summary=f"{chapter.title} — 共{len(sentences)}个有效句子",
            key_points=points,
            word_count=len(text),
        )


class DistillStreamer:
    """流式蒸馏包装器，逐句输出蒸馏进度"""

    def __init__(self, agent: DistillAgent):
        self.agent = agent

    def distill_stream(
        self, chapter: ParsedChapter
    ) -> Iterator[Dict[str, Any]]:
        """流式蒸馏（逐句输出）"""
        yield {"type": "start", "chapter": chapter.title}

        result = self.agent.distill_chapter(chapter)

        for i, point in enumerate(result.key_points):
            yield {
                "type": "point",
                "index": i + 1,
                "total": len(result.key_points),
                "point": point.point,
                "evidence": point.evidence,
                "quote": point.quote,
            }

        yield {"type": "done", "chapter": chapter.title}

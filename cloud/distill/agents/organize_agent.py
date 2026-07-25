"""
知境 · 整理引擎（整理Agent）

职责：
1. 汇总所有章节蒸馏结果
2. 按7类框架分类（方法/原则/策略/模型/案例/数据/观点）
3. 生成全书逻辑树形框架
"""

import logging
import json
from typing import List, Optional
from cloud.distill.models import (
    ChapterDistill, DistillPoint,
    CategoryEntry, FrameworkNode,
    OrganizeResult,
)

logger = logging.getLogger("knowscape.organize_agent")

CATEGORIES = [
    "方法",      # Methodology
    "原则",      # Principles
    "策略",      # Strategies
    "模型",      # Models
    "案例",      # Case Studies
    "数据/证据", # Data/Evidence
    "观点/立场", # Perspectives
]

CATEGORY_KEYWORDS = {
    "方法": ["方法", "步骤", "流程", "方式", "技术", "方法论", "approach", "method",
             "如何", "怎样", "通过", "采用", "使用"],
    "原则": ["原则", "准则", "定律", "原理", "基本", "根本", "principle", "rule",
             "必须", "应当", "应该"],
    "策略": ["策略", "战略", "战术", "方案", "计划", "strategy", "tactic",
             "建议", "推荐", "最佳实践"],
    "模型": ["模型", "框架", "理论", "公式", "结构", "model", "framework", "theory",
             "系统", "体系"],
    "案例": ["案例", "例子", "实例", "示例", "举例", "case", "example",
             "比如", "例如", "如下"],
    "数据/证据": ["数据", "统计", "研究", "实验", "证据", "调研", "data", "evidence",
                 "研究表明", "调查", "比例", "百分比", "数量"],
    "观点/立场": ["观点", "立场", "认为", "主张", "看法", "perspective", "view",
                 "作者认为", "本书认为", "值得注意", "重要的是"],
}


class OrganizeAgent:
    """整理Agent — 汇总蒸馏结果，生成框架"""

    def __init__(self, llm=None):
        self.llm = llm

    def organize(
        self,
        chapter_distills: List[ChapterDistill],
        book_title: str = "",
    ) -> OrganizeResult:
        """
        整理所有蒸馏结果

        Args:
            chapter_distills: 所有章节的蒸馏结果
            book_title: 书名

        Returns:
            OrganizeResult 整理后的框架
        """
        logger.info(f"整理 {len(chapter_distills)} 章的蒸馏结果")

        # Step 1: 按类型分类
        category_index = self._classify_points(chapter_distills)

        # Step 2: 生成框架树
        framework_tree = self._build_framework(chapter_distills)

        # Step 3: 生成全书摘要
        summary, core_idea, author_intent = self._generate_summary(
            chapter_distills, book_title
        )

        result = OrganizeResult(
            summary=summary,
            core_idea=core_idea,
            author_intent=author_intent,
            framework_tree=framework_tree,
            category_index=category_index,
        )

        logger.info(f"整理完成: {sum(len(c.items) for c in category_index)} 条目")
        return result

    def _classify_points(
        self, distills: List[ChapterDistill]
    ) -> List[CategoryEntry]:
        """将蒸馏点分类到7个类型中"""
        entries = {cat: CategoryEntry(category=cat, items=[])
                   for cat in CATEGORIES}

        for distill in distills:
            for point in distill.key_points:
                # 如果已有分类标记，直接使用
                if point.category:
                    cat = point.category
                    entry = next(
                        (e for e in entries.values() if e.category == cat),
                        None
                    )
                    if entry:
                        entry.items.append({
                            "chapter": distill.chapter_title,
                            "chapter_index": distill.chapter_index,
                            "point": point.point,
                            "evidence": point.evidence,
                            "quote": point.quote,
                        })
                    continue

                # 自动分类
                assigned = self._auto_classify(point.point)
                if assigned:
                    entries[assigned].items.append({
                        "chapter": distill.chapter_title,
                        "chapter_index": distill.chapter_index,
                        "point": point.point,
                        "evidence": point.evidence,
                        "quote": point.quote,
                    })
                    point.category = assigned

        # 过滤空分类
        return [e for e in entries.values() if e.items]

    def _auto_classify(self, text: str) -> Optional[str]:
        """基于关键词自动分类"""
        if not text:
            return None

        scores = {}
        for cat, keywords in CATEGORY_KEYWORDS.items():
            score = sum(1 for kw in keywords if kw in text)
            if score > 0:
                scores[cat] = score

        if scores:
            return max(scores, key=scores.get)

        return "观点/立场"  # 默认

    def _build_framework(
        self, distills: List[ChapterDistill]
    ) -> FrameworkNode:
        """构建全书逻辑框架树"""
        children = []

        for d in distills:
            node = FrameworkNode(
                title=d.chapter_title,
                level=2,
                key_points=[p.point for p in d.key_points],
            )
            children.append(node)

        return FrameworkNode(
            title="全书框架",
            level=1,
            children=children,
        )

    def _generate_summary(
        self, distills: List[ChapterDistill], book_title: str
    ) -> tuple:
        """生成全书摘要"""
        if not distills:
            return "暂无内容", "暂无核心思想", "无法判断"

        # 从每章摘要聚合
        chapter_summaries = "\n".join(
            f"- {d.chapter_title}: {d.summary}"
            for d in distills
        )

        if self.llm:
            try:
                prompt = f"""基于以下{len(distills)}章的蒸馏摘要，生成全书概览。

{chapter_summaries}

请输出 JSON：
{{
  "summary": "全书一句话总结",
  "core_idea": "全书核心思想（2-3句）",
  "author_intent": "作者写作意图"
}}
"""
                response = self.llm.invoke(prompt)
                text = response.content

                import re
                jm = re.search(r'```(?:json)?\s*\n?(.*?)\n?```',
                               text, re.DOTALL)
                if jm:
                    data = json.loads(jm.group(1))
                    return (
                        data.get("summary", ""),
                        data.get("core_idea", ""),
                        data.get("author_intent", ""),
                    )
            except Exception as e:
                logger.warning(f"AI摘要生成失败: {e}")

        # 回退
        first_summary = distills[0].summary if distills else ""
        total_points = sum(len(d.key_points) for d in distills)
        return (
            f"《{book_title}》共{len(distills)}章，{total_points}个核心论点",
            first_summary,
            "请配置AI或手动输入作者意图",
        )

    def format_text(self, result: OrganizeResult) -> str:
        """将整理结果格式化为文本"""
        lines = [
            "# 全书概览\n",
            f"**一句话总结**：{result.summary}\n",
            f"**核心思想**：{result.core_idea}\n",
            f"**作者意图**：{result.author_intent}\n",
            "---\n",
            "# 全书框架\n",
        ]

        def _render_tree(node: FrameworkNode, indent: int = 0):
            prefix = "  " * indent
            marker = "- " if indent > 0 else ""
            lines.append(f"{prefix}{marker}{node.title}\n")
            for kp in node.key_points:
                lines.append(f"{prefix}  - {kp}\n")
            for child in node.children:
                _render_tree(child, indent + 1)

        _render_tree(result.framework_tree)

        lines.extend(["\n---\n", "# 内容类型索引\n"])
        for entry in result.category_index:
            lines.append(f"\n## {entry.category}\n")
            for item in entry.items:
                ch = item.get("chapter", "未知章节")
                point = item.get("point", "")
                lines.append(f"- [{ch}] {point}\n")

        return "".join(lines)

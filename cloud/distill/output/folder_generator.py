"""
知境 · 蒸馏文件夹生成器

职责：
1. 根据整理的框架生成标准化输出文件夹
2. 目录结构遵循 3.2.4 定义
3. 支持 Markdown 格式输出
"""

import os
import logging
from typing import List, Optional
from cloud.distill.models import (
    ChapterDistill, OrganizeResult, DistillDepth,
    DistillFolder,
)
from cloud.distill.core.progress import ProgressTracker

logger = logging.getLogger("knowscape.folder_generator")


class FolderGenerator:
    """蒸馏文件夹生成器"""

    def __init__(self, output_dir: str = ""):
        self.output_dir = output_dir

    def generate(
        self,
        distills: List[ChapterDistill],
        organize_result: OrganizeResult,
        depth: DistillDepth = DistillDepth.MEDIUM,
        progress: Optional[ProgressTracker] = None,
    ) -> DistillFolder:
        """生成蒸馏文件夹"""
        if self.output_dir:
            os.makedirs(self.output_dir, exist_ok=True)

        files = []

        # 1. 全书概览
        content = self._render_overview(organize_result)
        files.append({"path": "全书概览.md", "content": content})
        self._write_file("全书概览.md", content, progress)

        # 2. 全书框架
        content = self._render_framework(organize_result)
        files.append({"path": "全书框架.md", "content": content})
        self._write_file("全书框架.md", content, progress)

        # 3. 内容类型索引
        content = self._render_category_index(organize_result)
        files.append({"path": "内容类型索引.md", "content": content})
        self._write_file("内容类型索引.md", content, progress)

        # 4. 章节蒸馏
        distill_dir = os.path.join(self.output_dir, "章节蒸馏")
        if self.output_dir:
            os.makedirs(distill_dir, exist_ok=True)

        for d in distills:
            filename = f"第{d.chapter_index+1}章_{d.chapter_title}_核心.md"
            filename = self._sanitize_filename(filename)
            content = self._render_chapter_distill(d, depth)
            files.append({"path": f"章节蒸馏/{filename}", "content": content})
            self._write_file(f"章节蒸馏/{filename}", content, progress)

        # 5. 深度文档（占位）
        deep_dir = os.path.join(self.output_dir, "深度文档")
        if self.output_dir:
            os.makedirs(deep_dir, exist_ok=True)

        placeholder = "# 深度文档\n\n此目录包含按需生成的深度内容。\n\n在对话模式下，你可以让 AI 为你生成任意主题的深度文档。"
        files.append({"path": "深度文档/README.md", "content": placeholder})
        self._write_file("深度文档/README.md", placeholder, progress)

        # 6. 原文引用
        quote_dir = os.path.join(self.output_dir, "原文引用")
        if self.output_dir:
            os.makedirs(quote_dir, exist_ok=True)

        quote_content = self._render_quote_index(distills)
        files.append({"path": "原文引用/原文片段索引.md", "content": quote_content})
        self._write_file("原文引用/原文片段索引.md", quote_content, progress)

        logger.info(f"蒸馏文件夹生成完成: {len(files)} 个文件")

        return DistillFolder(
            root_dir=self.output_dir or "(memory)",
            files=files,
        )

    def _render_overview(self, result: OrganizeResult) -> str:
        return f"""# 全书概览

**一句话总结**
{result.summary}

**核心思想**
{result.core_idea}

**作者意图**
{result.author_intent}

---

*由知境（KnowScape）AI 蒸馏生成*
"""

    def _render_framework(self, result: OrganizeResult) -> str:
        lines = ["# 全书框架\n"]

        def _render(node, indent=0):
            prefix = "  " * indent
            lines.append(f"{prefix}- **{node.title}**\n")
            for kp in node.key_points:
                lines.append(f"{prefix}  - {kp}\n")
            for child in node.children:
                _render(child, indent + 1)

        _render(result.framework_tree)
        return "".join(lines)

    def _render_category_index(self, result: OrganizeResult) -> str:
        lines = ["# 内容类型索引\n"]
        for entry in result.category_index:
            lines.append(f"\n## {entry.category}\n")
            for item in entry.items:
                ch = item.get("chapter", "未知")
                point = item.get("point", "")
                lines.append(f"- **[{ch}]** {point}\n")
                if item.get("evidence"):
                    lines.append(f"  - 论据：{item['evidence']}\n")
                if item.get("quote"):
                    lines.append(f"  > {item['quote']}\n")
        return "".join(lines)

    def _render_chapter_distill(
        self, distill: ChapterDistill, depth: DistillDepth
    ) -> str:
        lines = [
            f"# 第{distill.chapter_index+1}章：{distill.chapter_title}\n",
            f"\n## 本章概要\n\n{distill.summary}\n",
            "\n## 核心论点\n",
        ]

        for i, pt in enumerate(distill.key_points, 1):
            lines.append(f"\n### 论点 {i}\n")
            lines.append(f"{pt.point}\n")
            if depth in (DistillDepth.MEDIUM, DistillDepth.DEEP) and pt.evidence:
                lines.append(f"\n**论据**：{pt.evidence}\n")
            if depth == DistillDepth.DEEP and pt.quote:
                lines.append(f"\n> **引文**：{pt.quote}\n")

        if depth == DistillDepth.DEEP:
            lines.append(f"\n---\n*深度模式 | 知境(KnowScape)蒸馏*\n")

        return "".join(lines)

    def _render_quote_index(self, distills: List[ChapterDistill]) -> str:
        lines = ["# 原文片段索引\n"]
        for d in distills:
            has_quotes = [p for p in d.key_points if p.quote]
            if has_quotes:
                lines.append(f"\n## 第{d.chapter_index+1}章：{d.chapter_title}\n")
                for i, pt in enumerate(has_quotes, 1):
                    lines.append(f"- 引文{i}: {pt.quote}\n")
        if len(lines) == 1:
            lines.append("*请在深度模式下获取原文引用*\n")
        return "".join(lines)

    def _sanitize_filename(self, name: str) -> str:
        invalid_chars = '<>:"/\\|?*'
        for c in invalid_chars:
            name = name.replace(c, "_")
        return name[:200]

    def _write_file(self, rel_path: str, content: str, progress=None):
        if not self.output_dir:
            return
        full_path = os.path.join(self.output_dir, rel_path)
        os.makedirs(os.path.dirname(full_path), exist_ok=True)
        with open(full_path, "w", encoding="utf-8") as f:
            f.write(content)
        if progress:
            progress.stage_generate(rel_path)

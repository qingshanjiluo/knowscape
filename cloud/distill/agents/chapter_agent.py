"""
知境 · 分章引擎（分章Agent）

职责：
1. 解析 Markdown 标题结构（h1/h2/h3）
2. 若章节边界不清晰，调用 AI 语义修正
3. 生成独立章节文件
"""

import re
import logging
from typing import List, Optional
from cloud.distill.models import ChapterBoundary, ParsedChapter, ChapterResult

logger = logging.getLogger("knowscape.chapter_agent")

# Markdown 标题正则
HEADING_RE = re.compile(r'^(#{1,6})\s+(.+)$', re.MULTILINE)

# 常见章节关键词（中文 + 英文）
CHAPTER_KEYWORDS = [
    "第.{1,4}章", "第.{1,4}节", "第.{1,4}部分",
    "chapter", "section", "part",
    "引言", "前言", "绪论", "导论",
    "introduction", "preface",
    "附录", "参考文献", "参考", "后记",
    "appendix", "references", "bibliography", "index",
    "总结", "conclusion",
]


class ChapterAgent:
    """分章Agent — 解析文档结构，识别章节边界"""

    def __init__(self, llm=None):
        self.llm = llm  # LangChain LLM 实例（可选，用于AI修正）

    def split(self, full_text: str, book_title: str = "") -> ChapterResult:
        """
        主入口：将全文拆分为章节

        Args:
            full_text: 完整 Markdown 文本
            book_title: 书名

        Returns:
            ChapterResult 包含解析后的章节列表
        """
        logger.info(f"开始分章: {book_title or '未知'} ({len(full_text)} chars)")

        boundaries = self._parse_headings(full_text)

        corrections = []
        if not boundaries:
            logger.warning("标题结构不清晰，尝试AI语义辅助...")
            boundaries, corrections = self._ai_assisted_split(full_text)
        else:
            corrections = self._validate_boundaries(full_text, boundaries)

        chapters = self._build_chapters(full_text, boundaries)

        result = ChapterResult(
            book_title=book_title or "Untitled",
            chapters=chapters,
            total_chapters=len(chapters),
            ai_corrections=corrections,
        )

        logger.info(f"分章完成: {len(chapters)} 章")
        return result

    def _parse_headings(self, text: str) -> List[ChapterBoundary]:
        """解析 Markdown 标题结构"""
        matches = list(HEADING_RE.finditer(text))

        if not matches:
            return self._find_plain_chapter_boundaries(text)

        boundaries = []
        for i, m in enumerate(matches):
            level = len(m.group(1))
            title = m.group(2).strip()
            start = m.start()

            boundaries.append(ChapterBoundary(
                index=i,
                title=title,
                level=level,
                start_pos=start,
                end_pos=len(text),
            ))

        # 设置 end_pos
        for i in range(len(boundaries) - 1):
            boundaries[i].end_pos = boundaries[i + 1].start_pos

        return boundaries

    def _find_plain_chapter_boundaries(self, text: str) -> List[ChapterBoundary]:
        """无标题标记时，通过关键词识别章节边界"""
        boundaries = []
        lines = text.split("\n")

        for i, line in enumerate(lines):
            line = line.strip()
            if not line:
                continue
            for kw in CHAPTER_KEYWORDS:
                if re.match(kw, line, re.IGNORECASE):
                    start = text.find(line)
                    if start >= 0:
                        boundaries.append(ChapterBoundary(
                            index=len(boundaries),
                            title=line,
                            level=1,
                            start_pos=start,
                            end_pos=len(text),
                        ))
                    break

        for i in range(len(boundaries) - 1):
            boundaries[i].end_pos = boundaries[i + 1].start_pos

        return boundaries

    def _validate_boundaries(
        self, text: str, boundaries: List[ChapterBoundary]
    ) -> List[dict]:
        """验证已有边界，记录修正"""
        corrections = []
        for b in boundaries:
            if self._should_correct(b.title):
                original = b.title
                b.original_title = original
                b.is_ai_corrected = True
                b.title = original.rstrip(":").strip()  # 简单清理
                corrections.append({
                    "original": original,
                    "corrected": b.title,
                    "reason": "标题清理",
                })
        return corrections

    def _should_correct(self, title: str) -> bool:
        """判断是否需要修正标题"""
        if not title:
            return True
        if re.match(r'^\d+[\.\、\s]', title):
            return True  # "1. 引言" → "引言"
        return False

    def _build_chapters(
        self, full_text: str, boundaries: List[ChapterBoundary]
    ) -> List[ParsedChapter]:
        """从边界构建章节对象"""
        chapters = []
        for b in boundaries:
            content = full_text[b.start_pos:b.end_pos].strip()
            chapters.append(ParsedChapter(
                index=b.index,
                title=b.title,
                content=content,
                level=b.level,
                word_count=len(content),
            ))
        return chapters

    def _ai_assisted_split(self, text: str) -> tuple:
        """
        AI 语义辅助分章（当标题结构不清晰时）
        返回 (boundaries, corrections)
        """
        if not self.llm:
            # 无 LLM 时的回退：按段落分章
            logger.warning("未配置LLM，按段落自动分章")
            paras = text.split("\n\n")
            chunks = []
            chunk_size = max(1, len(paras) // 10)  # 约10章
            boundaries = []
            pos = 0
            for i in range(0, len(paras), chunk_size):
                chunk = "\n\n".join(paras[i:i + chunk_size])
                title = f"第{len(boundaries) + 1}部分"
                boundaries.append(ChapterBoundary(
                    index=len(boundaries),
                    title=title,
                    level=1,
                    start_pos=pos,
                    end_pos=pos + len(chunk),
                    is_ai_corrected=True,
                    original_title="AI自动分章",
                ))
                pos += len(chunk) + 2
            return boundaries, []

        # 有 LLM 时调用 AI 分章
        try:
            prompt = f"""你是一个专业文档分章助手。请将以下文本按逻辑结构分为章节。

要求：
1. 识别每个章节的标题和边界
2. 输出 JSON 数组，每个元素包含: title, start_line, end_line

文本内容（前2000字）：
{text[:2000]}

注意：请只输出 JSON 数组，不要有其他内容。"""
            response = self.llm.invoke(prompt)
            return self._parse_llm_response(text, response.content)

        except Exception as e:
            logger.error(f"AI分章失败: {e}")
            return self._ai_assisted_split(text)  # 递归回退（无LLM分支）

    def _parse_llm_response(
        self, text: str, response: str
    ) -> tuple:
        """解析LLM返回的章节信息"""
        import json
        try:
            data = json.loads(response)
            if isinstance(data, list) and len(data) > 0:
                lines = text.split("\n")
                boundaries = []
                for i, item in enumerate(data):
                    start = sum(len(l) + 1 for l in lines[:item.get("start_line", 0)])
                    end = sum(len(l) + 1 for l in lines[:item.get("end_line", len(lines))])
                    boundaries.append(ChapterBoundary(
                        index=i,
                        title=item.get("title", f"第{i+1}章"),
                        level=1,
                        start_pos=start,
                        end_pos=end,
                        is_ai_corrected=True,
                    ))
                return boundaries, [{"type": "ai_split", "chapters": len(boundaries)}]
        except (json.JSONDecodeError, KeyError, TypeError):
            pass

        return self._find_plain_chapter_boundaries(text), []


def extract_chapter_content(
    full_text: str, chapter: ParsedChapter
) -> str:
    """
    从全文中提取指定章节的纯净内容（去除前导/后置空行）
    """
    start = full_text.find(chapter.content)
    if start < 0:
        return chapter.content
    return full_text[start:start + len(chapter.content)].strip()

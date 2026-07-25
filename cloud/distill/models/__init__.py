"""
知境 · 分章与蒸馏引擎 — 数据模型

AI Agent 间传递的核心数据结构。
"""

from __future__ import annotations
from enum import Enum
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime


class DistillDepth(str, Enum):
    """蒸馏深度枚举"""
    SHALLOW = "shallow"       # 浅度：仅核心论点
    MEDIUM = "medium"         # 中度：论点 + 论据/案例
    DEEP = "deep"             # 深度：论点 + 论据 + 关键引文


class ChapterBoundary(BaseModel):
    """单个章节边界"""
    index: int = Field(..., description="章节序号（从0开始）")
    title: str = Field(..., description="章节标题")
    level: int = Field(1, description="标题层级（1=h1, 2=h2, ...）")
    start_pos: int = Field(..., description="在全文中的起始字符位置")
    end_pos: int = Field(..., description="在全文中的结束字符位置")
    is_ai_corrected: bool = Field(False, description="是否经AI语义修正")
    original_title: Optional[str] = Field(None, description="AI修正前的原始标题")


class ParsedChapter(BaseModel):
    """解析后的单个章节"""
    index: int = Field(..., description="章节序号")
    title: str = Field(..., description="章节标题")
    content: str = Field(..., description="章节内容（Markdown格式）")
    level: int = Field(1, description="标题层级")
    word_count: int = Field(0, description="字数")


class ChapterResult(BaseModel):
    """分章结果"""
    book_title: str = Field(..., description="书名")
    chapters: List[ParsedChapter] = Field(default_factory=list)
    total_chapters: int = Field(0)
    ai_corrections: List[Dict[str, Any]] = Field(
        default_factory=list,
        description="AI修正记录"
    )


class DistillPoint(BaseModel):
    """单个蒸馏点"""
    point: str = Field(..., description="核心论点")
    evidence: Optional[str] = Field(None, description="支撑论据（中/深度）")
    quote: Optional[str] = Field(None, description="关键引文（深度）")
    category: Optional[str] = Field(None, description="所属类型（整理Agent填充）")


class ChapterDistill(BaseModel):
    """单章蒸馏结果"""
    chapter_index: int
    chapter_title: str
    depth: DistillDepth
    summary: str = Field(..., description="本章一句话总结")
    key_points: List[DistillPoint] = Field(default_factory=list)
    word_count: int = Field(0)


class CategoryEntry(BaseModel):
    """分类条目"""
    category: str = Field(..., description="分类名称")
    items: List[Dict[str, Any]] = Field(
        default_factory=list,
        description="该分类下的条目列表（含章节来源）"
    )


class FrameworkNode(BaseModel):
    """框架树节点"""
    title: str
    level: int = Field(1, ge=1, le=6)
    children: List[FrameworkNode] = Field(default_factory=list)
    key_points: List[str] = Field(default_factory=list)


class OrganizeResult(BaseModel):
    """整理结果"""
    summary: str = Field(..., description="全书一句话总结")
    core_idea: str = Field(..., description="核心思想")
    author_intent: str = Field(..., description="作者意图")
    framework_tree: FrameworkNode = Field(..., description="逻辑结构树")
    category_index: List[CategoryEntry] = Field(
        default_factory=list,
        description="按类型分类汇总"
    )


class DistillProgress(BaseModel):
    """蒸馏进度"""
    stage: str = Field(..., description="当前阶段: split/distill/organize/generate")
    stage_label: str = Field(..., description="中文阶段名")
    progress: float = Field(0.0, ge=0.0, le=1.0, description="进度 0.0~1.0")
    current_item: str = Field("", description="当前处理项")
    done_count: int = Field(0)
    total_count: int = Field(0)
    message: str = Field("", description="详细消息")
    timestamp: str = Field(default_factory=lambda: datetime.now().isoformat())


class DistillConfig(BaseModel):
    """蒸馏配置"""
    depth: DistillDepth = Field(default=DistillDepth.MEDIUM)
    llm_model: str = Field(default="deepseek-chat")
    llm_base_url: str = Field(default="https://api.deepseek.com")
    llm_api_key: str = Field(default="", description="API Key, 为空则从环境变量读取")
    temperature: float = Field(default=0.3, ge=0.0, le=2.0)
    max_tokens: int = Field(default=4096)
    output_dir: Optional[str] = Field(None, description="蒸馏输出目录, 空则不写文件")
    language: str = Field(default="zh", description="输出语言")


class DistillFolder(BaseModel):
    """蒸馏文件夹完整结构（对应 3.2.4）"""
    root_dir: str
    files: List[Dict[str, str]] = Field(default_factory=list)
    # 格式: [{"path": "全书概览.md", "content": "..."}, ...]

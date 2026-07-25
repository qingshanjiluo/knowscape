"""
知境 · 三Agent 协作编排器

职责：
1. 按顺序调度：分章Agent → 蒸馏Agent → 整理Agent → 文件夹生成
2. 统一进度回调
3. 错误处理与恢复
"""

import logging
from typing import List, Optional, Callable
from cloud.distill.models import (
    ChapterResult, ChapterDistill, OrganizeResult,
    DistillConfig, DistillDepth, DistillProgress, DistillFolder,
)
from cloud.distill.agents.chapter_agent import ChapterAgent
from cloud.distill.agents.distill_agent import DistillAgent
from cloud.distill.agents.organize_agent import OrganizeAgent
from cloud.distill.output.folder_generator import FolderGenerator
from cloud.distill.core.progress import ProgressTracker

logger = logging.getLogger("knowscape.orchestrator")


class DistillOrchestrator:
    """蒸馏编排器 — 调度三大Agent按序工作"""

    def __init__(
        self,
        chapter_agent: Optional[ChapterAgent] = None,
        distill_agent: Optional[DistillAgent] = None,
        organize_agent: Optional[OrganizeAgent] = None,
        config: Optional[DistillConfig] = None,
    ):
        self.chapter_agent = chapter_agent or ChapterAgent()
        self.distill_agent = distill_agent or DistillAgent()
        self.organize_agent = organize_agent or OrganizeAgent()
        self.config = config or DistillConfig()
        self.progress = ProgressTracker()

    def register_progress_callback(self, cb: Callable[[DistillProgress], None]):
        """注册进度回调"""
        self.progress.register(cb)

    def run(
        self,
        full_text: str,
        book_title: str = "",
        output_dir: Optional[str] = None,
        depth: Optional[DistillDepth] = None,
    ) -> dict:
        """
        全流程执行：分章 → 蒸馏 → 整理 → 生成

        Args:
            full_text: 完整 Markdown 文本
            book_title: 书名
            output_dir: 输出目录（None则不写文件）
            depth: 蒸馏深度（覆盖配置）

        Returns:
            {
                "chapter_result": ChapterResult,
                "distills": List[ChapterDistill],
                "organize_result": OrganizeResult,
                "folder": DistillFolder | None,
            }
        """
        resolved_depth = depth or self.config.depth

        try:
            # === Step 1: 分章 ===
            logger.info("=" * 40)
            logger.info("Step 1/4: 智能分章")
            logger.info("=" * 40)

            self.progress.stage_split()
            self.distill_agent.set_depth(resolved_depth)
            chapter_result = self.chapter_agent.split(full_text, book_title)

            if not chapter_result.chapters:
                logger.error("分章失败：未识别到任何章节")
                raise ValueError("分章失败：未识别到任何章节")

            self.progress.update(
                "split", "智能分章", 1.0,
                done_count=chapter_result.total_chapters,
                total_count=chapter_result.total_chapters,
                message=f"识别到 {chapter_result.total_chapters} 章",
            )

            # === Step 2: 蒸馏 ===
            logger.info("=" * 40)
            logger.info(f"Step 2/4: 章节蒸馏 (深度={resolved_depth.value})")
            logger.info("=" * 40)

            distills = self.distill_agent.distill_all(
                chapter_result.chapters, self.progress
            )

            total_points = sum(len(d.key_points) for d in distills)
            self.progress.update(
                "distill", "章节蒸馏", 1.0,
                message=f"提取 {total_points} 个核心论点",
            )

            # === Step 3: 整理 ===
            logger.info("=" * 40)
            logger.info("Step 3/4: 框架整理")
            logger.info("=" * 40)

            self.progress.stage_organize()
            organize_result = self.organize_agent.organize(
                distills, book_title
            )

            total_categorized = sum(
                len(entry.items) for entry in organize_result.category_index
            )
            self.progress.update(
                "organize", "框架整理", 1.0,
                message=f"分类 {total_categorized} 个条目到 "
                        f"{len(organize_result.category_index)} 个类型",
            )

            # === Step 4: 生成文件夹 ===
            logger.info("=" * 40)
            logger.info("Step 4/4: 生成蒸馏文档")
            logger.info("=" * 40)

            folder = None
            if output_dir:
                gen = FolderGenerator(output_dir)
                folder = gen.generate(
                    distills, organize_result, resolved_depth, self.progress
                )
                self.progress.update(
                    "generate", "生成文档", 1.0,
                    message=f"已生成 {len(folder.files)} 个文件到 {output_dir}",
                )

            self.progress.done("蒸馏完成！")

            return {
                "chapter_result": chapter_result,
                "distills": distills,
                "organize_result": organize_result,
                "folder": folder,
            }

        except Exception as e:
            logger.error(f"蒸馏流程失败: {e}", exc_info=True)
            self.progress.error(str(e))
            raise

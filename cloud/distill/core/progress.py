"""
知境 · 分章与蒸馏引擎 — 进度回调模块
"""

from typing import Callable, Optional, Awaitable
from dataclasses import dataclass, field
from datetime import datetime
from cloud.distill.models import DistillProgress

# 进度回调类型：同步或异步
ProgressCallback = Callable[[DistillProgress], None]
AsyncProgressCallback = Callable[[DistillProgress], Awaitable[None]]


@dataclass
class ProgressTracker:
    """进度追踪器"""
    total_stages: int = 4  # split / distill / organize / generate
    current_stage: int = 0
    _callbacks: list = field(default_factory=list)

    def register(self, cb: ProgressCallback):
        self._callbacks.append(cb)

    def unregister(self, cb: ProgressCallback):
        self._callbacks.remove(cb)

    def notify(self, progress: DistillProgress):
        for cb in self._callbacks:
            cb(progress)

    def update(
        self,
        stage: str,
        stage_label: str,
        progress: float,
        current_item: str = "",
        done_count: int = 0,
        total_count: int = 0,
        message: str = "",
    ):
        p = DistillProgress(
            stage=stage,
            stage_label=stage_label,
            progress=progress,
            current_item=current_item,
            done_count=done_count,
            total_count=total_count,
            message=message,
        )
        self.notify(p)

    def stage_split(self, current: int = 0, total: int = 0):
        self.update("split", "智能分章", 0.0,
                     current_item="解析文档结构中...",
                     done_count=current, total_count=total)

    def stage_distill(self, current: int = 0, total: int = 0,
                      chapter_title: str = ""):
        self.update("distill", "章节蒸馏",
                     current / total if total > 0 else 0.0,
                     current_item=f"蒸馏: {chapter_title}",
                     done_count=current, total_count=total)

    def stage_organize(self):
        self.update("organize", "框架整理", 0.0,
                     current_item="汇总章节蒸馏结果...")

    def stage_generate(self, file_name: str = ""):
        self.update("generate", "生成文档",
                     0.0, current_item=f"生成: {file_name}")

    def done(self, message: str = "完成"):
        self.update("done", "完成", 1.0, message=message)

    def error(self, msg: str):
        self.update("error", "错误", 0.0, message=msg)

"""
知境 · 分章与蒸馏引擎 — 配置模块
"""

import os
from typing import Optional
from cloud.distill.models import DistillConfig, DistillDepth


def load_config(
    depth: str = "medium",
    api_key: Optional[str] = None,
    model: str = "deepseek-chat",
    **overrides
) -> DistillConfig:
    """
    加载蒸馏配置

    Args:
        depth: 蒸馏深度 (shallow / medium / deep)
        api_key: DeepSeek API Key (默认从 DEEPSEEK_API_KEY 环境变量读取)
        model: 模型名称
        **overrides: 其他覆盖参数

    Returns:
        DistillConfig 实例
    """
    depth_map = {
        "shallow": DistillDepth.SHALLOW,
        "medium": DistillDepth.MEDIUM,
        "deep": DistillDepth.DEEP,
    }

    resolved_depth = depth_map.get(depth, DistillDepth.MEDIUM)
    resolved_key = api_key or os.environ.get("DEEPSEEK_API_KEY", "")

    config = DistillConfig(
        depth=resolved_depth,
        llm_model=model,
        llm_api_key=resolved_key,
    )

    # 覆盖其他参数
    for k, v in overrides.items():
        if hasattr(config, k):
            setattr(config, k, v)

    return config

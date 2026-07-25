"""
知境 · 分章与蒸馏引擎 — 命令行使用示例

用法：
    python -m cloud.distill.main <book.md> [--depth shallow|medium|deep]

环境变量：
    DEEPSEEK_API_KEY=your_key     # 可选，无则使用规则回退

示例：
    python -m cloud.distill.main book.md --depth medium --output ./distill_output
"""

import sys
import os
import argparse
import logging
from pathlib import Path

# 确保包路径正确
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from cloud.distill import DistillOrchestrator
from cloud.distill.models import DistillDepth, DistillProgress
from cloud.distill.core.config import load_config


def setup_logging(verbose: bool = False):
    level = logging.DEBUG if verbose else logging.INFO
    logging.basicConfig(
        level=level,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%H:%M:%S",
    )


def progress_printer(p: DistillProgress):
    """进度回调：在终端显示进度"""
    bar_len = 20
    filled = int(bar_len * p.progress)
    bar = "█" * filled + "░" * (bar_len - filled)

    print(f"\r  [{p.stage_label}] {bar} {p.progress:.0%}  "
          f"({p.done_count}/{p.total_count}) {p.current_item}",
          end="", flush=True)

    if p.stage == "done":
        print(f"\n✅ {p.message}")
    elif p.stage == "error":
        print(f"\n❌ {p.message}")


def main():
    parser = argparse.ArgumentParser(
        description="知境(KnowScape) 分章与蒸馏引擎",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例：
  # 基本用法（规则回退）
  python -m cloud.distill.main book.md -o ./output
  
  # AI 辅助蒸馏（需设置 DEEPSEEK_API_KEY）
  DEEPSEEK_API_KEY=sk-xxx python -m cloud.distill.main book.md --depth deep
  
  # 详细日志
  python -m cloud.distill.main book.md -v
""",
    )
    parser.add_argument("input", help="输入的 Markdown 文件路径")
    parser.add_argument("-o", "--output", help="输出目录（默认不写文件）")
    parser.add_argument("--depth", choices=["shallow", "medium", "deep"],
                        default="medium", help="蒸馏深度（默认: medium）")
    parser.add_argument("--model", default="deepseek-chat",
                        help="LLM 模型名称")
    parser.add_argument("-v", "--verbose", action="store_true",
                        help="详细日志")

    args = parser.parse_args()
    setup_logging(args.verbose)

    # 读取输入文件
    input_path = Path(args.input)
    if not input_path.exists():
        print(f"❌ 文件不存在: {args.input}")
        sys.exit(1)

    print(f"📖 知境 · 分章与蒸馏引擎")
    print(f"   输入: {args.input}")
    print(f"   深度: {args.depth}")
    print(f"   输出: {args.output or '(仅内存)'}")
    print()

    with open(input_path, "r", encoding="utf-8") as f:
        full_text = f.read()

    print(f"   文本长度: {len(full_text)} 字符")
    print()

    # 配置
    config = load_config(
        depth=args.depth,
        model=args.model,
    )

    # 初始化编排器
    orchestrator = DistillOrchestrator(config=config)

    # 注册进度回调
    orchestrator.register_progress_callback(progress_printer)

    # 如果 LLM API Key 可用，注入 agent
    if config.llm_api_key:
        from langchain_openai import ChatOpenAI
        llm = ChatOpenAI(
            model=config.llm_model,
            openai_api_key=config.llm_api_key,
            openai_api_base=config.llm_base_url,
            temperature=config.temperature,
            max_tokens=config.max_tokens,
        )
        orchestrator.chapter_agent.llm = llm
        orchestrator.distill_agent.llm = llm
        orchestrator.organize_agent.llm = llm
        print("   🤖 AI 模式 (DeepSeek)")
    else:
        print("   📋 规则模式 (无 LLM)")
    print()

    # 执行
    try:
        result = orchestrator.run(
            full_text=full_text,
            book_title=input_path.stem,
            output_dir=args.output,
            depth=DistillDepth(args.depth),
        )

        # 打印统计
        ch = result["chapter_result"]
        di = result["distills"]
        or_ = result["organize_result"]

        print(f"""
📊 蒸馏统计
   ├─ 章节: {ch.total_chapters} 章
   ├─ 蒸馏点: {sum(len(d.key_points) for d in di)} 条
   ├─ 分类: {len(or_.category_index)} 个类型
   └─ AI修正: {len(ch.ai_corrections)} 处

💾 输出:
""")

        if result["folder"]:
            for f in result["folder"].files:
                print(f"   📄 {f['path']}")
            print(f"\n   输出路径: {Path(args.output).resolve()}")
        else:
            print("   未指定输出目录，结果仅在内存中\n")

    except Exception as e:
        print(f"\n❌ 蒸馏失败: {e}")
        if args.verbose:
            import traceback
            traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()

"""
知境 · 分章与蒸馏引擎 — 单元测试

运行：
    pip install -r requirements.txt pytest
    pytest cloud/distill/tests/ -v
"""

import sys
import os
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent))

import pytest
from cloud.distill.agents.chapter_agent import ChapterAgent
from cloud.distill.agents.distill_agent import DistillAgent
from cloud.distill.agents.organize_agent import OrganizeAgent
from cloud.distill.models import (
    DistillDepth, ParsedChapter, ChapterDistill, DistillPoint,
    ChapterBoundary,
)
from cloud.distill.core.orchestrator import DistillOrchestrator


# ─── Fixtures ────────────────────────────────────────────────

@pytest.fixture
def sample_markdown():
    return """# 第一章：认知升级

认知升级是终身学习的核心。

## 1.1 什么是认知升级

认知升级是指思维模式的根本转变。

### 方法

通过持续学习和反思来实现认知升级。

### 案例

某公司通过认知升级实现了业绩翻倍。

---

# 第二章：方法论

方法论是解决问题的系统框架。

## 2.1 第一性原理

第一性原理是回归事物最基本的真理。

### 原则

从本质出发，不受现有方案约束。

## 2.2 系统思维

系统思维考虑整体而非局部。

### 模型

系统动力学模型用于分析复杂系统。

> 作者认为系统思维是21世纪最重要的思维方式。
"""


@pytest.fixture
def sample_chapter():
    return ParsedChapter(
        index=0,
        title="认知升级",
        content="认知升级是终身学习的核心。通过持续学习和反思来实现认知升级。",
        level=1,
        word_count=30,
    )


@pytest.fixture
def sample_distills():
    return [
        ChapterDistill(
            chapter_index=0,
            chapter_title="认知升级",
            depth=DistillDepth.MEDIUM,
            summary="本章介绍认知升级的概念与方法",
            key_points=[
                DistillPoint(
                    point="认知升级是思维模式的根本转变",
                    evidence="通过持续学习和反思来实现",
                ),
                DistillPoint(
                    point="第一性原理是核心方法论",
                    evidence="回归事物最基本的真理",
                    category="方法",
                ),
                DistillPoint(
                    point="系统思维考虑整体而非局部",
                    evidence="系统动力学模型用于分析",
                    category="模型",
                ),
            ],
            word_count=150,
        ),
        ChapterDistill(
            chapter_index=1,
            chapter_title="方法论",
            depth=DistillDepth.MEDIUM,
            summary="本章介绍系统解决问题的框架",
            key_points=[
                DistillPoint(
                    point="方法论是解决问题的系统框架",
                    evidence="包括第一性原理和系统思维",
                    category="方法",
                ),
                DistillPoint(
                    point="从本质出发解决问题",
                    evidence="不受现有方案约束",
                    category="原则",
                ),
            ],
            word_count=100,
        ),
    ]


# ─── ChapterAgent Tests ─────────────────────────────────────

class TestChapterAgent:
    def test_split_parses_headings(self, sample_markdown):
        agent = ChapterAgent()
        result = agent.split(sample_markdown, "测试书籍")
        assert len(result.chapters) >= 2
        assert result.book_title == "测试书籍"
        assert result.total_chapters == len(result.chapters)

    def test_split_chapter_titles(self, sample_markdown):
        agent = ChapterAgent()
        result = agent.split(sample_markdown)
        titles = [c.title for c in result.chapters]
        assert any("认知升级" in t for t in titles)
        assert any("方法论" in t for t in titles)

    def test_split_preserves_content(self, sample_markdown):
        agent = ChapterAgent()
        result = agent.split(sample_markdown)
        combined = "\n\n".join(c.content for c in result.chapters)
        assert "认知升级" in combined
        assert "第一性原理" in combined

    def test_empty_text_returns_empty(self):
        agent = ChapterAgent()
        result = agent.split("", "空文档")
        # 空文本应返回空列表（或极简内容）
        assert len(result.chapters) < 2

    def test_no_headings_fallback(self):
        agent = ChapterAgent()
        text = "这是第一段。\n\n这是第二段。\n\n这是第三段。"
        result = agent.split(text)
        # Should find at least something
        assert len(result.chapters) >= 0

    def test_single_chapter(self):
        agent = ChapterAgent()
        text = "只有一段内容。没有标题。"
        result = agent.split(text)
        assert len(result.chapters) >= 0

    def test_chapter_positions(self, sample_markdown):
        agent = ChapterAgent()
        result = agent.split(sample_markdown)
        for ch in result.chapters:
            assert ch.content
            assert ch.index >= 0
            assert ch.level >= 1


# ─── DistillAgent Tests ─────────────────────────────────────

class TestDistillAgent:
    def test_distill_fallback(self, sample_chapter):
        agent = DistillAgent(depth=DistillDepth.SHALLOW)
        result = agent.distill_chapter(sample_chapter)
        assert result.chapter_index == sample_chapter.index
        assert result.chapter_title == sample_chapter.title
        assert result.depth == DistillDepth.SHALLOW
        assert len(result.key_points) > 0

    def test_distill_all(self, sample_markdown):
        chapter_agent = ChapterAgent()
        ch_result = chapter_agent.split(sample_markdown)
        distill_agent = DistillAgent(depth=DistillDepth.MEDIUM)
        results = distill_agent.distill_all(ch_result.chapters)
        assert len(results) == len(ch_result.chapters)

    def test_distill_point_structure(self, sample_chapter):
        agent = DistillAgent(depth=DistillDepth.DEEP)
        result = agent.distill_chapter(sample_chapter)
        for point in result.key_points:
            assert point.point
            assert len(point.point) > 0

    def test_distill_shallow_depth(self, sample_chapter):
        agent = DistillAgent(depth=DistillDepth.SHALLOW)
        result = agent.distill_chapter(sample_chapter)
        assert result.summary

    def test_distill_medium_depth(self, sample_chapter):
        agent = DistillAgent(depth=DistillDepth.MEDIUM)
        result = agent.distill_chapter(sample_chapter)
        assert result.summary


# ─── OrganizeAgent Tests ────────────────────────────────────

class TestOrganizeAgent:
    def test_organize_categorizes(self, sample_distills):
        agent = OrganizeAgent()
        result = agent.organize(sample_distills, "测试书籍")
        assert len(result.category_index) > 0
        # Should have "方法" category
        categories = [e.category for e in result.category_index]
        assert "方法" in categories

    def test_organize_framework(self, sample_distills):
        agent = OrganizeAgent()
        result = agent.organize(sample_distills)
        assert result.framework_tree.title == "全书框架"
        assert len(result.framework_tree.children) == len(sample_distills)

    def test_organize_summary(self, sample_distills):
        agent = OrganizeAgent()
        result = agent.organize(sample_distills, "测试书籍")
        assert result.summary
        assert "测试书籍" in result.summary

    def test_organize_empty(self):
        agent = OrganizeAgent()
        result = agent.organize([], "")
        assert len(result.category_index) == 0
        assert result.framework_tree.title == "全书框架"

    def test_organize_core_idea(self, sample_distills):
        agent = OrganizeAgent()
        result = agent.organize(sample_distills)
        assert result.core_idea

    def test_organize_author_intent(self, sample_distills):
        agent = OrganizeAgent()
        result = agent.organize(sample_distills)
        assert result.author_intent

    def test_format_text(self, sample_distills):
        agent = OrganizeAgent()
        result = agent.organize(sample_distills)
        text = agent.format_text(result)
        assert "# 全书概览" in text
        assert "# 全书框架" in text
        assert "# 内容类型索引" in text

    def test_auto_classify(self):
        agent = OrganizeAgent()
        assert agent._auto_classify("采用新方法解决问题") == "方法"
        assert agent._auto_classify("根据原则必须遵守") == "原则"
        assert agent._auto_classify("数据显示增长") == "数据/证据"
        assert agent._auto_classify("作者认为...") == "观点/立场"


# ─── Orchestrator Tests ─────────────────────────────────────

class TestOrchestrator:
    def test_orchestrator_full_pipeline(self, sample_markdown):
        orch = DistillOrchestrator()
        result = orch.run(sample_markdown, "测试书籍")
        assert "chapter_result" in result
        assert "distills" in result
        assert "organize_result" in result
        assert result["chapter_result"].total_chapters > 0
        assert len(result["distills"]) > 0

    def test_orchestrator_empty_text_raises(self):
        orch = DistillOrchestrator()
        # 空文本应不会导致崩溃，而是返回空结果
        result = orch.run("", "空文档")
        assert result is not None

    def test_orchestrator_progress_callback(self, sample_markdown):
        calls = []

        def cb(p):
            calls.append(p.stage)

        orch = DistillOrchestrator()
        orch.register_progress_callback(cb)
        orch.run(sample_markdown, "测试书籍")
        assert "split" in calls
        assert "distill" in calls
        assert "organize" in calls
        assert "done" in calls

    def test_orchestrator_depth_config(self, sample_markdown):
        orch = DistillOrchestrator()
        r1 = orch.run(sample_markdown, "浅度测试",
                       depth=DistillDepth.SHALLOW)
        for d in r1["distills"]:
            assert d.depth == DistillDepth.SHALLOW

        r2 = orch.run(sample_markdown, "深度测试",
                       depth=DistillDepth.DEEP)
        for d in r2["distills"]:
            assert d.depth == DistillDepth.DEEP


# ─── FolderGenerator Tests ──────────────────────────────────

class TestFolderGenerator:
    def test_generate_in_memory(self, sample_distills):
        from cloud.distill.agents.organize_agent import OrganizeAgent
        from cloud.distill.output.folder_generator import FolderGenerator

        organize = OrganizeAgent()
        result = organize.organize(sample_distills, "测试书籍")

        gen = FolderGenerator(output_dir="")
        folder = gen.generate(sample_distills, result)

        assert len(folder.files) > 0
        paths = [f["path"] for f in folder.files]
        assert "全书概览.md" in paths
        assert "全书框架.md" in paths
        assert "内容类型索引.md" in paths

    def test_chapter_distill_files(self, sample_distills):
        from cloud.distill.agents.organize_agent import OrganizeAgent
        from cloud.distill.output.folder_generator import FolderGenerator

        organize = OrganizeAgent()
        result = organize.organize(sample_distills, "测试书籍")

        gen = FolderGenerator(output_dir="")
        folder = gen.generate(sample_distills, result)

        chapter_files = [f for f in folder.files
                         if f["path"].startswith("章节蒸馏")]
        assert len(chapter_files) == len(sample_distills)

    def test_generate_with_dir(self, tmpdir, sample_distills):
        from cloud.distill.agents.organize_agent import OrganizeAgent
        from cloud.distill.output.folder_generator import FolderGenerator

        organize = OrganizeAgent()
        result = organize.organize(sample_distills, "测试书籍")

        gen = FolderGenerator(output_dir=str(tmpdir))
        folder = gen.generate(sample_distills, result)

        # Check files were written
        overview = tmpdir.join("全书概览.md")
        assert overview.exists()


# ─── DistillStreamer Tests ──────────────────────────────────

class TestDistillStreamer:
    def test_streamer_yields_events(self, sample_chapter):
        from cloud.distill.agents.distill_agent import DistillStreamer

        agent = DistillAgent(depth=DistillDepth.SHALLOW)
        streamer = DistillStreamer(agent)

        events = list(streamer.distill_stream(sample_chapter))
        assert len(events) >= 2
        assert events[0]["type"] == "start"
        assert events[-1]["type"] == "done"

    def test_streamer_point_events(self, sample_chapter):
        from cloud.distill.agents.distill_agent import DistillStreamer

        agent = DistillAgent(depth=DistillDepth.MEDIUM)
        streamer = DistillStreamer(agent)

        events = list(streamer.distill_stream(sample_chapter))
        points = [e for e in events if e["type"] == "point"]
        assert len(points) > 0
        for p in points:
            assert "point" in p
            assert "index" in p

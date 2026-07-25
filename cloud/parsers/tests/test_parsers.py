"""
Unit tests for KnowScape Cloud Parser Engine.

Run:
    pip install pytest
    pytest cloud/parsers/ -v
"""

import json
import os
import tempfile
import pytest
from pathlib import Path

# Add project root to path so `cloud.parsers` is importable
import sys
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from cloud.parsers import (
    ParserEngine, ParseOptions, DocumentFormat,
    MarkdownParser, EpubParser, PdfParser, DocxParser, HtmlParser,
    ParsedDocument, Chapter,
    normalize_text, extract_title_from_markdown, split_into_chapters,
    hash_text, is_chinese_text,
)


# ─── Format Detection Tests ──────────────────────────────────

class TestFormatDetection:
    def test_epub(self):
        assert DocumentFormat.from_path("book.epub") == DocumentFormat.EPUB

    def test_pdf(self):
        assert DocumentFormat.from_path("doc.pdf") == DocumentFormat.PDF

    def test_mobi(self):
        assert DocumentFormat.from_path("book.mobi") == DocumentFormat.MOBI

    def test_azw(self):
        assert DocumentFormat.from_path("book.azw3") == DocumentFormat.AZW

    def test_latex(self):
        assert DocumentFormat.from_path("paper.tex") == DocumentFormat.LATEX

    def test_docx(self):
        assert DocumentFormat.from_path("report.docx") == DocumentFormat.DOCX

    def test_markdown(self):
        assert DocumentFormat.from_path("readme.md") == DocumentFormat.MARKDOWN

    def test_html(self):
        assert DocumentFormat.from_path("page.html") == DocumentFormat.HTML

    def test_url(self):
        assert DocumentFormat.from_path("https://example.com") == DocumentFormat.URL

    def test_unknown(self):
        assert DocumentFormat.from_path("file.xyz") == DocumentFormat.UNKNOWN


# ─── Utility Tests ───────────────────────────────────────────

class TestUtils:
    def test_normalize_removes_bom(self):
        assert normalize_text("\ufeffHello\nWorld\r\n") == "Hello\nWorld"

    def test_extract_title(self):
        text = "# Title\n\nContent\n## Section\n"
        assert extract_title_from_markdown(text) == "Title"

    def test_extract_title_no_h1(self):
        assert extract_title_from_markdown("No heading") is None

    def test_split_chapters(self):
        text = "# Ch1\nA\n# Ch2\nB\n## C\nD"
        chapters = split_into_chapters(text)
        assert len(chapters) >= 2
        assert chapters[0][1] == "Ch1"
        assert chapters[1][1] == "Ch2"

    def test_is_chinese(self):
        assert is_chinese_text("中文测试") is True
        assert is_chinese_text("English only") is False

    def test_hash_text(self):
        h = hash_text("hello")
        assert len(h) == 64
        assert h == hash_text("hello")


# ─── Markdown Parser Tests ───────────────────────────────────

class TestMarkdownParser:
    def test_parse_basic(self):
        content = "# Test\n\nParagraph\n\n## Section\n\nContent"
        doc = MarkdownParser.parse_from_string(content, "test.md")
        assert doc.metadata.title == "Test"
        assert len(doc.chapters) >= 2

    def test_parse_empty_raises(self):
        with pytest.raises(ValueError, match="Empty document"):
            MarkdownParser.parse_from_string("", "empty.md")

    def test_parse_file(self):
        with tempfile.NamedTemporaryFile(mode="w", suffix=".md", delete=False) as f:
            f.write("# File Title\n\nContent")
            f.close()
            doc = MarkdownParser.parse(f.name, ParseOptions())
            assert doc.metadata.title == "File Title"
            os.unlink(f.name)

    def test_parse_single_chapter(self):
        doc = MarkdownParser.parse_from_string("Just plain text", "plain.md")
        assert len(doc.chapters) == 1
        assert doc.chapters[0].title in ("plain", "前言")

    def test_parse_chinese(self):
        content = "# 认知红利\n\n内容\n\n## 第1章\n\n第一章内容"
        doc = MarkdownParser.parse_from_string(content, "book.md")
        assert doc.metadata.language == "zh"
        assert doc.metadata.title == "认知红利"


# ─── JSON Roundtrip Tests ────────────────────────────────────

class TestSerialization:
    def test_to_from_json(self):
        doc = MarkdownParser.parse_from_string("# Test\n\nContent", "test.md")
        json_str = doc.to_json()
        restored = ParsedDocument.from_json(json_str)
        assert restored.metadata.title == doc.metadata.title
        assert len(restored.chapters) == len(doc.chapters)
        assert restored.full_text == doc.full_text

    def test_json_has_all_fields(self):
        doc = MarkdownParser.parse_from_string("# Test\n\nContent", "test.md")
        data = json.loads(doc.to_json())
        assert "id" in data
        assert "metadata" in data
        assert "full_text" in data
        assert "chapters" in data
        assert "notes" in data


# ─── Parser Engine Tests ─────────────────────────────────────

class TestParserEngine:
    def test_engine_create(self):
        engine = ParserEngine()
        assert engine is not None

    def test_engine_markdown(self):
        with tempfile.NamedTemporaryFile(mode="w", suffix=".md", delete=False) as f:
            f.write("# Engine\n\nContent")
            f.close()
            engine = ParserEngine()
            doc = engine.parse(f.name)
            assert doc.metadata.title == "Engine"
            os.unlink(f.name)

    def test_supported_formats(self):
        formats = ParserEngine.supported_formats()
        assert len(formats) >= 8


# ─── HTML Parser Tests ───────────────────────────────────────

class TestHtmlParser:
    def test_html_to_markdown_headings(self):
        html = "<h1>Title</h1><p>Paragraph</p><h2>Section</h2><p>Content</p>"
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(html, "html.parser")
        md = HtmlParser._soup_to_markdown(soup)
        assert "# Title" in md
        assert "## Section" in md
        assert "Paragraph" in md

    def test_html_extract_title(self):
        html = "<html><head><title>My Page</title></head><body></body></html>"
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(html, "html.parser")
        assert soup.title.get_text(strip=True) == "My Page"


# ─── Chapter Structure Tests ────────────────────────────────

class TestChapterStructure:
    def test_chapter_creation(self):
        ch = Chapter(index=0, title="Test", level=1,
                     content="Content", start_pos=0, end_pos=7)
        assert ch.title == "Test"
        assert ch.content == "Content"

    def test_chapter_positions(self):
        text = "# A\n\n# B\n\n# C"
        chapters = split_into_chapters(text)
        for idx, _, _, start, end in chapters:
            assert start < end
            assert 0 <= start <= len(text)
            assert 0 <= end <= len(text)


# ─── HTML Parser Enhancement ─────────────────────────────────

class TestHtmlExtended:
    """Additional HTML parser tests using the string-based approach."""

    @pytest.fixture
    def simple_html(self):
        return """
        <!DOCTYPE html>
        <html>
        <head><title>测试文章</title></head>
        <body>
            <h1>第一章</h1>
            <p>这是第一段内容。</p>
            <h2>第一节</h2>
            <p>这是子节内容。</p>
            <ul>
                <li>第一项</li>
                <li>第二项</li>
            </ul>
            <blockquote>引用内容</blockquote>
        </body>
        </html>
        """

    def test_parse_simple_html(self, simple_html):
        with tempfile.NamedTemporaryFile(mode="w", suffix=".html", delete=False) as f:
            f.write(simple_html)
            f.close()
            engine = ParserEngine()
            doc = engine.parse(f.name)
            assert doc.metadata.title == "测试文章"
            assert len(doc.chapters) >= 1
            os.unlink(f.name)


# ─── DOCX Parser Tests ───────────────────────────────────────

class TestDocxParser:
    def test_docx_no_file(self):
        pytest.importorskip("docx", reason="python-docx not installed")
        with pytest.raises(FileNotFoundError):
            DocxParser.parse("/nonexistent/doc.docx", ParseOptions())


# ─── PDF Parser Tests ────────────────────────────────────────

class TestPdfParser:
    def test_pdf_no_file(self):
        with pytest.raises(FileNotFoundError):
            PdfParser.parse("/nonexistent/doc.pdf", ParseOptions())

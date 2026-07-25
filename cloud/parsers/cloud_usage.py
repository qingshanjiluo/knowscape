#!/usr/bin/env python3
"""
KnowScape Cloud Parser — Usage Examples

Run:
    pip install -r requirements.txt
    python cloud_usage.py <file_or_url>
"""

import json
import sys
import logging
from pathlib import Path

# Add parsers to path
sys.path.insert(0, str(Path(__file__).parent))
from parsers import ParserEngine, ParseOptions, DocumentFormat

logging.basicConfig(level=logging.INFO)


def main():
    if len(sys.argv) < 2:
        print("Usage: python cloud_usage.py <path_or_url>")
        print("Examples:")
        print("  python cloud_usage.py book.epub")
        print("  python cloud_usage.py https://example.com/article")
        print("  python cloud_usage.py --manual 'content string'")
        sys.exit(1)

    engine = ParserEngine()
    options = ParseOptions()

    if sys.argv[1] == "--manual":
        # Manual upload fallback
        content = sys.argv[2] if len(sys.argv) > 2 else "# Manual\n\nContent"
        doc = engine.parse_with_format(
            "manual.md", DocumentFormat.MARKDOWN, options
        )
        # Actually use parse_from_string for manual content
        from parsers import MarkdownParser
        doc = MarkdownParser.parse_from_string(content, "manual.md")
        print("📖 Manual upload result:")
    else:
        # Auto-detect and parse
        path_or_url = sys.argv[1]
        print(f"📖 Detecting format for: {path_or_url}")
        fmt = DocumentFormat.from_path(path_or_url)
        print(f"   Format: {fmt.value} ({fmt.description()})")

        print("⏳ Parsing...")
        doc = engine.parse(path_or_url, options)

    # Display results
    print(f"\n✅ Parsed: {doc.metadata.title}")
    print(f"   Author: {doc.metadata.author}")
    print(f"   Chapters: {len(doc.chapters)}")
    print(f"   Word count: {doc.metadata.word_count}")
    print(f"   OCR applied: {doc.metadata.ocr_applied}")
    print(f"   Source hash: {doc.metadata.source_hash[:16]}...")

    for chapter in doc.chapters:
        print(f"   📄 [{chapter.index+1}] {chapter.title} "
              f"(level {chapter.level}, {len(chapter.content)} chars)")

    for note in doc.notes:
        print(f"   ℹ️  {note}")

    # Export to JSON
    output_path = f"{doc.metadata.source_hash[:8]}.json"
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(doc.to_json())
    print(f"\n💾 Results saved to: {output_path}")
    print(f"   Full text: {len(doc.full_text)} chars")


def demo_parse_from_string():
    """Example: parse Markdown from string (manual upload)."""
    from parsers import MarkdownParser

    content = """
# 认知红利

## 第1章 重新认识自己
内容...

## 第2章 思维升级
更多内容...
"""
    doc = MarkdownParser.parse_from_string(content)
    print(f"Parsed: {doc.metadata.title}")
    print(f"Chapters: {len(doc.chapters)}")


def demo_format_detection():
    """Example: test format detection."""
    engine = ParserEngine()
    test_cases = [
        "book.epub", "article.pdf", "novel.mobi",
        "reference.azw3", "paper.tex", "report.docx",
        "readme.md", "index.html",
        "https://example.com/post", "notes.txt",
    ]
    for path in test_cases:
        fmt = DocumentFormat.from_path(path)
        print(f"{path:30} → {fmt.value:12} ({fmt.description()})")


def demo_ocr_check():
    """Example: check if OCR is available."""
    try:
        import pytesseract
        print(f"Tesseract version: {pytesseract.get_tesseract_version()}")
    except ImportError:
        print("pytesseract not installed")
    except Exception as e:
        print(f"Tesseract not available: {e}")


if __name__ == "__main__":
    main()

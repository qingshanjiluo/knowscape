document parsing engine
========================

All format parsers, OCR, and utilities.

## Manual Testing

### 1. Test with a Markdown file (no external tools needed)

```bash
# Create a test file
cat > /tmp/test_book.md << 'EOF'
# 测试书籍

## 第一章：介绍
这是第一章的内容。

## 第二章：深入
这是第二章的内容，包含**粗体**和*斜体*。

> 这是一段引用
EOF

# Run the binary
cargo run --bin parser-demo -- /tmp/test_book.md
```

### 2. Test with EPUB

```bash
# Download a sample EPUB
wget https://www.gutenberg.org/ebooks/1342.epub -O /tmp/pride.epub
cargo run --bin parser-demo -- /tmp/pride.epub
```

### 3. Test OCR (requires Tesseract)

```bash
# Check Tesseract is installed
tesseract --version

# Run on a scanned PDF
cargo run --bin parser-demo -- /tmp/scanned.pdf
```

### 4. Test URL fetching

```bash
cargo run --bin parser-demo -- https://example.com
```

## Python Cloud Tests

```bash
cd cloud/parsers
pip install -r requirements.txt
python cloud_usage.py /tmp/test_book.md
```

## Running Rust Unit Tests

```bash
# From workspace root
cargo test -p knowscape-parser

# With logs
cargo test -p knowscape-parser -- --nocapture

# Specific test
cargo test -p knowscape-parser -- test_split_chapters
```

## Running Python Tests

```bash
cd cloud/parsers
pip install pytest
python -m pytest tests/ -v
```

## External Tools Setup

### Tesseract OCR (required for scanned PDFs)
```bash
# macOS
brew install tesseract tesseract-lang

# Ubuntu/Debian
sudo apt install tesseract-ocr tesseract-ocr-chi-sim

# Windows
# Download from https://github.com/UB-Mannheim/tesseract/wiki
```

### Calibre (required for MOBI/AZW)
```bash
# macOS
brew install calibre

# Ubuntu/Debian
sudo apt install calibre

# Windows
# Download from https://calibre-ebook.com/download
```

### Pandoc (required for LaTeX)
```bash
# macOS
brew install pandoc

# Ubuntu/Debian
sudo apt install pandoc

# Windows
# Download from https://pandoc.org/installing.html
```

## Cargo Test Expectations

| Test | Expected | Notes |
|------|----------|-------|
| `test_split_chapters` | ✅ Pass | Pure utility, no externals |
| `test_extract_title` | ✅ Pass | Pure utility |
| `test_parse_markdown_file` | ✅ Pass | Creates temp files |
| `test_format_detection` | ✅ Pass | Pattern matching only |
| `test_parse_from_json_roundtrip` | ✅ Pass | Serialization only |
| `test_parse_nonexistent_file` | ✅ Pass | Error path |
| `test_html_to_markdown_basic` | ✅ Pass | HTML parsing |
| `test_markdown_from_string` | ✅ Pass | Manual upload fallback |

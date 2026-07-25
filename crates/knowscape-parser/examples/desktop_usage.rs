/// Usage example: Desktop (Rust/Tauri) integration
///
/// This example shows how to use knowscape-parser in a Tauri command.
///
/// Add to Cargo.toml:
/// ```toml
/// [dependencies]
/// knowscape-parser = { path = "../crates/knowscape-parser" }
/// ```

use knowscape_parser::{ParserEngine, ParseOptions, DocumentFormat};

/// Example Tauri command: parse a book
#[tauri::command]
fn parse_book(path: String) -> Result<String, String> {
    let engine = ParserEngine::new();
    let options = ParseOptions::default();

    match engine.parse(&path, &options) {
        Ok(doc) => {
            // Return JSON string to frontend
            doc.to_json().map_err(|e| e.to_string())
        }
        Err(e) => {
            // Check if it's a missing external tool
            if let knowscape_parser::error::ParseError::ExternalToolError { tool, message } = &e {
                Err(format!("需要 {}: {}", tool, message))
            } else {
                Err(format!("解析失败: {}", e))
            }
        }
    }
}

/// Example: Parse with explicit format and progress callback
fn parse_with_progress(path: &str) -> Result<(), Box<dyn std::error::Error>> {
    let engine = ParserEngine::new();
    let fmt = DocumentFormat::from_path(path);

    println!("📖 Detected format: {:?}", fmt);
    println!("⏳ Parsing...");

    let doc = engine.parse(path, &ParseOptions::default())?;

    println!("✅ Parsed: {}", doc.metadata.title);
    println!("   Author: {}", doc.metadata.author);
    println!("   Chapters: {}", doc.chapters.len());
    println!("   Word count: {}", doc.metadata.word_count);
    println!("   OCR applied: {}", doc.metadata.ocr_applied);

    // Show chapter listing
    for chapter in &doc.chapters {
        println!("   📄 Chapter {}: {} ({} chars)",
            chapter.index + 1, chapter.title, chapter.content.len());
    }

    // Show notes/warnings
    for note in &doc.notes {
        println!("   ℹ️  {}", note);
    }

    Ok(())
}

/// Example: Manual upload fallback (user uploads plain text/Markdown)
fn handle_manual_upload(text: &str, filename: &str) -> Result<String, String> {
    knowscape_parser::markdown::MarkdownParser::parse_from_string(text, filename)
        .map(|doc| doc.to_json().unwrap_or_default())
        .map_err(|e| format!("手动上传内容解析失败: {}", e))
}

/// Example: Test format detection
fn test_detection() {
    let test_cases = vec![
        "book.epub",
        "article.pdf",
        "novel.mobi",
        "reference.azw3",
        "paper.tex",
        "report.docx",
        "readme.md",
        "index.html",
        "https://example.com/post",
        "notes.txt",
    ];

    for path in test_cases {
        let fmt = DocumentFormat::from_path(path);
        println!("{:30} → {:?} ({})", path, fmt, fmt.description());
    }
}

/// Main demo
fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Test format detection
    test_detection();

    // Parse a markdown file (if available)
    let test_md = "test_book.md";
    if std::path::Path::new(test_md).exists() {
        parse_with_progress(test_md)?;
    } else {
        // Create and parse from string
        let content = "# 认知红利\n\n## 第1章 重新认识自己\n\n内容...\n\n## 第2章 思维升级\n\n更多内容...";
        let json = handle_manual_upload(content, "认知红利.md")?;
        println!("Manual upload result: {} bytes", json.len());
    }

    Ok(())
}

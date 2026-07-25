use knowscape_parser::{ParserEngine, ParseOptions, DocumentFormat};
use knowscape_parser::error::ParseError;
use knowscape_parser::markdown::MarkdownParser;
use knowscape_parser::types::ParsedDocument;
use serde::Serialize;
use std::path::Path;

/// Unified result sent to the frontend after parsing
#[derive(Serialize)]
pub struct ParseResultResponse {
    pub success: bool,
    pub book_id: Option<String>,
    pub title: String,
    pub author: String,
    pub chapters: usize,
    pub word_count: usize,
    pub ocr_applied: bool,
    pub notes: Vec<String>,
    pub error: Option<String>,
    pub needs_tool: Option<String>,  // If an external tool is missing
}

/// Tauri command: parse a book file
#[tauri::command]
pub async fn parse_book(
    path: String,
    ocr_enabled: Option<bool>,
    ocr_language: Option<String>,
) -> ParseResultResponse {
    let path_ref = Path::new(&path);

    if !path_ref.exists() {
        return ParseResultResponse {
            success: false,
            book_id: None,
            title: String::new(),
            author: String::new(),
            chapters: 0,
            word_count: 0,
            ocr_applied: false,
            notes: vec![],
            error: Some(format!("文件不存在: {}", path)),
            needs_tool: None,
        };
    }

    let mut options = ParseOptions::default();
    options.ocr.enabled = ocr_enabled.unwrap_or(true);
    if let Some(lang) = ocr_language {
        options.ocr.language = lang;
    }

    let engine = ParserEngine::new();

    match engine.parse(&path, &options) {
        Ok(doc) => {
            log::info!("Parse success: {} ({} chapters, {} words)",
                doc.metadata.title, doc.chapters.len(), doc.metadata.word_count);

            ParseResultResponse {
                success: true,
                book_id: Some(doc.id.clone()),
                title: doc.metadata.title,
                author: doc.metadata.author,
                chapters: doc.chapters.len(),
                word_count: doc.metadata.word_count,
                ocr_applied: doc.metadata.ocr_applied,
                notes: doc.notes,
                error: None,
                needs_tool: None,
            }
        }
        Err(ParseError::ExternalToolError { tool, message }) => {
            log::warn!("Missing tool {}: {}", tool, message);
            ParseResultResponse {
                success: false,
                book_id: None,
                title: String::new(),
                author: String::new(),
                chapters: 0,
                word_count: 0,
                ocr_applied: false,
                notes: vec![],
                error: Some(message),
                needs_tool: Some(tool),
            }
        }
        Err(e) => {
            log::error!("Parse failed: {}", e);
            ParseResultResponse {
                success: false,
                book_id: None,
                title: String::new(),
                author: String::new(),
                chapters: 0,
                word_count: 0,
                ocr_applied: false,
                notes: vec![],
                error: Some(e.to_string()),
                needs_tool: None,
            }
        }
    }
}

/// Tauri command: manually upload content (fallback when format conversion fails)
#[tauri::command]
pub async fn manual_upload(
    content: String,
    filename: String,
) -> ParseResultResponse {
    match MarkdownParser::parse_from_string(&content, &filename) {
        Ok(doc) => ParseResultResponse {
            success: true,
            book_id: Some(doc.id),
            title: doc.metadata.title,
            author: doc.metadata.author,
            chapters: doc.chapters.len(),
            word_count: doc.metadata.word_count,
            ocr_applied: false,
            notes: doc.notes,
            error: None,
            needs_tool: None,
        },
        Err(e) => ParseResultResponse {
            success: false,
            book_id: None,
            title: String::new(),
            author: String::new(),
            chapters: 0,
            word_count: 0,
            ocr_applied: false,
            notes: vec![],
            error: Some(e.to_string()),
            needs_tool: None,
        },
    }
}

/// Tauri command: detect format without full parsing
#[tauri::command]
pub async fn detect_format(path: String) -> Result<serde_json::Value, String> {
    let fmt = DocumentFormat::from_path(&path);
    Ok(serde_json::json!({
        "format": format!("{:?}", fmt),
        "description": fmt.description(),
        "supported": fmt != DocumentFormat::Unknown,
    }))
}

/// Tauri command: check if required external tools are installed
#[tauri::command]
pub async fn check_external_tools() -> serde_json::Value {
    let tesseract = std::process::Command::new("tesseract")
        .arg("--version")
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false);

    let calibre = std::process::Command::new("ebook-convert")
        .arg("--version")
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false);

    let pandoc = std::process::Command::new("pandoc")
        .arg("--version")
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false);

    serde_json::json!({
        "tesseract": tesseract,
        "calibre": calibre,
        "pandoc": pandoc,
        "all_available": tesseract || true, // OCR is optional
    })
}

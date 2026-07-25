//! # KnowScape Document Parsing Engine
//!
//! Unified document parser supporting EPUB, PDF, MOBI, AZW, LaTeX, DOCX,
//! Markdown, HTML, and URL sources. All formats output unified Markdown.
//!
//! ## Usage
//!
//! ```rust
//! use knowscape_parser::{ParserEngine, DocumentFormat, ParseOptions};
//!
//! let engine = ParserEngine::new();
//! let result = engine.parse("book.epub", &ParseOptions::default())?;
//! println!("Title: {}", result.metadata.title);
//! println!("Chapters: {}", result.chapters.len());
//! ```

pub mod types;
pub mod error;
pub mod utils;
pub mod epub;
pub mod pdf;
pub mod mobi;
pub mod latex;
pub mod docx;
pub mod html;
pub mod markdown;
pub mod ocr;

use std::path::Path;
pub use types::*;
pub use error::*;

/// Main entry point for the document parsing engine.
/// Detects format and dispatches to the appropriate parser.
pub struct ParserEngine;

impl ParserEngine {
    /// Create a new parser engine instance.
    pub fn new() -> Self {
        Self
    }

    /// Parse a document from a file path or URL.
    /// Auto-detects format from file extension.
    pub fn parse(&self, path_or_url: &str, options: &ParseOptions) -> ParseResult<ParsedDocument> {
        let format = DocumentFormat::from_path(path_or_url);

        log::info!("Detected format: {:?} for path: {}", format, path_or_url);

        match format {
            DocumentFormat::Epub => epub::EpubParser::parse(path_or_url, options),
            DocumentFormat::Pdf => pdf::PdfParser::parse(path_or_url, options),
            DocumentFormat::Mobi | DocumentFormat::Azw => mobi::MobiParser::parse(path_or_url, options),
            DocumentFormat::Latex => latex::LatexParser::parse(path_or_url, options),
            DocumentFormat::Docx => docx::DocxParser::parse(path_or_url, options),
            DocumentFormat::Markdown | DocumentFormat::PlainText => {
                markdown::MarkdownParser::parse(path_or_url, options)
            }
            DocumentFormat::Html => html::HtmlParser::parse(path_or_url, options),
            DocumentFormat::Url => html::HtmlParser::parse(path_or_url, options),
            DocumentFormat::Unknown => {
                // Last resort: try to read as text
                log::warn!("Unknown format, trying as plain text: {}", path_or_url);
                let path = Path::new(path_or_url);
                if path.exists() {
                    let bytes = std::fs::read(path)
                        .map_err(|e| ParseError::IoError(e))?;
                    let text = utils::detect_and_decode(&bytes)?;
                    markdown::MarkdownParser::parse_from_string(&text, path_or_url)
                } else {
                    Err(ParseError::UnsupportedFormat(path_or_url.to_string()))
                }
            }
        }
    }

    /// Parse with explicit format specification (skip auto-detection).
    pub fn parse_with_format(
        &self,
        path: &str,
        format: DocumentFormat,
        options: &ParseOptions,
    ) -> ParseResult<ParsedDocument> {
        log::info!("Parsing with explicit format: {:?}", format);

        match format {
            DocumentFormat::Epub => epub::EpubParser::parse(path, options),
            DocumentFormat::Pdf => pdf::PdfParser::parse(path, options),
            DocumentFormat::Mobi | DocumentFormat::Azw => mobi::MobiParser::parse(path, options),
            DocumentFormat::Latex => latex::LatexParser::parse(path, options),
            DocumentFormat::Docx => docx::DocxParser::parse(path, options),
            DocumentFormat::Markdown | DocumentFormat::PlainText => {
                markdown::MarkdownParser::parse(path, options)
            }
            DocumentFormat::Html | DocumentFormat::Url => html::HtmlParser::parse(path, options),
            DocumentFormat::Unknown => Err(ParseError::UnsupportedFormat(path.to_string())),
        }
    }

    /// Check if a format is supported natively (without external tools)
    pub fn is_natively_supported(format: &DocumentFormat) -> bool {
        matches!(format,
            DocumentFormat::Epub
            | DocumentFormat::Pdf
            | DocumentFormat::Docx
            | DocumentFormat::Markdown
            | DocumentFormat::Html
            | DocumentFormat::Url
            | DocumentFormat::PlainText
        )
    }

    /// Check if a format requires external tools (Calibre, Pandoc)
    pub fn requires_external_tool(format: &DocumentFormat) -> Option<&'static str> {
        match format {
            DocumentFormat::Mobi | DocumentFormat::Azw => Some("calibre (ebook-convert)"),
            DocumentFormat::Latex => Some("pandoc"),
            _ => None,
        }
    }

    /// Get list of all supported formats with descriptions
    pub fn supported_formats() -> Vec<(DocumentFormat, &'static str)> {
        vec![
            (DocumentFormat::Epub, "EPUB eBook"),
            (DocumentFormat::Pdf, "PDF Document (text + scanned)"),
            (DocumentFormat::Mobi, "MOBI eBook (requires Calibre)"),
            (DocumentFormat::Azw, "AZW eBook (requires Calibre)"),
            (DocumentFormat::Latex, "LaTeX Document (requires Pandoc)"),
            (DocumentFormat::Docx, "Word Document"),
            (DocumentFormat::Markdown, "Markdown"),
            (DocumentFormat::Html, "HTML File"),
            (DocumentFormat::Url, "Web URL"),
            (DocumentFormat::PlainText, "Plain Text"),
        ]
    }
}

impl Default for ParserEngine {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    #[test]
    fn test_format_detection() {
        assert_eq!(DocumentFormat::from_path("book.epub"), DocumentFormat::Epub);
        assert_eq!(DocumentFormat::from_path("doc.pdf"), DocumentFormat::Pdf);
        assert_eq!(DocumentFormat::from_path("book.mobi"), DocumentFormat::Mobi);
        assert_eq!(DocumentFormat::from_path("file.tex"), DocumentFormat::Latex);
        assert_eq!(DocumentFormat::from_path("file.docx"), DocumentFormat::Docx);
        assert_eq!(DocumentFormat::from_path("file.md"), DocumentFormat::Markdown);
        assert_eq!(DocumentFormat::from_path("file.html"), DocumentFormat::Html);
        assert_eq!(
            DocumentFormat::from_path("https://example.com/article"),
            DocumentFormat::Url
        );
        assert_eq!(DocumentFormat::from_path("file.xyz"), DocumentFormat::Unknown);
    }

    #[test]
    fn test_parse_markdown_file() {
        let mut tmp = tempfile::NamedTempFile::new().unwrap();
        write!(tmp, "# Test Book\n\nContent here.\n\n## Chapter 1\n\nChapter content.").unwrap();

        let engine = ParserEngine::new();
        let result = engine.parse(
            tmp.path().to_str().unwrap(),
            &ParseOptions::default(),
        );
        assert!(result.is_ok());
        let doc = result.unwrap();
        assert_eq!(doc.metadata.title, "Test Book");
        assert_eq!(doc.chapters.len(), 2);
        assert!(doc.metadata.word_count > 0);
    }

    #[test]
    fn test_parse_nonexistent_file() {
        let engine = ParserEngine::new();
        let result = engine.parse("/nonexistent/book.epub", &ParseOptions::default());
        assert!(result.is_err());
        match result {
            Err(ParseError::FileNotFound(_)) => {} // expected
            _ => panic!("Expected FileNotFound error"),
        }
    }

    #[test]
    fn test_parse_empty_markdown() {
        let mut tmp = tempfile::NamedTempFile::new().unwrap();
        write!(tmp, "").unwrap();

        let engine = ParserEngine::new();
        let result = engine.parse(
            tmp.path().to_str().unwrap(),
            &ParseOptions::default(),
        );
        assert!(matches!(result, Err(ParseError::EmptyDocument)));
    }

    #[test]
    fn test_supported_formats() {
        let formats = ParserEngine::supported_formats();
        assert!(formats.len() >= 8);
        assert!(formats.iter().any(|(f, _)| *f == DocumentFormat::Epub));
        assert!(formats.iter().any(|(f, _)| *f == DocumentFormat::Pdf));
    }

    #[test]
    fn test_parse_from_json_roundtrip() {
        let content = "# Test\n\nContent";
        let engine = ParserEngine::new();
        let doc = engine.parse_with_format(
            "test.md",
            DocumentFormat::Markdown,
            &ParseOptions::default(),
        );
        // This tests that we can create a document manually too
        let parsed = markdown::MarkdownParser::parse_from_string(content, "test.md").unwrap();
        let json = parsed.to_json().unwrap();
        let restored = ParsedDocument::from_json(&json).unwrap();
        assert_eq!(restored.metadata.title, parsed.metadata.title);
        assert_eq!(restored.chapters.len(), parsed.chapters.len());
    }
}

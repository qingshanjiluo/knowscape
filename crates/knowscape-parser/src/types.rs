use serde::{Deserialize, Serialize};
use std::path::PathBuf;

/// Detected document format
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum DocumentFormat {
    Epub,
    Pdf,
    Mobi,
    Azw,
    Latex,
    Docx,
    Markdown,
    Html,
    Url,
    PlainText,
    Unknown,
}

impl DocumentFormat {
    /// Detect format from file extension or URL
    pub fn from_path(path: &str) -> Self {
        let lower = path.to_lowercase();

        if lower.starts_with("http://") || lower.starts_with("https://") {
            return DocumentFormat::Url;
        }

        let ext = std::path::Path::new(&lower)
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("");

        match ext {
            "epub" => DocumentFormat::Epub,
            "pdf" => DocumentFormat::Pdf,
            "mobi" => DocumentFormat::Mobi,
            "azw" | "azw3" | "azw4" => DocumentFormat::Azw,
            "tex" | "ltx" | "cls" => DocumentFormat::Latex,
            "docx" => DocumentFormat::Docx,
            "md" | "markdown" => DocumentFormat::Markdown,
            "htm" | "html" | "xhtml" => DocumentFormat::Html,
            "txt" => DocumentFormat::PlainText,
            _ => DocumentFormat::Unknown,
        }
    }

    /// Human-readable description
    pub fn description(&self) -> &'static str {
        match self {
            DocumentFormat::Epub => "EPUB eBook",
            DocumentFormat::Pdf => "PDF Document",
            DocumentFormat::Mobi => "MOBI eBook",
            DocumentFormat::Azw => "AZW eBook",
            DocumentFormat::Latex => "LaTeX Document",
            DocumentFormat::Docx => "Word Document",
            DocumentFormat::Markdown => "Markdown",
            DocumentFormat::Html => "HTML",
            DocumentFormat::Url => "Web URL",
            DocumentFormat::PlainText => "Plain Text",
            DocumentFormat::Unknown => "Unknown Format",
        }
    }
}

/// A single chapter/section within the parsed document
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Chapter {
    /// 0-based index
    pub index: usize,
    /// Chapter title
    pub title: String,
    /// Heading level (1 = top-level chapter, 2 = section, etc.)
    pub level: usize,
    /// Content in Markdown format
    pub content: String,
    /// Character offset in the full text where this chapter starts
    pub start_pos: usize,
    /// Character offset where this chapter ends
    pub end_pos: usize,
}

/// Metadata extracted from the document
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocumentMetadata {
    pub title: String,
    pub author: String,
    pub language: String,
    pub source_format: DocumentFormat,
    pub source_path: String,
    pub source_hash: String,
    pub total_chapters: usize,
    pub word_count: usize,
    pub ocr_applied: bool,
}

/// The unified output of the parsing engine
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParsedDocument {
    /// Unique identifier for this parse session
    pub id: String,
    /// Document metadata
    pub metadata: DocumentMetadata,
    /// Full text in Markdown (concatenated chapters)
    pub full_text: String,
    /// Split chapters
    pub chapters: Vec<Chapter>,
    /// Warnings or notes during parsing (e.g., "OCR applied on page 3-5")
    pub notes: Vec<String>,
}

/// OCR configuration
#[derive(Debug, Clone)]
pub struct OcrConfig {
    pub enabled: bool,
    pub language: String,
    pub dpi: u32,
    pub psm: u32,
}

impl Default for OcrConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            language: "chi_sim+eng".to_string(),
            dpi: 300,
            psm: 3,
        }
    }
}

/// Parsing options
#[derive(Debug, Clone)]
pub struct ParseOptions {
    pub ocr: OcrConfig,
    pub extract_chapters: bool,
    pub preserve_formatting: bool,
}

impl Default for ParseOptions {
    fn default() -> Self {
        Self {
            ocr: OcrConfig::default(),
            extract_chapters: true,
            preserve_formatting: true,
        }
    }
}

impl ParsedDocument {
    /// Helper: get a specific chapter by index
    pub fn chapter(&self, index: usize) -> Option<&Chapter> {
        self.chapters.iter().find(|c| c.index == index)
    }

    /// Export as JSON for serialization/storage
    pub fn to_json(&self) -> Result<String, serde_json::Error> {
        serde_json::to_string_pretty(self)
    }

    /// Load from JSON
    pub fn from_json(json: &str) -> Result<Self, serde_json::Error> {
        serde_json::from_str(json)
    }
}

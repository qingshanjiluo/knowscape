use thiserror::Error;

pub type ParseResult<T> = Result<T, ParseError>;

/// Unified error type for all parsing operations
#[derive(Error, Debug)]
pub enum ParseError {
    #[error("Unsupported format: {0}")]
    UnsupportedFormat(String),

    #[error("File not found: {0}")]
    FileNotFound(String),

    #[error("Failed to read file: {0}")]
    IoError(#[from] std::io::Error),

    #[error("EPUB parsing error: {0}")]
    EpubError(String),

    #[error("PDF parsing error: {0}")]
    PdfError(String),

    #[error("DOCX parsing error: {0}")]
    DocxError(String),

    #[error("HTML parsing error: {0}")]
    HtmlError(String),

    #[error("LaTeX parsing error: {0}")]
    LatexError(String),

    #[error("MOBI/AZW parsing error: {0}")]
    MobiError(String),

    #[error("External tool error ({tool}): {message}")]
    ExternalToolError {
        tool: String,
        message: String,
    },

    #[error("OCR error: {0}")]
    OcrError(String),

    #[error("Network error: {0}")]
    NetworkError(#[from] reqwest::Error),

    #[error("URL parsing error: {0}")]
    UrlError(#[from] url::ParseError),

    #[error("JSON serialization error: {0}")]
    JsonError(#[from] serde_json::Error),

    #[error("Encoding error: {0}")]
    EncodingError(String),

    #[error("Empty document")]
    EmptyDocument,

    #[error("Hash computation failed")]
    HashError,
}

impl From<epub::doc::DocError> for ParseError {
    fn from(e: epub::doc::DocError) -> Self {
        ParseError::EpubError(e.to_string())
    }
}

impl From<pdf_extract::OutputError> for ParseError {
    fn from(e: pdf_extract::OutputError) -> Self {
        ParseError::PdfError(e.to_string())
    }
}

impl From<lopdf::Error> for ParseError {
    fn from(e: lopdf::Error) -> Self {
        ParseError::PdfError(e.to_string())
    }
}

impl From<docx_rust::DocxError> for ParseError {
    fn from(e: docx_rust::DocxError) -> Self {
        ParseError::DocxError(e.to_string())
    }
}

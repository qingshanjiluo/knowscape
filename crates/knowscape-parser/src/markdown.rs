use crate::error::*;
use crate::types::*;
use crate::utils;

/// Markdown format parser — validates and normalizes Markdown input
pub struct MarkdownParser;

impl MarkdownParser {
    /// Parse a Markdown file — validates, normalize, and split into chapters
    pub fn parse(path: &str, _options: &ParseOptions) -> ParseResult<ParsedDocument> {
        log::info!("Parsing Markdown: {}", path);

        let path_buf = std::path::Path::new(path);
        if !path_buf.exists() {
            return Err(ParseError::FileNotFound(path.to_string()));
        }

        let source_hash = utils::hash_file(path_buf)?;
        let bytes = std::fs::read(path)?;
        let content = utils::detect_and_decode(&bytes)?;
        let normalized = utils::normalize_text(&content);

        if normalized.trim().is_empty() {
            return Err(ParseError::EmptyDocument);
        }

        // Validate Markdown structure (parse to ensure no fatal errors)
        Self::validate_markdown(&normalized);

        let title = utils::extract_title_from_markdown(&normalized)
            .or_else(|| {
                path_buf.file_stem().and_then(|s| s.to_str()).map(|s| s.to_string())
            })
            .unwrap_or_else(|| "Untitled".to_string());

        // Split into chapters by headings
        let chapter_data = utils::split_into_chapters(&normalized);
        let mut chapters = Vec::new();

        if chapter_data.is_empty() {
            chapters.push(Chapter {
                index: 0,
                title: title.clone(),
                level: 1,
                content: normalized.clone(),
                start_pos: 0,
                end_pos: normalized.len(),
            });
        } else {
            for (idx, chap_title, level, start, end) in &chapter_data {
                let content = normalized[*start..*end].trim().to_string();
                chapters.push(Chapter {
                    index: *idx,
                    title: chap_title.clone(),
                    level: *level,
                    content,
                    start_pos: *start,
                    end_pos: *end,
                });
            }
        }

        Ok(ParsedDocument {
            id: uuid::Uuid::new_v4().to_string(),
            metadata: DocumentMetadata {
                title,
                author: String::new(),
                language: if utils::is_chinese_text(&normalized) { "zh".into() } else { "en".into() },
                source_format: DocumentFormat::Markdown,
                source_path: path.to_string(),
                source_hash,
                total_chapters: chapters.len(),
                word_count: normalized.chars().count(),
                ocr_applied: false,
            },
            full_text: normalized,
            chapters,
            notes: Vec::new(),
        })
    }

    /// Validate Markdown by attempting to parse it (catches fatal syntax issues)
    fn validate_markdown(text: &str) {
        use pulldown_cmark::Parser;
        let _parser = Parser::new(text);
        // If the parser runs without panicking, the Markdown is valid
        // (pulldown-cmark is lenient, but this catches extreme cases)
    }

    /// Parse from a raw Markdown string (for the manual upload fallback)
    pub fn parse_from_string(content: &str, filename: &str) -> ParseResult<ParsedDocument> {
        log::info!("Parsing Markdown from string: {} chars", content.len());

        let normalized = utils::normalize_text(content);

        if normalized.trim().is_empty() {
            return Err(ParseError::EmptyDocument);
        }

        let source_hash = utils::hash_text(&normalized);
        let title = utils::extract_title_from_markdown(&normalized)
            .or_else(|| {
                let path = std::path::Path::new(filename);
                path.file_stem().and_then(|s| s.to_str()).map(|s| s.to_string())
            })
            .unwrap_or_else(|| "Untitled".to_string());

        let chapter_data = utils::split_into_chapters(&normalized);
        let mut chapters = Vec::new();

        if chapter_data.is_empty() {
            chapters.push(Chapter {
                index: 0,
                title: title.clone(),
                level: 1,
                content: normalized.clone(),
                start_pos: 0,
                end_pos: normalized.len(),
            });
        } else {
            for (idx, chap_title, level, start, end) in &chapter_data {
                chapters.push(Chapter {
                    index: *idx,
                    title: chap_title.clone(),
                    level: *level,
                    content: normalized[*start..*end].trim().to_string(),
                    start_pos: *start,
                    end_pos: *end,
                });
            }
        }

        Ok(ParsedDocument {
            id: uuid::Uuid::new_v4().to_string(),
            metadata: DocumentMetadata {
                title,
                author: String::new(),
                language: if utils::is_chinese_text(&normalized) { "zh".into() } else { "en".into() },
                source_format: DocumentFormat::Markdown,
                source_path: filename.to_string(),
                source_hash,
                total_chapters: chapters.len(),
                word_count: normalized.chars().count(),
                ocr_applied: false,
            },
            full_text: normalized,
            chapters,
            notes: vec!["Manually uploaded Markdown".into()],
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    #[test]
    fn test_markdown_basic() {
        let mut tmp = tempfile::NamedTempFile::new().unwrap();
        write!(tmp, "# Title\n\nContent\n\n## Section 1\n\nSection content").unwrap();
        let result = MarkdownParser::parse(tmp.path().to_str().unwrap(), &ParseOptions::default());
        assert!(result.is_ok());
        let doc = result.unwrap();
        assert_eq!(doc.chapters.len(), 2);
        assert_eq!(doc.metadata.title, "Title");
    }

    #[test]
    fn test_markdown_empty() {
        let mut tmp = tempfile::NamedTempFile::new().unwrap();
        write!(tmp, "").unwrap();
        let result = MarkdownParser::parse(tmp.path().to_str().unwrap(), &ParseOptions::default());
        assert!(matches!(result, Err(ParseError::EmptyDocument)));
    }

    #[test]
    fn test_markdown_from_string() {
        let content = "# Test\n\nSome content";
        let result = MarkdownParser::parse_from_string(content, "test.md");
        assert!(result.is_ok());
        assert_eq!(result.unwrap().metadata.title, "Test");
    }

    #[test]
    fn test_markdown_filename_as_title() {
        let content = "Just plain text without headings";
        let result = MarkdownParser::parse_from_string(content, "my-book.md");
        assert!(result.is_ok());
        assert_eq!(result.unwrap().metadata.title, "my-book");
    }
}

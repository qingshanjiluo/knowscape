use crate::error::*;
use crate::types::*;
use crate::utils;
use std::process::Command;

/// MOBI/AZW format parser — delegates to calibre's `ebook-convert`
pub struct MobiParser;

impl MobiParser {
    /// Parse MOBI/AZW file using Calibre's ebook-convert
    pub fn parse(path: &str, _options: &ParseOptions) -> ParseResult<ParsedDocument> {
        log::info!("Parsing MOBI/AZW: {}", path);

        let path_buf = std::path::Path::new(path);
        if !path_buf.exists() {
            return Err(ParseError::FileNotFound(path.to_string()));
        }

        let source_hash = utils::hash_file(path_buf)?;

        // Convert MOBI → Markdown via calibre
        let markdown = Self::convert_to_markdown(path)?;

        if markdown.trim().is_empty() {
            return Err(ParseError::MobiError("Converted content is empty".into()));
        }

        let normalized = utils::normalize_text(&markdown);
        let title = utils::extract_title_from_markdown(&normalized)
            .or_else(|| {
                path_buf.file_stem().and_then(|s| s.to_str()).map(|s| s.to_string())
            })
            .unwrap_or_else(|| "Unknown".to_string());

        // Split into chapters
        let chapter_data = utils::split_into_chapters(&normalized);
        let mut chapters = Vec::new();
        let mut notes = Vec::new();

        if chapter_data.is_empty() {
            // No heading structure found → treat as single chapter
            chapters.push(Chapter {
                index: 0,
                title: title.clone(),
                level: 1,
                content: normalized.clone(),
                start_pos: 0,
                end_pos: normalized.len(),
            });
            notes.push("No chapter headings detected; treated as single chapter.".into());
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

        notes.push("Converted via Calibre (ebook-convert)".into());

        Ok(ParsedDocument {
            id: uuid::Uuid::new_v4().to_string(),
            metadata: DocumentMetadata {
                title,
                author: String::new(),
                language: "zh".to_string(),
                source_format: if path.to_lowercase().ends_with(".mobi") {
                    DocumentFormat::Mobi
                } else {
                    DocumentFormat::Azw
                },
                source_path: path.to_string(),
                source_hash,
                total_chapters: chapters.len(),
                word_count: normalized.chars().count(),
                ocr_applied: false,
            },
            full_text: normalized,
            chapters,
            notes,
        })
    }

    /// Call calibre's ebook-convert to convert MOBI/AZW → Markdown
    fn convert_to_markdown(path: &str) -> Result<String, ParseError> {
        let tmp_dir = tempfile::tempdir()?;
        let output_path = tmp_dir.path().join("converted.md");

        let output = Command::new("ebook-convert")
            .arg(path)
            .arg(output_path.to_string_lossy().to_string())
            .arg("--input-encoding")
            .arg("utf-8")
            .output()
            .map_err(|e| {
                if e.kind() == std::io::ErrorKind::NotFound {
                    ParseError::ExternalToolError {
                        tool: "calibre".into(),
                        message: "Calibre (ebook-convert) is not installed. \
                                  Please install Calibre from https://calibre-ebook.com \
                                  to enable MOBI/AZW support.".into(),
                    }
                } else {
                    ParseError::MobiError(format!("Failed to run ebook-convert: {}", e))
                }
            })?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(ParseError::ExternalToolError {
                tool: "ebook-convert".into(),
                message: format!("Conversion failed: {}", stderr),
            });
        }

        let content = std::fs::read_to_string(&output_path)
            .map_err(|e| ParseError::MobiError(format!(
                "Failed to read converted file: {}", e
            )))?;

        Ok(content)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_mobi_parser_no_file() {
        let result = MobiParser::parse("/nonexistent/test.mobi", &ParseOptions::default());
        assert!(result.is_err());
    }
}

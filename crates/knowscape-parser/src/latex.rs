use crate::error::*;
use crate::types::*;
use crate::utils;
use std::process::Command;

/// LaTeX format parser — delegates to Pandoc
pub struct LatexParser;

impl LatexParser {
    pub fn parse(path: &str, _options: &ParseOptions) -> ParseResult<ParsedDocument> {
        log::info!("Parsing LaTeX: {}", path);

        let path_buf = std::path::Path::new(path);
        if !path_buf.exists() {
            return Err(ParseError::FileNotFound(path.to_string()));
        }

        let source_hash = utils::hash_file(path_buf)?;

        // Convert LaTeX → Markdown via Pandoc
        let markdown = Self::convert_to_markdown(path)?;

        if markdown.trim().is_empty() {
            return Err(ParseError::LatexError("Converted content is empty".into()));
        }

        let normalized = utils::normalize_text(&markdown);
        let title = utils::extract_title_from_markdown(&normalized)
            .or_else(|| {
                path_buf.file_stem().and_then(|s| s.to_str()).map(|s| s.to_string())
            })
            .unwrap_or_else(|| "Untitled".to_string());

        // Split into chapters
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
                author: String::new(),  // Pandoc doesn't reliably extract author from .tex
                language: "zh".to_string(),
                source_format: DocumentFormat::Latex,
                source_path: path.to_string(),
                source_hash,
                total_chapters: chapters.len(),
                word_count: normalized.chars().count(),
                ocr_applied: false,
            },
            full_text: normalized,
            chapters,
            notes: vec!["Converted via Pandoc (pandoc)".into()],
        })
    }

    fn convert_to_markdown(path: &str) -> Result<String, ParseError> {
        let tmp_dir = tempfile::tempdir()?;
        let output_path = tmp_dir.path().join("converted.md");

        let output = Command::new("pandoc")
            .arg(path)
            .arg("-f")
            .arg("latex")
            .arg("-t")
            .arg("markdown")
            .arg("--wrap=preserve")
            .arg("-o")
            .arg(output_path.to_string_lossy().to_string())
            .output()
            .map_err(|e| {
                if e.kind() == std::io::ErrorKind::NotFound {
                    ParseError::ExternalToolError {
                        tool: "pandoc".into(),
                        message: "Pandoc is not installed. \
                                  Please install Pandoc from https://pandoc.org \
                                  to enable LaTeX support.".into(),
                    }
                } else {
                    ParseError::LatexError(format!("Failed to run pandoc: {}", e))
                }
            })?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(ParseError::ExternalToolError {
                tool: "pandoc".into(),
                message: format!("Pandoc conversion failed: {}", stderr),
            });
        }

        Ok(std::fs::read_to_string(&output_path)?)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_latex_parser_no_file() {
        let result = LatexParser::parse("/nonexistent/doc.tex", &ParseOptions::default());
        assert!(result.is_err());
    }
}

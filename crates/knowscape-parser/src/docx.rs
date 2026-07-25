use crate::error::*;
use crate::types::*;
use crate::utils;
use docx_rust::document::{BodyContent, Paragraph, ParagraphContent, TableRowContent, TableCellContent};
use docx_rust::DocxFile;

/// DOCX (Word) format parser
pub struct DocxParser;

impl DocxParser {
    pub fn parse(path: &str, _options: &ParseOptions) -> ParseResult<ParsedDocument> {
        log::info!("Parsing DOCX: {}", path);

        let path_buf = std::path::Path::new(path);
        if !path_buf.exists() {
            return Err(ParseError::FileNotFound(path.to_string()));
        }

        let source_hash = utils::hash_file(path_buf)?;

        let docx_file = DocxFile::from_file(path)
            .map_err(|e| ParseError::DocxError(format!("Failed to read DOCX: {}", e)))?;
        let docx = docx_file.parse()
            .map_err(|e| ParseError::DocxError(format!("Failed to parse DOCX: {}", e)))?;

        let body = &docx.document.body;

        let mut full_text = String::new();
        let mut current_heading = String::from("正文");
        let mut current_level = 1usize;
        let mut chapter_buf = String::new();
        let mut chapters = Vec::new();
        let mut chapter_index = 0usize;

        for child in &body.content {
            match child {
                BodyContent::Paragraph(p) => {
                    let text = paragraph_text(p);
                    if text.trim().is_empty() {
                        continue;
                    }

                    let style_id = p.property.as_ref()
                        .and_then(|prop| prop.style_id.as_ref())
                        .map(|s| s.value.to_string());

                    let outline_lvl = p.property.as_ref()
                        .and_then(|prop| prop.outline_lvl.as_ref())
                        .map(|l| l.value);

                    let is_heading = style_id.as_deref()
                        .map(|s| {
                            let lower = s.to_lowercase();
                            lower == "heading1" || lower == "heading2" || lower == "heading3"
                                || lower == "heading4" || lower == "heading5" || lower == "heading6"
                        })
                        .unwrap_or(false);

                    let heading_level = if is_heading {
                        style_id.as_deref()
                            .and_then(|s| {
                                let s = s.to_lowercase();
                                s.trim_start_matches("heading").parse::<usize>().ok()
                            })
                            .unwrap_or(1)
                    } else if let Some(lvl) = outline_lvl {
                        (lvl + 1) as usize
                    } else {
                        0
                    };

                    if heading_level > 0 {
                        if !chapter_buf.trim().is_empty() {
                            let start = chapters.last().map(|c: &Chapter| c.end_pos).unwrap_or(0);
                            chapters.push(Chapter {
                                index: chapter_index,
                                title: current_heading.clone(),
                                level: current_level,
                                content: chapter_buf.trim().to_string(),
                                start_pos: start,
                                end_pos: full_text.len(),
                            });
                            chapter_index += 1;
                            chapter_buf.clear();
                        }

                        current_heading = text.clone();
                        current_level = heading_level;
                        full_text.push_str(&format!("{} {}\n\n", "#".repeat(heading_level), text));
                    } else {
                        full_text.push_str(&text);
                        full_text.push_str("\n\n");
                        chapter_buf.push_str(&text);
                        chapter_buf.push_str("\n\n");
                    }
                }
                BodyContent::Table(table) => {
                    let md = table_to_markdown(table);
                    full_text.push_str(&md);
                    chapter_buf.push_str(&md);
                }
                _ => {}
            }
        }

        if !chapter_buf.trim().is_empty() {
            let start = if chapters.is_empty() { 0 } else { chapters.last().unwrap().end_pos };
            chapters.push(Chapter {
                index: chapter_index,
                title: current_heading,
                level: current_level,
                content: chapter_buf.trim().to_string(),
                start_pos: start,
                end_pos: full_text.len(),
            });
        }

        if chapters.is_empty() {
            chapters.push(Chapter {
                index: 0,
                title: "正文".into(),
                level: 1,
                content: full_text.clone(),
                start_pos: 0,
                end_pos: full_text.len(),
            });
        }

        let title = utils::extract_title_from_markdown(&full_text)
            .or_else(|| {
                path_buf.file_stem().and_then(|s| s.to_str()).map(|s| s.to_string())
            })
            .unwrap_or_else(|| "Untitled".to_string());

        let author = docx.core.as_ref()
            .and_then(|core| {
                use docx_rust::core::Core;
                match core {
                    Core::CoreNamespace(ns) => ns.creator.clone(),
                    Core::CoreNoNamespace(ns) => ns.creator.clone(),
                }
            })
            .unwrap_or_default();

        Ok(ParsedDocument {
            id: uuid::Uuid::new_v4().to_string(),
            metadata: DocumentMetadata {
                title,
                author: author.to_string(),
                language: "zh".to_string(),
                source_format: DocumentFormat::Docx,
                source_path: path.to_string(),
                source_hash,
                total_chapters: chapters.len(),
                word_count: full_text.chars().count(),
                ocr_applied: false,
            },
            full_text,
            chapters,
            notes: Vec::new(),
        })
    }
}

fn paragraph_text(p: &Paragraph) -> String {
    p.content.iter()
        .filter_map(|content| match content {
            ParagraphContent::Run(run) => {
                Some(run.iter_text()
                    .map(|t| t.to_string())
                    .collect::<String>())
            }
            ParagraphContent::Link(link) => {
                Some(link.iter_text()
                    .map(|t| t.to_string())
                    .collect::<String>())
            }
            _ => None,
        })
        .collect::<Vec<_>>()
        .join("")
}

fn table_to_markdown(table: &docx_rust::document::Table) -> String {
    let mut output = String::new();
    for row in &table.rows {
        let row_text: Vec<String> = row.cells.iter()
            .filter_map(|content| match content {
                TableRowContent::TableCell(tc) => {
                    Some(tc.content.iter()
                        .filter_map(|c| match c {
                            TableCellContent::Paragraph(p) => Some(paragraph_text(p)),
                        })
                        .collect::<Vec<_>>()
                        .join(" "))
                }
                TableRowContent::SDT(_) => None,
            })
            .collect();
        if !row_text.is_empty() {
            output.push_str(&format!("| {} |\n", row_text.join(" | ")));
        }
    }
    if !output.is_empty() {
        output.push('\n');
    }
    output
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_docx_no_file() {
        let result = DocxParser::parse("/nonexistent/doc.docx", &ParseOptions::default());
        assert!(result.is_err());
    }
}

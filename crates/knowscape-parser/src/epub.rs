use crate::error::*;
use crate::types::*;
use crate::utils;
use epub::doc::EpubDoc;

/// EPUB format parser
pub struct EpubParser;

impl EpubParser {
    pub fn parse(path: &str, _options: &ParseOptions) -> ParseResult<ParsedDocument> {
        log::info!("Parsing EPUB: {}", path);

        let path_buf = std::path::Path::new(path);
        if !path_buf.exists() {
            return Err(ParseError::FileNotFound(path_buf.to_string_lossy().to_string()));
        }

        let source_hash = utils::hash_file(path_buf)?;

        let mut epub = EpubDoc::new(path)?;

        // Extract metadata
        let title = epub.get_title()
            .or_else(|| {
                epub.mdata("description")
                    .map(|m| m.value.clone())
            })
            .unwrap_or_else(|| {
                path_buf.file_stem()
                    .and_then(|s| s.to_str())
                    .unwrap_or("Unknown")
                    .to_string()
            });

        let author = epub.mdata("creator")
            .map(|m| m.value.clone())
            .unwrap_or_default();

        let language = epub.mdata("language")
            .map(|m| m.value.clone())
            .unwrap_or_else(|| "zh".to_string());

        // Iterate through spine and extract content
        let mut chapters = Vec::new();
        let mut full_text_parts = Vec::new();
        let mut notes = Vec::new();

        let spine_items: Vec<_> = epub.spine.iter().map(|s| s.clone()).collect();
        for (i, spine_item) in spine_items.iter().enumerate() {
            if let Some((content_bytes, _mime)) = epub.get_resource(&spine_item.idref) {
                let decoded = utils::detect_and_decode(&content_bytes)?;
                let normalized = utils::normalize_text(&decoded);

                if normalized.trim().is_empty() {
                    continue;
                }

                // Extract chapter title from HTML
                let html_title = extract_html_title(&normalized);
                let chapter_title = html_title.unwrap_or_else(|| {
                    format!("第{}章", i + 1)
                });

                // Convert HTML to Markdown
                let markdown = html_to_markdown_simple(&normalized);

                let start_pos = full_text_parts.iter().map(|s: &String| s.len()).sum::<usize>() + full_text_parts.len();
                let content_len = markdown.len();
                full_text_parts.push(markdown.clone());

                chapters.push(Chapter {
                    index: i,
                    title: chapter_title,
                    level: 1,
                    content: markdown,
                    start_pos,
                    end_pos: start_pos + content_len,
                });
            }
        }

        if chapters.is_empty() {
            return Err(ParseError::EmptyDocument);
        }

        let full_text = full_text_parts.join("\n\n");
        let word_count = full_text.chars().count();

        Ok(ParsedDocument {
            id: uuid::Uuid::new_v4().to_string(),
            metadata: DocumentMetadata {
                title,
                author,
                language,
                source_format: DocumentFormat::Epub,
                source_path: path.to_string(),
                source_hash,
                total_chapters: chapters.len(),
                word_count,
                ocr_applied: false,
            },
            full_text,
            chapters,
            notes,
        })
    }
}

fn extract_html_title(html: &str) -> Option<String> {
    let fragment = scraper::Html::parse_fragment(html);
    let selector = scraper::Selector::parse("title").ok()?;
    fragment.select(&selector)
        .next()
        .map(|el| el.text().collect::<String>().trim().to_string())
}

fn html_to_markdown_simple(html: &str) -> String {
    let fragment = scraper::Html::parse_fragment(html);

    let body_sel = scraper::Selector::parse("body, div, section").ok();
    let root = if let Some(ref sel) = body_sel {
        if let Some(body) = fragment.select(sel).next() {
            body.inner_html()
        } else {
            html.to_string()
        }
    } else {
        html.to_string()
    };

    let root_frag = scraper::Html::parse_fragment(&root);

    let mut output = String::new();
    let heading_sel = scraper::Selector::parse("h1, h2, h3, h4, h5, h6, p, li, blockquote, pre, hr").unwrap();

    for element in root_frag.select(&heading_sel) {
        let tag_name = element.value().name();
        let text = element.text().collect::<String>().trim().to_string();

        if text.is_empty() && tag_name != "hr" {
            continue;
        }

        match tag_name {
            "h1" => output.push_str(&format!("# {}\n\n", text)),
            "h2" => output.push_str(&format!("## {}\n\n", text)),
            "h3" => output.push_str(&format!("### {}\n\n", text)),
            "h4" => output.push_str(&format!("#### {}\n\n", text)),
            "h5" => output.push_str(&format!("##### {}\n\n", text)),
            "h6" => output.push_str(&format!("###### {}\n\n", text)),
            "p" => output.push_str(&format!("{}\n\n", text)),
            "li" => output.push_str(&format!("- {}\n", text)),
            "blockquote" => output.push_str(&format!("> {}\n\n", text)),
            "pre" => output.push_str(&format!("```\n{}\n```\n\n", text)),
            "hr" => output.push_str("---\n\n"),
            _ => output.push_str(&format!("{}\n\n", text)),
        }
    }

    if output.is_empty() {
        return root_frag.root_element().text().collect::<String>().trim().to_string();
    }

    output.trim().to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_html_to_markdown_basic() {
        let html = "<h1>Title</h1><p>Paragraph</p>";
        let md = html_to_markdown_simple(html);
        assert!(md.contains("# Title"));
        assert!(md.contains("Paragraph"));
    }

    #[test]
    fn test_extract_html_title() {
        let html = "<html><head><title>My Book</title></head><body></body></html>";
        assert_eq!(extract_html_title(html), Some("My Book".into()));
    }
}

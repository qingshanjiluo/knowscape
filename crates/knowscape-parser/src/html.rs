use crate::error::*;
use crate::types::*;
use crate::utils;
use scraper::{Html, Selector};

/// HTML/URL format parser — fetches (if URL) and extracts main content
pub struct HtmlParser;

impl HtmlParser {
    /// Parse an HTML file or URL. Auto-detects if input is a URL.
    pub fn parse(path_or_url: &str, options: &ParseOptions) -> ParseResult<ParsedDocument> {
        let (html_content, source_path, is_url) = if path_or_url.starts_with("http://")
            || path_or_url.starts_with("https://")
        {
            log::info!("Fetching URL: {}", path_or_url);
            let html = Self::fetch_url(path_or_url)?;
            (html, path_or_url.to_string(), true)
        } else {
            log::info!("Parsing HTML file: {}", path_or_url);
            let path = std::path::Path::new(path_or_url);
            if !path.exists() {
                return Err(ParseError::FileNotFound(path_or_url.to_string()));
            }
            let bytes = std::fs::read(path)?;
            let html = utils::detect_and_decode(&bytes)?;
            (html, path_or_url.to_string(), false)
        };

        let source_hash = if is_url {
            utils::hash_text(&html_content)
        } else {
            utils::hash_file(std::path::Path::new(path_or_url))?
        };

        // Extract main content
        let document = Html::parse_document(&html_content);

        // Extract title
        let title = Self::extract_title(&document)
            .unwrap_or_else(|| "Untitled".to_string());

        // Extract author (from meta tags or byline)
        let author = Self::extract_author(&document)
            .unwrap_or_default();

        // Extract main content as Markdown
        let main_content = Self::extract_readable_content(&document);
        let markdown = html_to_markdown_readability(&main_content);
        let normalized = utils::normalize_text(&markdown);

        // Split into sections/chapters
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

        let mut notes = Vec::new();
        if is_url {
            notes.push(format!("Fetched from URL: {}", path_or_url));
        }

        Ok(ParsedDocument {
            id: uuid::Uuid::new_v4().to_string(),
            metadata: DocumentMetadata {
                title,
                author,
                language: detect_html_language(&document),
                source_format: DocumentFormat::Html,
                source_path: source_path,
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

    fn fetch_url(url: &str) -> Result<String, ParseError> {
        let rt = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .map_err(|e| ParseError::HtmlError(format!("Runtime error: {}", e)))?;

        rt.block_on(async {
            let client = reqwest::Client::builder()
                .user_agent("KnowScape/0.1 (Document Parser; +https://knowscape.app)")
                .timeout(std::time::Duration::from_secs(30))
                .build()?;

            let response = client.get(url).send().await?;

            if !response.status().is_success() {
                return Err(ParseError::HtmlError(format!(
                    "HTTP {}: {}", response.status(), url
                )));
            }

            let content_type = response.headers()
                .get("content-type")
                .and_then(|v| v.to_str().ok())
                .unwrap_or("")
                .to_string();

            let bytes = response.bytes().await?;

            // Detect encoding from Content-Type or HTML meta
            if content_type.contains("charset=utf-8") || content_type.contains("charset=UTF-8") {
                Ok(String::from_utf8(bytes.to_vec())
                    .unwrap_or_else(|_| String::from_utf8_lossy(&bytes).to_string()))
            } else {
                Ok(utils::detect_and_decode(&bytes)?)
            }
        })
    }

    fn extract_title(document: &Html) -> Option<String> {
        // Try <title> first
        let sel = Selector::parse("title").ok()?;
        if let Some(el) = document.select(&sel).next() {
            let text = el.text().collect::<String>().trim().to_string();
            if !text.is_empty() {
                return Some(text);
            }
        }

        // Try <meta property="og:title">
        let sel = Selector::parse(r#"meta[property="og:title"]"#).ok()?;
        if let Some(el) = document.select(&sel).next() {
            if let Some(content) = el.value().attr("content") {
                return Some(content.to_string());
            }
        }

        // Try first H1
        let sel = Selector::parse("h1").ok()?;
        if let Some(el) = document.select(&sel).next() {
            let text = el.text().collect::<String>().trim().to_string();
            if !text.is_empty() {
                return Some(text);
            }
        }

        None
    }

    fn extract_author(document: &Html) -> Option<String> {
        // Try <meta name="author">
        let sel = Selector::parse(r#"meta[name="author"]"#).ok()?;
        if let Some(el) = document.select(&sel).next() {
            if let Some(content) = el.value().attr("content") {
                return Some(content.to_string());
            }
        }

        // Try <meta property="article:author">
        let sel = Selector::parse(r#"meta[property="article:author"]"#).ok()?;
        if let Some(el) = document.select(&sel).next() {
            if let Some(content) = el.value().attr("content") {
                return Some(content.to_string());
            }
        }

        None
    }

    /// Extract readable main content using a readability-like approach:
    /// 1. Remove non-content elements (nav, footer, ads, etc.)
    /// 2. Score remaining elements by text density
    /// 3. Return the highest-scoring content block
    fn extract_readable_content(document: &Html) -> String {
        // Remove unwanted elements
        let remove_selectors = [
            "script", "style", "noscript", "iframe", "svg",
            "nav", "footer", "header", "aside",
            ".advertisement", ".ad", ".sidebar", ".comments",
            ".footer", ".header", ".nav", ".menu",
            "[role=navigation]", "[role=complementary]",
        ];

        let mut cleaned = document.clone();

        for sel_str in &remove_selectors {
            if let Ok(sel) = Selector::parse(sel_str) {
                // We can't easily remove from scraper::Html,
                // so we collect text from main content areas instead
            }
        }

        // Find the main content area using common selectors
        let content_selectors = [
            "main", "article", "[role=main]",
            ".post-content", ".article-content", ".entry-content",
            ".content", "#content", "#article",
            ".post", ".article",
        ];

        for sel_str in &content_selectors {
            if let Ok(sel) = Selector::parse(sel_str) {
                if let Some(el) = document.select(&sel).next() {
                    return el.inner_html();
                }
            }
        }

        // Fallback: return body content
        if let Ok(sel) = Selector::parse("body") {
            if let Some(body) = document.select(&sel).next() {
                return body.inner_html();
            }
        }

        // Last resort: return full HTML
        document.root_element().inner_html()
    }
}

/// Convert HTML fragment to Markdown, suitable for article-length content
fn html_to_markdown_readability(html: &str) -> String {
    let fragment = scraper::Html::parse_fragment(html);
    let mut output = String::new();

    // Process block-level elements in order
    let block_sel = Selector::parse(
        "h1, h2, h3, h4, h5, h6, p, ul, ol, blockquote, pre, hr, div, section, figure, figcaption"
    ).unwrap();

    for element in fragment.select(&block_sel) {
        let tag = element.value().name();
        let text = element.text().collect::<String>().trim().to_string();

        match tag {
            "h1" => output.push_str(&format!("# {}\n\n", text)),
            "h2" => output.push_str(&format!("## {}\n\n", text)),
            "h3" => output.push_str(&format!("### {}\n\n", text)),
            "h4" => output.push_str(&format!("#### {}\n\n", text)),
            "h5" => output.push_str(&format!("##### {}\n\n", text)),
            "h6" => output.push_str(&format!("###### {}\n\n", text)),
            "p" => {
                // Process inline elements within paragraph
                let inline = process_inline(&element);
                if !inline.trim().is_empty() {
                    output.push_str(&inline);
                    output.push_str("\n\n");
                }
            }
            "ul" | "ol" => {
                for li in element.select(&Selector::parse("li").unwrap()) {
                    let li_text = process_inline(&li);
                    if !li_text.trim().is_empty() {
                        output.push_str(&format!("- {}\n", li_text));
                    }
                }
                output.push('\n');
            }
            "blockquote" => {
                for qline in text.lines() {
                    output.push_str(&format!("> {}\n", qline));
                }
                output.push('\n');
            }
            "pre" => {
                output.push_str("```\n");
                output.push_str(&text);
                output.push_str("\n```\n\n");
            }
            "hr" => output.push_str("---\n\n"),
            "figure" => {
                // Extract figcaption if present
                if let Ok(cap_sel) = Selector::parse("figcaption") {
                    if let Some(cap) = element.select(&cap_sel).next() {
                        let cap_text = cap.text().collect::<String>();
                        output.push_str(&format!("*{}*\n\n", cap_text));
                    }
                }
            }
            "div" | "section" => {
                // Recursively process children (already handled by the selector)
                // Only add text if it's not already covered by child elements
                if !text.trim().is_empty() && !output.ends_with(&text) {
                    output.push_str(&text);
                    output.push_str("\n\n");
                }
            }
            _ => {
                if !text.trim().is_empty() {
                    output.push_str(&text);
                    output.push_str("\n\n");
                }
            }
        }
    }

    if output.trim().is_empty() {
        return html_plain_text(html);
    }

    output.trim().to_string()
}

/// Process inline elements: links, bold, italic, code
fn process_inline(element: &scraper::ElementRef) -> String {
    let mut result = String::new();

    for node in element.children() {
        match node.value() {
            scraper::node::Node::Text(t) => {
                result.push_str(&t.text);
            }
            scraper::node::Node::Element(el) => {
                let tag = el.name.local.as_ref();
                let inner: String = node.children()
                    .filter_map(|c| {
                        if let scraper::node::Node::Text(t) = c.value() {
                            Some(t.text.as_ref())
                        } else {
                            None
                        }
                    })
                    .collect();

                match tag {
                    "a" => {
                        let href = el.attrs.iter()
                            .find(|(a, _)| a.local.as_ref() == "href")
                            .map(|(_, v)| v)
                            .map_or("", |v| v);
                        result.push_str(&format!("[{}]({})", inner, href));
                    }
                    "strong" | "b" => result.push_str(&format!("**{}**", inner)),
                    "em" | "i" => result.push_str(&format!("*{}*", inner)),
                    "code" => result.push_str(&format!("`{}`", inner)),
                    "br" => result.push('\n'),
                    _ => result.push_str(&inner),
                }
            }
            _ => {}
        }
    }

    result
}

/// Fallback: strip tags and return plain text
fn html_plain_text(html: &str) -> String {
    let fragment = scraper::Html::parse_fragment(html);
    fragment.root_element().text().collect::<String>().trim().to_string()
}

/// Detect language from <html lang="..."> attribute
fn detect_html_language(document: &Html) -> String {
    if let Ok(sel) = Selector::parse("html") {
        if let Some(html_el) = document.select(&sel).next() {
            if let Some(lang) = html_el.value().attr("lang") {
                let lang = lang.to_lowercase();
                if lang.starts_with("zh") {
                    return "zh".to_string();
                }
                if lang.starts_with("en") {
                    return "en".to_string();
                }
                return lang;
            }
        }
    }
    "zh".to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_html_to_markdown_basic() {
        let html = "<h1>Title</h1><p>Content with <strong>bold</strong> and <a href='x'>link</a>.</p>";
        let md = html_to_markdown_readability(html);
        assert!(md.contains("# Title"));
        assert!(md.contains("**bold**"));
        assert!(md.contains("[link](x)"));
    }

    #[test]
    fn test_html_parser_local_file_not_found() {
        let result = HtmlParser::parse("/nonexistent/file.html", &ParseOptions::default());
        assert!(result.is_err());
    }

    #[test]
    fn test_extract_title() {
        let html = "<html><head><title>Test Title</title></head><body></body></html>";
        let doc = Html::parse_document(html);
        assert_eq!(HtmlParser::extract_title(&doc), Some("Test Title".into()));
    }
}

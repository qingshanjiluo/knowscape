use crate::error::*;
use crate::types::*;
use crate::utils;
use crate::ocr::OcrEngine;

/// PDF format parser — handles both text-based and scanned PDFs
pub struct PdfParser;

impl PdfParser {
    pub fn parse(path: &str, options: &ParseOptions) -> ParseResult<ParsedDocument> {
        log::info!("Parsing PDF: {}", path);

        let path_buf = std::path::Path::new(path);
        if !path_buf.exists() {
            return Err(ParseError::FileNotFound(path.to_string()));
        }

        let source_hash = utils::hash_file(path_buf)?;
        let clean_path = path_buf.to_string_lossy().to_string();

        // Try to extract text directly
        let text_result = extract_text_from_pdf(path);

        match text_result {
            Ok(text) if text.trim().len() > 100 => {
                log::info!("PDF text extraction successful ({} chars)", text.len());
                build_document(&clean_path, &source_hash, &text, false)
            }
            Ok(text) => {
                let extracted_len = text.trim().len();
                log::warn!("PDF text extraction returned only {} chars, trying OCR", extracted_len);

                if options.ocr.enabled {
                    ocr_pdf(path, &options.ocr, &clean_path, &source_hash)
                } else {
                    build_document(&clean_path, &source_hash, &text, false)
                }
            }
            Err(_) => {
                log::warn!("PDF text extraction failed, falling back to OCR");

                if options.ocr.enabled {
                    ocr_pdf(path, &options.ocr, &clean_path, &source_hash)
                } else {
                    Err(ParseError::PdfError(
                        "Text extraction failed and OCR is disabled".into()
                    ))
                }
            }
        }
    }
}

/// Extract text from a text-based PDF using pdf-extract
fn extract_text_from_pdf(path: &str) -> Result<String, ParseError> {
    let text = pdf_extract::extract_text(path)?;
    Ok(utils::normalize_text(&text))
}

/// Build a ParsedDocument from extracted text
fn build_document(source_path: &str, source_hash: &str, text: &str, ocr_applied: bool) -> ParseResult<ParsedDocument> {
    let chapter_data = utils::split_into_chapters(text);
    let mut chapters = Vec::new();
    let title = utils::extract_title_from_markdown(text)
        .or_else(|| {
            std::path::Path::new(source_path)
                .file_stem().and_then(|s| s.to_str()).map(|s| s.to_string())
        })
        .unwrap_or_else(|| "Untitled".to_string());

    if chapter_data.is_empty() {
        chapters.push(Chapter {
            index: 0,
            title: title.clone(),
            level: 1,
            content: text.to_string(),
            start_pos: 0,
            end_pos: text.len(),
        });
    } else {
        for (idx, chap_title, level, start, end) in &chapter_data {
            chapters.push(Chapter {
                index: *idx,
                title: chap_title.clone(),
                level: *level,
                content: text[*start..*end].trim().to_string(),
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
            language: "zh".to_string(),
            source_format: DocumentFormat::Pdf,
            source_path: source_path.to_string(),
            source_hash: source_hash.to_string(),
            total_chapters: chapters.len(),
            word_count: text.chars().count(),
            ocr_applied,
        },
        full_text: text.to_string(),
        chapters,
        notes: if ocr_applied { vec!["OCR applied".to_string()] } else { vec![] },
    })
}

/// OCR a scanned PDF: convert pages to images, run OCR, build result
fn ocr_pdf(path: &str, config: &super::OcrConfig, source_path: &str, source_hash: &str)
    -> ParseResult<ParsedDocument>
{
    log::info!("Starting OCR for PDF: {}", path);

    let has_mutool = which("mutool");
    let has_pdftoppm = which("pdftoppm");

    let render_tool = if has_mutool {
        "mutool"
    } else if has_pdftoppm {
        "pdftoppm"
    } else {
        return Err(ParseError::ExternalToolError {
            tool: "PDF renderer".into(),
            message: "Neither mutool (MuPDF) nor pdftoppm (poppler-utils) found. \
                      Please install one of them for OCR support.".into(),
        });
    };

    let tmp_dir = tempfile::tempdir()?;
    let tmp_path = tmp_dir.path();

    // Render PDF to images
    let render_status = if render_tool == "mutool" {
        std::process::Command::new("mutool")
            .args(["draw", "-o"])
            .arg(tmp_path.join("page_%d.png").to_string_lossy().to_string())
            .arg("-r")
            .arg(config.dpi.to_string())
            .arg(path)
            .output()
    } else {
        std::process::Command::new("pdftoppm")
            .arg("-png")
            .arg("-r")
            .arg(config.dpi.to_string())
            .arg(path)
            .arg(tmp_path.join("page").to_string_lossy().to_string())
            .output()
    };

    match render_status {
        Ok(output) if output.status.success() => {
            log::info!("PDF rendered to images in {:?}", tmp_path);
        }
        Ok(output) => {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(ParseError::ExternalToolError {
                tool: render_tool.into(),
                message: format!("Render failed: {}", stderr),
            });
        }
        Err(e) => {
            return Err(ParseError::ExternalToolError {
                tool: render_tool.into(),
                message: format!("Render execution failed: {}", e),
            });
        }
    }

    // Count rendered pages
    let total_pages = (1..).find(|&i| {
        let image_path = if render_tool == "mutool" {
            tmp_path.join(format!("page_{}.png", i))
        } else {
            tmp_path.join(format!("page-{}.png", i))
        };
        !image_path.exists()
    }).unwrap_or(1) - 1;

    if total_pages == 0 {
        return Err(ParseError::EmptyDocument);
    }

    // Run OCR on each page
    let ocr_engine = OcrEngine::new(&config.language);
    let mut full_text = String::new();
    let mut chapters = Vec::new();
    let mut notes = Vec::new();
    let mut total_chars = 0usize;

    for page_num in 1..=total_pages {
        let image_path = if render_tool == "mutool" {
            tmp_path.join(format!("page_{}.png", page_num))
        } else {
            tmp_path.join(format!("page-{}.png", page_num))
        };

        if !image_path.exists() {
            log::warn!("Page {} image not found, skipping", page_num);
            continue;
        }

        match ocr_engine.recognize(image_path.to_string_lossy().to_string().as_str()) {
            Ok(page_text) => {
                let normalized = utils::normalize_text(&page_text);
                let start_pos = total_chars;
                let content_len = normalized.len();
                total_chars += content_len;

                full_text.push_str(&normalized);
                full_text.push_str("\n\n");

                chapters.push(Chapter {
                    index: page_num - 1,
                    title: format!("第{}页", page_num),
                    level: 1,
                    content: normalized,
                    start_pos,
                    end_pos: start_pos + content_len,
                });
            }
            Err(e) => {
                let warn = format!("OCR failed for page {}: {}", page_num, e);
                log::warn!("{}", warn);
                notes.push(warn);
            }
        }
    }

    if chapters.is_empty() {
        return Err(ParseError::EmptyDocument);
    }

    notes.push(format!("OCR applied on {} pages using {}", total_pages, config.language));

    Ok(ParsedDocument {
        id: uuid::Uuid::new_v4().to_string(),
        metadata: DocumentMetadata {
            title: std::path::Path::new(source_path)
                .file_stem().and_then(|s| s.to_str())
                .unwrap_or("Scanned PDF")
                .to_string(),
            author: String::new(),
            language: "zh".to_string(),
            source_format: DocumentFormat::Pdf,
            source_path: source_path.to_string(),
            source_hash: source_hash.to_string(),
            total_chapters: chapters.len(),
            word_count: full_text.chars().count(),
            ocr_applied: true,
        },
        full_text,
        chapters,
        notes,
    })
}

fn which(name: &str) -> bool {
    std::process::Command::new(if cfg!(windows) { "where" } else { "which" })
        .arg(name)
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_pdf_nonexistent() {
        let result = extract_text_from_pdf("/nonexistent/test.pdf");
        assert!(result.is_err());
    }
}

use sha2::{Digest, Sha256};
use std::path::Path;

/// Compute SHA256 hash of a file
pub fn hash_file(path: &Path) -> Result<String, crate::error::ParseError> {
    let mut file = std::fs::File::open(path)?;
    let mut hasher = Sha256::new();
    std::io::copy(&mut file, &mut hasher)?;
    let hash = hasher.finalize();
    Ok(hex::encode(hash))
}

/// Compute SHA256 hash of a string
pub fn hash_text(text: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(text.as_bytes());
    hex::encode(hasher.finalize())
}

/// Normalize text: trim, unify line endings, remove BOM, normalize unicode
pub fn normalize_text(text: &str) -> String {
    let text = text.trim();
    // Remove BOM
    let text = text.strip_prefix('\u{feff}').unwrap_or(text);
    // Normalize line endings
    let text = text.replace("\r\n", "\n").replace('\r', "\n");
    // Unicode NFC normalization
    use unicode_normalization::UnicodeNormalization;
    text.nfc().collect::<String>()
}

/// Detect if text is mostly Chinese characters
pub fn is_chinese_text(text: &str) -> bool {
    let chinese_count = text.chars().filter(|c| {
        matches!(c, '\u{4e00}'..='\u{9fff}' | '\u{3400}'..='\u{4dbf}')
    }).count();
    chinese_count as f64 > text.len() as f64 * 0.1
}

/// Detect encoding from raw bytes (UTF-8 first, then GBK fallback)
pub fn detect_and_decode(bytes: &[u8]) -> Result<String, crate::error::ParseError> {
    // Try UTF-8 first
    if let Ok(text) = std::str::from_utf8(bytes) {
        return Ok(text.to_string());
    }
    // Fallback to GBK (common for Chinese documents)
    let (text, _, _) = encoding_rs::GBK.decode(bytes);
    if !text.is_empty() {
        return Ok(text.to_string());
    }
    // Last resort: lossy UTF-8
    Ok(String::from_utf8_lossy(bytes).to_string())
}

/// Extract title from the first H1 heading in Markdown text
pub fn extract_title_from_markdown(text: &str) -> Option<String> {
    for line in text.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with("# ") {
            return Some(trimmed.trim_start_matches("# ").trim().to_string());
        }
        if trimmed.starts_with("#\t") {
            return Some(trimmed.trim_start_matches("#\t").trim().to_string());
        }
    }
    None
}

/// Split Markdown text into chapters based on H1/H2 headings
pub fn split_into_chapters(full_text: &str) -> Vec<(usize, String, usize, usize, usize)> {
    let mut chapters = Vec::new();
    let mut current_title = String::from("前言");
    let mut current_level = 1usize;
    let mut current_start = 0usize;
    let mut index = 0usize;

    for (pos, line) in full_text.lines().enumerate() {
        let trimmed = line.trim();
        let char_pos = line_offset(full_text, pos);

        if let Some((level, title)) = parse_heading(trimmed) {
            // Save previous chapter
            if char_pos > current_start || index > 0 {
                chapters.push((index, current_title, current_level, current_start, char_pos));
                index += 1;
            }
            current_title = title;
            current_level = level;
            current_start = char_pos;
        }
    }

    // Last chapter
    let end = full_text.len();
    if chapters.is_empty() && !current_title.is_empty() {
        chapters.push((0, current_title, current_level, 0, end));
    } else if !chapters.is_empty() {
        chapters.push((index, current_title, current_level, current_start, end));
    }

    chapters
}

fn parse_heading(line: &str) -> Option<(usize, String)> {
    let trimmed = line.trim();
    let mut level = 0;
    for ch in trimmed.chars() {
        if ch == '#' {
            level += 1;
        } else if ch == ' ' || ch == '\t' {
            if level > 0 && level <= 6 {
                return Some((level, trimmed[level + 1..].trim().to_string()));
            }
            return None;
        } else {
            return None;
        }
    }
    None
}

fn line_offset(text: &str, line_index: usize) -> usize {
    text.lines()
        .take(line_index)
        .map(|l| l.len() + 1) // +1 for newline
        .sum()
}

/// Convert raw text to basic Markdown (escape special chars)
pub fn escape_to_markdown(text: &str) -> String {
    text.replace('\\', "\\\\")
        .replace('`', "\\`")
        .replace('*', "\\*")
        .replace('_', "\\_")
        .replace('[', "\\[")
        .replace(']', "\\]")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_normalize_text_removes_bom() {
        let text = "\u{feff}Hello\nWorld\r\n";
        assert_eq!(normalize_text(text), "Hello\nWorld");
    }

    #[test]
    fn test_extract_title() {
        let text = "# 认知红利\n\n内容...\n## 第一章\n";
        assert_eq!(extract_title_from_markdown(text), Some("认知红利".into()));
    }

    #[test]
    fn test_split_chapters() {
        let text = "# 第一章\n内容\n# 第二章\n更多内容\n## 2.1节\n细节";
        let chapters = split_into_chapters(text);
        assert_eq!(chapters.len(), 3);
        assert_eq!(chapters[0].1, "第一章");
        assert_eq!(chapters[1].1, "第二章");
        assert_eq!(chapters[2].1, "2.1节");
    }

    #[test]
    fn test_is_chinese() {
        assert!(is_chinese_text("这是一段中文文本"));
        assert!(!is_chinese_text("This is English"));
    }

    #[test]
    fn test_hash_text() {
        let h = hash_text("hello");
        assert_eq!(h.len(), 64);
    }
}

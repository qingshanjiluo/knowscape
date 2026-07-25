use crate::error::*;
use crate::types::*;
use crate::utils;
use std::process::Command;

/// Tesseract OCR engine wrapper
pub struct OcrEngine {
    language: String,
}

impl OcrEngine {
    pub fn new(language: &str) -> Self {
        Self {
            language: language.to_string(),
        }
    }

    /// Run OCR on an image file, returning recognized text
    pub fn recognize(&self, image_path: &str) -> Result<String, ParseError> {
        log::debug!("OCR: {} (lang={})", image_path, self.language);

        let output = Command::new("tesseract")
            .arg(image_path)
            .arg("stdout")               // output to stdout
            .arg("-l")
            .arg(&self.language)
            .arg("--psm")
            .arg("3")                     // automatic page segmentation
            .arg("--oem")
            .arg("3")                     // default engine
            .output()
            .map_err(|e| {
                if e.kind() == std::io::ErrorKind::NotFound {
                    ParseError::ExternalToolError {
                        tool: "tesseract".into(),
                        message: "Tesseract OCR is not installed. \
                                  Please install tesseract-ocr with Chinese language pack.".into(),
                    }
                } else {
                    ParseError::OcrError(e.to_string())
                }
            })?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(ParseError::OcrError(format!(
                "Tesseract failed: {}", stderr
            )));
        }

        let text = String::from_utf8_lossy(&output.stdout).to_string();
        if text.trim().is_empty() {
            log::warn!("OCR returned empty text for {}", image_path);
        }

        Ok(text)
    }

    /// Batch OCR: recognize multiple image files
    pub fn recognize_batch(&self, image_paths: &[String]) -> Result<Vec<String>, ParseError> {
        let mut results = Vec::with_capacity(image_paths.len());
        for path in image_paths {
            let text = self.recognize(path)?;
            results.push(text);
        }
        Ok(results)
    }

    /// Check if Tesseract is available on this system
    pub fn is_available() -> bool {
        Command::new("tesseract")
            .arg("--version")
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false)
    }

    /// Check if a specific language pack is installed
    pub fn has_language(lang: &str) -> bool {
        Command::new("tesseract")
            .args(["--list-langs"])
            .output()
            .map(|o| {
                let stdout = String::from_utf8_lossy(&o.stdout);
                stdout.contains(lang)
            })
            .unwrap_or(false)
    }
}

/// Utility: pre-process image before OCR (deskew, threshold)
/// Uses ImageMagick if available
pub fn preprocess_image(input: &str, output: &str) -> Result<(), ParseError> {
    let status = Command::new("convert")
        .args([
            input,
            "-deskew", "40%",
            "-sharpen", "0x1",
            "-colorspace", "Gray",
            "-threshold", "80%",
            output,
        ])
        .output()
        .map_err(|e| ParseError::ExternalToolError {
            tool: "ImageMagick".into(),
            message: format!("Image preprocessing failed: {}", e),
        })?;

    if !status.status.success() {
        let stderr = String::from_utf8_lossy(&status.stderr);
        log::warn!("ImageMagick preprocessing warning: {}", stderr);
        // Non-fatal — OCR can still run on original image
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ocr_availability() {
        // This test checks if Tesseract is installed, but doesn't fail if not
        let available = OcrEngine::is_available();
        println!("Tesseract available: {}", available);
    }

    #[test]
    fn test_chinese_language_pack() {
        let has_chi_sim = OcrEngine::has_language("chi_sim");
        println!("Chinese language pack: {}", has_chi_sim);
    }
}

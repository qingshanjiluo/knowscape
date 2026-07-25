fn main() {
    let args: Vec<String> = std::env::args().collect();

    if args.len() < 2 {
        eprintln!("Usage: {} <path_or_url> [ocr_lang]", args[0]);
        eprintln!("Examples:");
        eprintln!("  {} book.epub", args[0]);
        eprintln!("  {} article.pdf chi_sim+eng", args[0]);
        eprintln!("  {} https://example.com/article", args[0]);
        std::process::exit(1);
    }

    let path = &args[1];
    let ocr_lang = args.get(2).cloned().unwrap_or_else(|| "chi_sim+eng".to_string());

    // Initialize logger
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info"))
        .init();

    println!("📖 KnowScape Document Parser");
    println!("   Input: {}", path);

    let fmt = knowscape_parser::DocumentFormat::from_path(path);
    println!("   Detected: {:?} ({})", fmt, fmt.description());

    let mut options = knowscape_parser::ParseOptions::default();
    options.ocr.language = ocr_lang;

    let engine = knowscape_parser::ParserEngine::new();

    match engine.parse(path, &options) {
        Ok(doc) => {
            println!("\n✅ Parsed successfully!");
            println!("   ID:        {}", doc.id);
            println!("   Title:     {}", doc.metadata.title);
            println!("   Author:    {}", doc.metadata.author);
            println!("   Language:  {}", doc.metadata.language);
            println!("   Chapters:  {}", doc.chapters.len());
            println!("   Words:     {}", doc.metadata.word_count);
            println!("   OCR:       {}", doc.metadata.ocr_applied);
            println!("   Format:    {:?}", doc.metadata.source_format);

            println!("\n📄 Chapters:");
            for ch in &doc.chapters {
                let preview: String = ch.content.chars().take(60).collect();
                println!("   [{:2}] {} ({} chars): {:30}...",
                    ch.index + 1, ch.title, ch.content.len(), preview);
            }

            if !doc.notes.is_empty() {
                println!("\n📝 Notes:");
                for note in &doc.notes {
                    println!("   ℹ️  {}", note);
                }
            }

            // Save JSON output
            let json_path = format!("{}.json", doc.metadata.source_hash.get(..8).unwrap_or("output"));
            if let Ok(json) = doc.to_json() {
                std::fs::write(&json_path, &json).ok();
                println!("\n💾 JSON saved to: {}", json_path);

                // Also save full text
                let md_path = format!("{}_full.md", doc.metadata.source_hash.get(..8).unwrap_or("output"));
                std::fs::write(&md_path, &doc.full_text).ok();
                println!("💾 Full markdown saved to: {}", md_path);
            }
        }
        Err(knowscape_parser::error::ParseError::ExternalToolError { tool, message }) => {
            eprintln!("\n❌ Missing external tool: {}", tool);
            eprintln!("   {}", message);
            std::process::exit(2);
        }
        Err(e) => {
            eprintln!("\n❌ Parse failed: {}", e);
            std::process::exit(1);
        }
    }
}

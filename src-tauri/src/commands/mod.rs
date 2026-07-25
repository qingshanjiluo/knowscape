use crate::database::{BookRecord, ChapterRecord};
use crate::types::*;
use crate::AppState;
use tauri::Emitter;

fn parse_chapters(text: &str) -> Vec<(String, String)> {
    let mut chapters = Vec::new();
    let mut current_title = String::from("引言");
    let mut current_content = String::new();

    for line in text.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with("# ") || trimmed.starts_with("## ") || trimmed.starts_with("### ") {
            if !current_content.trim().is_empty() {
                chapters.push((
                    current_title.clone(),
                    current_content.trim().to_string(),
                ));
            }
            current_title = trimmed.trim_start_matches('#').trim().to_string();
            current_content.clear();
        } else {
            current_content.push_str(line);
            current_content.push('\n');
        }
    }
    if !current_content.trim().is_empty() {
        chapters.push((current_title, current_content.trim().to_string()));
    }
    if chapters.is_empty() && !text.trim().is_empty() {
        chapters.push((
            "全文".into(),
            text.trim().to_string(),
        ));
    }
    chapters
}

fn parse_epub_from_bytes(data: &[u8]) -> Result<(String, Vec<(String, String)>), String> {
    use epub::doc::EpubDoc;
    use std::io::Cursor;
    let mut cursor = Cursor::new(data);
    let mut doc = EpubDoc::from_reader(&mut cursor).map_err(|e| format!("EPUB 解析失败: {}", e))?;
    let title = doc.get_title().unwrap_or_else(|| "未命名".into());

    let spine_ids: Vec<String> = doc.spine.iter().map(|s| s.idref.clone()).collect();
    let mut chapters = Vec::new();

    for id in &spine_ids {
        if let Some((content, _mime)) = doc.get_resource(id) {
            let text = strip_html_tags(&String::from_utf8_lossy(&content));
            if text.trim().is_empty() {
                continue;
            }
            let ch_title = format!("章节 {}", chapters.len() + 1);
            chapters.push((ch_title, text.trim().to_string()));
        }
    }

    if chapters.is_empty() {
        if let Some((all_bytes, _)) = doc.get_current() {
            let all_text = strip_html_tags(&String::from_utf8_lossy(&all_bytes));
            if !all_text.trim().is_empty() {
                chapters.push(("全文".into(), all_text.trim().to_string()));
            }
        }
    }

    Ok((title, chapters))
}

fn strip_html_tags(html: &str) -> String {
    let mut result = String::with_capacity(html.len());
    let mut in_tag = false;
    let mut in_script = false;

    for ch in html.chars() {
        match ch {
            '<' => {
                in_tag = true;
                if html[html.find('<').unwrap_or(0)..].starts_with("<script") {
                    in_script = true;
                }
            }
            '>' => {
                in_tag = false;
                in_script = false;
                result.push('\n');
            }
            _ if !in_tag && !in_script => {
                result.push(ch);
            }
            _ => {}
        }
    }
    result
}

fn detect_file_type(path: &str) -> String {
    std::path::Path::new(path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("txt")
        .to_lowercase()
}

fn extract_title(path: &str) -> String {
    std::path::Path::new(path)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("Untitled")
        .to_string()
}

#[tauri::command]
pub async fn upload_book(
    path: String,
    content: Option<String>,
    state: tauri::State<'_, AppState>,
) -> Result<String, String> {
    let ft = detect_file_type(&path);
    let title_from_path = extract_title(&path);

    let (title, chapters_data) = match ft.as_str() {
        "epub" => {
            let data = if let Some(ref c) = content {
                base64_decode(c)?
            } else {
                std::fs::read(&path).map_err(|e| format!("读取文件失败: {}", e))?
            };
            parse_epub_from_bytes(&data)?
        }
        "md" | "markdown" | "txt" | "text" => {
            let text = if let Some(ref c) = content {
                c.clone()
            } else {
                std::fs::read_to_string(&path)
                    .map_err(|e| format!("读取文件失败: {}", e))?
            };
            let chapters = parse_chapters(&text);
            (title_from_path, chapters)
        }
        "pdf" => {
            let data = if let Some(ref c) = content {
                base64_decode(c)?
            } else {
                std::fs::read(&path)
                    .map_err(|e| format!("读取文件失败: {}", e))?
            };
            let text = extract_pdf_text(&data)?;
            let chapters = parse_chapters(&text);
            (title_from_path, chapters)
        }
        _ => {
            return Err(format!(
                "暂不支持 .{} 格式，请使用 .md、.txt、.epub 或 .pdf 文件",
                ft
            ));
        }
    };

    let book_id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    state.db.insert_book(&BookRecord {
        id: book_id.clone(),
        title,
        author: String::new(),
        file_path: path,
        file_type: ft,
        status: "parsed".into(),
        progress: chapters_data.len() as f32,
        created_at: now.clone(),
        updated_at: now,
    }).map_err(|e| e.to_string())?;

    for (i, (ch_title, ch_content)) in chapters_data.into_iter().enumerate() {
        state.db.insert_chapter(&ChapterRecord {
            id: uuid::Uuid::new_v4().to_string(),
            book_id: book_id.clone(),
            idx: i as u32,
            title: ch_title,
            content: ch_content,
            distilled_content: String::new(),
        }).map_err(|e| e.to_string())?;
    }

    Ok(book_id)
}

fn base64_decode(s: &str) -> Result<Vec<u8>, String> {
    use base64::Engine;
    base64::engine::general_purpose::STANDARD
        .decode(s)
        .map_err(|e| format!("Base64 解码失败: {}", e))
}

fn extract_pdf_text(data: &[u8]) -> Result<String, String> {
    pdf_extract::extract_text(data).map_err(|e| format!("PDF 解析失败: {}", e))
}

#[tauri::command]
pub async fn list_books(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<BookInfo>, String> {
    let books = state.db.list_books().map_err(|e| e.to_string())?;
    let mut result = Vec::new();
    for b in books {
        let total = state.db.count_chapters(&b.id).unwrap_or(0);
        result.push(BookInfo {
            id: b.id,
            title: b.title,
            author: b.author,
            cover_color: None,
            source_format: b.file_type,
            status: b.status,
            progress: BookProgress {
                phase: "idle".into(),
                percent: b.progress,
                current_chapter: 0,
                total_chapters: total,
                message: String::new(),
                estimated_remaining_ms: None,
            },
            stats: BookStats {
                total_chapters: total,
                distilled_points: 0,
                categories: std::collections::HashMap::new(),
            },
            created_at: b.created_at,
            updated_at: b.updated_at,
        });
    }
    Ok(result)
}

#[tauri::command]
pub async fn start_distillation(
    book_id: String,
    _depth: String,
    state: tauri::State<'_, AppState>,
    app: tauri::AppHandle,
) -> Result<String, String> {
    let pipeline = crate::distill::DistillPipeline::new(
        state.llm_pool.clone(),
        state.db.clone(),
        state.config.distill.clone(),
    );
    let bid = book_id.clone();
    tokio::spawn(async move {
        if let Err(e) = pipeline.run(&bid, &app).await {
            eprintln!("Distillation failed for {}: {}", bid, e);
            let _ = app.emit("distillation-progress", serde_json::json!({
                "bookId": bid, "progress": 0.0, "phase": "error", "error": e
            }));
        }
    });
    Ok(format!("task-{}", uuid::Uuid::new_v4()))
}

#[tauri::command]
pub async fn get_distillation_status(
    book_id: String,
    state: tauri::State<'_, AppState>,
) -> Result<DistillStatus, String> {
    let book = state.db.get_book(&book_id)?;
    let chapters = state.db.get_chapters(&book_id)?;
    Ok(DistillStatus {
        book_id,
        is_running: book.status == "distilling",
        overall_progress: book.progress,
        current_phase: book.status,
        chapters: chapters
            .into_iter()
            .map(|ch| ChapterProgress {
                index: ch.idx,
                title: ch.title,
                status: if ch.distilled_content.is_empty() {
                    "pending".into()
                } else {
                    "completed".into()
                },
            })
            .collect(),
    })
}

#[tauri::command]
pub async fn get_chapter(
    book_id: String,
    chapter_index: u32,
    state: tauri::State<'_, AppState>,
) -> Result<ChapterContent, String> {
    let ch = state.db.get_chapter(&book_id, chapter_index)?;
    let empty = serde_json::json!({"shallow":[],"medium":[],"deep":[]});
    let distill: serde_json::Value =
        serde_json::from_str(&ch.distilled_content).unwrap_or(empty);

    fn parse_points(val: &serde_json::Value, chapter_index: u32) -> Vec<DistillPoint> {
        val.as_array()
            .map(|arr| {
                arr.iter()
                    .map(|p| DistillPoint {
                        id: p["id"].as_str().unwrap_or("").into(),
                        summary: p["summary"].as_str().unwrap_or("").into(),
                        evidence: p["evidence"].as_str().map(String::from),
                        citation: p["citation"].as_str().map(String::from),
                        original_ref: p["originalRef"].as_str().unwrap_or("").into(),
                        category: p["category"].as_str().unwrap_or("").into(),
                        chapter_index,
                    })
                    .collect()
            })
            .unwrap_or_default()
    }

    Ok(ChapterContent {
        book_id: ch.book_id,
        chapter_index: ch.idx,
        title: ch.title,
        shallow: parse_points(&distill["shallow"], chapter_index),
        medium: parse_points(&distill["medium"], chapter_index),
        deep: parse_points(&distill["deep"], chapter_index),
        original_text: ch.content,
    })
}

#[tauri::command]
pub async fn get_framework(
    book_id: String,
    state: tauri::State<'_, AppState>,
) -> Result<FrameworkTree, String> {
    match state.db.get_framework_by_book(&book_id)? {
        Some(rec) => {
            let val: serde_json::Value = serde_json::from_str(&rec.framework_tree)
                .unwrap_or(serde_json::json!({"title":"","children":[]}));
            Ok(FrameworkTree {
                book_id,
                title: val["title"].as_str().unwrap_or("").into(),
                children: parse_framework_nodes(&val["children"]),
            })
        }
        None => Ok(FrameworkTree {
            book_id,
            title: String::new(),
            children: vec![],
        }),
    }
}

fn parse_framework_nodes(val: &serde_json::Value) -> Vec<FrameworkNode> {
    val.as_array()
        .map(|arr| {
            arr.iter()
                .map(|n| FrameworkNode {
                    id: n["id"].as_str().unwrap_or("").into(),
                    label: n["label"].as_str().unwrap_or("").into(),
                    level: n["level"].as_u64().unwrap_or(0) as u32,
                    chapter_index: n["chapterIndex"].as_u64().map(|v| v as u32),
                    children: parse_framework_nodes(&n["children"]),
                })
                .collect()
        })
        .unwrap_or_default()
}

#[tauri::command]
pub async fn get_graph_data(
    book_id: String,
    state: tauri::State<'_, AppState>,
) -> Result<GraphData, String> {
    let nodes = state.db.get_graph_nodes(&book_id)?;
    let edges = state.db.get_graph_edges_for_book(&book_id)?;
    Ok(GraphData {
        nodes: nodes
            .into_iter()
            .map(|n| {
                let meta: serde_json::Value =
                    serde_json::from_str(&n.metadata).unwrap_or(serde_json::json!({}));
                GraphNode {
                    id: n.id,
                    label: n.label,
                    category: n.node_type,
                    chapter_index: meta["chapterIndex"].as_u64().unwrap_or(0) as u32,
                    point_count: meta["pointCount"].as_u64().unwrap_or(1) as u32,
                    size: meta["size"].as_f64().unwrap_or(8.0) as f32,
                }
            })
            .collect(),
        edges: edges
            .into_iter()
            .map(|e| GraphEdge {
                source: e.source_id,
                target: e.target_id,
                relation_type: e.relation_type,
            })
            .collect(),
    })
}

#[tauri::command]
pub async fn delete_book(
    book_id: String,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    state.db.delete_book_cascade(&book_id)
}

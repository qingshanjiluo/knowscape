use crate::config::DistillConfig;
use crate::database::{Database, FrameworkRecord, GraphEdgeRecord, GraphNodeRecord};
use crate::llm::{LlmOptions, LlmPool, Message};
use std::sync::Arc;
use tokio::sync::Semaphore;
use tauri::Emitter as _;

pub struct DistillPipeline {
    llm_pool: LlmPool,
    db: Database,
    config: DistillConfig,
}

impl DistillPipeline {
    pub fn new(llm_pool: LlmPool, db: Database, config: DistillConfig) -> Self {
        Self {
            llm_pool,
            db,
            config,
        }
    }

    pub async fn run(
        &self,
        book_id: &str,
        app: &tauri::AppHandle,
    ) -> Result<(), String> {
        self.db.update_book_status(book_id, "distilling", 0.0)?;

        let chapters = self.db.get_chapters(book_id)?;
        let total = chapters.len() as f32;
        if total == 0.0 {
            self.db.update_book_status(book_id, "completed", 100.0)?;
            return Ok(());
        }

        let semaphore = Arc::new(Semaphore::new(self.config.max_concurrent));
        let mut handles = Vec::new();

        let distill_client = self.llm_pool.get_for_agent("distill");

        for (i, ch) in chapters.into_iter().enumerate() {
            let permit = semaphore
                .clone()
                .acquire_owned()
                .await
                .map_err(|e| e.to_string())?;
            let llm = distill_client.clone();
            let db = self.db.clone();
            let bid = book_id.to_string();
            let app_clone = app.clone();
            let depth = self.config.default_depth.clone();

            let handle = tokio::spawn(async move {
                let result = distill_chapter(&llm, &ch.content, &ch.title, &depth).await;
                let _ = permit;

                match result {
                    Ok(distilled) => {
                        let _ = db.update_chapter_distilled(&ch.id, &distilled);
                    }
                    Err(e) => {
                        eprintln!("Distill chapter {} failed: {}", ch.idx, e);
                        let fallback = format!(
                            r#"{{"shallow":[{{"id":"{}","summary":"蒸馏失败: {}","originalRef":"ch{}","category":"论点"}}],"medium":[],"deep":[]}}"#,
                            uuid::Uuid::new_v4(), e.replace('"', "'"), ch.idx
                        );
                        let _ = db.update_chapter_distilled(&ch.id, &fallback);
                    }
                }

                let pct = ((i as f32 + 1.0) / total * 100.0) as f32;
                let _ = db.update_book_status(&bid, "distilling", pct);
                let _ = app_clone.emit("distillation-progress", serde_json::json!({
                    "bookId": bid,
                    "progress": pct,
                    "chapterIndex": i,
                    "chapterTitle": ch.title,
                }));
            });
            handles.push(handle);
        }

        for handle in handles {
            let _ = handle.await;
        }

        self.db
            .update_book_status(book_id, "distilling", 90.0)?;
        let _ = app.emit("distillation-progress", serde_json::json!({
            "bookId": book_id,
            "progress": 90.0,
            "phase": "framing"
        }));

        if let Err(e) = self.generate_framework(book_id).await {
            eprintln!("Framework generation failed: {}", e);
        }

        self.db
            .update_book_status(book_id, "distilling", 95.0)?;
        let _ = app.emit("distillation-progress", serde_json::json!({
            "bookId": book_id,
            "progress": 95.0,
            "phase": "graphing"
        }));

        if let Err(e) = self.generate_graph(book_id).await {
            eprintln!("Graph generation failed: {}", e);
        }

        self.db.update_book_status(book_id, "completed", 100.0)?;
        let _ = app.emit("distillation-progress", serde_json::json!({
            "bookId": book_id,
            "progress": 100.0,
            "phase": "completed"
        }));
        Ok(())
    }

    async fn generate_framework(&self, book_id: &str) -> Result<(), String> {
        let chapters = self.db.get_chapters(book_id)?;
        let mut all_summaries = Vec::new();
        for ch in &chapters {
            if ch.distilled_content.is_empty() {
                continue;
            }
            if let Ok(val) = serde_json::from_str::<serde_json::Value>(&ch.distilled_content) {
                if let Some(arr) = val["shallow"].as_array() {
                    for pt in arr {
                        if let Some(s) = pt["summary"].as_str() {
                            all_summaries.push(format!("ch{}: {}", ch.idx, s));
                        }
                    }
                }
            }
        }

        if all_summaries.is_empty() {
            return Ok(());
        }

        let summaries_text = all_summaries.join("\n");
        let prompt = format!(
            "你是一位知识架构师。根据以下从各章节提取的蒸馏点，构建一棵知识框架树。\n\n蒸馏点列表：\n{}\n\n请以JSON格式输出，结构为：{{\"title\": \"全书标题\", \"children\": [{{\"id\": \"...\", \"label\": \"...\", \"level\": 1, \"chapterIndex\": N, \"children\": [...]}}]}}\n\n要求：\n1. 按知识领域和逻辑关系组织层次结构\n2. 每个节点包含 id, label, level, chapterIndex 字段\n3. level 表示层级深度（1=根级，2=子级，以此类推）\n4. chapterIndex 表示该知识点主要来自第几章",
            truncate(&summaries_text, 4000)
        );

        let llm = self.llm_pool.get_for_agent("distill");
        let messages = vec![
            Message {
                role: "system".into(),
                content: "你是知境知识管理系统的框架生成引擎。请严格按JSON格式输出。".into(),
            },
            Message {
                role: "user".into(),
                content: prompt,
            },
        ];

        let options = LlmOptions {
            temperature: Some(0.3),
            max_tokens: Some(4096),
            stream: false,
        };

        let response = llm.chat(&messages, &options).await?;
        let json_str = extract_json(&response);

        if let Ok(val) = serde_json::from_str::<serde_json::Value>(&json_str) {
            let _title = val["title"].as_str().unwrap_or("未命名");
            let framework_tree = val.clone();
            self.db.upsert_framework(&FrameworkRecord {
                id: uuid::Uuid::new_v4().to_string(),
                book_id: book_id.to_string(),
                framework_tree: framework_tree.to_string(),
                type_index: "{}".to_string(),
            })?;
        }

        Ok(())
    }

    async fn generate_graph(&self, book_id: &str) -> Result<(), String> {
        let chapters = self.db.get_chapters(book_id)?;
        let mut nodes: Vec<(String, String, String, u32, u32)> = Vec::new();
        let mut node_ids: Vec<String> = Vec::new();

        for ch in &chapters {
            if ch.distilled_content.is_empty() {
                continue;
            }
            if let Ok(val) = serde_json::from_str::<serde_json::Value>(&ch.distilled_content) {
                for level in &["shallow", "medium", "deep"] {
                    if let Some(arr) = val[*level].as_array() {
                        for pt in arr {
                            let id = pt["id"]
                                .as_str()
                                .unwrap_or(&uuid::Uuid::new_v4().to_string())
                                .to_string();
                            let label = pt["summary"]
                                .as_str()
                                .unwrap_or("")
                                .to_string();
                            let category = pt["category"]
                                .as_str()
                                .unwrap_or("论点")
                                .to_string();
                            let chapter_index = ch.idx;
                            let point_count = 1u32;
                            nodes.push((id.clone(), label, category, chapter_index, point_count));
                            node_ids.push(id);
                        }
                    }
                }
            }
        }

        for (id, label, category, chapter_index, point_count) in &nodes {
            let metadata = serde_json::json!({
                "chapterIndex": chapter_index,
                "pointCount": point_count,
                "size": 20 + point_count * 5,
            });
            self.db.insert_graph_node(&GraphNodeRecord {
                id: id.clone(),
                book_id: book_id.to_string(),
                label: label.clone(),
                node_type: category.clone(),
                metadata: metadata.to_string(),
            })?;
        }

        let mut edges = Vec::new();
        let chapters_with_indices: Vec<(u32, Vec<&String>)> = {
            let mut map: std::collections::HashMap<u32, Vec<&String>> =
                std::collections::HashMap::new();
            for (id, _, _, ch_idx, _) in &nodes {
                map.entry(*ch_idx).or_default().push(id);
            }
            let mut sorted: Vec<_> = map.into_iter().collect();
            sorted.sort_by_key(|(k, _)| *k);
            sorted
        };

        for window in chapters_with_indices.windows(2) {
            let (_, prev_ids) = &window[0];
            let (_, curr_ids) = &window[1];
            if let (Some(src), Some(tgt)) = (prev_ids.first(), curr_ids.first()) {
                edges.push((
                    src.to_string(),
                    tgt.to_string(),
                    "chapter".to_string(),
                ));
            }
        }

        let mut category_map: std::collections::HashMap<String, Vec<String>> =
            std::collections::HashMap::new();
        for (id, _, category, _, _) in &nodes {
            category_map
                .entry(category.clone())
                .or_default()
                .push(id.clone());
        }
        for (_, ids) in &category_map {
            for pair in ids.windows(2) {
                edges.push((
                    pair[0].clone(),
                    pair[1].clone(),
                    "category".to_string(),
                ));
            }
        }

        for (source, target, relation_type) in &edges {
            self.db.insert_graph_edge(&GraphEdgeRecord {
                id: uuid::Uuid::new_v4().to_string(),
                source_id: source.clone(),
                target_id: target.clone(),
                relation_type: relation_type.clone(),
            })?;
        }

        Ok(())
    }
}

async fn distill_chapter(
    llm: &crate::llm::LlmClient,
    content: &str,
    title: &str,
    depth: &str,
) -> Result<String, String> {
    let prompt = match depth {
        "shallow" => format!(
            "你是一位学术助手。请对以下章节进行浅层蒸馏，提取3-5个核心论点。\n章节标题：{}\n\n章节内容：\n{}\n\n请以JSON格式输出，每个论点包含 id, summary, originalRef, category 字段。category 使用「论点」「论据」「方法」「概念」之一。",
            title, truncate(content, 3000)
        ),
        "deep" => format!(
            "你是一位资深学者。请对以下章节进行深层蒸馏，深入分析其逻辑结构、论证方法和知识关联。\n章节标题：{}\n\n章节内容：\n{}\n\n请以JSON格式输出，包含 shallow(浅层), medium(中层), deep(深层) 三个级别的蒸馏结果。每个级别包含3-8个蒸馏点，每个点包含 id, summary, evidence, citation, originalRef, category 字段。",
            title, truncate(content, 4000)
        ),
        _ => format!(
            "你是一位学术助手。请对以下章节进行中层蒸馏，提取核心论点、论据和知识关联。\n章节标题：{}\n\n章节内容：\n{}\n\n请以JSON格式输出 shallow 和 medium 两个级别。每个蒸馏点包含 id, summary, evidence, originalRef, category 字段。",
            title, truncate(content, 3500)
        ),
    };

    let messages = vec![
        Message {
            role: "system".into(),
            content: "你是知境知识管理系统的蒸馏引擎。请严格按照要求的JSON格式输出，不要添加多余文字。".into(),
        },
        Message {
            role: "user".into(),
            content: prompt,
        },
    ];

    let options = LlmOptions {
        temperature: Some(0.3),
        max_tokens: Some(4096),
        stream: false,
    };

    let response = llm.chat(&messages, &options).await?;
    let json_str = extract_json(&response);
    Ok(json_str)
}

fn truncate(s: &str, max_chars: usize) -> &str {
    if s.chars().count() <= max_chars {
        s
    } else {
        match s.char_indices().nth(max_chars) {
            Some((idx, _)) => &s[..idx],
            None => s,
        }
    }
}

fn extract_json(text: &str) -> String {
    if let Some(start) = text.find('{') {
        if let Some(end) = text.rfind('}') {
            return text[start..=end].to_string();
        }
    }
    text.to_string()
}

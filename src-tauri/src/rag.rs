use crate::database::Database;
use crate::embedding::EmbeddingProvider;
use crate::llm::{LlmClient, LlmOptions, Message};

#[derive(Debug, Clone)]
pub struct RagChunk {
    pub id: String,
    pub text: String,
    pub source: String,
    pub chapter_index: u32,
    pub score: f32,
}

#[derive(Debug, Clone)]
pub struct RagResult {
    pub answer: String,
    pub citations: Vec<RagChunk>,
}

pub struct RagEngine {
    embedding: EmbeddingProvider,
    llm: LlmClient,
}

impl RagEngine {
    pub fn new(embedding: EmbeddingProvider, llm: LlmClient) -> Self {
        Self { embedding, llm }
    }

    pub async fn search(
        &self,
        db: &Database,
        book_id: &str,
        query: &str,
    ) -> Result<Vec<RagChunk>, String> {
        let chapters = db.get_chapters(book_id)?;
        let mut chunks = Vec::new();

        for ch in &chapters {
            let text_lower = ch.content.to_lowercase();
            let query_lower = query.to_lowercase();
            let query_chars: Vec<char> = query_lower.chars().collect();

            let mut bm25_score = 0.0f32;
            for window in query_chars.windows(2) {
                let term: String = window.iter().collect();
                if text_lower.contains(&term) {
                    bm25_score += 1.0;
                }
            }
            if text_lower.contains(&query_lower) {
                bm25_score += 5.0;
            }

            let snippet = if ch.content.len() > 500 {
                find_best_snippet(&ch.content, query)
            } else {
                ch.content.clone()
            };

            if bm25_score > 0.0 || snippet != ch.content {
                chunks.push(RagChunk {
                    id: ch.id.clone(),
                    text: snippet,
                    source: ch.title.clone(),
                    chapter_index: ch.idx,
                    score: bm25_score,
                });
            }
        }

        if let Ok(query_vec) = self.embedding.embed(query).await {
            for ch in &chapters {
                if let Ok(ch_vec) = self.embedding.embed(&ch.content[..ch.content.len().min(500)]).await {
                    let sim = EmbeddingProvider::cosine_similarity(&query_vec, &ch_vec);
                    if sim > 0.3 {
                        if let Some(existing) = chunks.iter_mut().find(|c| c.id == ch.id) {
                            existing.score += sim * 10.0;
                        } else {
                            chunks.push(RagChunk {
                                id: ch.id.clone(),
                                text: ch.content[..ch.content.len().min(500)].to_string(),
                                source: ch.title.clone(),
                                chapter_index: ch.idx,
                                score: sim * 10.0,
                            });
                        }
                    }
                }
            }
        }

        chunks.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap_or(std::cmp::Ordering::Equal));
        chunks.truncate(5);
        Ok(chunks)
    }

    pub async fn generate(
        &self,
        query: &str,
        chunks: &[RagChunk],
    ) -> Result<RagResult, String> {
        let context: String = chunks
            .iter()
            .enumerate()
            .map(|(i, c)| format!("[引{}] (来源: {} 第{}章)\n{}", i + 1, c.source, c.chapter_index + 1, c.text))
            .collect::<Vec<_>>()
            .join("\n\n");

        let messages = vec![
            Message {
                role: "system".into(),
                content: "你是知境知识管理系统的问答引擎。请基于提供的参考资料回答用户问题。回答中使用 [引N] 标注引用来源。如果资料不足以回答，请说明。".into(),
            },
            Message {
                role: "user".into(),
                content: format!("参考资料：\n{}\n\n用户问题：{}", context, query),
            },
        ];

        let options = LlmOptions {
            temperature: Some(0.5),
            max_tokens: Some(2048),
            stream: false,
        };

        let answer = self.llm.chat(&messages, &options).await?;
        Ok(RagResult {
            answer,
            citations: chunks.to_vec(),
        })
    }

    pub async fn ask(
        &self,
        db: &Database,
        book_id: &str,
        query: &str,
    ) -> Result<RagResult, String> {
        let chunks = self.search(db, book_id, query).await?;
        if chunks.is_empty() {
            return Ok(RagResult {
                answer: "未找到相关内容，请尝试更具体的问题。".into(),
                citations: vec![],
            });
        }
        self.generate(query, &chunks).await
    }
}

fn find_best_snippet(text: &str, query: &str) -> String {
    let query_lower = query.to_lowercase();
    if let Some(pos) = text.to_lowercase().find(&query_lower) {
        let start = pos.saturating_sub(100);
        let end = (pos + query.len() + 200).min(text.len());
        let snippet = &text[start..end];
        if start > 0 {
            format!("...{}", snippet)
        } else if end < text.len() {
            format!("{}...", snippet)
        } else {
            snippet.to_string()
        }
    } else {
        text[..text.len().min(500)].to_string()
    }
}

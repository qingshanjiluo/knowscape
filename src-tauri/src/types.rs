use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BookInfo {
    pub id: String,
    pub title: String,
    pub author: String,
    pub cover_color: Option<String>,
    pub source_format: String,
    pub status: String,
    pub progress: BookProgress,
    pub stats: BookStats,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BookProgress {
    pub phase: String,
    pub percent: f32,
    pub current_chapter: u32,
    pub total_chapters: u32,
    pub message: String,
    pub estimated_remaining_ms: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BookStats {
    pub total_chapters: u32,
    pub distilled_points: u32,
    pub categories: std::collections::HashMap<String, u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChapterContent {
    pub book_id: String,
    pub chapter_index: u32,
    pub title: String,
    pub shallow: Vec<DistillPoint>,
    pub medium: Vec<DistillPoint>,
    pub deep: Vec<DistillPoint>,
    pub original_text: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DistillPoint {
    pub id: String,
    pub summary: String,
    pub evidence: Option<String>,
    pub citation: Option<String>,
    pub original_ref: String,
    pub category: String,
    pub chapter_index: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FrameworkTree {
    pub book_id: String,
    pub title: String,
    pub children: Vec<FrameworkNode>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FrameworkNode {
    pub id: String,
    pub label: String,
    pub level: u32,
    pub chapter_index: Option<u32>,
    pub children: Vec<FrameworkNode>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GraphData {
    pub nodes: Vec<GraphNode>,
    pub edges: Vec<GraphEdge>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GraphNode {
    pub id: String,
    pub label: String,
    pub category: String,
    pub chapter_index: u32,
    pub point_count: u32,
    pub size: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GraphEdge {
    pub source: String,
    pub target: String,
    pub relation_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DistillStatus {
    pub book_id: String,
    pub is_running: bool,
    pub overall_progress: f32,
    pub current_phase: String,
    pub chapters: Vec<ChapterProgress>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChapterProgress {
    pub index: u32,
    pub title: String,
    pub status: String,
}

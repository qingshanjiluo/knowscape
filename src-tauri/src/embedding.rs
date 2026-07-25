use crate::config::EmbeddingConfig;
use std::collections::HashMap;
use std::sync::RwLock;

pub struct EmbeddingProvider {
    http: reqwest::Client,
    base_url: String,
    dimension: usize,
    cache: RwLock<HashMap<String, Vec<f32>>>,
}

impl EmbeddingProvider {
    pub fn new(config: &EmbeddingConfig) -> Self {
        Self {
            http: reqwest::Client::new(),
            base_url: config.base_url.clone(),
            dimension: config.dimension,
            cache: RwLock::new(HashMap::new()),
        }
    }

    pub async fn embed(&self, text: &str) -> Result<Vec<f32>, String> {
        {
            let cache = self.cache.read().map_err(|e| e.to_string())?;
            if let Some(vec) = cache.get(text) {
                return Ok(vec.clone());
            }
        }

        let resp = self
            .http
            .post(format!("{}/embed", self.base_url))
            .json(&serde_json::json!({
                "input": [text],
                "model": "bge-large-zh"
            }))
            .send()
            .await
            .map_err(|e| format!("Embedding request failed: {}", e))?;

        let body: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
        let embeddings = body["embeddings"]
            .as_array()
            .or_else(|| body["data"].as_array().map(|a| a))
            .ok_or("Invalid embedding response")?;

        let first = embeddings.first().ok_or("Empty embedding response")?;
        let vec: Vec<f32> = if let Some(arr) = first["embedding"].as_array() {
            arr.iter().filter_map(|v| v.as_f64().map(|f| f as f32)).collect()
        } else if let Some(arr) = first.as_array() {
            arr.iter().filter_map(|v| v.as_f64().map(|f| f as f32)).collect()
        } else {
            Vec::new()
        };

        if vec.len() != self.dimension && !vec.is_empty() {
            eprintln!("Warning: embedding dimension {} != expected {}", vec.len(), self.dimension);
        }

        let normalized = normalize(&vec);
        {
            let mut cache = self.cache.write().map_err(|e| e.to_string())?;
            cache.insert(text.to_string(), normalized.clone());
        }
        Ok(normalized)
    }

    pub async fn embed_batch(&self, texts: &[&str]) -> Result<Vec<Vec<f32>>, String> {
        let mut results = Vec::with_capacity(texts.len());
        for text in texts {
            results.push(self.embed(text).await?);
        }
        Ok(results)
    }

    pub fn cosine_similarity(a: &[f32], b: &[f32]) -> f32 {
        let len = a.len().min(b.len());
        if len == 0 { return 0.0; }
        let dot: f32 = (0..len).map(|i| a[i] * b[i]).sum();
        let norm_a: f32 = (0..len).map(|i| a[i] * a[i]).sum::<f32>().sqrt();
        let norm_b: f32 = (0..len).map(|i| b[i] * b[i]).sum::<f32>().sqrt();
        if norm_a == 0.0 || norm_b == 0.0 { 0.0 } else { dot / (norm_a * norm_b) }
    }
}

fn normalize(v: &[f32]) -> Vec<f32> {
    let norm: f32 = v.iter().map(|x| x * x).sum::<f32>().sqrt();
    if norm == 0.0 {
        v.to_vec()
    } else {
        v.iter().map(|x| x / norm).collect()
    }
}

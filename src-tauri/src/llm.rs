use crate::config::{LlmConfig, LlmProvider};
use futures::Stream;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::pin::Pin;
use std::sync::Arc;
use std::time::Duration;

pub type BoxStream<'a, T> = Pin<Box<dyn Stream<Item = T> + Send + 'a>>;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Message {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Clone)]
pub struct LlmOptions {
    pub temperature: Option<f32>,
    pub max_tokens: Option<u32>,
    pub stream: bool,
}

impl Default for LlmOptions {
    fn default() -> Self {
        Self {
            temperature: None,
            max_tokens: None,
            stream: false,
        }
    }
}

#[derive(Debug, Clone, Serialize)]
struct ChatRequest {
    model: String,
    messages: Vec<Message>,
    #[serde(skip_serializing_if = "std::ops::Not::not")]
    stream: bool,
    temperature: f32,
    max_tokens: u32,
}

#[derive(Debug, Deserialize)]
struct ChatResponse {
    choices: Vec<Choice>,
}

#[derive(Debug, Deserialize)]
struct Choice {
    message: Option<ChoiceMessage>,
    #[allow(dead_code)]
    delta: Option<ChoiceDelta>,
}

#[derive(Debug, Deserialize)]
struct ChoiceMessage {
    content: Option<String>,
    reasoning_content: Option<String>,
}

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
struct ChoiceDelta {
    content: Option<String>,
}

#[derive(Clone)]
pub struct LlmClient {
    http: reqwest::Client,
    provider: LlmProvider,
}

impl LlmClient {
    pub fn new(provider: LlmProvider) -> Self {
        let http = reqwest::Client::builder()
            .timeout(Duration::from_secs(provider.timeout_seconds))
            .build()
            .expect("Failed to create HTTP client");
        Self { http, provider }
    }

    fn chat_url(&self) -> String {
        if self.provider.base_url.ends_with("/chat/completions")
            || self.provider.base_url.ends_with("/api/chat")
        {
            self.provider.base_url.clone()
        } else if self.provider.base_url.contains("11434") {
            format!("{}/api/chat", self.provider.base_url.trim_end_matches('/'))
        } else {
            format!(
                "{}/chat/completions",
                self.provider.base_url.trim_end_matches('/')
            )
        }
    }

    fn build_headers(&self) -> reqwest::header::HeaderMap {
        let mut headers = reqwest::header::HeaderMap::new();
        headers.insert("Content-Type", "application/json".parse().unwrap());
        if !self.provider.api_key.is_empty() {
            headers.insert(
                "Authorization",
                format!("Bearer {}", self.provider.api_key).parse().unwrap(),
            );
        }
        headers
    }

    pub async fn chat(
        &self,
        messages: &[Message],
        options: &LlmOptions,
    ) -> Result<String, String> {
        let body = ChatRequest {
            model: self.provider.model.clone(),
            messages: messages.to_vec(),
            stream: false,
            temperature: options
                .temperature
                .unwrap_or(self.provider.temperature),
            max_tokens: options
                .max_tokens
                .unwrap_or(self.provider.max_tokens),
        };

        let mut last_err = String::new();
        for attempt in 0..=self.provider.max_retries {
            match self
                .http
                .post(self.chat_url())
                .headers(self.build_headers())
                .json(&body)
                .send()
                .await
            {
                Ok(resp) => {
                    let text = resp.text().await.map_err(|e| e.to_string())?;
                    let parsed: ChatResponse = serde_json::from_str(&text).map_err(|e| {
                        format!(
                            "Parse error: {} | body: {}",
                            e,
                            &text[..text.len().min(200)]
                        )
                    })?;
                    if let Some(msg) = parsed.choices.first().and_then(|c| c.message.as_ref()) {
                        let content = msg.content.as_deref().unwrap_or("");
                        let reasoning = msg.reasoning_content.as_deref().unwrap_or("");
                        if !content.is_empty() {
                            return Ok(content.to_string());
                        }
                        if !reasoning.is_empty() {
                            return Ok(reasoning.to_string());
                        }
                    }
                    return Err("Empty response from LLM".into());
                }
                Err(e) => {
                    last_err = e.to_string();
                    if attempt < self.provider.max_retries {
                        tokio::time::sleep(Duration::from_secs(2u64.pow(attempt))).await;
                    }
                }
            }
        }
        Err(format!(
            "LLM request failed after {} retries: {}",
            self.provider.max_retries, last_err
        ))
    }

    pub fn stream_chat<'a>(
        &'a self,
        messages: &'a [Message],
        options: &'a LlmOptions,
    ) -> BoxStream<'a, Result<String, String>> {
        let body = ChatRequest {
            model: self.provider.model.clone(),
            messages: messages.to_vec(),
            stream: true,
            temperature: options
                .temperature
                .unwrap_or(self.provider.temperature),
            max_tokens: options
                .max_tokens
                .unwrap_or(self.provider.max_tokens),
        };

        let url = self.chat_url();
        let headers = self.build_headers();
        let http = self.http.clone();

        Box::pin(async_stream::stream! {
            let resp = http.post(&url).headers(headers).json(&body).send().await;
            let resp = match resp {
                Ok(r) => r,
                Err(e) => { yield Err(e.to_string()); return; }
            };
            let mut bytes_stream = resp.bytes_stream();
            use futures::StreamExt;
            let mut buffer = String::new();
            while let Some(chunk) = bytes_stream.next().await {
                let chunk = match chunk {
                    Ok(c) => c,
                    Err(e) => { yield Err(e.to_string()); return; }
                };
                buffer.push_str(&String::from_utf8_lossy(&chunk));
                while let Some(line_end) = buffer.find('\n') {
                    let line = buffer[..line_end].trim().to_string();
                    buffer = buffer[line_end + 1..].to_string();
                    if line.is_empty() || line == "data: [DONE]" { continue; }
                    let json_str = if let Some(rest) = line.strip_prefix("data: ") { rest } else { &line };
                    if let Ok(val) = serde_json::from_str::<serde_json::Value>(json_str) {
                        let content = if let Some(delta) = val["delta"]["content"].as_str() {
                            delta.to_string()
                        } else if let Some(delta) = val["delta"]["reasoning_content"].as_str() {
                            delta.to_string()
                        } else if let Some(content) = val["message"]["content"].as_str() {
                            content.to_string()
                        } else if let Some(reasoning) = val["message"]["reasoning_content"].as_str() {
                            reasoning.to_string()
                        } else {
                            continue;
                        };
                        if !content.is_empty() {
                            yield Ok(content);
                        }
                    }
                }
            }
        })
    }
}

pub struct LlmPool {
    clients: HashMap<String, Arc<LlmClient>>,
    config: LlmConfig,
}

impl Clone for LlmPool {
    fn clone(&self) -> Self {
        Self {
            clients: self.clients.clone(),
            config: self.config.clone(),
        }
    }
}

impl LlmPool {
    pub fn new(config: &LlmConfig) -> Self {
        let mut clients = HashMap::new();
        for (name, provider) in &config.providers {
            clients.insert(name.clone(), Arc::new(LlmClient::new(provider.clone())));
        }
        Self {
            clients,
            config: config.clone(),
        }
    }

    pub fn get_for_agent(&self, agent: &str) -> Arc<LlmClient> {
        let provider_name = self
            .config
            .agents
            .get(agent)
            .unwrap_or(&self.config.default_provider);
        self.clients
            .get(provider_name)
            .cloned()
            .or_else(|| self.clients.values().next().cloned())
            .unwrap_or_else(|| {
                Arc::new(LlmClient::new(LlmProvider::default()))
            })
    }

    pub fn get_default(&self) -> Arc<LlmClient> {
        self.get_for_agent("chat")
    }
}

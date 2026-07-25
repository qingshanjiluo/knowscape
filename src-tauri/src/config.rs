use serde::Deserialize;
use std::collections::HashMap;

#[derive(Debug, Clone, Deserialize)]
#[serde(default)]
pub struct AppConfig {
    pub llm: LlmConfig,
    pub embedding: EmbeddingConfig,
    pub database: DatabaseConfig,
    pub distill: DistillConfig,
    pub log: LogConfig,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(default)]
pub struct LlmConfig {
    pub default_provider: String,
    pub providers: HashMap<String, LlmProvider>,
    pub agents: HashMap<String, String>,
}

#[derive(Clone, Deserialize)]
#[serde(default)]
pub struct LlmProvider {
    pub api_key: String,
    pub base_url: String,
    pub model: String,
    pub timeout_seconds: u64,
    pub max_retries: u32,
    pub temperature: f32,
    pub max_tokens: u32,
}

impl std::fmt::Debug for LlmProvider {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("LlmProvider")
            .field("api_key", &"[REDACTED]")
            .field("base_url", &self.base_url)
            .field("model", &self.model)
            .field("timeout_seconds", &self.timeout_seconds)
            .field("max_retries", &self.max_retries)
            .field("temperature", &self.temperature)
            .field("max_tokens", &self.max_tokens)
            .finish()
    }
}

#[derive(Debug, Clone, Deserialize)]
#[serde(default)]
pub struct EmbeddingConfig {
    pub provider: String,
    pub base_url: String,
    pub dimension: usize,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(default)]
pub struct DatabaseConfig {
    pub path: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(default)]
pub struct DistillConfig {
    pub max_concurrent: usize,
    pub default_depth: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(default)]
pub struct LogConfig {
    pub level: String,
}

impl Default for LlmProvider {
    fn default() -> Self {
        Self {
            api_key: String::new(),
            base_url: "https://api.deepseek.com".into(),
            model: "deepseek-chat".into(),
            timeout_seconds: 60,
            max_retries: 3,
            temperature: 0.7,
            max_tokens: 4096,
        }
    }
}

impl Default for LlmConfig {
    fn default() -> Self {
        let mut providers = HashMap::new();
        providers.insert("deepseek".into(), LlmProvider {
            base_url: "https://api.deepseek.com".into(),
            model: "deepseek-chat".into(),
            ..Default::default()
        });

        let mut agents = HashMap::new();
        for name in &["distill", "rag", "chat", "generate"] {
            agents.insert(name.to_string(), "deepseek".into());
        }

        Self {
            default_provider: "deepseek".into(),
            providers,
            agents,
        }
    }
}

impl Default for EmbeddingConfig {
    fn default() -> Self {
        Self {
            provider: "http".into(),
            base_url: "http://localhost:8001".into(),
            dimension: 1024,
        }
    }
}

impl Default for DatabaseConfig {
    fn default() -> Self {
        Self {
            path: "knowscape.db".into(),
        }
    }
}

impl Default for DistillConfig {
    fn default() -> Self {
        Self {
            max_concurrent: 3,
            default_depth: "medium".into(),
        }
    }
}

impl Default for LogConfig {
    fn default() -> Self {
        Self {
            level: "info".into(),
        }
    }
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            llm: LlmConfig::default(),
            embedding: EmbeddingConfig::default(),
            database: DatabaseConfig::default(),
            distill: DistillConfig::default(),
            log: LogConfig::default(),
        }
    }
}

impl LlmConfig {
    pub fn resolve_provider(&self, agent: &str) -> LlmProvider {
        let provider_name = self.agents.get(agent)
            .unwrap_or(&self.default_provider);
        self.providers.get(provider_name)
            .cloned()
            .unwrap_or_else(|| self.providers.values().next().cloned().unwrap_or_default())
    }
}

pub fn load() -> AppConfig {
    let _ = dotenvy::dotenv();

    let mut config = AppConfig::default();

    let config_paths = ["config.toml", "knowscape.toml"];
    for path in config_paths {
        if let Ok(content) = std::fs::read_to_string(path) {
            if let Ok(file_config) = toml::from_str::<AppConfig>(&content) {
                config = file_config;
                break;
            }
        }
    }

    if let Ok(v) = std::env::var("LLM_DEFAULT_PROVIDER") {
        config.llm.default_provider = v;
    }

    if let Ok(v) = std::env::var("DEEPSEEK_API_KEY") {
        if let Some(p) = config.llm.providers.get_mut("deepseek") {
            p.api_key = v;
        }
    }
    if let Ok(v) = std::env::var("DEEPSEEK_BASE_URL") {
        if let Some(p) = config.llm.providers.get_mut("deepseek") {
            p.base_url = v;
        }
    }
    if let Ok(v) = std::env::var("OPENAI_API_KEY") {
        if let Some(p) = config.llm.providers.get_mut("openai") {
            p.api_key = v;
        } else {
            config.llm.providers.insert("openai".into(), LlmProvider {
                api_key: v,
                base_url: "https://api.openai.com/v1".into(),
                model: "gpt-4o".into(),
                ..Default::default()
            });
        }
    }
    if let Ok(v) = std::env::var("OPENAI_BASE_URL") {
        if let Some(p) = config.llm.providers.get_mut("openai") {
            p.base_url = v;
        }
    }
    if let Ok(v) = std::env::var("OLLAMA_BASE_URL") {
        if let Some(p) = config.llm.providers.get_mut("ollama") {
            p.base_url = v;
        }
    }
    if let Ok(v) = std::env::var("DEFAULT_MODEL") {
        for p in config.llm.providers.values_mut() {
            p.model = v.clone();
        }
    }
    if let Ok(v) = std::env::var("LLM_TIMEOUT_SECONDS") {
        let timeout = v.parse().unwrap_or(60);
        for p in config.llm.providers.values_mut() {
            p.timeout_seconds = timeout;
        }
    }
    if let Ok(v) = std::env::var("DB_PATH") {
        config.database.path = v;
    }
    if let Ok(v) = std::env::var("LOG_LEVEL") {
        config.log.level = v;
    }
    if let Ok(v) = std::env::var("EMBEDDING_BASE_URL") {
        config.embedding.base_url = v;
    }

    config
}

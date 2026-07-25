import os
from cloud.knowledge.models import IndexConfig, StorageBackendType


class KnowledgeConfig:
    backend: StorageBackendType
    db_path: str
    pg_dsn: str
    index: IndexConfig
    embedding_model: str
    embedding_device: str

    def __init__(self):
        self.backend = StorageBackendType(
            os.getenv("KNOWLEDGE_BACKEND", "sqlite")
        )
        self.db_path = os.getenv(
            "KNOWLEDGE_DB_PATH",
            os.path.join(os.getcwd(), "knowledge_store.db"),
        )
        self.pg_dsn = os.getenv(
            "DATABASE_URL",
            "postgresql+asyncpg://user:pass@localhost:5432/knowscape",
        )
        self.index = IndexConfig(
            enable_fts=os.getenv("KNOWLEDGE_FTS", "1") == "1",
            enable_vector=os.getenv("KNOWLEDGE_VECTOR", "1") == "1",
            vector_dimension=int(os.getenv("KNOWLEDGE_VECTOR_DIM", "384")),
            chunk_size=int(os.getenv("KNOWLEDGE_CHUNK_SIZE", "512")),
            chunk_overlap=int(os.getenv("KNOWLEDGE_CHUNK_OVERLAP", "64")),
        )
        self.embedding_model = os.getenv(
            "KNOWLEDGE_EMBEDDING_MODEL", "all-MiniLM-L6-v2"
        )
        self.embedding_device = os.getenv("KNOWLEDGE_DEVICE", "cpu")

    def for_doc(self, **overrides) -> "KnowledgeConfig":
        c = KnowledgeConfig.__new__(KnowledgeConfig)
        c.backend = overrides.get("backend", self.backend)
        c.db_path = overrides.get("db_path", self.db_path)
        c.pg_dsn = overrides.get("pg_dsn", self.pg_dsn)
        c.index = overrides.get("index", self.index)
        c.embedding_model = overrides.get("embedding_model", self.embedding_model)
        c.embedding_device = overrides.get("embedding_device", self.embedding_device)
        return c


default_config = KnowledgeConfig()

use rusqlite::{params, Connection};
use std::sync::{Arc, Mutex};

#[derive(Debug, Clone)]
pub struct BookRecord {
    pub id: String,
    pub title: String,
    pub author: String,
    pub file_path: String,
    pub file_type: String,
    pub status: String,
    pub progress: f32,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone)]
pub struct ChapterRecord {
    pub id: String,
    pub book_id: String,
    pub idx: u32,
    pub title: String,
    pub content: String,
    pub distilled_content: String,
}

#[derive(Debug, Clone)]
pub struct FrameworkRecord {
    pub id: String,
    pub book_id: String,
    pub framework_tree: String,
    pub type_index: String,
}

#[derive(Debug, Clone)]
pub struct GraphNodeRecord {
    pub id: String,
    pub book_id: String,
    pub label: String,
    pub node_type: String,
    pub metadata: String,
}

#[derive(Debug, Clone)]
pub struct GraphEdgeRecord {
    pub id: String,
    pub source_id: String,
    pub target_id: String,
    pub relation_type: String,
}

#[derive(Clone)]
pub struct Database {
    conn: Arc<Mutex<Connection>>,
}

impl Database {
    pub fn new(db_path: &str) -> Result<Self, String> {
        let conn =
            Connection::open(db_path).map_err(|e| format!("Failed to open database: {}", e))?;
        conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")
            .map_err(|e| format!("Failed to configure database: {}", e))?;
        Ok(Self {
            conn: Arc::new(Mutex::new(conn)),
        })
    }

    pub fn initialize(&self) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute_batch(SCHEMA)
            .map_err(|e| format!("Failed to create tables: {}", e))?;
        Ok(())
    }

    pub fn insert_book(&self, record: &BookRecord) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "INSERT INTO books (id, title, author, file_path, file_type, status, progress, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![record.id, record.title, record.author, record.file_path, record.file_type, record.status, record.progress, record.created_at, record.updated_at],
        ).map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn list_books(&self) -> Result<Vec<BookRecord>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn
            .prepare(
                "SELECT id, title, author, file_path, file_type, status, progress, created_at, updated_at FROM books ORDER BY created_at DESC",
            )
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map([], |row| {
                Ok(BookRecord {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    author: row.get(2)?,
                    file_path: row.get(3)?,
                    file_type: row.get(4)?,
                    status: row.get(5)?,
                    progress: row.get(6)?,
                    created_at: row.get(7)?,
                    updated_at: row.get(8)?,
                })
            })
            .map_err(|e| e.to_string())?;
        let mut books = Vec::new();
        for row in rows {
            books.push(row.map_err(|e| e.to_string())?);
        }
        Ok(books)
    }

    pub fn get_book(&self, id: &str) -> Result<BookRecord, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.query_row(
            "SELECT id, title, author, file_path, file_type, status, progress, created_at, updated_at FROM books WHERE id = ?1",
            params![id],
            |row| {
                Ok(BookRecord {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    author: row.get(2)?,
                    file_path: row.get(3)?,
                    file_type: row.get(4)?,
                    status: row.get(5)?,
                    progress: row.get(6)?,
                    created_at: row.get(7)?,
                    updated_at: row.get(8)?,
                })
            },
        )
        .map_err(|e| format!("Book not found: {}", e))
    }

    pub fn update_book_status(&self, id: &str, status: &str, progress: f32) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let now = chrono::Utc::now().to_rfc3339();
        conn.execute(
            "UPDATE books SET status = ?1, progress = ?2, updated_at = ?3 WHERE id = ?4",
            params![status, progress, now, id],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn delete_book_cascade(&self, id: &str) -> Result<(), String> {
        let mut conn = self.conn.lock().map_err(|e| e.to_string())?;
        let tx = conn.transaction().map_err(|e| e.to_string())?;
        tx.execute("DELETE FROM graph_edges WHERE source_id IN (SELECT id FROM graph_nodes WHERE book_id = ?1)", params![id])
            .map_err(|e| e.to_string())?;
        tx.execute("DELETE FROM graph_nodes WHERE book_id = ?1", params![id])
            .map_err(|e| e.to_string())?;
        tx.execute("DELETE FROM frameworks WHERE book_id = ?1", params![id])
            .map_err(|e| e.to_string())?;
        tx.execute("DELETE FROM distillations WHERE book_id = ?1", params![id])
            .map_err(|e| e.to_string())?;
        tx.execute("DELETE FROM chapters WHERE book_id = ?1", params![id])
            .map_err(|e| e.to_string())?;
        tx.execute("DELETE FROM books WHERE id = ?1", params![id])
            .map_err(|e| e.to_string())?;
        tx.commit().map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn insert_chapter(&self, record: &ChapterRecord) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "INSERT INTO chapters (id, book_id, idx, title, content, distilled_content) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![record.id, record.book_id, record.idx, record.title, record.content, record.distilled_content],
        ).map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn get_chapter(&self, book_id: &str, idx: u32) -> Result<ChapterRecord, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.query_row(
            "SELECT id, book_id, idx, title, content, distilled_content FROM chapters WHERE book_id = ?1 AND idx = ?2",
            params![book_id, idx],
            |row| {
                Ok(ChapterRecord {
                    id: row.get(0)?,
                    book_id: row.get(1)?,
                    idx: row.get(2)?,
                    title: row.get(3)?,
                    content: row.get(4)?,
                    distilled_content: row.get(5)?,
                })
            },
        )
        .map_err(|e| format!("Chapter not found: {}", e))
    }

    pub fn get_chapters(&self, book_id: &str) -> Result<Vec<ChapterRecord>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn
            .prepare("SELECT id, book_id, idx, title, content, distilled_content FROM chapters WHERE book_id = ?1 ORDER BY idx")
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map(params![book_id], |row| {
                Ok(ChapterRecord {
                    id: row.get(0)?,
                    book_id: row.get(1)?,
                    idx: row.get(2)?,
                    title: row.get(3)?,
                    content: row.get(4)?,
                    distilled_content: row.get(5)?,
                })
            })
            .map_err(|e| e.to_string())?;
        let mut chapters = Vec::new();
        for row in rows {
            chapters.push(row.map_err(|e| e.to_string())?);
        }
        Ok(chapters)
    }

    pub fn update_chapter_distilled(&self, id: &str, content: &str) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "UPDATE chapters SET distilled_content = ?1 WHERE id = ?2",
            params![content, id],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn count_chapters(&self, book_id: &str) -> Result<u32, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM chapters WHERE book_id = ?1",
                params![book_id],
                |row| row.get(0),
            )
            .map_err(|e| e.to_string())?;
        Ok(count as u32)
    }

    pub fn upsert_framework(&self, record: &FrameworkRecord) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "INSERT OR REPLACE INTO frameworks (id, book_id, framework_tree, type_index) VALUES (?1, ?2, ?3, ?4)",
            params![record.id, record.book_id, record.framework_tree, record.type_index],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn get_framework_by_book(&self, book_id: &str) -> Result<Option<FrameworkRecord>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let result = conn.query_row(
            "SELECT id, book_id, framework_tree, type_index FROM frameworks WHERE book_id = ?1",
            params![book_id],
            |row| {
                Ok(FrameworkRecord {
                    id: row.get(0)?,
                    book_id: row.get(1)?,
                    framework_tree: row.get(2)?,
                    type_index: row.get(3)?,
                })
            },
        );
        match result {
            Ok(record) => Ok(Some(record)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e.to_string()),
        }
    }

    pub fn insert_graph_node(&self, record: &GraphNodeRecord) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "INSERT OR REPLACE INTO graph_nodes (id, book_id, label, type, metadata) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![record.id, record.book_id, record.label, record.node_type, record.metadata],
        ).map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn insert_graph_edge(&self, record: &GraphEdgeRecord) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "INSERT INTO graph_edges (id, source_id, target_id, relation_type) VALUES (?1, ?2, ?3, ?4)",
            params![record.id, record.source_id, record.target_id, record.relation_type],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn get_graph_nodes(&self, book_id: &str) -> Result<Vec<GraphNodeRecord>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn
            .prepare("SELECT id, book_id, label, type, metadata FROM graph_nodes WHERE book_id = ?1")
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map(params![book_id], |row| {
                Ok(GraphNodeRecord {
                    id: row.get(0)?,
                    book_id: row.get(1)?,
                    label: row.get(2)?,
                    node_type: row.get(3)?,
                    metadata: row.get(4)?,
                })
            })
            .map_err(|e| e.to_string())?;
        let mut nodes = Vec::new();
        for row in rows {
            nodes.push(row.map_err(|e| e.to_string())?);
        }
        Ok(nodes)
    }

    pub fn get_graph_edges_for_book(&self, book_id: &str) -> Result<Vec<GraphEdgeRecord>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn
            .prepare(
                "SELECT ge.id, ge.source_id, ge.target_id, ge.relation_type FROM graph_edges ge JOIN graph_nodes gn ON ge.source_id = gn.id WHERE gn.book_id = ?1",
            )
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map(params![book_id], |row| {
                Ok(GraphEdgeRecord {
                    id: row.get(0)?,
                    source_id: row.get(1)?,
                    target_id: row.get(2)?,
                    relation_type: row.get(3)?,
                })
            })
            .map_err(|e| e.to_string())?;
        let mut edges = Vec::new();
        for row in rows {
            edges.push(row.map_err(|e| e.to_string())?);
        }
        Ok(edges)
    }
}

const SCHEMA: &str = "
CREATE TABLE IF NOT EXISTS books (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    author TEXT DEFAULT '',
    file_path TEXT DEFAULT '',
    file_type TEXT DEFAULT '',
    status TEXT DEFAULT 'idle',
    progress REAL DEFAULT 0.0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS chapters (
    id TEXT PRIMARY KEY,
    book_id TEXT NOT NULL,
    idx INTEGER NOT NULL,
    title TEXT NOT NULL,
    content TEXT DEFAULT '',
    distilled_content TEXT DEFAULT '',
    FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS distillations (
    id TEXT PRIMARY KEY,
    book_id TEXT NOT NULL,
    chapter_id TEXT NOT NULL,
    depth TEXT NOT NULL,
    content TEXT DEFAULT '',
    created_at TEXT NOT NULL,
    FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
    FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS frameworks (
    id TEXT PRIMARY KEY,
    book_id TEXT NOT NULL UNIQUE,
    framework_tree TEXT DEFAULT '{}',
    type_index TEXT DEFAULT '{}',
    FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS graph_nodes (
    id TEXT PRIMARY KEY,
    book_id TEXT NOT NULL,
    label TEXT NOT NULL,
    type TEXT DEFAULT '',
    metadata TEXT DEFAULT '{}',
    FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS graph_edges (
    id TEXT PRIMARY KEY,
    source_id TEXT NOT NULL,
    target_id TEXT NOT NULL,
    relation_type TEXT DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_chapters_book ON chapters(book_id);
CREATE INDEX IF NOT EXISTS idx_chapters_idx ON chapters(book_id, idx);
CREATE INDEX IF NOT EXISTS idx_distillations_book ON distillations(book_id);
CREATE INDEX IF NOT EXISTS idx_distillations_chapter ON distillations(chapter_id);
CREATE INDEX IF NOT EXISTS idx_frameworks_book ON frameworks(book_id);
CREATE INDEX IF NOT EXISTS idx_graph_nodes_book ON graph_nodes(book_id);
CREATE INDEX IF NOT EXISTS idx_graph_edges_source ON graph_edges(source_id);
CREATE INDEX IF NOT EXISTS idx_graph_edges_target ON graph_edges(target_id);
";

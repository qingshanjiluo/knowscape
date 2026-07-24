CREATE TABLE IF NOT EXISTS books (
  id TEXT PRIMARY KEY, title TEXT, author TEXT, file_path TEXT,
  file_type TEXT, status TEXT, progress REAL,
  created_at TEXT, updated_at TEXT
);

CREATE TABLE IF NOT EXISTS chapters (
  id TEXT PRIMARY KEY, book_id TEXT, idx INTEGER, title TEXT,
  content TEXT, distilled_content TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS frameworks (
  book_id TEXT PRIMARY KEY, framework_tree TEXT
);

CREATE TABLE IF NOT EXISTS graph_nodes (
  id TEXT PRIMARY KEY, book_id TEXT, label TEXT, node_type TEXT, metadata TEXT
);

CREATE TABLE IF NOT EXISTS graph_edges (
  id TEXT PRIMARY KEY, book_id TEXT, source_id TEXT, target_id TEXT, relation_type TEXT
);

CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY, book_id TEXT, title TEXT, content TEXT,
  custom_prompt TEXT, created_at TEXT
);

CREATE TABLE IF NOT EXISTS annotations (
  id TEXT PRIMARY KEY, book_id TEXT, chapter_idx INTEGER, content TEXT,
  type TEXT DEFAULT 'highlight', color TEXT DEFAULT '#FFEB3B',
  start_offset INTEGER DEFAULT 0, end_offset INTEGER DEFAULT 0,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS checkins (
  id TEXT PRIMARY KEY, user_id TEXT DEFAULT 'default', created_at TEXT
);

CREATE TABLE IF NOT EXISTS chat_sessions (
  id TEXT PRIMARY KEY, book_id TEXT, title TEXT, created_at TEXT, updated_at TEXT
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY, session_id TEXT, book_id TEXT, role TEXT, content TEXT, created_at TEXT
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE,
  password_hash TEXT NOT NULL,
  avatar TEXT,
  bio TEXT,
  is_active INTEGER DEFAULT 1,
  is_admin INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS user_points (
  id TEXT PRIMARY KEY,
  user_id TEXT UNIQUE NOT NULL,
  balance INTEGER DEFAULT 0,
  total_earned INTEGER DEFAULT 0,
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS point_transactions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  amount INTEGER NOT NULL,
  type TEXT NOT NULL,
  description TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS user_membership (
  id TEXT PRIMARY KEY,
  user_id TEXT UNIQUE NOT NULL,
  level TEXT DEFAULT 'free',
  expire_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS token_usage (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  model TEXT,
  source TEXT DEFAULT 'chat',
  cache_hit INTEGER DEFAULT 0,
  prompt_tokens INTEGER DEFAULT 0,
  completion_tokens INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  cost_points INTEGER DEFAULT 0,
  duration_ms INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS daily_quota (
  user_id TEXT NOT NULL,
  date TEXT NOT NULL,
  used_tokens INTEGER DEFAULT 0,
  PRIMARY KEY (user_id, date)
);

CREATE TABLE IF NOT EXISTS community_resources (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  book_id TEXT,
  title TEXT NOT NULL,
  description TEXT,
  categories TEXT DEFAULT '[]',
  content TEXT,
  cover_color TEXT,
  views INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  is_published INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS community_likes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, resource_id)
);

CREATE TABLE IF NOT EXISTS community_comments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  content TEXT NOT NULL,
  parent_id TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS co_reading (
  id TEXT PRIMARY KEY,
  book_id TEXT,
  title TEXT NOT NULL,
  description TEXT,
  cover_color TEXT,
  max_participants INTEGER DEFAULT 50,
  current_participants INTEGER DEFAULT 1,
  start_date TEXT,
  end_date TEXT,
  status TEXT DEFAULT 'active',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS co_reading_members (
  id TEXT PRIMARY KEY,
  co_reading_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT DEFAULT 'member',
  progress INTEGER DEFAULT 0,
  joined_at TEXT DEFAULT (datetime('now')),
  UNIQUE(co_reading_id, user_id)
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  plan TEXT NOT NULL DEFAULT 'free',
  status TEXT DEFAULT 'active',
  monthly_points INTEGER DEFAULT 0,
  ebook_quota INTEGER DEFAULT 0,
  ebook_used INTEGER DEFAULT 0,
  expire_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  plan TEXT,
  amount INTEGER NOT NULL,
  points INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending',
  payment_method TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS redeem_codes (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  type TEXT NOT NULL,
  value INTEGER NOT NULL,
  plan TEXT,
  is_used INTEGER DEFAULT 0,
  used_by TEXT,
  used_at TEXT,
  expire_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ebook_benefits (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  book_code TEXT UNIQUE NOT NULL,
  book_name TEXT,
  status TEXT DEFAULT 'active',
  expire_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS daily_tasks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  task_type TEXT NOT NULL,
  date TEXT NOT NULL,
  count INTEGER DEFAULT 0,
  UNIQUE(user_id, task_type, date)
);

CREATE TABLE IF NOT EXISTS reading_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  book_id TEXT,
  start_time TEXT NOT NULL,
  end_time TEXT,
  duration_minutes INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS agent_conversations (
  id TEXT PRIMARY KEY,
  user_id TEXT DEFAULT 'default',
  title TEXT DEFAULT '新对话',
  book_id TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS agent_messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  tool_calls TEXT,
  tool_results TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS agent_cache (
  cache_key TEXT PRIMARY KEY,
  response TEXT NOT NULL,
  book_id TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS book_preprocessing (
  id TEXT PRIMARY KEY,
  book_id TEXT NOT NULL,
  original_chapters INTEGER DEFAULT 0,
  cleaned_chapters INTEGER DEFAULT 0,
  footnotes_extracted INTEGER DEFAULT 0,
  references_extracted INTEGER DEFAULT 0,
  copyright_removed INTEGER DEFAULT 0,
  toc_detected INTEGER DEFAULT 0,
  background_json TEXT,
  metadata_json TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS mindmaps (
  id TEXT PRIMARY KEY,
  book_id TEXT,
  user_id TEXT DEFAULT 'default',
  title TEXT DEFAULT '思维导图',
  content TEXT NOT NULL,
  style TEXT DEFAULT 'tree',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS knowledge_maps (
  id TEXT PRIMARY KEY,
  book_id TEXT NOT NULL,
  title TEXT DEFAULT '知识地图',
  layout TEXT DEFAULT 'mindmap',
  nodes_json TEXT DEFAULT '[]',
  edges_json TEXT DEFAULT '[]',
  styles_json TEXT DEFAULT '{}',
  version INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS mindmap_versions (
  id TEXT PRIMARY KEY,
  map_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  nodes_json TEXT NOT NULL,
  edges_json TEXT NOT NULL,
  styles_json TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS knowledge_base (
  id TEXT PRIMARY KEY,
  book_id TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT,
  metadata TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

ALTER TABLE documents ADD COLUMN created_at TEXT;
ALTER TABLE documents ADD COLUMN custom_prompt TEXT;
ALTER TABLE books ADD COLUMN total_chapters INTEGER DEFAULT 0;
ALTER TABLE books ADD COLUMN distilled_points INTEGER DEFAULT 0;
ALTER TABLE books ADD COLUMN author TEXT;
ALTER TABLE token_usage ADD COLUMN source TEXT DEFAULT 'chat';
ALTER TABLE token_usage ADD COLUMN cache_hit INTEGER DEFAULT 0;
ALTER TABLE token_usage ADD COLUMN duration_ms INTEGER DEFAULT 0;

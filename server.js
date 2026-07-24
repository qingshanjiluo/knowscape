const express = require('express');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');

require('dotenv').config({ path: path.join(__dirname, 'src-tauri', '.env') });

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const DB_PATH = path.join(__dirname, 'knowscape_web.db');
const Database = require('better-sqlite3');
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

db.exec(`
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
`);

try { db.exec(`ALTER TABLE documents ADD COLUMN created_at TEXT`); } catch {}
try { db.exec(`ALTER TABLE documents ADD COLUMN custom_prompt TEXT`); } catch {}
try { db.exec(`ALTER TABLE books ADD COLUMN total_chapters INTEGER DEFAULT 0`); } catch {}
try { db.exec(`ALTER TABLE books ADD COLUMN distilled_points INTEGER DEFAULT 0`); } catch {}
try { db.exec(`ALTER TABLE books ADD COLUMN author TEXT`); } catch {}
try { db.exec(`ALTER TABLE token_usage ADD COLUMN source TEXT DEFAULT 'chat'`); } catch {}
try { db.exec(`ALTER TABLE token_usage ADD COLUMN cache_hit INTEGER DEFAULT 0`); } catch {}
try { db.exec(`ALTER TABLE token_usage ADD COLUMN duration_ms INTEGER DEFAULT 0`); } catch {}

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ detail: '请先登录' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const jwt = require('jsonwebtoken');
    const JWT_SECRET = process.env.JWT_SECRET || 'knowscape-secret-key-2024';
    const decoded = jwt.verify(token, JWT_SECRET);
    const session = db.prepare("SELECT * FROM sessions WHERE token = ? AND expires_at > datetime('now')").get(token);
    if (!session) {
      return res.status(401).json({ detail: '登录已过期' });
    }
    const user = db.prepare('SELECT id, username, email, avatar, bio, is_admin, is_active FROM users WHERE id = ?').get(decoded.userId);
    if (!user || !user.is_active) {
      return res.status(401).json({ detail: '用户不存在或已被禁用' });
    }
    req.user = user;
    next();
  } catch (e) {
    return res.status(401).json({ detail: '无效的登录凭证' });
  }
}

function addPoints(userId, amount, type, description) {
  const points = db.prepare('SELECT * FROM user_points WHERE user_id = ?').get(userId);
  if (points) {
    db.prepare("UPDATE user_points SET balance = balance + ?, total_earned = total_earned + ?, updated_at = datetime('now') WHERE user_id = ?").run(amount, Math.max(0, amount), userId);
  } else {
    db.prepare('INSERT INTO user_points (id, user_id, balance, total_earned) VALUES (?, ?, ?, ?)').run(uuidv4(), userId, amount, Math.max(0, amount));
  }
  db.prepare('INSERT INTO point_transactions (id, user_id, amount, type, description) VALUES (?, ?, ?, ?, ?)').run(uuidv4(), userId, amount, type, description);
}

function consumePoints(userId, amount, type, description) {
  const points = db.prepare('SELECT * FROM user_points WHERE user_id = ?').get(userId);
  if (!points || points.balance < amount) {
    return false;
  }
  db.prepare("UPDATE user_points SET balance = balance - ?, updated_at = datetime('now') WHERE user_id = ?").run(amount, userId);
  db.prepare('INSERT INTO point_transactions (id, user_id, amount, type, description) VALUES (?, ?, ?, ?, ?)').run(uuidv4(), userId, -amount, type, description);
  return true;
}

function getMembershipLevel(userId) {
  const m = db.prepare('SELECT * FROM user_membership WHERE user_id = ?').get(userId);
  if (!m || (m.expire_at && new Date(m.expire_at) < new Date())) return 'free';
  return m.level;
}

function getMembershipBenefits(level) {
  const benefits = {
    free: { name: '免费用户', maxDepth: 'shallow', ragLimit: 5, tokenDaily: 10000, exportPdf: false },
    silver: { name: '白银会员', maxDepth: 'medium', ragLimit: 20, tokenDaily: 50000, exportPdf: true },
    gold: { name: '黄金会员', maxDepth: 'deep', ragLimit: -1, tokenDaily: 200000, exportPdf: true, priority: true },
  };
  return benefits[level] || benefits.free;
}

function checkDailyTask(userId, taskType, maxCount) {
  const today = new Date().toISOString().split('T')[0];
  const task = db.prepare('SELECT * FROM daily_tasks WHERE user_id = ? AND task_type = ? AND date = ?').get(userId, taskType, today);
  if (!task) {
    db.prepare('INSERT INTO daily_tasks (id, user_id, task_type, date, count) VALUES (?, ?, ?, ?, 1)').run(uuidv4(), userId, taskType, today);
    return true;
  }
  if (task.count >= maxCount) return false;
  db.prepare('UPDATE daily_tasks SET count = count + 1 WHERE id = ?').run(task.id);
  return true;
}

function parseChapters(text) {
  const lines = text.split('\n');
  const candidates = [];

  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (!t) continue;

    if (/^#{1,4}\s+/.test(t)) {
      candidates.push({ line: i, title: t.replace(/^#+\s*/, ''), method: 'markdown' });
    } else if (/^(第[一二三四五六七八九十百千\d]+[章节卷篇部]|(卷|篇|部|Part|Volume)\s*\d*|Chapter\s+\d+|CHAPTER\s+\d+)/i.test(t) && t.length < 60) {
      candidates.push({ line: i, title: t, method: 'chinese_marker' });
    } else if (/^(\d+[\.\、])\s*[^\d]/.test(t) && t.length < 80 && t.length > 4) {
      candidates.push({ line: i, title: t, method: 'numbered' });
    } else if (/^(序言|前言|引言|序|引子|导言|绪论|附录|参考文献|后记|致谢|跋|附)/i.test(t) && t.length < 20) {
      candidates.push({ line: i, title: t, method: 'structural' });
    } else if (/^【.+】$/.test(t) || /^「.+」$/.test(t)) {
      candidates.push({ line: i, title: t.replace(/[【】「」]/g, ''), method: 'bracket' });
    }
  }

  if (candidates.length >= 2) {
    const chapters = [];
    for (let i = 0; i < candidates.length; i++) {
      const start = candidates[i].line;
      const end = i + 1 < candidates.length ? candidates[i + 1].line : lines.length;
      const content = lines.slice(start, end).join('\n').trim();
      if (content) chapters.push([candidates[i].title, content]);
    }
    if (chapters.length) return chapters;
  }

  const paragraphs = text.split(/\n{3,}/);
  if (paragraphs.length >= 3) {
    const chunkSize = Math.max(1, Math.ceil(paragraphs.length / Math.min(10, paragraphs.length)));
    const chapters = [];
    for (let i = 0; i < paragraphs.length; i += chunkSize) {
      const chunk = paragraphs.slice(i, i + chunkSize).join('\n\n\n').trim();
      if (chunk) chapters.push([`章节 ${chapters.length + 1}`, chunk]);
    }
    if (chapters.length) return chapters;
  }

  if (text.trim()) {
    const maxLen = 8000;
    const chapters = [];
    for (let i = 0; i < text.length; i += maxLen) {
      const chunk = text.slice(i, i + maxLen).trim();
      if (chunk) chapters.push([`章节 ${chapters.length + 1}`, chunk]);
    }
    return chapters.length ? chapters : [['全文', text.trim()]];
  }
  return [];
}

async function aiSplitChapters(text, llmConfig) {
  if (!llmConfig || !llmConfig.api_key || text.length < 2000) return null;

  const preview = text.length > 6000 ? text.slice(0, 6000) + '\n...(省略中间部分)...\n' + text.slice(-2000) : text;
  const prompt = `你是一位专业的文档结构分析专家。请分析以下文档内容，识别出所有章节边界。

文档内容:
${preview}

请以 JSON 格式返回章节列表（仅返回标题，不要返回内容）:
{
  "chapters": [
    {"title": "章节标题", "line_hint": "该章节开头的几个关键字"}
  ]
}

要求:
1. 识别所有自然章节边界（标题、主题转换、段落分界）
2. 每章应有实质性内容（不少于500字）
3. 如果文档没有明显章节结构，按内容主题拆分为3-10个章节
4. 仅返回JSON，不要其他文字`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    let resp;
    try {
      resp = await fetch(`${llmConfig.base_url.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${llmConfig.api_key}` },
        body: JSON.stringify({
          model: llmConfig.model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.1,
          max_tokens: 1000,
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!resp.ok) return null;
    const data = await resp.json();
    const content = data.choices?.[0]?.message?.content || '';

    const jsonMatch = content.match(/\{[\s\S]*"chapters"[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed.chapters) || parsed.chapters.length < 2) return null;

    const lines = text.split('\n');
    const result = [];
    const usedLines = new Set();

    for (const ch of parsed.chapters) {
      if (!ch.title || !ch.line_hint) continue;
      let startLine = -1;
      const hint = ch.line_hint.slice(0, 20);

      for (let i = 0; i < lines.length; i++) {
        if (usedLines.has(i)) continue;
        if (lines[i].includes(hint) || lines[i].trim() === ch.title.trim()) {
          startLine = i;
          break;
        }
      }

      if (startLine === -1) {
        for (let i = 0; i < lines.length; i++) {
          if (!usedLines.has(i) && lines[i].trim().length > 0) {
            startLine = i;
            break;
          }
        }
      }

      if (startLine >= 0) {
        usedLines.add(startLine);
        result.push({ title: ch.title, startLine });
      }
    }

    if (result.length < 2) return null;

    result.sort((a, b) => a.startLine - b.startLine);

    const chapters = [];
    for (let i = 0; i < result.length; i++) {
      const start = result[i].startLine;
      const end = i + 1 < result.length ? result[i + 1].startLine : lines.length;
      const content = lines.slice(start, end).join('\n').trim();
      if (content.length > 100) {
        chapters.push([result[i].title, content]);
      }
    }

    return chapters.length >= 2 ? chapters : null;
  } catch (e) {
    console.log('[AI Split] Failed:', e.message);
    return null;
  }
}

async function smartSplitChapters(text, bookId) {
  const patternResult = parseChapters(text);

  const llmConfig = getLlmConfig('chat');
  if (!llmConfig || !llmConfig.api_key) {
    return patternResult;
  }

  if (patternResult.length >= 3 && patternResult.every(([, c]) => c.length > 200 && c.length < 15000)) {
    return patternResult;
  }

  if (text.length < 3000) {
    return patternResult;
  }

  console.log(`[SmartSplit] Pattern-based: ${patternResult.length} chapters, trying AI split...`);
  if (bookId) pushProgress(bookId, makeLog('info', `基础分章得到 ${patternResult.length} 章，AI 语义分析优化中...`));

  const aiResult = await aiSplitChapters(text, llmConfig);
  if (aiResult && aiResult.length >= 2) {
    console.log(`[AI Split] Success: ${aiResult.length} chapters`);
    if (bookId) pushProgress(bookId, makeLog('success', `AI 优化分章完成: ${aiResult.length} 章`));
    return aiResult;
  }

  console.log(`[AI Split] Failed or insufficient, using pattern result`);
  return patternResult;
}

function parseChaptersWithVolumes(text) {
  const lines = text.split('\n');
  const volumes = [];
  let currentVolume = null;
  let currentChapters = [];
  let chapterIdx = 0;

  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (!t) continue;

    const isVolume = /^(第[一二三四五六七八九十百千\d]+[卷篇部]|(卷|篇|部|Part|Volume)\s*\d+)/i.test(t) && t.length < 60;
    const isChapter = /^(第[一二三四五六七八九十百千\d]+[章节]|Chapter\s+\d+|CHAPTER\s+\d+)/i.test(t) && t.length < 60;

    if (isVolume) {
      if (currentVolume && currentChapters.length > 0) {
        volumes.push({ volume: currentVolume, chapters: currentChapters });
      }
      currentVolume = t;
      currentChapters = [];
    } else if (isChapter || (currentVolume && /^(\d+[\.\、])\s*[^\d]/.test(t) && t.length < 80)) {
      if (currentChapters.length > 0) {
        currentChapters[currentChapters.length - 1].endLine = i;
      }
      currentChapters.push({ title: t, startLine: i, endLine: lines.length });
    }
  }

  if (currentVolume && currentChapters.length > 0) {
    volumes.push({ volume: currentVolume, chapters: currentChapters });
  }

  if (volumes.length === 0) {
    const chapters = parseChapters(text);
    return { hasVolumes: false, volumes: null, chapters: chapters.map(([title, content], idx) => ({ idx, title, content, volume: null })) };
  }

  const result = [];
  for (let vi = 0; vi < volumes.length; vi++) {
    const vol = volumes[vi];
    for (let ci = 0; ci < vol.chapters.length; ci++) {
      const ch = vol.chapters[ci];
      const start = ch.startLine;
      const end = ci + 1 < vol.chapters.length ? vol.chapters[ci + 1].startLine : (vi + 1 < volumes.length ? volumes[vi + 1].chapters[0].startLine : lines.length);
      const content = lines.slice(start, end).join('\n').trim();
      if (content) {
        result.push({ idx: chapterIdx++, title: ch.title, content, volume: vol.volume });
      }
    }
  }

  return { hasVolumes: true, volumes: volumes.map(v => v.volume), chapters: result };
}

function stripHtml(html) {
  return html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<[^>]+>/g, '\n').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
}

const API = '/api/v1';
const SETTINGS_PATH = path.join(__dirname, 'settings.json');
const distillProgress = new Map();

function readSettings() {
  try {
    if (fs.existsSync(SETTINGS_PATH)) {
      return JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf-8'));
    }
  } catch {}
  return {
    providers: {
      deepseek: { name: 'DeepSeek', base_url: 'https://api.deepseek.com', api_key: process.env.DEEPSEEK_API_KEY || '', model: 'deepseek-chat', temperature: 0.7, max_tokens: 4096 },
      openai: { name: 'OpenAI', base_url: 'https://api.openai.com/v1', api_key: '', model: 'gpt-4o', temperature: 0.7, max_tokens: 4096 },
    },
    default_provider: 'deepseek',
    agents: { distill: 'deepseek', chat: 'deepseek', rag: 'deepseek', generate: 'deepseek' },
  };
}

function getLlmConfig(agentName) {
  const settings = readSettings();
  const providerKey = settings.agents?.[agentName] || settings.default_provider || 'deepseek';
  const provider = settings.providers?.[providerKey];
  if (!provider) {
    return {
      api_key: process.env.DEEPSEEK_API_KEY,
      base_url: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
      model: process.env.DEFAULT_MODEL || 'deepseek-chat',
      temperature: 0.7,
      max_tokens: 4096,
    };
  }
  return {
    api_key: provider.api_key || process.env.DEEPSEEK_API_KEY,
    base_url: provider.base_url || 'https://api.deepseek.com',
    model: provider.model || 'deepseek-chat',
    temperature: provider.temperature ?? 0.7,
    max_tokens: provider.max_tokens ?? 4096,
  };
}

function extractToc(content) {
  const toc = [];
  const lines = content.split('\n');
  let inToc = false;
  let tocStartLine = -1;
  let tocEndLine = -1;

  const tocHeaderPatterns = [
    /^\s*目\s*录\s*$/,
    /^\s*CONTENTS?\s*$/i,
    /^\s*Table\s+of\s+Contents?\s*$/i,
    /^\s*目\s*次\s*$/,
  ];

  const tocEntryPatterns = [
    /^(第[一二三四五六七八九十百千\d]+[章节篇部]\s*.+?)[\s.·…]+(\d+)$/,
    /^(Chapter\s+\d+[\s:：].+?)[\s.·…]+(\d+)$/i,
    /^(\d+[\.\s]+.+?)$/m,
    /^(第[一二三四五六七八九十百千\d]+[章节篇部].+?)$/,
    /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+(?:Chapter|Section)\s+\d+)/i,
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!inToc) {
      if (tocHeaderPatterns.some(p => p.test(line))) {
        inToc = true;
        tocStartLine = i;
        continue;
      }
    } else {
      if (line === '' && toc.length > 0 && i - tocStartLine > 5) {
        tocEndLine = i;
        break;
      }
      if (tocEndLine < 0 && i - tocStartLine > 100) {
        tocEndLine = i;
        break;
      }
      for (const pat of tocEntryPatterns) {
        const m = line.match(pat);
        if (m) {
          toc.push({ title: (m[1] || line).trim(), line: i });
          break;
        }
      }
    }
  }

  if (tocEndLine < 0) tocEndLine = tocStartLine + toc.length + 5;
  return { toc, startLine: tocStartLine, endLine: tocEndLine };
}

function extractCoverMetadata(content) {
  const metadata = {};
  const lines = content.split('\n').slice(0, 30).join('\n');

  const authorPatterns = [
    /作者[：:]\s*(.+)/,
    /Author[：:]\s*(.+)/i,
    /By\s+(.+)/i,
    /著[者者]?\s*(.+)/,
    /编著[：:]\s*(.+)/,
  ];
  for (const p of authorPatterns) {
    const m = lines.match(p);
    if (m) { metadata.author = m[1].trim(); break; }
  }

  const publisherPatterns = [
    /出版社[：:]\s*(.+)/,
    /Publisher[：:]\s*(.+)/i,
    /出版[社公司]+/,
  ];
  for (const p of publisherPatterns) {
    const m = lines.match(p);
    if (m) { metadata.publisher = (m[1] || m[0]).trim(); break; }
  }

  const isbnPattern = /ISBN[-:\s]*([\d\-]+)/i;
  const isbnMatch = lines.match(isbnPattern);
  if (isbnMatch) metadata.isbn = isbnMatch[1];

  const yearPattern = /(\d{4})\s*年?\s*(?:第\s*\d+\s*版|出版|出版发行)/;
  const yearMatch = lines.match(yearPattern);
  if (yearMatch) metadata.year = yearMatch[1];

  return metadata;
}

function detectSpecialSections(content, chapterIdx) {
  const sections = { cover: false, copyright: false, tocPage: false, preface: false, appendix: false, bibliography: false };

  const lines = content.split('\n').slice(0, 50).join('\n');
  const fullContent = content;

  const isCopyright = /ISBN|版权所有|All\s+Rights?\s+Reserved|Copyright\s*©|图书在版编目|CIP|未经许可.*转载/.test(lines);
  sections.copyright = isCopyright;

  const hasCoverSignals = /^[\s\S]{0,300}?(封面|书衣|扉页)/.test(lines)
    || (/^[\s\S]{0,200}?(书名|作者|版次|出版社)/.test(lines) && !/第[一二三四五六七八九十\d]+章/.test(lines));
  sections.cover = hasCoverSignals && (chapterIdx === 0 || chapterIdx === 1);

  const tocHeader = /(?:目\s*录|CONTENTS?|Table\s+of\s+Contents?|目\s*次)/i.test(lines);
  sections.tocPage = tocHeader;

  const prefacePatterns = /^(?:前言|序|序言|导言|引言|Preface|Foreword|Introduction|致谢|序一|序二|推荐序|自序)/m;
  sections.preface = prefacePatterns.test(fullContent.substring(0, 2000));

  const appendixPatterns = /(?:附录|Appendix|附录[A-Z])/i;
  sections.appendix = appendixPatterns.test(fullContent.substring(fullContent.length - 3000));

  const bibPatterns = /(?:参考文献|References?|Bibliography|注释|Further\s+Reading)/i;
  sections.bibliography = bibPatterns.test(fullContent.substring(fullContent.length - 5000));

  return sections;
}

function splitContentByToc(content, tocEntries) {
  if (!tocEntries || tocEntries.length < 2) return null;

  const lines = content.split('\n');
  const boundaries = [];

  for (const entry of tocEntries) {
    const titleLower = entry.title.toLowerCase().replace(/\s+/g, '');
    let bestMatch = -1;
    let bestScore = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim().toLowerCase().replace(/\s+/g, '');
      if (!line) continue;

      let score = 0;
      if (line.includes(titleLower) || titleLower.includes(line)) {
        score = 100;
      } else {
        const titleWords = entry.title.split(/[\s,，、]+/).filter(w => w.length > 1);
        const matchedWords = titleWords.filter(w => line.includes(w));
        score = (matchedWords.length / titleWords.length) * 80;
      }

      if (i > 0 && lines[i - 1].trim() === '') score += 5;

      if (score > bestScore) {
        bestScore = score;
        bestMatch = i;
      }
    }

    if (bestMatch >= 0 && bestScore > 30) {
      boundaries.push({ title: entry.title, lineIdx: bestMatch, score: bestScore });
    }
  }

  boundaries.sort((a, b) => a.lineIdx - b.lineIdx);

  const merged = [];
  for (const b of boundaries) {
    if (merged.length === 0 || b.lineIdx - merged[merged.length - 1].lineIdx > 5) {
      merged.push(b);
    }
  }

  if (merged.length < 2) return null;

  return merged.map((b, i) => {
    const start = b.lineIdx;
    const end = i < merged.length - 1 ? merged[i + 1].lineIdx : lines.length;
    return {
      title: b.title,
      startLine: start,
      endLine: end,
      content: lines.slice(start, end).join('\n').trim(),
    };
  });
}

function splitByHeadingPatterns(content) {
  const lines = content.split('\n');
  const chapterPattern = /^(#{1,3})\s+(.+)/;
  const numberedPattern = /^(第[一二三四五六七八九十百千\d]+[章节篇部])\s*(.+)/;
  const numericPattern = /^(\d+(?:\.\d+)*)[\s.、：:]+(.+)/;
  const romanPattern = /^([IVXLC]+\.?\s+.+)/;
  const englishChapterPattern = /^(Chapter\s+\d+[\s:：].+)/i;

  const splits = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    let match = null;
    let title = '';

    if ((match = line.match(chapterPattern))) {
      if (match[1].length <= 2) { title = match[2]; }
    } else if ((match = line.match(numberedPattern))) {
      title = match[0];
    } else if ((match = line.match(numericPattern))) {
      title = match[2];
    } else if ((match = line.match(romanPattern))) {
      title = match[1];
    } else if ((match = line.match(englishChapterPattern))) {
      title = match[1];
    }

    if (title && title.length > 1 && title.length < 100) {
      splits.push({ title, lineIdx: i });
    }
  }

  if (splits.length < 2) return null;

  return splits.map((s, i) => {
    const start = s.lineIdx;
    const end = i < splits.length - 1 ? splits[i + 1].lineIdx : lines.length;
    return {
      title: s.title,
      startLine: start,
      endLine: end,
      content: lines.slice(start, end).join('\n').trim(),
    };
  });
}

async function aiDetectChapterPattern(content, bookTitle) {
  const llmConfig = getLlmConfig('chat');
  if (!llmConfig.api_key) return null;

  const lines = content.split('\n').filter(l => l.trim());
  if (lines.length < 20) return null;

  const sampleCount = Math.min(5, Math.max(3, Math.floor(lines.length / 200)));
  const samples = [];
  for (let i = 0; i < sampleCount; i++) {
    const idx = Math.floor(Math.random() * (lines.length - 20)) + 10;
    const start = Math.max(0, idx - 3);
    const end = Math.min(lines.length, idx + 7);
    samples.push({ position: idx, lines: lines.slice(start, end).join('\n') });
  }
  samples.sort((a, b) => a.position - b.position);

  const systemPrompt = `你是一个专业的书籍结构分析师。分析以下书籍的抽样片段，识别章节标题的格式规律。

要求：
1. 观察每个片段中的标题行（章节、小节、子标题等）
2. 归纳出标题的格式规律（如"第X章"、"## "、"一、"、"1."等）
3. 返回JSON格式，包含 patterns（规律数组，每个元素是正则表达式字符串）和 confidence（置信度0-100）
4. 仅返回JSON，不要其他文字

示例输出：
{"patterns":["^第[一二三四五六七八九十百千\\d]+[章篇部]"],"confidence":95}`;

  try {
    const resp = await fetch(`${llmConfig.base_url.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${llmConfig.api_key}` },
      body: JSON.stringify({
        model: llmConfig.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `书籍: ${bookTitle}\n\n抽样片段:\n${samples.map((s, i) => `[片段${i + 1} 位置:${s.position}]\n${s.lines}`).join('\n\n')}` }
        ],
        temperature: 0.1,
        max_tokens: 1024
      }),
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    const answer = data.choices?.[0]?.message?.content || '';
    const jsonMatch = answer.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      if (result.patterns && result.patterns.length > 0) {
        return { patterns: result.patterns, confidence: result.confidence || 50 };
      }
    }
  } catch (e) {
    console.error('[AI Pattern Detection Error]', e.message);
  }
  return null;
}

function aiFallbackRuleEngine(content) {
  const lines = content.split('\n');
  const patterns = [
    { regex: /^(#{1,3})\s+(.+)/, type: 'markdown' },
    { regex: /^(第[一二三四五六七八九十百千\d]+[章节篇部])\s*(.*)/, type: 'chinese_numbered' },
    { regex: /^(\d+(?:\.\d+)*)\s*[、.：:]\s*(.+)/, type: 'numeric' },
    { regex: /^([IVXLC]+\.?\s+.+)/, type: 'roman' },
    { regex: /^(Chapter\s+\d+[\s:：].*)/i, type: 'english' },
    { regex: /^([一二三四五六七八九十]+)[、.]\s*(.+)/, type: 'chinese_simple' },
  ];

  const splits = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.length > 100) continue;

    for (const { regex, type } of patterns) {
      const match = line.match(regex);
      if (match) {
        let title = match[0];
        if (type === 'markdown' && match[1].length > 2) continue;
        if (title.length > 2) {
          splits.push({ title, lineIdx: i, type });
          break;
        }
      }
    }
  }

  if (splits.length < 2) return null;

  return splits.map((s, i) => {
    const start = s.lineIdx;
    const end = i < splits.length - 1 ? splits[i + 1].lineIdx : lines.length;
    return {
      title: s.title,
      startLine: start,
      endLine: end,
      content: lines.slice(start, end).join('\n').trim(),
    };
  });
}

function applyDetectedPatterns(content, patterns) {
  const lines = content.split('\n');
  const compiledPatterns = patterns.map(p => {
    try { return new RegExp(p); } catch { return null; }
  }).filter(Boolean);

  if (compiledPatterns.length === 0) return null;

  const splits = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.length > 100) continue;

    for (const pat of compiledPatterns) {
      const match = line.match(pat);
      if (match) {
        const title = match[0].trim();
        if (title.length >= 2) {
          splits.push({ title, lineIdx: i });
          break;
        }
      }
    }
  }

  if (splits.length < 2) return null;

  return splits.map((s, i) => {
    const start = s.lineIdx;
    const end = i < splits.length - 1 ? splits[i + 1].lineIdx : lines.length;
    return {
      title: s.title,
      startLine: start,
      endLine: end,
      content: lines.slice(start, end).join('\n').trim(),
    };
  });
}

async function smartSplitChapters(content, bookTitle) {
  const aiPattern = await aiDetectChapterPattern(content, bookTitle);

  if (aiPattern && aiPattern.confidence >= 60) {
    const aiSplit = applyDetectedPatterns(content, aiPattern.patterns);
    if (aiSplit && aiSplit.length >= 2) {
      console.log(`[Smart Split] AI模式识别成功，置信度${aiPattern.confidence}，分${aiSplit.length}章`);
      return { chapters: aiSplit, source: 'ai_pattern', confidence: aiPattern.confidence };
    }
  }

  console.log('[Smart Split] AI识别失败或置信度低，回退到规则引擎');
  const ruleSplit = aiFallbackRuleEngine(content);
  if (ruleSplit && ruleSplit.length >= 2) {
    return { chapters: ruleSplit, source: 'rule_engine', confidence: 0 };
  }

  return { chapters: [{ title: bookTitle || '全书', startLine: 0, endLine: content.split('\n').length, content }], source: 'fallback', confidence: 0 };
}

function sanitizeJsonString(str) {
  let result = str;
  result = result.replace(/\n/g, '\\n');
  result = result.replace(/\r/g, '\\r');
  result = result.replace(/\t/g, '\\t');
  result = result.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
  result = result.replace(/\\[^"\\\/bfnrtu]/g, '');
  return result;
}

function safeJsonParse(str) {
  try { return JSON.parse(str); } catch {}
  try {
    const sanitized = sanitizeJsonString(str);
    return JSON.parse(sanitized);
  } catch {}
  try {
    const fixed = str.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');
    return JSON.parse(fixed);
  } catch {}
  return null;
}

async function distillChapterWithRetry(llmConfig, ch, depth, book_id, index, totalChapters, batchPct, MAX_RETRIES = 3) {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      pushProgress(book_id, { type: 'chapter_progress', chapter_index: index, progress: Math.round((attempt / (MAX_RETRIES + 1)) * 50), message: attempt > 1 ? `重试 ${attempt}/${MAX_RETRIES}...` : 'LLM 分析中...' });

      let bookType = 'general';
      try {
        const bookDesc = db.prepare('SELECT description FROM books WHERE id = ?').get(book_id);
        if (bookDesc?.description) {
          const desc = JSON.parse(bookDesc.description);
          if (desc.book_type) bookType = desc.book_type;
        }
      } catch {}
      const prompt = buildChapterDistillPrompt(ch.title, ch.content, depth, bookType);
      const { content: raw } = await callLLM(llmConfig, [{ role: 'user', content: prompt }], undefined, 'distill');

      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        if (attempt < MAX_RETRIES) {
          pushProgress(book_id, makeLog('warn', `[${index + 1}/${totalChapters}] 第${attempt}次尝试解析失败，重试中...`));
          await new Promise(r => setTimeout(r, 1000 * attempt));
          continue;
        }
        throw new Error('LLM 未返回有效 JSON');
      }

      const parsed = safeJsonParse(jsonMatch[0]);
      if (!parsed) {
        if (attempt < MAX_RETRIES) {
          pushProgress(book_id, makeLog('warn', `[${index + 1}/${totalChapters}] 第${attempt}次JSON解析失败，重试中...`));
          await new Promise(r => setTimeout(r, 1000 * attempt));
          continue;
        }
        throw new Error('JSON 解析失败');
      }

      const filtered = {};
      if (depth === 'shallow') {
        filtered.shallow = parsed.shallow || [];
      } else if (depth === 'medium') {
        filtered.shallow = parsed.shallow || [];
        filtered.medium = parsed.medium || [];
      } else {
        filtered.shallow = parsed.shallow || [];
        filtered.medium = parsed.medium || [];
        filtered.deep = parsed.deep || [];
      }
      db.prepare('UPDATE chapters SET distilled_content = ? WHERE book_id = ? AND idx = ?')
        .run(JSON.stringify(filtered), book_id, ch.idx);
      const pointsFound = (filtered.shallow?.length || 0) + (filtered.medium?.length || 0) + (filtered.deep?.length || 0);

      pushProgress(book_id, { type: 'chapter_done', chapter_index: index, points_found: pointsFound, overall_progress: parseFloat(batchPct) });
      pushProgress(book_id, makeLog('success', `[${index + 1}/${totalChapters}] 蒸馏完成: ${ch.title}，提取 ${pointsFound} 个知识点${attempt > 1 ? ` (第${attempt}次成功)` : ''}`));
      return { success: true, index };
    } catch (e) {
      if (attempt < MAX_RETRIES) {
        pushProgress(book_id, makeLog('warn', `[${index + 1}/${totalChapters}] 第${attempt}次失败: ${e.message}，${MAX_RETRIES - attempt}次重试剩余`));
        await new Promise(r => setTimeout(r, 1000 * attempt));
        continue;
      }
      console.error(`Distill chapter ${index} failed after ${MAX_RETRIES} retries:`, e.message);
      db.prepare('UPDATE chapters SET distilled_content = ? WHERE book_id = ? AND idx = ?')
        .run(JSON.stringify({ shallow: [], medium: [], deep: [], error: e.message }), book_id, ch.idx);
      pushProgress(book_id, { type: 'chapter_progress', chapter_index: index, progress: 100, message: `失败(${MAX_RETRIES}次重试): ${e.message}` });
      pushProgress(book_id, makeLog('error', `[${index + 1}/${totalChapters}] 蒸馏失败(已重试${MAX_RETRIES}次): ${ch.title} - ${e.message}`));
      return { success: false, index, error: e.message };
    }
  }
}

async function aiEnhanceChapterTitles(chapters, bookTitle) {
  const llmConfig = getLlmConfig('chat');
  if (!llmConfig.api_key || chapters.length < 2) return chapters;

  const needsEnhancement = chapters.filter(ch => {
    const title = (ch.title || '').trim();
    if (title.length < 5) return true;
    if (/^第[一二三四五六七八九十百千\d]+[章节篇部]$/.test(title)) return true;
    if (/^Chapter\s+\d+$/i.test(title)) return true;
    if (title.length < 10 && !title.includes(' ')) return true;
    return false;
  });

  if (needsEnhancement.length === 0) return chapters;
  if (needsEnhancement.length > 15) return chapters;

  const previews = needsEnhancement.map(ch => {
    const content = (ch.content || '').substring(0, 300);
    return `当前标题: "${ch.title}"\n内容预览: ${content.replace(/\n/g, ' ').substring(0, 200)}`;
  });

  const systemPrompt = `你是一位专业的书籍编辑。请为以下章节生成更准确、更具描述性的标题。

要求：
1. 标题应概括章节核心内容
2. 保持简洁，不超过20字
3. 保留原有的章节编号格式（如"第X章"）
4. 返回JSON数组，每个元素格式: {"index": 原始索引, "new_title": "新标题"}
5. 只返回JSON数组，不要其他文字`;

  try {
    const { content } = await callLLM(llmConfig, [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `书籍: ${bookTitle}\n\n章节列表:\n${previews.join('\n\n')}` },
    ], 1024, 'preprocess');

    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return chapters;

    const enhancements = JSON.parse(jsonMatch[0]);
    for (const enh of enhancements) {
      if (enh.index != null && enh.new_title) {
        const ch = needsEnhancement.find(c => c.idx === enh.index);
        if (ch) {
          console.log(`[AI Title] "${ch.title}" -> "${enh.new_title}"`);
          ch.title = enh.new_title;
        }
      }
    }
  } catch (e) {
    console.error('[AI Title Enhancement Error]', e.message);
  }

  return chapters;
}

function detectBookType(title, content) {
  const text = (title + ' ' + (content || '').substring(0, 3000)).toLowerCase();
  const patterns = {
    tool: [/手册|指南|教程|入门|实战|编程|开发|技术|算法|数据结构|数据库|网络|linux|python|java|javascript|react|vue|api|sdk|框架|配置|部署/],
    literature: [/小说|故事|散文|诗|文学|长篇|短篇|中篇|纪实|传记|自传|回忆录|日记|书信/],
    academic: [/论文|研究|学报|期刊|学术|实验|理论|假设|方法论|数据分析|文献综述|参考文献|摘要|关键词/],
    textbook: [/教材|教科书|课程|大学|学院|学期|考试|习题|练习|答案|解析|第[一二三四]版/],
    popular: [/畅销|自我提升|心理学|思维|习惯|效率|沟通|领导力|创业|管理|投资|理财|健康|养生/],
  };
  let bestType = 'general';
  let bestScore = 0;
  for (const [type, regs] of Object.entries(patterns)) {
    let score = 0;
    for (const reg of regs) {
      const matches = text.match(new RegExp(reg.source, 'gi'));
      if (matches) score += matches.length;
    }
    if (score > bestScore) { bestScore = score; bestType = type; }
  }
  return bestType;
}

const BOOK_TYPE_PROMPTS = {
  tool: '本书是工具书/技术书。蒸馏时重点关注：核心概念定义、操作步骤、代码示例、配置方法、最佳实践、常见问题。提取可操作的知识点。',
  literature: '本书是文学作品。蒸馏时重点关注：人物关系、情节发展、主题思想、写作风格、经典段落、文学手法。保留叙事结构。',
  academic: '本书是学术论文/研究报告。蒸馏时重点关注：研究问题、方法论、核心论点、数据支撑、结论、创新点、局限性。保留引用关系。',
  textbook: '本书是教材/教科书。蒸馏时重点关注：知识体系结构、核心概念、公式定理、例题解析、章节练习、知识关联。构建知识框架。',
  popular: '本书是畅销书/通俗读物。蒸馏时重点关注：核心观点、论证逻辑、实用建议、案例故事、行动指南。提炼可执行的方法。',
  general: '全面蒸馏本书内容，提取核心观点、关键论据和实用知识。',
};

async function preprocessBook(bookId) {
  const book = db.prepare('SELECT * FROM books WHERE id = ?').get(bookId);
  if (!book) return;

  const chapters = db.prepare('SELECT id, idx, title, content FROM chapters WHERE book_id = ? ORDER BY idx').all(bookId);
  const metadata = { title: book.title, author: book.author || '' };
  const footnotes = [];
  const references = [];
  let copyrightRemoved = 0;
  let footnotesExtracted = 0;
  let referencesExtracted = 0;
  let tocDetected = 0;
  let tocAnchors = [];

  const copyrightPatterns = [
    /ISBN[-:\s]*[\d\-]+/gi,
    /版权所有[^\n]*/gi,
    /All\s+Rights?\s+Reserved/gi,
    /Copyright\s*©[^\n]*/gi,
    /本书由[^。]*授权/gi,
    /未经许可[^。]*转载/gi,
    /图书在版编目[^。]*/gi,
    /CIP\s+数据[^。]*/gi,
  ];

  const footnotePatterns = [
    /^\[(\d+)\]\s*.+$/gm,
    /^【注\d+】.+$/gm,
    /^\d+\.\s+.+\(\d{4}\)/gm,
  ];

  const referenceSectionPatterns = [
    /^参考文献\s*$/gm,
    /^References?\s*$/gm,
    /^Bibliography\s*$/gm,
    /^Further\s+Reading/gm,
    /^扩展阅读/gm,
  ];

  let fullBookContent = '';
  const chapterContents = [];

  const tocTitlePatterns = /^(?:目\s*录|CONTENTS?|Table\s+of\s+Contents?|目\s*次|CATALOG)/i;

  for (const ch of chapters) {
    let content = ch.content || '';
    let title = ch.title || '';
    const sections = detectSpecialSections(content, ch.idx);

    const coverMeta = extractCoverMetadata(content);
    if (coverMeta.author && !metadata.author) metadata.author = coverMeta.author;
    if (coverMeta.publisher) metadata.publisher = coverMeta.publisher;
    if (coverMeta.isbn) metadata.isbn = coverMeta.isbn;
    if (coverMeta.year) metadata.year = coverMeta.year;

    for (const pat of copyrightPatterns) {
      const matches = content.match(pat);
      if (matches) {
        copyrightRemoved += matches.length;
        content = content.replace(pat, '');
      }
    }

    if (sections.tocPage || tocTitlePatterns.test(title)) {
      tocDetected++;
      const tocResult = extractToc(content);
      if (tocResult.toc.length > 0) {
        tocAnchors.push(...tocResult.toc);
      }
      console.log(`[PreprocessBook] 跳过目录章节: ${title}`);
      continue;
    }

    if (ch.idx <= 1 && (sections.cover || sections.copyright)) {
      console.log(`[PreprocessBook] 跳过封面/版权页: ${title}`);
      continue;
    }

    const trimmedContent = content.replace(/[\s\u3000]+/g, '');
    if (trimmedContent.length < 20) {
      console.log(`[PreprocessBook] 跳过空白章节: ${title} (内容长度: ${trimmedContent.length})`);
      continue;
    }

    for (const pat of referenceSectionPatterns) {
      const refIdx = content.search(pat);
      if (refIdx > 0) {
        const refSection = content.substring(refIdx);
        const refLines = refSection.split('\n').filter(l => l.trim() && !pat.test(l));
        for (const line of refLines) {
          if (line.trim().length > 5) {
            references.push({ id: 'ref_' + references.length, content: line.trim(), chapter: title || ch.title });
            referencesExtracted++;
          }
        }
        content = content.substring(0, refIdx);
      }
    }

    const extractedFootnotes = [];
    for (const pat of footnotePatterns) {
      const fnMatches = content.matchAll(pat);
      for (const m of fnMatches) {
        extractedFootnotes.push(m[0]);
        footnotes.push({ id: 'fn_' + footnotes.length, content: m[0], chapter: title || ch.title });
        footnotesExtracted++;
        content = content.replace(m[0], '');
      }
    }

    const chapterRefs = references.filter(r => r.chapter === (title || ch.title));
    if (extractedFootnotes.length > 0 || chapterRefs.length > 0) {
      let refSection = '\n\n---\n## 参考\n\n';
      if (extractedFootnotes.length > 0) {
        refSection += '### 脚注/尾注\n\n';
        extractedFootnotes.forEach((fn, i) => {
          refSection += `${i + 1}. ${fn.replace(/^\[\d+\]\s*/, '')}\n`;
        });
        refSection += '\n';
      }
      if (chapterRefs.length > 0) {
        refSection += '### 参考文献\n\n';
        chapterRefs.forEach((ref, i) => {
          refSection += `${i + 1}. ${ref.content}\n`;
        });
      }
      content = content.trim() + refSection;
    }

    const tocResult = extractToc(content);
    if (tocResult.toc.length > 2) {
      tocDetected++;
      tocAnchors.push(...tocResult.toc);
      if (tocResult.startLine >= 0 && tocResult.endLine > tocResult.startLine) {
        const lines = content.split('\n');
        lines.splice(tocResult.startLine, tocResult.endLine - tocResult.startLine);
        content = lines.join('\n');
      }
    }

    content = content.replace(/\n{3,}/g, '\n\n').trim();

    if (content.length > 50) {
      chapterContents.push({ id: ch.id, idx: ch.idx, title, content });
      fullBookContent += `\n\n=== 章节 ${ch.idx}: ${title} ===\n\n${content}`;
    }
  }

  if (chapterContents.length === 0) {
    for (const ch of chapters) {
      if (ch.content && ch.content.length > 50) {
        chapterContents.push({ id: ch.id, idx: ch.idx, title: ch.title || '', content: ch.content });
      }
    }
  }

  let smartChapters = chapterContents;
  let splitSource = 'original';

  if (fullBookContent.length > 500) {
    const splitResult = await smartSplitChapters(fullBookContent, book.title);
    if (splitResult.chapters.length >= 2) {
      const seenTitles = new Set();
      smartChapters = splitResult.chapters
        .filter(sec => {
          const content = sec.content || '';
          const trimmed = content.replace(/[\s\u3000]+/g, '');
          if (trimmed.length < 30) {
            console.log(`[PreprocessBook] 分章后跳过空白章节: ${sec.title}`);
            return false;
          }
          if (tocTitlePatterns.test(sec.title)) {
            console.log(`[PreprocessBook] 分章后跳过目录章节: ${sec.title}`);
            return false;
          }
          const title = (sec.title || '').trim();
          if (title.startsWith('##') || title.startsWith('###')) {
            console.log(`[PreprocessBook] 分章后跳过标记章节: ${sec.title}`);
            return false;
          }
          if (/^\d+\.\s*(Mr\.|Ms\.|Dr\.|译者注)/.test(title) || title.length < 3) {
            console.log(`[PreprocessBook] 分章后跳过无效标题: ${sec.title}`);
            return false;
          }
          const normalizedTitle = title.replace(/[\s\u3000]+/g, '');
          if (seenTitles.has(normalizedTitle)) {
            console.log(`[PreprocessBook] 分章后跳过重复章节: ${sec.title}`);
            return false;
          }
          seenTitles.add(normalizedTitle);
          return true;
        })
        .map((sec, i) => ({
          id: uuidv4(),
          idx: i,
          title: sec.title,
          content: sec.content,
        }));
      splitSource = splitResult.source;
      console.log(`[PreprocessBook] 分章完成: 来源=${splitResult.source}, 置信度=${splitResult.confidence}, 章节数=${smartChapters.length}`);
    }
  }

  if (smartChapters.length >= 2) {
    smartChapters = await aiEnhanceChapterTitles(smartChapters, book.title);
  }

  for (const ch of smartChapters) {
    if (ch.content && ch.content.length > 10) {
      const existing = db.prepare('SELECT id FROM chapters WHERE book_id = ? AND idx = ?').get(bookId, ch.idx);
      if (existing) {
        db.prepare('UPDATE chapters SET content = ?, title = ? WHERE book_id = ? AND idx = ?')
          .run(ch.content, ch.title, bookId, ch.idx);
      } else {
        db.prepare('INSERT INTO chapters (id, book_id, idx, title, content) VALUES (?, ?, ?, ?, ?)')
          .run(ch.id, bookId, ch.idx, ch.title, ch.content);
      }
    }
  }

  const background = { footnotes, references, tocAnchors };

  const sampleContent = smartChapters.slice(0, 3).map(c => c.content || '').join('\n').substring(0, 3000);
  const bookType = detectBookType(book.title, sampleContent);
  console.log(`[PreprocessBook] 书籍类型识别: ${bookType}`);

  db.prepare('UPDATE books SET description = ? WHERE id = ?').run(JSON.stringify({ book_type: bookType }), bookId);

  db.prepare('INSERT OR REPLACE INTO book_preprocessing (id, book_id, original_chapters, cleaned_chapters, footnotes_extracted, references_extracted, copyright_removed, toc_detected, background_json, metadata_json) VALUES (?,?,?,?,?,?,?,?,?,?)')
    .run(uuidv4(), bookId, chapters.length, smartChapters.length, footnotesExtracted, referencesExtracted, copyrightRemoved, tocDetected, JSON.stringify(background), JSON.stringify(metadata));

  if (tocAnchors.length > 0) {
    const tocData = {
      book_id: bookId,
      book_title: book.title,
      extracted_at: new Date().toISOString(),
      entries: tocAnchors.map((toc, i) => ({
        id: i + 1,
        title: toc.title,
        page: toc.page || null,
        level: toc.level || 1,
      })),
    };
    db.prepare('INSERT OR REPLACE INTO knowledge_base (id, book_id, type, title, content, metadata) VALUES (?,?,?,?,?,?)')
      .run(uuidv4(), bookId, 'toc', `${book.title} - 目录`, JSON.stringify(tocData, null, 2), JSON.stringify({ source: 'preprocessing', entries_count: tocAnchors.length }));
    console.log(`[PreprocessBook] 目录已保存到知识库: ${tocAnchors.length} 个条目`);
  }

  return {
    originalChapters: chapters.length,
    cleanedChapters: smartChapters.length,
    copyrightRemoved,
    footnotesExtracted,
    referencesExtracted,
    tocDetected,
    tocAnchorsCount: tocAnchors.length,
    splitSource,
    metadata,
    chapterTitles: smartChapters.map(c => c.title),
  };
}

async function callLLM(llmConfig, messages, maxTokens, source = 'chat') {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120000);
  const startTime = Date.now();
  try {
    const resp = await fetch(`${llmConfig.base_url.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${llmConfig.api_key}` },
      body: JSON.stringify({
        model: llmConfig.model,
        messages,
        temperature: llmConfig.temperature,
        max_tokens: maxTokens || llmConfig.max_tokens,
      }),
      signal: controller.signal,
    });
    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`LLM API error: ${resp.status} ${errText}`);
    }
    const data = await resp.json();
    const msg = data.choices?.[0]?.message;
    const durationMs = Date.now() - startTime;
    
    const usage = data.usage || {};
    const promptTokens = usage.prompt_tokens || 0;
    const completionTokens = usage.completion_tokens || 0;
    const totalTokens = usage.total_tokens || 0;
    const cacheHit = usage.prompt_tokens_details?.cached_tokens > 0 ? 1 : 0;
    
    try {
      db.prepare('INSERT INTO token_usage (id, user_id, model, source, cache_hit, prompt_tokens, completion_tokens, total_tokens, cost_points, duration_ms) VALUES (?,?,?,?,?,?,?,?,?,?)')
        .run(uuidv4(), 'default', llmConfig.model || 'unknown', source, cacheHit, promptTokens, completionTokens, totalTokens, 0, durationMs);
    } catch (e) {
      console.error('[Token Usage] Record failed:', e.message);
    }
    
    return {
      content: msg?.content || msg?.reasoning_content || '',
      usage: { promptTokens, completionTokens, totalTokens, cacheHit, durationMs },
    };
  } finally {
    clearTimeout(timeout);
  }
}

function pushProgress(bookId, event) {
  if (!distillProgress.has(bookId)) distillProgress.set(bookId, []);
  distillProgress.get(bookId).push(event);
}

function makeLog(level, message) {
  return { type: 'log', level, message, timestamp: new Date().toISOString() };
}

function buildChapterDistillPrompt(chapterTitle, chapterContent, depth, bookType) {
  const truncated = chapterContent.length > 4000 ? chapterContent.slice(0, 4000) + '...' : chapterContent;
  const depthHint = depth === 'shallow'
    ? '请只提取浅层概要。'
    : depth === 'medium'
    ? '请提取浅层概要和中层详细分析。'
    : '请提取浅层概要、中层详细分析和深层洞察。';
  const typeHint = BOOK_TYPE_PROMPTS[bookType] || BOOK_TYPE_PROMPTS.general;
  return `你是一位知识管理专家。${typeHint}${depthHint}

重要：返回的JSON中，所有字符串值必须是合法的JSON字符串，不要包含未转义的换行符、制表符或其他控制字符。

章节标题: ${chapterTitle}
章节内容:
${truncated}

请以 JSON 格式返回，包含以下层次(不需要的层次留空数组):
{
  "shallow": [{"id": "s1", "summary": "概要总结", "category": "分类", "originalRef": "引用位置"}],
  "medium": [{"id": "m1", "summary": "详细要点", "evidence": "原文依据", "category": "分类", "originalRef": "引用位置"}],
  "deep": [{"id": "d1", "summary": "深度洞察", "evidence": "分析依据", "citation": "引用", "category": "分类", "originalRef": "引用位置"}]
}`;
}

function getDistilledPoints(ch) {
  try {
    const d = JSON.parse(ch.distilled_content || '{}');
    const points = [...(d.shallow || []), ...(d.medium || []), ...(d.deep || [])];
    return points.map(p => p.summary).filter(Boolean).join('；');
  } catch {
    return '';
  }
}

const AGENT_TOOLS = [
  {
    name: 'read_chapter',
    description: '阅读指定章节的原文内容',
    parameters: { book_id: 'string', chapter_idx: 'number' },
  },
  {
    name: 'read_all_chapters',
    description: '阅读当前书籍所有章节标题列表',
    parameters: { book_id: 'string' },
  },
  {
    name: 'get_distilled_content',
    description: '获取指定章节的蒸馏知识点',
    parameters: { book_id: 'string', chapter_idx: 'number' },
  },
  {
    name: 'get_framework',
    description: '获取书籍的知识框架图',
    parameters: { book_id: 'string' },
  },
  {
    name: 'get_graph_data',
    description: '获取书籍的知识图谱数据（节点和边）',
    parameters: { book_id: 'string' },
  },
  {
    name: 'search_book',
    description: '在书籍中搜索关键词',
    parameters: { book_id: 'string', query: 'string' },
  },
  {
    name: 'start_distillation',
    description: '启动书籍蒸馏流程',
    parameters: { book_id: 'string', depth: 'string' },
  },
  {
    name: 'generate_document',
    description: '生成全书综合文档',
    parameters: { book_id: 'string', custom_prompt: 'string' },
  },
  {
    name: 'export_book',
    description: '导出书籍为指定格式（markdown/json/html/pdf）',
    parameters: { book_id: 'string', format: 'string' },
  },
  {
    name: 'get_book_info',
    description: '获取书籍基本信息（标题、作者、状态等）',
    parameters: { book_id: 'string' },
  },
  {
    name: 'list_books',
    description: '列出所有已上传的书籍',
    parameters: {},
  },
  {
    name: 'write_document',
    description: '将内容写入为新文档或更新现有文档',
    parameters: { book_id: 'string', title: 'string', content: 'string' },
  },
  {
    name: 'get_annotations',
    description: '获取指定章节的批注',
    parameters: { book_id: 'string', chapter_idx: 'number' },
  },
  {
    name: 'add_annotation',
    description: '为章节添加批注',
    parameters: { book_id: 'string', chapter_idx: 'number', content: 'string', type: 'string' },
  },
];

function executeTool(toolName, args) {
  try {
    switch (toolName) {
      case 'read_chapter': {
        const ch = db.prepare('SELECT * FROM chapters WHERE book_id = ? AND idx = ?').get(args.book_id, args.chapter_idx);
        if (!ch) return { error: '章节不存在' };
        return { title: ch.title, content: (ch.content || '').substring(0, 3000), idx: ch.idx };
      }
      case 'read_all_chapters': {
        const chapters = db.prepare('SELECT idx, title FROM chapters WHERE book_id = ? ORDER BY idx').all(args.book_id);
        return { chapters: chapters.map(c => ({ idx: c.idx, title: c.title })) };
      }
      case 'get_distilled_content': {
        const ch = db.prepare('SELECT distilled_content FROM chapters WHERE book_id = ? AND idx = ?').get(args.book_id, args.chapter_idx);
        if (!ch) return { error: '章节不存在' };
        try { return JSON.parse(ch.distilled_content || '{}'); } catch { return { error: '蒸馏数据解析失败' }; }
      }
      case 'get_framework': {
        const fw = db.prepare('SELECT * FROM frameworks WHERE book_id = ?').all(args.book_id);
        return { frameworks: fw };
      }
      case 'get_graph_data': {
        const nodes = db.prepare('SELECT * FROM graph_nodes WHERE book_id = ?').all(args.book_id);
        const edges = db.prepare('SELECT * FROM graph_edges WHERE book_id = ?').all(args.book_id);
        return { nodes: nodes.length, edges: edges.length };
      }
      case 'search_book': {
        const results = db.prepare('SELECT idx, title, content FROM chapters WHERE book_id = ? AND (title LIKE ? OR content LIKE ?) LIMIT 5').all(args.book_id, `%${args.query}%`, `%${args.query}%`);
        return { results: results.map(r => ({ idx: r.idx, title: r.title, snippet: (r.content || '').substring(0, 200) })) };
      }
      case 'start_distillation': {
        return { message: '蒸馏任务已启动', book_id: args.book_id, depth: args.depth || 'deep' };
      }
      case 'generate_document': {
        return { message: '文档生成已启动', book_id: args.book_id };
      }
      case 'export_book': {
        return { message: '导出已准备', format: args.format || 'markdown' };
      }
      case 'get_book_info': {
        const book = db.prepare('SELECT * FROM books WHERE id = ?').get(args.book_id);
        if (!book) return { error: '书籍不存在' };
        const chCount = db.prepare('SELECT count(*) as c FROM chapters WHERE book_id = ?').get(args.book_id).c;
        const docCount = db.prepare('SELECT count(*) as c FROM documents WHERE book_id = ?').get(args.book_id).c;
        return { id: book.id, title: book.title, author: book.author, status: book.status, chapters: chCount, documents: docCount };
      }
      case 'list_books': {
        const books = db.prepare('SELECT id, title, author, status FROM books ORDER BY created_at DESC').all();
        return { books };
      }
      case 'write_document': {
        const docId = uuidv4();
        db.prepare('INSERT INTO documents (id, book_id, title, content, type) VALUES (?,?,?,?,?)').run(docId, args.book_id, args.title, args.content, 'agent');
        return { success: true, document_id: docId, title: args.title };
      }
      case 'get_annotations': {
        const anns = db.prepare('SELECT * FROM annotations WHERE book_id = ? AND chapter_idx = ?').all(args.book_id, args.chapter_idx);
        return { annotations: anns };
      }
      case 'add_annotation': {
        const annId = uuidv4();
        db.prepare('INSERT INTO annotations (id, book_id, chapter_idx, content, type) VALUES (?,?,?,?,?)').run(annId, args.book_id, args.chapter_idx, args.content, args.type || 'note');
        return { success: true, id: annId };
      }
      default:
        return { error: '未知工具: ' + toolName };
    }
  } catch (e) {
    return { error: e.message };
  }
}

function getAgentSystemPrompt(bookId) {
  const toolsDesc = AGENT_TOOLS.map(t => `- ${t.name}: ${t.description}`).join('\n');
  let bookContext = '';
  if (bookId) {
    const book = db.prepare('SELECT title, author, status FROM books WHERE id = ?').get(bookId);
    if (book) {
      const chapters = db.prepare('SELECT idx, title FROM chapters WHERE book_id = ? ORDER BY idx').all(bookId);
      bookContext = `\n当前书籍: ${book.title} (作者: ${book.author}, 状态: ${book.status})\n章节列表:\n${chapters.map(c => `  [${c.idx}] ${c.title}`).join('\n')}`;
    }
  }
  return `你是知境(KnowScape)的AI助手，一个专业的阅读和知识管理助手。你可以帮助用户阅读书籍、分析内容、管理知识。

可用工具:
${toolsDesc}
${bookContext}

使用规则:
1. 当用户需要阅读、分析、搜索书籍内容时，使用相应工具获取数据后再回答
2. 当用户要求蒸馏、生成文档、导出时，先调用工具执行操作，然后告诉用户结果
3. 回答要简洁专业，使用Markdown格式
4. 如果用户没有指定书籍，先用list_books列出可用书籍
5. 工具调用格式: 调用工具名+参数，等待结果后再继续`;
}

const agentTools = {
  read_chapter: async ({ chapter_index }, book_id) => {
    const ch = db.prepare('SELECT * FROM chapters WHERE book_id = ? AND idx = ?').get(book_id, chapter_index);
    if (!ch) return { error: 'Chapter not found' };
    let distilled = {};
    try { distilled = JSON.parse(ch.distilled_content || '{}'); } catch {}
    return { title: ch.title, content_preview: ch.content?.substring(0, 2000), distilled_points: distilled };
  },

  list_chapters: async ({}, book_id) => {
    const chapters = db.prepare('SELECT idx, title, distilled_content FROM chapters WHERE book_id = ? ORDER BY idx').all(book_id);
    return chapters.map(ch => {
      let pointCount = 0;
      try { const d = JSON.parse(ch.distilled_content || '{}'); pointCount = (d.shallow?.length||0)+(d.medium?.length||0)+(d.deep?.length||0); } catch {}
      return { index: ch.idx, title: ch.title, distilled: pointCount > 0, point_count: pointCount };
    });
  },

  get_framework: async ({}, book_id) => {
    const fw = db.prepare('SELECT framework_tree FROM frameworks WHERE book_id = ? ORDER BY rowid DESC LIMIT 1').get(book_id);
    return fw ? JSON.parse(fw.framework_tree || '{}') : { error: 'No framework generated yet' };
  },

  distill_chapter: async ({ chapter_index, depth = 'medium' }, book_id) => {
    const ch = db.prepare('SELECT * FROM chapters WHERE book_id = ? AND idx = ?').get(book_id, chapter_index);
    if (!ch) return { error: 'Chapter not found' };
    const llmConfig = getLlmConfig('chat');
    if (!llmConfig.api_key) return { error: 'LLM API 未配置' };
    let bookType = 'general';
    try {
      const bookDesc = db.prepare('SELECT description FROM books WHERE id = ?').get(book_id);
      if (bookDesc?.description) {
        const desc = JSON.parse(bookDesc.description);
        if (desc.book_type) bookType = desc.book_type;
      }
    } catch {}
    const prompt = buildChapterDistillPrompt(ch.title, ch.content, depth, bookType);
    const { content: result } = await callLLM(llmConfig, [{ role: 'user', content: prompt }], undefined, 'distill');
    try {
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return { error: 'Failed to parse LLM response' };
      const parsed = JSON.parse(jsonMatch[0]);
      db.prepare('UPDATE chapters SET distilled_content = ? WHERE book_id = ? AND idx = ?').run(JSON.stringify(parsed), book_id, chapter_index);
      return { success: true, points_found: (parsed.shallow?.length||0)+(parsed.medium?.length||0)+(parsed.deep?.length||0) };
    } catch { return { error: 'Failed to parse LLM response' }; }
  },

  generate_document: async ({ custom_prompt = '' }, book_id) => {
    const chapters = db.prepare('SELECT * FROM chapters WHERE book_id = ? ORDER BY idx').all(book_id);
    const summaries = chapters.map((ch, i) => {
      let d = {}; try { d = JSON.parse(ch.distilled_content || '{}'); } catch {}
      const pts = [...(d.shallow||[]), ...(d.medium||[]), ...(d.deep||[])];
      return `Chapter ${i+1}: ${ch.title}\nKey points: ${pts.map(p => p.summary).join('; ')}`;
    }).join('\n\n');

    const llmConfig = getLlmConfig('generate');
    if (!llmConfig.api_key) return { error: 'LLM API 未配置' };
    const prompt = `你是一位知识管理专家。请基于以下书籍的所有章节摘要，生成一份全面的综合文档。\n\n章节摘要:\n${summaries.slice(0, 8000)}\n\n${custom_prompt ? `用户要求: ${custom_prompt}\n` : ''}请生成一份3000字以上的综合文档，包含：框架概述、核心知识点、跨章节分析、深度洞察。`;

    const { content } = await callLLM(llmConfig, [{ role: 'user', content: prompt }], 8192, 'generate');
    if (!content || !content.trim()) return { error: 'LLM 返回内容为空' };
    const docId = uuidv4();
    db.prepare('INSERT INTO documents (id, book_id, title, content, custom_prompt, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(docId, book_id, '综合文档', content, custom_prompt, new Date().toISOString());
    return { success: true, document_id: docId, content };
  },

  search_knowledge: async ({ query }, book_id) => {
    const chapters = db.prepare('SELECT * FROM chapters WHERE book_id = ? ORDER BY idx').all(book_id);
    const results = [];
    for (const ch of chapters) {
      let d = {}; try { d = JSON.parse(ch.distilled_content || '{}'); } catch {}
      const allPts = [...(d.shallow||[]), ...(d.medium||[]), ...(d.deep||[])];
      for (const pt of allPts) {
        if ((pt.summary||'').includes(query) || (pt.evidence||'').includes(query) || (pt.category||'').includes(query)) {
          results.push({ chapter: ch.title, chapter_index: ch.idx, point: pt });
        }
      }
      if (ch.content && ch.content.includes(query)) {
        const idx = ch.content.indexOf(query);
        results.push({ chapter: ch.title, chapter_index: ch.idx, context: ch.content.substring(Math.max(0,idx-100), idx+query.length+100) });
      }
    }
    return results.slice(0, 10);
  },

  get_stats: async ({}, book_id) => {
    const book = db.prepare('SELECT * FROM books WHERE id = ?').get(book_id);
    if (!book) return { error: 'Book not found' };
    const total = db.prepare('SELECT COUNT(*) as c FROM chapters WHERE book_id = ?').get(book_id);
    const distilled = db.prepare("SELECT COUNT(*) as c FROM chapters WHERE book_id = ? AND distilled_content IS NOT NULL AND distilled_content != '{}'").get(book_id);
    const doc = db.prepare('SELECT id FROM documents WHERE book_id = ? ORDER BY created_at DESC LIMIT 1').get(book_id);
    return { title: book.title, status: book.status, total_chapters: total?.c || 0, distilled_chapters: distilled?.c || 0, has_document: !!doc, progress: book.progress || 0 };
  }
};

function parseToolCall(text) {
  const match = text.match(/TOOL_CALL:\s*(\w+)\((\{.*?\})\)/s);
  if (!match) return null;
  const toolName = match[1];
  try {
    const args = JSON.parse(match[2]);
    return { tool: toolName, args };
  } catch {
    return null;
  }
}

app.get(`${API}/list-books`, (req, res) => {
  try {
    const books = db.prepare('SELECT * FROM books ORDER BY created_at DESC').all();
    const result = books.map(b => {
      const total = db.prepare('SELECT COUNT(*) as c FROM chapters WHERE book_id = ?').get(b.id);
      const chapters = db.prepare('SELECT distilled_content FROM chapters WHERE book_id = ?').all(b.id);
      let distilledPoints = 0;
      for (const ch of chapters) {
        try {
          const d = JSON.parse(ch.distilled_content || '{}');
          distilledPoints += (d.shallow?.length || 0) + (d.medium?.length || 0) + (d.deep?.length || 0);
        } catch {}
      }
      return {
        id: b.id, title: b.title, author: b.author, cover_color: null,
        source_format: b.file_type, status: b.status,
        progress: { phase: 'idle', percent: b.progress || 0, current_chapter: 0, total_chapters: total?.c || 0, message: '', estimated_remaining_ms: null },
        stats: { total_chapters: total?.c || 0, distilled_points: distilledPoints, categories: {} },
        created_at: b.created_at, updated_at: b.updated_at,
      };
    });
    res.json(result);
  } catch (e) {
    res.status(500).json({ detail: e.message });
  }
});

async function ocrBuffer(imageBuffer, lang = 'chi_sim+eng') {
  const Tesseract = require('tesseract.js');
  const { data } = await Tesseract.recognize(imageBuffer, lang, {});
  return data.text || '';
}

async function fetchUrlContent(url) {
  const resp = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KnowScape/1.0)' }, signal: AbortSignal.timeout(30000) });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const contentType = resp.headers.get('content-type') || '';
  const html = await resp.text();
  if (contentType.includes('text/html') || html.includes('<html') || html.includes('<body')) {
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : new URL(url).hostname;
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    const bodyHtml = bodyMatch ? bodyMatch[1] : html;
    const text = stripHtml(bodyHtml).trim();
    return { title, text, type: 'html' };
  }
  return { title: new URL(url).pathname.split('/').pop() || '网页', text: html, type: 'text' };
}

async function parseWithOcrFallback(filePath, content, pushLog, title) {
  const { PDFParse } = require('pdf-parse');
  const data = content ? Buffer.from(content, 'base64') : fs.readFileSync(filePath);
  const parser = new PDFParse({ data: new Uint8Array(data) });
  const textResult = await parser.getText();
  let text = textResult.text || '';
  try { await parser.destroy(); } catch {}

  if (text.trim().length > 100) {
    pushLog('info', `PDF 文本提取成功 (${text.length} 字符)`);
    return { text, title, ocrUsed: false };
  }

  pushLog('info', 'PDF 文本内容不足，尝试 OCR 识别...');
  const images = textResult.pages?.map(p => p.text).filter(Boolean) || [];

  try {
    const Tesseract = require('tesseract.js');
    const pdfImages = await parser.getRenderPage?.() || [];
    if (pdfImages.length > 0) {
      pushLog('info', `检测到 ${pdfImages.length} 页扫描内容，启动 OCR...`);
      let ocrText = '';
      for (let i = 0; i < pdfImages.length; i++) {
        pushLog('info', `OCR 处理第 ${i + 1}/${pdfImages.length} 页...`);
        const pageText = await ocrBuffer(pdfImages[i]);
        ocrText += pageText + '\n\n';
      }
      if (ocrText.trim().length > 50) {
        pushLog('success', `OCR 完成，识别 ${ocrText.length} 字符`);
        return { text: ocrText, title, ocrUsed: true };
      }
    }
  } catch (e) {
    pushLog('warn', `PDF 图片 OCR 失败: ${e.message}`);
  }

  pushLog('warn', 'PDF 无法提取有效文本，尝试整页 OCR...');
  try {
    const { createCanvas } = require('canvas');
    pushLog('info', 'OCR 引擎不可用，跳过整页 OCR');
  } catch {}

  if (text.trim()) {
    pushLog('info', `使用提取的有限文本 (${text.length} 字符)`);
    return { text, title, ocrUsed: false };
  }

  throw new Error('PDF 既无法提取文本，也无法进行 OCR 识别');
}

async function parseDocx(filePath, content) {
  const mammoth = require('mammoth');
  const data = content ? Buffer.from(content, 'base64') : fs.readFileSync(filePath);
  const result = await mammoth.extractRawText({ buffer: data });
  return result.value || '';
}

async function parseImageOcr(filePath, content, pushLog) {
  pushLog('info', '检测到图片文件，启动 OCR 文字识别...');
  const data = content ? Buffer.from(content, 'base64') : fs.readFileSync(filePath);
  const text = await ocrBuffer(data);
  pushLog('info', `OCR 识别完成，提取 ${text.length} 字符`);
  return text;
}

app.post(`${API}/upload-book`, async (req, res) => {
  try {
    const { path: filePath, content } = req.body;
    if (!filePath) return res.status(400).json({ detail: '缺少文件路径' });

    const ft = path.extname(filePath).toLowerCase().replace('.', '') || 'txt';
    const title = path.basename(filePath, path.extname(filePath));
    let chapters = [];
    var finalTitle = title;

    const conversionLogs = [];
    const pushLog = (level, message) => {
      conversionLogs.push({ level, message, time: new Date().toISOString() });
      console.log(`[Convert] [${level}] ${message}`);
    };

    pushLog('info', `开始处理文件: ${title}.${ft}`);

    if (ft === 'epub') {
      pushLog('info', '解析 EPUB 格式...');
      const data = content ? Buffer.from(content, 'base64') : fs.readFileSync(filePath);
      try {
        const JSZip = require('jszip');
        const zip = await JSZip.loadAsync(data);
        let epubTitle = title;
        const containerFile = zip.file('META-INF/container.xml');
        if (containerFile) {
          const containerXml = await containerFile.async('text');
          const rootfileMatch = containerXml.match(/full-path="([^"]+)"/);
          if (rootfileMatch) {
            const opfFile = zip.file(rootfileMatch[1]);
            if (opfFile) {
              const opf = await opfFile.async('text');
              const titleMatch = opf.match(/<dc:title[^>]*>([^<]+)<\/dc:title>/i);
              if (titleMatch) epubTitle = titleMatch[1].trim();
              const spineMatches = [...opf.matchAll(/<item[^>]+href="([^"]+)"[^>]*media-type="application\/xhtml[^"]*"/gi)];
              const opfDir = rootfileMatch[1].replace(/\/[^/]+$/, '/');
              for (const m of spineMatches) {
                const href = opfDir + m[1];
                const file = zip.file(href);
                if (file) {
                  const html = await file.async('text');
                  const text = stripHtml(html);
                  if (text.trim()) chapters.push([`章节 ${chapters.length + 1}`, text.trim()]);
                }
              }
            }
          }
        }
        if (!chapters.length) {
          const xhtmlFiles = zip.file(/\.xhtml$|\.html$/);
          for (const f of xhtmlFiles.slice(0, 50)) {
            const html = await f.async('text');
            const text = stripHtml(html);
            if (text.trim()) chapters.push([`章节 ${chapters.length + 1}`, text.trim()]);
          }
        }
        var finalTitle = epubTitle || title;
        pushLog('success', `EPUB 解析完成: ${chapters.length} 个章节`);
      } catch (e) {
        return res.status(400).json({ detail: `EPUB 解析失败: ${e.message}`, conversion_logs: conversionLogs });
      }

    } else if (ft === 'pdf') {
      pushLog('info', '解析 PDF 格式...');
      try {
        const result = await parseWithOcrFallback(filePath, content, pushLog, title);
        if (result.ocrUsed) pushLog('success', 'PDF 通过 OCR 成功识别');
        chapters = await smartSplitChapters(result.text, null);
        pushLog('success', `PDF 解析完成: ${chapters.length} 个章节`);
      } catch (e) {
        return res.status(400).json({ detail: `PDF 解析失败: ${e.message}`, conversion_logs: conversionLogs });
      }

    } else if (ft === 'docx' || ft === 'doc') {
      pushLog('info', '解析 Word 文档...');
      try {
        const text = await parseDocx(filePath, content);
        if (!text.trim()) return res.status(400).json({ detail: 'Word 文档内容为空', conversion_logs: conversionLogs });
        chapters = await smartSplitChapters(text, null);
        pushLog('success', `Word 解析完成: ${chapters.length} 个章节`);
      } catch (e) {
        return res.status(400).json({ detail: `Word 解析失败: ${e.message}`, conversion_logs: conversionLogs });
      }

    } else if (ft === 'html' || ft === 'htm') {
      pushLog('info', '解析 HTML 格式...');
      try {
        const html = content || (filePath && fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf-8') : '');
        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        if (titleMatch) finalTitle = titleMatch[1].trim();
        const text = stripHtml(html);
        if (!text.trim()) return res.status(400).json({ detail: 'HTML 内容为空', conversion_logs: conversionLogs });
        chapters = await smartSplitChapters(text, null);
        pushLog('success', `HTML 解析完成: ${chapters.length} 个章节`);
      } catch (e) {
        return res.status(400).json({ detail: `HTML 解析失败: ${e.message}`, conversion_logs: conversionLogs });
      }

    } else if (ft === 'md' || ft === 'markdown' || ft === 'txt' || ft === 'text') {
      pushLog('info', '解析文本格式...');
      const text = content || (filePath && fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf-8') : '');
      if (!text) return res.status(400).json({ detail: '文件内容为空', conversion_logs: conversionLogs });
      chapters = await smartSplitChapters(text, null);
      pushLog('success', `文本解析完成: ${chapters.length} 个章节`);

    } else if (ft === 'url' || filePath.startsWith('http://') || filePath.startsWith('https://')) {
      pushLog('info', '抓取网页内容...');
      try {
        const url = filePath.startsWith('http') ? filePath : content;
        if (!url) return res.status(400).json({ detail: '缺少 URL', conversion_logs: conversionLogs });
        const result = await fetchUrlContent(url);
        finalTitle = result.title;
        pushLog('info', `网页标题: ${result.title}`);
        if (!result.text.trim()) return res.status(400).json({ detail: '网页内容为空', conversion_logs: conversionLogs });
        chapters = await smartSplitChapters(result.text, null);
        pushLog('success', `网页解析完成: ${chapters.length} 个章节`);
      } catch (e) {
        return res.status(400).json({ detail: `网页抓取失败: ${e.message}`, conversion_logs: conversionLogs });
      }

    } else if (['png', 'jpg', 'jpeg', 'gif', 'bmp', 'tiff', 'webp'].includes(ft)) {
      pushLog('info', '检测到图片文件，启动 OCR...');
      try {
        const text = await parseImageOcr(filePath, content, pushLog);
        if (!text.trim()) return res.status(400).json({ detail: 'OCR 未能识别出文字', conversion_logs: conversionLogs });
        chapters = await smartSplitChapters(text, null);
        pushLog('success', `图片 OCR 完成: ${chapters.length} 个章节`);
      } catch (e) {
        return res.status(400).json({ detail: `图片 OCR 失败: ${e.message}`, conversion_logs: conversionLogs });
      }

    } else {
      return res.status(400).json({ detail: `暂不支持 .${ft} 格式。支持: epub, pdf, docx, html, md, txt, url, png, jpg 等`, conversion_logs: conversionLogs });
    }

    pushLog('info', `分章完成，共 ${chapters.length} 章`);

    const bookId = uuidv4();
    const now = new Date().toISOString();
    db.prepare('INSERT INTO books (id, title, author, file_path, file_type, status, progress, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)')
      .run(bookId, finalTitle || title, '', filePath, ft, 'parsed', chapters.length, now, now);

    const ins = db.prepare('INSERT INTO chapters (id, book_id, idx, title, content, distilled_content) VALUES (?,?,?,?,?,?)');
    for (let i = 0; i < chapters.length; i++) {
      ins.run(uuidv4(), bookId, i, chapters[i][0], chapters[i][1], '');
    }

    pushLog('success', `文件处理完成! "${finalTitle || title}" - ${chapters.length} 章`);

    res.json({ book_id: bookId, title: finalTitle || title, chapters: chapters.length, conversion_logs: conversionLogs });
  } catch (e) {
    res.status(500).json({ detail: e.message });
  }
});

app.post(`${API}/upload-book-file`, (req, res) => {
  try {
    const { filename, content } = req.body;
    if (!filename || !content) return res.status(400).json({ detail: '缺少文件名或内容' });
    req.body = { path: filename, content };
    app.handle(req, res);
  } catch (e) {
    res.status(500).json({ detail: e.message });
  }
});

app.delete(`${API}/delete-book`, (req, res) => {
  try {
    const { book_id } = req.query;
    if (!book_id) return res.status(400).json({ detail: '缺少 book_id' });
    const tx = db.transaction(() => {
      db.prepare('DELETE FROM graph_edges WHERE source_id IN (SELECT id FROM graph_nodes WHERE book_id = ?)').run(book_id);
      db.prepare('DELETE FROM graph_nodes WHERE book_id = ?').run(book_id);
      db.prepare('DELETE FROM frameworks WHERE book_id = ?').run(book_id);
      db.prepare('DELETE FROM documents WHERE book_id = ?').run(book_id);
      db.prepare('DELETE FROM annotations WHERE book_id = ?').run(book_id);
      db.prepare('DELETE FROM chapters WHERE book_id = ?').run(book_id);
      db.prepare('DELETE FROM books WHERE id = ?').run(book_id);
    });
    tx();
    res.json(null);
  } catch (e) {
    res.status(500).json({ detail: e.message });
  }
});

app.get(`${API}/get-distillation-status`, (req, res) => {
  try {
    const { book_id } = req.query;
    const book = db.prepare('SELECT * FROM books WHERE id = ?').get(book_id);
    if (!book) return res.status(404).json({ detail: 'Book not found' });
    const chapters = db.prepare('SELECT * FROM chapters WHERE book_id = ? ORDER BY idx').all(book_id);
    res.json({
      book_id, is_running: book.status === 'distilling', overall_progress: book.progress,
      current_phase: book.status,
      chapters: chapters.map(ch => {
        let status = 'pending';
        if (ch.distilled_content) {
          try {
            const d = JSON.parse(ch.distilled_content);
            if (d.error) status = 'error';
            else if ((d.shallow?.length || 0) + (d.medium?.length || 0) + (d.deep?.length || 0) > 0) status = 'done';
            else status = 'pending';
          } catch {
            status = 'done';
          }
        }
        return { index: ch.idx, title: ch.title, status, tokenCount: ch.content?.length || 0 };
      }),
    });
  } catch (e) {
    res.status(500).json({ detail: e.message });
  }
});

app.get(`${API}/get-chapter`, (req, res) => {
  try {
    const { book_id, chapter_index } = req.query;
    const ch = db.prepare('SELECT * FROM chapters WHERE book_id = ? AND idx = ?').get(book_id, parseInt(chapter_index));
    if (!ch) return res.status(404).json({ detail: 'Chapter not found' });
    let distill = { shallow: [], medium: [], deep: [] };
    try { distill = JSON.parse(ch.distilled_content || '{}'); } catch {}
    if (!distill.shallow) distill.shallow = [];
    if (!distill.medium) distill.medium = [];
    if (!distill.deep) distill.deep = [];
    const parsePoints = (arr, ci) => (arr || []).map(p => ({
      id: p.id || '', summary: p.summary || '', evidence: p.evidence || null,
      citation: p.citation || null, originalRef: p.originalRef || '',
      category: p.category || '', chapter_index: ci,
    }));
    res.json({
      book_id: ch.book_id, chapter_index: ch.idx, title: ch.title,
      shallow: parsePoints(distill.shallow, ch.idx),
      medium: parsePoints(distill.medium, ch.idx),
      deep: parsePoints(distill.deep, ch.idx),
      original_text: ch.content,
    });
  } catch (e) {
    res.status(500).json({ detail: e.message });
  }
});

app.get(`${API}/get-framework`, (req, res) => {
  try {
    const { book_id } = req.query;
    const rec = db.prepare('SELECT * FROM frameworks WHERE book_id = ?').get(book_id);
    if (!rec) return res.json({ book_id, title: '', children: [] });
    const val = JSON.parse(rec.framework_tree || '{"title":"","children":[]}');
    res.json({ book_id, title: val.title || '', children: val.children || [] });
  } catch (e) {
    res.status(500).json({ detail: e.message });
  }
});

app.get(`${API}/get-graph-data`, (req, res) => {
  try {
    const { book_id } = req.query;
    const nodes = db.prepare('SELECT * FROM graph_nodes WHERE book_id = ?').all(book_id);
    const edges = db.prepare('SELECT * FROM graph_edges WHERE book_id = ?').all(book_id);
    res.json({
      nodes: nodes.map(n => {
        let meta = {};
        try { meta = JSON.parse(n.metadata || '{}'); } catch {}
        return {
          id: n.id, label: n.label, category: n.node_type,
          chapter_index: meta.chapterIndex || 0, point_count: meta.pointCount || 1,
          size: meta.size || 8,
        };
      }),
      edges: edges.map(e => ({ source: e.source_id, target: e.target_id, relation_type: e.relation_type })),
    });
  } catch (e) {
    res.status(500).json({ detail: e.message });
  }
});

app.get(`${API}/settings`, (req, res) => {
  try {
    const settings = readSettings();
    const providersArr = Object.entries(settings.providers || {}).map(([k, v]) => ({
      id: k,
      name: v.name || k,
      base_url: v.base_url || '',
      api_key: v.api_key ? v.api_key.slice(0, 8) + '****' : '',
      model: v.model || '',
      temperature: v.temperature ?? 0.7,
      max_tokens: v.max_tokens ?? 4096,
    }));
    res.json({
      providers: providersArr,
      default_provider_id: settings.default_provider || '',
      agent_mappings: settings.agents || { distill: '', chat: '', rag: '', generate: '' },
    });
  } catch (e) {
    res.status(500).json({ detail: e.message });
  }
});

app.post(`${API}/settings`, (req, res) => {
  try {
    const { providers, default_provider_id, agent_mappings } = req.body;
    if (!providers || !Array.isArray(providers)) {
      return res.status(400).json({ detail: '无效的设置格式' });
    }
    const existing = readSettings();
    const providersObj = {};
    for (const p of providers) {
      const key = p.id || `provider-${Date.now()}`;
      let apiKey = p.api_key || '';
      if (apiKey.includes('****')) {
        apiKey = existing.providers?.[key]?.api_key || apiKey;
      }
      providersObj[key] = {
        name: p.name || key,
        base_url: p.base_url || '',
        api_key: apiKey,
        model: p.model || '',
        temperature: p.temperature ?? 0.7,
        max_tokens: p.max_tokens ?? 4096,
      };
    }
    const out = {
      providers: providersObj,
      default_provider: default_provider_id || Object.keys(providersObj)[0] || '',
      agents: agent_mappings || { distill: '', chat: '', rag: '', generate: '' },
    };
    fs.writeFileSync(SETTINGS_PATH, JSON.stringify(out, null, 2), 'utf-8');
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ detail: e.message });
  }
});

app.post(`${API}/settings/test-connection`, async (req, res) => {
  try {
    const { base_url, api_key, model } = req.body;
    if (!api_key) return res.status(400).json({ success: false, message: '缺少 api_key' });

    const resp = await fetch(`${base_url.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${api_key}` },
      body: JSON.stringify({ model: model || 'deepseek-chat', messages: [{ role: 'user', content: 'Hi' }], max_tokens: 5 }),
    });

    if (resp.ok) {
      res.json({ success: true, message: '连接成功' });
    } else {
      const err = await resp.text();
      res.json({ success: false, message: `连接失败: ${resp.status} ${err}` });
    }
  } catch (e) {
    res.json({ success: false, message: `连接失败: ${e.message}` });
  }
});

app.get(`${API}/distill-progress`, (req, res) => {
  const { book_id } = req.query;
  if (!book_id) return res.status(400).json({ detail: '缺少 book_id' });

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  const events = distillProgress.get(book_id) || [];
  for (const ev of events) {
    res.write(`data: ${JSON.stringify(ev)}\n\n`);
  }

  const book = db.prepare('SELECT status FROM books WHERE id = ?').get(book_id);
  if (!book || book.status === 'completed' || book.status === 'error') {
    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    res.end();
    return;
  }

  let idx = events.length;
  const interval = setInterval(() => {
    const all = distillProgress.get(book_id) || [];
    while (idx < all.length) {
      res.write(`data: ${JSON.stringify(all[idx])}\n\n`);
      idx++;
    }
    const b = db.prepare('SELECT status FROM books WHERE id = ?').get(book_id);
    if (!b || b.status === 'completed' || b.status === 'error') {
      res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
      clearInterval(interval);
      res.end();
    }
  }, 500);

  req.on('close', () => clearInterval(interval));
});

app.post(`${API}/start-distillation`, async (req, res) => {
  try {
    const { book_id, depth = 'deep', custom_prompt = '' } = req.body;
    db.prepare('UPDATE books SET status = ? WHERE id = ?').run('distilling', book_id);
    distillProgress.set(book_id, []);

    const chapters = db.prepare('SELECT * FROM chapters WHERE book_id = ? ORDER BY idx').all(book_id);
    if (!chapters.length) {
      db.prepare('UPDATE books SET status = ? WHERE id = ?').run('error', book_id);
      return res.status(400).json({ detail: 'No chapters found' });
    }

    res.json(`task-${uuidv4()}`);

    const llmConfig = getLlmConfig('distill');

    (async () => {
      try {
        const pp = (pct) => pushProgress(book_id, { type: 'progress', percent: pct });

        pushProgress(book_id, makeLog('info', `开始蒸馏流程，共 ${chapters.length} 个章节，深度: ${depth}`));
        pp(0);

        pushProgress(book_id, { type: 'phase', phase: 'chapter_distill', message: 'Phase 1: 章节蒸馏' });
        pushProgress(book_id, makeLog('info', '=== Phase 1: 章节蒸馏 (60%) ==='));

        const totalChapters = chapters.length;
        const pendingChapters = [];
        let skippedCount = 0;

        for (let i = 0; i < totalChapters; i++) {
          const ch = chapters[i];
          let existingDistilled = null;
          try { existingDistilled = JSON.parse(ch.distilled_content || '{}'); } catch {}
          const hasExisting = existingDistilled && (
            (existingDistilled.shallow?.length > 0) ||
            (existingDistilled.medium?.length > 0) ||
            (existingDistilled.deep?.length > 0)
          );

          if (hasExisting) {
            skippedCount++;
            pushProgress(book_id, makeLog('info', `[${i + 1}/${totalChapters}] 跳过已蒸馏章节: ${ch.title}`));
            continue;
          }

          pendingChapters.push({ ch, index: i });
        }

        if (skippedCount > 0) {
          pushProgress(book_id, makeLog('info', `跳过 ${skippedCount} 个已蒸馏章节，剩余 ${pendingChapters.length} 个待蒸馏`));
        }

        const CONCURRENCY = 3;
        const completedCount = skippedCount;
        const distillStartTime = Date.now();
        const chapterTimers = {};

        pushProgress(book_id, { type: 'timer', event: 'start', start_time: distillStartTime });

        for (let batch = 0; batch < pendingChapters.length; batch += CONCURRENCY) {
          const batchItems = pendingChapters.slice(batch, batch + CONCURRENCY);
          const batchPct = ((completedCount + batch) / totalChapters * 60).toFixed(1);
          db.prepare('UPDATE books SET progress = ? WHERE id = ?').run(parseFloat(batchPct), book_id);
          pp(parseFloat(batchPct));

          const batchPromises = batchItems.map(async ({ ch, index }) => {
            pushProgress(book_id, { type: 'chapter_start', chapter_index: index, chapter_title: ch.title, total: totalChapters, overall_progress: parseFloat(batchPct) });
            pushProgress(book_id, makeLog('info', `[${index + 1}/${totalChapters}] 开始蒸馏章节: ${ch.title}`));

            chapterTimers[index] = Date.now();
            const result = await distillChapterWithRetry(llmConfig, ch, depth, book_id, index, totalChapters, batchPct);
            const elapsed = Date.now() - chapterTimers[index];
            pushProgress(book_id, { type: 'chapter_elapsed', chapter_index: index, elapsed_ms: elapsed });

            return result;
          });

          await Promise.allSettled(batchPromises);
        }

        const totalDistillElapsed = Date.now() - distillStartTime;
        pushProgress(book_id, { type: 'timer', event: 'end', total_elapsed_ms: totalDistillElapsed });
        pushProgress(book_id, makeLog('info', `章节蒸馏总耗时: ${(totalDistillElapsed / 1000).toFixed(1)}s`));

        const afterChaptersPct = 60;
        db.prepare('UPDATE books SET progress = ? WHERE id = ?').run(afterChaptersPct, book_id);
        pp(afterChaptersPct);

        pushProgress(book_id, makeLog('info', '章节蒸馏完成，开始生成知识框架...'));

        pushProgress(book_id, { type: 'phase', phase: 'framework', message: 'Phase 2: 知识框架生成' });
        pushProgress(book_id, makeLog('info', '=== Phase 2: 知识框架生成 (20%) ==='));

        try {
          const freshChapters = db.prepare('SELECT * FROM chapters WHERE book_id = ? ORDER BY idx').all(book_id);
          const summaries = freshChapters.map(ch => {
            const points = getDistilledPoints(ch);
            return `章节 ${ch.idx}: ${ch.title}\n${points || '(未蒸馏)'}`;
          }).join('\n\n');

          const frameworkPrompt = `你是一位知识架构专家。请根据以下各章节的蒸馏摘要，生成一个层次化的知识框架树。

各章节摘要:
${summaries.slice(0, 6000)}

${custom_prompt ? `用户额外要求: ${custom_prompt}\n` : ''}
请以 JSON 格式返回层次化框架，结构如下:
{
  "title": "书籍总主题",
  "children": [
    {
      "name": "一级分类",
      "children": [
        { "name": "二级分类", "chapters": [0, 1], "summary": "简要说明" }
      ]
    }
  ]
}

要求:
1. 框架应覆盖所有章节的核心主题
2. 层次不超过3级
3. 每个叶节点关联相关章节编号
4. 总结要精炼准确`;

          pushProgress(book_id, makeLog('info', '正在调用 LLM 生成知识框架...'));
          const { content: frameworkRaw } = await callLLM(llmConfig, [{ role: 'user', content: frameworkPrompt }], undefined, 'framework');

          const fwJsonMatch = frameworkRaw.match(/\{[\s\S]*\}/);
          if (fwJsonMatch) {
            const framework = JSON.parse(fwJsonMatch[0]);
            db.prepare('INSERT OR REPLACE INTO frameworks (book_id, framework_tree) VALUES (?, ?)')
              .run(book_id, JSON.stringify(framework));
            pushProgress(book_id, makeLog('success', `知识框架生成成功: "${framework.title || '未命名'}"`));
          } else {
            pushProgress(book_id, makeLog('warn', '知识框架生成失败：LLM 未返回有效 JSON'));
          }
        } catch (e) {
          console.error('Framework generation failed:', e.message);
          pushProgress(book_id, makeLog('error', `知识框架生成失败: ${e.message}`));
        }

        const afterFrameworkPct = 80;
        db.prepare('UPDATE books SET progress = ? WHERE id = ?').run(afterFrameworkPct, book_id);
        pp(afterFrameworkPct);

        try {
          const allChapters = db.prepare('SELECT * FROM chapters WHERE book_id = ? ORDER BY idx').all(book_id);
          const nodeMap = new Map();
          const edges = [];
          
          for (const ch of allChapters) {
            let d = {};
            try { d = JSON.parse(ch.distilled_content || '{}'); } catch {}
            const allPts = [...(d.shallow||[]), ...(d.medium||[]), ...(d.deep||[])];
            
            for (const pt of allPts) {
              const cat = pt.category || '未分类';
              if (!nodeMap.has(cat)) {
                nodeMap.set(cat, { id: `cat-${cat}`, label: cat, type: 'category', count: 0 });
              }
              nodeMap.get(cat).count++;
              
              const ptId = `pt-${ch.idx}-${pt.id || Math.random().toString(36).slice(2,8)}`;
              nodeMap.set(ptId, { id: ptId, label: (pt.summary||'').substring(0, 50), type: 'point', chapter_idx: ch.idx, chapter_title: ch.title, category: cat });
              edges.push({ source: `cat-${cat}`, target: ptId, relationship: 'contains' });
            }
          }
          
          for (const ch of allChapters) {
            const chId = `ch-${ch.idx}`;
            nodeMap.set(chId, { id: chId, label: ch.title, type: 'chapter', chapter_idx: ch.idx });
            let d = {};
            try { d = JSON.parse(ch.distilled_content || '{}'); } catch {}
            const cats = new Set([...(d.shallow||[]), ...(d.medium||[]), ...(d.deep||[])].map(p => p.category).filter(Boolean));
            for (const cat of cats) {
              edges.push({ source: chId, target: `cat-${cat}`, relationship: 'belongs_to' });
            }
          }
          
          db.prepare('DELETE FROM graph_nodes WHERE book_id = ?').run(book_id);
          db.prepare('DELETE FROM graph_edges WHERE book_id = ?').run(book_id);
          
          const insertNode = db.prepare('INSERT OR IGNORE INTO graph_nodes (id, book_id, label, node_type, metadata) VALUES (?, ?, ?, ?, ?)');
          const insertEdge = db.prepare('INSERT INTO graph_edges (id, book_id, source_id, target_id, relation_type) VALUES (?, ?, ?, ?, ?)');
          
          for (const [, node] of nodeMap) {
            insertNode.run(node.id, book_id, node.label, node.type, JSON.stringify(node));
          }
          for (const edge of edges) {
            insertEdge.run(uuidv4(), book_id, edge.source, edge.target, edge.relationship);
          }
          
          pushProgress(book_id, makeLog('info', `知识图谱生成完成: ${nodeMap.size} 节点, ${edges.length} 连接`));
        } catch (e) {
          console.error('Graph generation error:', e.message);
        }

        pushProgress(book_id, { type: 'phase', phase: 'whole_book_doc', message: 'Phase 3: 全书文档生成' });
        pushProgress(book_id, makeLog('info', '=== Phase 3: 全书文档生成 (20%) ==='));

        try {
          const bookInfo = db.prepare('SELECT title FROM books WHERE id = ?').get(book_id);
          const freshChapters = db.prepare('SELECT * FROM chapters WHERE book_id = ? ORDER BY idx').all(book_id);

          const chapterDocs = freshChapters.map(ch => {
            const points = getDistilledPoints(ch);
            return `## ${ch.title}\n${points || ch.content.slice(0, 500)}`;
          }).join('\n\n');

          let frameworkContext = '';
          try {
            const fwRec = db.prepare('SELECT framework_tree FROM frameworks WHERE book_id = ?').get(book_id);
            if (fwRec) frameworkContext = `知识框架:\n${fwRec.framework_tree}\n\n`;
          } catch {}

          const docPrompt = `你是一位学术写作专家。请根据以下书籍的章节蒸馏内容，生成一份全面的全书综合文档。

书籍名称: ${bookInfo?.title || '未知'}
${frameworkContext}
各章节内容:
${chapterDocs.slice(0, 8000)}

${custom_prompt ? `用户额外要求: ${custom_prompt}\n` : ''}
请生成一份3000字以上的综合文档，包含以下部分:

1. **全书概览**: 对全书主题、目标读者和核心价值的总结
2. **知识框架概述**: 简述全书的知识结构
3. **核心知识点详解**: 按主题归类，详细阐述各核心知识点
4. **跨章节分析**: 分析各章节之间的关联和知识脉络
5. **关键概念索引**: 列出全书关键概念及其所在章节
6. **总结与启示**: 全书的精华总结和实践启示

要求:
- 内容详实，不少于3000字
- 使用 Markdown 格式
- 逻辑清晰，结构完整
- 体现跨章节的知识关联`;

          pushProgress(book_id, makeLog('info', '正在调用 LLM 生成全书文档...'));
          const { content: docContent } = await callLLM(llmConfig, [{ role: 'user', content: docPrompt }], 8192, 'generate');

          if (docContent && docContent.trim()) {
            const docId = uuidv4();
            db.prepare('INSERT INTO documents (id, book_id, title, content, custom_prompt, created_at) VALUES (?,?,?,?,?,?)')
              .run(docId, book_id, `${bookInfo?.title || '未知'} - 全书综合文档`, docContent, custom_prompt || '', new Date().toISOString());
            pushProgress(book_id, makeLog('success', `全书文档生成成功，共 ${docContent.length} 字`));
          } else {
            pushProgress(book_id, makeLog('warn', '全书文档生成失败：LLM 返回内容为空'));
          }
        } catch (e) {
          console.error('Whole-book document generation failed:', e.message);
          pushProgress(book_id, makeLog('error', `全书文档生成失败: ${e.message}`));
        }

        pp(100);
        pushProgress(book_id, { type: 'completed', progress: 100 });
        pushProgress(book_id, makeLog('success', '全部蒸馏流程完成！'));
        db.prepare('UPDATE books SET status = ?, progress = 100 WHERE id = ?').run('completed', book_id);
        console.log(`Distillation completed for book ${book_id}`);
      } catch (e) {
        console.error(`Distillation pipeline failed for ${book_id}:`, e.message);
        pushProgress(book_id, makeLog('error', `蒸馏流程异常终止: ${e.message}`));
        pushProgress(book_id, { type: 'error', message: e.message });
        db.prepare('UPDATE books SET status = ? WHERE id = ?').run('error', book_id);
      }
    })();
  } catch (e) {
    res.status(500).json({ detail: e.message });
  }
});

app.post(`${API}/distill-chapter`, async (req, res) => {
  try {
    const { book_id, chapter_index, depth = 'deep', custom_prompt = '' } = req.body;
    if (!book_id || chapter_index === undefined) {
      return res.status(400).json({ detail: '缺少 book_id 或 chapter_index' });
    }

    const ch = db.prepare('SELECT * FROM chapters WHERE book_id = ? AND idx = ?').get(book_id, parseInt(chapter_index));
    if (!ch) return res.status(404).json({ detail: 'Chapter not found' });

    const llmConfig = getLlmConfig('distill');
    if (!llmConfig.api_key) {
      return res.status(400).json({ detail: 'LLM API 未配置' });
    }

    let bookType = 'general';
    try {
      const bookDesc = db.prepare('SELECT description FROM books WHERE id = ?').get(book_id);
      if (bookDesc?.description) {
        const desc = JSON.parse(bookDesc.description);
        if (desc.book_type) bookType = desc.book_type;
      }
    } catch {}
    let prompt = buildChapterDistillPrompt(ch.title, ch.content, depth, bookType);
    if (custom_prompt) {
      prompt += `\n\n用户额外要求: ${custom_prompt}`;
    }

    const { content: raw } = await callLLM(llmConfig, [{ role: 'user', content: prompt }], undefined, 'distill');

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return res.status(500).json({ detail: 'LLM 未返回有效 JSON' });
    }

    const parsed = JSON.parse(jsonMatch[0]);
    db.prepare('UPDATE chapters SET distilled_content = ? WHERE book_id = ? AND idx = ?')
      .run(JSON.stringify(parsed), book_id, parseInt(chapter_index));

    const pointsFound = (parsed.shallow?.length || 0) + (parsed.medium?.length || 0) + (parsed.deep?.length || 0);
    res.json({ success: true, points_found: pointsFound, distilled_content: parsed });
  } catch (e) {
    res.status(500).json({ detail: e.message });
  }
});

app.post(`${API}/generate-document`, async (req, res) => {
  try {
    const { book_id, custom_prompt = '' } = req.body;
    if (!book_id) return res.status(400).json({ detail: '缺少 book_id' });

    const bookInfo = db.prepare('SELECT title FROM books WHERE id = ?').get(book_id);
    if (!bookInfo) return res.status(404).json({ detail: 'Book not found' });

    const llmConfig = getLlmConfig('generate');
    if (!llmConfig.api_key) {
      return res.status(400).json({ detail: 'LLM API 未配置' });
    }

    const chapters = db.prepare('SELECT * FROM chapters WHERE book_id = ? ORDER BY idx').all(book_id);
    const chapterDocs = chapters.map(ch => {
      const points = getDistilledPoints(ch);
      return `## ${ch.title}\n${points || ch.content.slice(0, 500)}`;
    }).join('\n\n');

    let frameworkContext = '';
    try {
      const fwRec = db.prepare('SELECT framework_tree FROM frameworks WHERE book_id = ?').get(book_id);
      if (fwRec) frameworkContext = `知识框架:\n${fwRec.framework_tree}\n\n`;
    } catch {}

    const docPrompt = `你是一位学术写作专家。请根据以下书籍的章节蒸馏内容，生成一份全面的全书综合文档。

书籍名称: ${bookInfo.title}
${frameworkContext}
各章节内容:
${chapterDocs.slice(0, 8000)}

${custom_prompt ? `用户额外要求: ${custom_prompt}\n` : ''}
请生成一份3000字以上的综合文档，包含以下部分:

1. **全书概览**: 对全书主题、目标读者和核心价值的总结
2. **知识框架概述**: 简述全书的知识结构
3. **核心知识点详解**: 按主题归类，详细阐述各核心知识点
4. **跨章节分析**: 分析各章节之间的关联和知识脉络
5. **关键概念索引**: 列出全书关键概念及其所在章节
6. **总结与启示**: 全书的精华总结和实践启示

要求:
- 内容详实，不少于3000字
- 使用 Markdown 格式
- 逻辑清晰，结构完整
- 体现跨章节的知识关联`;

    const { content: docContent } = await callLLM(llmConfig, [{ role: 'user', content: docPrompt }], 8192, 'generate');

    if (!docContent || !docContent.trim()) {
      return res.status(500).json({ detail: 'LLM 返回内容为空' });
    }

    const docId = uuidv4();
    db.prepare('INSERT INTO documents (id, book_id, title, content, custom_prompt, created_at) VALUES (?,?,?,?,?,?)')
      .run(docId, book_id, `${bookInfo.title} - 全书综合文档`, docContent, custom_prompt || '', new Date().toISOString());

    res.json({ id: docId, title: `${bookInfo.title} - 全书综合文档`, content: docContent });
  } catch (e) {
    res.status(500).json({ detail: e.message });
  }
});

app.get(`${API}/get-document`, (req, res) => {
  try {
    const { book_id } = req.query;
    if (!book_id) return res.status(400).json({ detail: '缺少 book_id' });

    const doc = db.prepare('SELECT * FROM documents WHERE book_id = ? ORDER BY created_at DESC LIMIT 1').get(book_id);
    if (!doc) return res.json(null);

    res.json({
      id: doc.id,
      book_id: doc.book_id,
      title: doc.title,
      content: doc.content,
      custom_prompt: doc.custom_prompt,
      created_at: doc.created_at,
    });
  } catch (e) {
    res.status(500).json({ detail: e.message });
  }
});

app.post(`${API}/ask-question`, async (req, res) => {
  try {
    const { book_id, question, history } = req.body;
    const chapters = db.prepare('SELECT * FROM chapters WHERE book_id = ? ORDER BY idx').all(book_id);

    const sources = [];
    let context = '';
    for (const ch of chapters) {
      let distilled = '';
      let pointSummary = '';
      try {
        const d = JSON.parse(ch.distilled_content || '{}');
        const points = [...(d.shallow || []), ...(d.medium || []), ...(d.deep || [])];
        distilled = points.map(p => p.summary).join('\n');
        pointSummary = points.map(p => p.summary).slice(0, 5).join('；');
      } catch {}
      context += `章节 ${ch.idx}: ${ch.title}\n${distilled || ch.content.slice(0, 1000)}\n\n`;
      sources.push({ chapter_index: ch.idx, chapter_title: ch.title, point_summary: pointSummary || '(未蒸馏)' });
    }

    const llmConfig = getLlmConfig('chat');

    if (!llmConfig.api_key) {
      return res.json({ answer: 'AI 服务未配置。请在设置中配置 API Key。', sources: [] });
    }

    const systemPrompt = `你是一位知识助手，基于以下书籍内容回答问题。请遵循以下规则:

1. 简洁准确地回答问题
2. 在回答中引用来源章节，在提到某个知识点时使用 [章节X: 章节名称] 的格式标注出处
3. 如果问题涉及多个章节的知识，请综合分析并分别标注出处
4. 如果书中没有相关内容，请明确说明

可用章节及知识点摘要:
${context.slice(0, 6000)}`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...(history || []),
      { role: 'user', content: question },
    ];

    const { content: answer } = await callLLM(llmConfig, messages, 2048, 'chat');

    res.json({ answer: answer || '无法生成回答', sources });
  } catch (e) {
    res.status(500).json({ detail: e.message });
  }
});

app.get(`${API}/agent/conversations`, (req, res) => {
  const { book_id } = req.query;
  let convs;
  if (book_id) {
    convs = db.prepare('SELECT * FROM agent_conversations WHERE book_id = ? ORDER BY updated_at DESC LIMIT 50').all(book_id);
  } else {
    convs = db.prepare('SELECT * FROM agent_conversations ORDER BY updated_at DESC LIMIT 50').all();
  }
  res.json(convs);
});

app.post(`${API}/agent/conversations`, (req, res) => {
  const { book_id, title } = req.body;
  const id = uuidv4();
  db.prepare('INSERT INTO agent_conversations (id, book_id, title) VALUES (?,?,?)').run(id, book_id || null, title || '新对话');
  const conv = db.prepare('SELECT * FROM agent_conversations WHERE id = ?').get(id);
  res.json(conv);
});

app.delete(`${API}/agent/conversations/:id`, (req, res) => {
  db.prepare('DELETE FROM agent_messages WHERE conversation_id = ?').run(req.params.id);
  db.prepare('DELETE FROM agent_conversations WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

app.get(`${API}/agent/conversations/:id/messages`, (req, res) => {
  const messages = db.prepare('SELECT * FROM agent_messages WHERE conversation_id = ? ORDER BY created_at ASC').all(req.params.id);
  res.json(messages);
});

app.post(`${API}/agent/chat`, async (req, res) => {
  try {
    const { book_id, message, history = [], tools } = req.body;
    if (!book_id || !message) {
      return res.status(400).json({ detail: '缺少 book_id 或 message' });
    }

    const book = db.prepare('SELECT * FROM books WHERE id = ?').get(book_id);
    if (!book) return res.status(404).json({ detail: 'Book not found' });

    const llmConfig = getLlmConfig('chat');
    if (!llmConfig.api_key) {
      return res.json({ answer: 'AI 服务未配置。请在设置中配置 API Key。', tool_calls: [], sources: [] });
    }

    const totalChapters = db.prepare('SELECT COUNT(*) as c FROM chapters WHERE book_id = ?').get(book_id);
    const distilledChapters = db.prepare("SELECT COUNT(*) as c FROM chapters WHERE book_id = ? AND distilled_content IS NOT NULL AND distilled_content != '{}'").get(book_id);
    const hasFramework = db.prepare('SELECT 1 FROM frameworks WHERE book_id = ?').get(book_id);

    const systemPrompt = `你是 KnowScape 的 AI 知识管理助手。你可以帮助用户管理书籍知识、执行蒸馏分析、生成文档等。

你可以使用以下工具（用 TOOL_CALL 格式调用）：
- read_chapter: 阅读指定章节内容和蒸馏结果，参数: {"chapter_index": 数字}
- list_chapters: 列出所有章节及蒸馏状态
- get_framework: 获取知识框架
- distill_chapter: 蒸馏指定章节，参数: {"chapter_index": 数字, "depth": "shallow|medium|deep"}
- generate_document: 生成全书综合文档，参数: {"custom_prompt": "可选的自定义要求"}
- search_knowledge: 搜索知识要点，参数: {"query": "搜索关键词"}
- get_stats: 获取书籍统计信息

调用格式: TOOL_CALL: tool_name({"param": "value"})
你可以连续调用多个工具，每次只调用一个工具。调用后你会收到工具结果，然后继续调用或给出总结性回答。
当不需要再调用工具时，请直接给出完整的中文回答，不要包含 TOOL_CALL 格式。

当前书籍ID: ${book_id}
书籍标题: ${book.title}
书籍状态: ${book.status}
总章节数: ${totalChapters?.c || 0}
已蒸馏章节: ${distilledChapters?.c || 0}
已有知识框架: ${hasFramework ? '是' : '否'}`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...history,
      { role: 'user', content: message },
    ];

    const toolCallLog = [];
    const sources = [];
    let finalText = '';
    const MAX_ROUNDS = 3;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalTokens = 0;

    for (let round = 0; round < MAX_ROUNDS; round++) {
      console.log(`[Agent] Round ${round + 1}/${MAX_ROUNDS}, book=${book_id}`);

      const { content: rawResponse, usage } = await callLLM(llmConfig, messages, 2048, 'agent');
      console.log(`[Agent] LLM response (round ${round + 1}):`, rawResponse.substring(0, 200));

      if (usage) {
        totalInputTokens += usage.promptTokens || 0;
        totalOutputTokens += usage.completionTokens || 0;
        totalTokens += usage.totalTokens || 0;
      }

      const toolCall = parseToolCall(rawResponse);

      if (!toolCall || !agentTools[toolCall.tool]) {
        finalText = rawResponse;
        break;
      }

      const { tool, args } = toolCall;
      console.log(`[Agent] Tool call: ${tool}`, JSON.stringify(args));

      let result;
      try {
        if (typeof agentTools[tool] === 'function') {
          result = await agentTools[tool](args, book_id);
        } else {
          result = { error: `Unknown tool: ${tool}` };
        }
      } catch (e) {
        console.error(`[Agent] Tool ${tool} execution error:`, e.message);
        result = { error: e.message };
      }

      console.log(`[Agent] Tool ${tool} result:`, JSON.stringify(result).substring(0, 300));

      toolCallLog.push({
        tool,
        args,
        result_summary: typeof result === 'object' ? JSON.stringify(result).substring(0, 500) : String(result).substring(0, 500),
      });

      if (tool === 'read_chapter' && result.title) {
        sources.push({ chapter_index: args.chapter_index, chapter_title: result.title });
      }
      if (tool === 'search_knowledge' && Array.isArray(result)) {
        for (const r of result) {
          if (r.chapter_index !== undefined && r.chapter) {
            const exists = sources.find(s => s.chapter_index === r.chapter_index);
            if (!exists) sources.push({ chapter_index: r.chapter_index, chapter_title: r.chapter });
          }
        }
      }

      const toolResultMessage = `Tool result for ${tool}: ${JSON.stringify(result)}`;
      messages.push({ role: 'assistant', content: rawResponse });
      messages.push({ role: 'user', content: toolResultMessage });
    }

    if (!finalText) {
      const { content: lastResponse, usage } = await callLLM(llmConfig, messages, 2048, 'agent');
      finalText = lastResponse || '无法生成回答';
      if (usage) {
        totalInputTokens += usage.promptTokens || 0;
        totalOutputTokens += usage.completionTokens || 0;
        totalTokens += usage.totalTokens || 0;
      }
    }

    console.log(`[Agent] Completed. tool_calls=${toolCallLog.length}, sources=${sources.length}`);

    res.json({
      answer: finalText,
      tool_calls: toolCallLog,
      sources,
      token_usage: {
        input: totalInputTokens,
        output: totalOutputTokens,
        total: totalTokens,
        model: llmConfig.model,
      },
    });
  } catch (e) {
    console.error('[Agent] Error:', e.message);
    res.status(500).json({ detail: e.message });
  }
});

app.get(`${API}/agent/tools`, (req, res) => {
  res.json(AGENT_TOOLS);
});

app.post(`${API}/agent/export`, (req, res) => {
  const { conversation_id } = req.body;
  if (!conversation_id) return res.status(400).json({ detail: 'conversation_id required' });
  const messages = db.prepare('SELECT role, content, tool_calls, tool_results, created_at FROM agent_messages WHERE conversation_id = ? ORDER BY created_at ASC').all(conversation_id);
  const conv = db.prepare('SELECT * FROM agent_conversations WHERE id = ?').get(conversation_id);

  let md = `# ${conv?.title || 'AI对话'}\n\n`;
  md += `> 对话时间: ${conv?.created_at || ''}\n\n---\n\n`;
  for (const m of messages) {
    const roleLabel = m.role === 'user' ? '👤 用户' : '🤖 AI助手';
    md += `### ${roleLabel}\n\n${m.content}\n\n`;
    if (m.tool_calls) {
      try {
        const calls = JSON.parse(m.tool_calls);
        if (calls.length > 0) {
          md += `**工具调用:**\n`;
          for (const c of calls) {
            md += `- \`${c.name}\`(${JSON.stringify(c.arguments)})\n`;
          }
          md += '\n';
        }
      } catch {}
    }
  }

  res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="conversation_${conversation_id.substring(0, 8)}.md"`);
  res.send(md);
});

app.post(`${API}/cancel-distillation`, (req, res) => {
  const { book_id } = req.body;
  db.prepare('UPDATE books SET status = ? WHERE id = ?').run('parsed', book_id);
  pushProgress(book_id, { type: 'done' });
  res.json({ success: true });
});

app.post(`${API}/reset-distillation`, (req, res) => {
  const { book_id } = req.body;
  if (!book_id) return res.status(400).json({ detail: 'book_id required' });
  
  db.prepare('UPDATE chapters SET distilled_content = NULL WHERE book_id = ?').run(book_id);
  db.prepare('UPDATE books SET status = ?, progress = 0 WHERE id = ?').run('parsed', book_id);
  db.prepare('DELETE FROM frameworks WHERE book_id = ?').run(book_id);
  db.prepare('DELETE FROM documents WHERE book_id = ?').run(book_id);
  
  pushProgress(book_id, { type: 'done' });
  res.json({ success: true, message: '蒸馏状态已重置' });
});

app.get(`${API}/get-type-index`, (req, res) => {
  const { book_id } = req.query;
  const chapters = db.prepare('SELECT * FROM chapters WHERE book_id = ? ORDER BY idx').all(book_id);
  const categories = { methodology: [], principles: [], strategies: [], models: [], cases: [], data: [], perspectives: [] };
  const catLabels = { methodology: '方法', principles: '原则', strategies: '策略', models: '模型', cases: '案例', data: '数据/证据', perspectives: '观点/立场' };
  
  for (const ch of chapters) {
    let d = {};
    try { d = JSON.parse(ch.distilled_content || '{}'); } catch {}
    const allPts = [...(d.shallow||[]), ...(d.medium||[]), ...(d.deep||[])];
    for (const pt of allPts) {
      const cat = (pt.category || '').toLowerCase();
      for (const [key, label] of Object.entries(catLabels)) {
        if (cat.includes(label) || cat.includes(key)) {
          categories[key].push({ chapter_idx: ch.idx, chapter_title: ch.title, point: pt });
          break;
        }
      }
    }
  }
  
  const result = Object.entries(categories)
    .filter(([, items]) => items.length > 0)
    .map(([key, items]) => ({ category: key, label: catLabels[key], count: items.length, items }));
  
  res.json({ book_id, categories: result, total_points: result.reduce((s, c) => s + c.count, 0) });
});

app.get(`${API}/search`, (req, res) => {
  const { book_id, query } = req.query;
  if (!query) return res.json({ results: [] });
  const q = query.toLowerCase();
  const chapters = db.prepare('SELECT * FROM chapters WHERE book_id = ? ORDER BY idx').all(book_id);
  const results = [];
  
  for (const ch of chapters) {
    if (ch.content && ch.content.toLowerCase().includes(q)) {
      const idx = ch.content.toLowerCase().indexOf(q);
      results.push({
        type: 'original', chapter_idx: ch.idx, chapter_title: ch.title,
        context: ch.content.substring(Math.max(0, idx - 80), Math.min(ch.content.length, idx + q.length + 80)),
        match_position: idx
      });
    }
    let d = {};
    try { d = JSON.parse(ch.distilled_content || '{}'); } catch {}
    for (const depth of ['shallow', 'medium', 'deep']) {
      for (const pt of (d[depth] || [])) {
        if ((pt.summary||'').toLowerCase().includes(q) || (pt.evidence||'').toLowerCase().includes(q) || (pt.category||'').toLowerCase().includes(q)) {
          results.push({
            type: 'distilled', chapter_idx: ch.idx, chapter_title: ch.title, depth,
            point: pt, context: pt.summary
          });
        }
      }
    }
  }
  
  res.json({ query, results: results.slice(0, 50), total: results.length });
});

app.post(`${API}/add-annotation`, (req, res) => {
  const { book_id, chapter_idx, content, type: annoType, color, start_offset, end_offset } = req.body;
  const id = uuidv4();
  db.prepare('INSERT INTO annotations (id, book_id, chapter_idx, content, type, color, start_offset, end_offset, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(id, book_id, chapter_idx, content, annoType || 'highlight', color || '#FFEB3B', start_offset || 0, end_offset || 0, new Date().toISOString());
  res.json({ id, success: true });
});

app.get(`${API}/get-annotations`, (req, res) => {
  const { book_id, chapter_idx } = req.query;
  let sql = 'SELECT * FROM annotations WHERE book_id = ?';
  const params = [book_id];
  if (chapter_idx !== undefined) { sql += ' AND chapter_idx = ?'; params.push(parseInt(chapter_idx)); }
  sql += ' ORDER BY created_at DESC';
  res.json(db.prepare(sql).all(...params));
});

app.delete(`${API}/delete-annotation`, (req, res) => {
  const { id } = req.query;
  db.prepare('DELETE FROM annotations WHERE id = ?').run(id);
  res.json({ success: true });
});

app.get(`${API}/export-book`, async (req, res) => {
  try {
    const { book_id, format = 'json' } = req.query;
    if (!book_id) return res.status(400).json({ detail: 'book_id required' });

    const book = db.prepare('SELECT * FROM books WHERE id = ?').get(book_id);
    if (!book) return res.status(404).json({ detail: 'Book not found' });

    const chapters = db.prepare('SELECT * FROM chapters WHERE book_id = ? ORDER BY idx').all(book_id);
    const framework = db.prepare('SELECT * FROM frameworks WHERE book_id = ?').all(book_id);
    const doc = db.prepare('SELECT * FROM documents WHERE book_id = ? ORDER BY created_at DESC LIMIT 1').get(book_id);
    const annotations = db.prepare('SELECT * FROM annotations WHERE book_id = ?').all(book_id);

    const safeTitle = (book.title || 'book').replace(/[^\w]/g, '_').substring(0, 50);

    if (format === 'markdown') {
      let md = `# ${book.title}\n\n`;
      for (const ch of chapters) {
        md += `## ${ch.title}\n\n${ch.content || ''}\n\n`;
        try {
          const dc = JSON.parse(ch.distilled_content || '{}');
          for (const depth of ['shallow', 'medium', 'deep']) {
            const pts = dc[depth] || [];
            if (pts.length > 0) {
              md += `### ${depth === 'shallow' ? '浅层' : depth === 'medium' ? '中层' : '深层'}蒸馏\n\n`;
              for (const p of pts) {
                md += `- **${p.title || ''}**\n  ${p.summary || ''}\n`;
                if (p.evidence) md += `  > ${p.evidence}\n`;
                md += '\n';
              }
            }
          }
        } catch {}
      }
      if (doc && doc.content) {
        md += `\n---\n\n# 全书综合文档\n\n${doc.content}\n`;
      }
      if (annotations.length > 0) {
        md += `\n---\n\n# 批注\n\n`;
        for (const a of annotations) {
          md += `- [${a.type || 'note'}] ${a.content || ''}\n`;
        }
      }
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${safeTitle}.md"`);
      return res.send(md);
    }

    if (format === 'html') {
      let body = `<h1>${book.title}</h1>\n`;
      for (const ch of chapters) {
        body += `<h2>${ch.title}</h2>\n<div>${(ch.content || '').replace(/\n/g, '<br>')}</div>\n`;
        try {
          const dc = JSON.parse(ch.distilled_content || '{}');
          for (const depth of ['shallow', 'medium', 'deep']) {
            const pts = dc[depth] || [];
            if (pts.length > 0) {
              body += `<h3>${depth === 'shallow' ? '浅层蒸馏' : depth === 'medium' ? '中层蒸馏' : '深层蒸馏'}</h3>\n<ul>\n`;
              for (const p of pts) {
                body += `<li><strong>${p.title || ''}</strong> - ${p.summary || ''}</li>\n`;
              }
              body += '</ul>\n';
            }
          }
        } catch {}
      }
      if (doc && doc.content) {
        body += `<hr><h1>全书综合文档</h1>\n<div>${doc.content.replace(/\n/g, '<br>')}</div>\n`;
      }
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${book.title}</title><style>body{font-family:sans-serif;max-width:800px;margin:0 auto;padding:20px;line-height:1.8}h1{border-bottom:2px solid #3B82F6;padding-bottom:8px}h2{color:#1e40af}h3{color:#374151}blockquote{border-left:3px solid #3B82F6;padding-left:12px;color:#666}</style></head><body>${body}</body></html>`;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${safeTitle}.html"`);
      return res.send(html);
    }

    if (format === 'pdf') {
      const PDFDocument = require('pdfkit');
      const chunks = [];
      const pdfDoc = new PDFDocument({ margin: 50, bufferPages: true });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${safeTitle}.pdf"`);
      pdfDoc.pipe(res);

      pdfDoc.fontSize(24).text(book.title, { align: 'center' });
      pdfDoc.moveDown(2);

      for (const ch of chapters) {
        pdfDoc.fontSize(16).text(ch.title);
        pdfDoc.moveDown(0.5);
        pdfDoc.fontSize(11).text(ch.content || '', { lineGap: 4 });
        pdfDoc.moveDown(1);

        try {
          const dc = JSON.parse(ch.distilled_content || '{}');
          for (const depth of ['shallow', 'medium', 'deep']) {
            const pts = dc[depth] || [];
            if (pts.length > 0) {
              pdfDoc.fontSize(13).text(depth === 'shallow' ? '浅层蒸馏' : depth === 'medium' ? '中层蒸馏' : '深层蒸馏');
              pdfDoc.moveDown(0.3);
              for (const p of pts) {
                pdfDoc.fontSize(11).text(`• ${p.title || ''}`);
                pdfDoc.fontSize(10).text(`  ${p.summary || ''}`);
                pdfDoc.moveDown(0.2);
              }
              pdfDoc.moveDown(0.5);
            }
          }
        } catch {}

        pdfDoc.addPage();
      }

      if (doc && doc.content) {
        pdfDoc.fontSize(16).text('全书综合文档');
        pdfDoc.moveDown(0.5);
        pdfDoc.fontSize(11).text(doc.content, { lineGap: 4 });
      }

      pdfDoc.end();
      return;
    }

    const jsonData = {
      book,
      chapters: chapters.map(ch => {
        let distilled = {};
        try { distilled = JSON.parse(ch.distilled_content || '{}'); } catch {}
        return { ...ch, distilled_content: distilled };
      }),
      frameworks: framework,
      document: doc ? doc.content : null,
      annotations,
    };
    res.json(jsonData);

  } catch (e) {
    res.status(500).json({ detail: e.message });
  }
});

app.get(`${API}/get-book`, (req, res) => {
  const { book_id } = req.query;
  if (!book_id) return res.status(400).json({ detail: 'book_id is required' });
  const book = db.prepare('SELECT * FROM books WHERE id = ?').get(book_id);
  if (!book) return res.status(404).json({ detail: 'Book not found' });
  const total = db.prepare('SELECT COUNT(*) as c FROM chapters WHERE book_id = ?').get(book_id);
  const distilled = db.prepare("SELECT COUNT(*) as c FROM chapters WHERE book_id = ? AND distilled_content IS NOT NULL AND distilled_content != '{}'").get(book_id);
  let distilledPoints = 0;
  const chs = db.prepare('SELECT distilled_content FROM chapters WHERE book_id = ?').all(book_id);
  for (const ch of chs) {
    try { const d = JSON.parse(ch.distilled_content || '{}'); distilledPoints += (d.shallow?.length || 0) + (d.medium?.length || 0) + (d.deep?.length || 0); } catch {}
  }
  const framework = db.prepare('SELECT framework_tree FROM frameworks WHERE book_id = ?').get(book_id);
  const document = db.prepare('SELECT id, title, created_at FROM documents WHERE book_id = ? ORDER BY created_at DESC LIMIT 1').get(book_id);
  res.json({
    ...book,
    stats: {
      total_chapters: total?.c || 0,
      distilled_chapters: distilled?.c || 0,
      distilled_points: distilledPoints,
      has_framework: !!framework,
      has_document: !!document,
    },
  });
});

app.get(`${API}/get-chat-history`, (req, res) => {
  const { book_id } = req.query;
  const limit = parseInt(req.query.limit) || 50;
  if (!book_id) return res.json([]);
  try {
    let session = db.prepare('SELECT id FROM chat_sessions WHERE book_id = ? ORDER BY updated_at DESC LIMIT 1').get(book_id);
    if (!session) {
      const sid = uuidv4();
      const now = new Date().toISOString();
      db.prepare('INSERT INTO chat_sessions (id, book_id, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?)').run(sid, book_id, '默认对话', now, now);
      session = { id: sid };
    }
    const messages = db.prepare('SELECT * FROM chat_messages WHERE session_id = ? ORDER BY created_at ASC LIMIT ?').all(session.id, limit);
    res.json(messages.map(m => ({ id: m.id, role: m.role, content: m.content, timestamp: m.created_at })));
  } catch {
    res.json([]);
  }
});

app.post(`${API}/save-chat-message`, (req, res) => {
  const { book_id, role, content } = req.body;
  if (!book_id || !content) return res.status(400).json({ detail: 'book_id and content are required' });
  try {
    let session = db.prepare('SELECT id FROM chat_sessions WHERE book_id = ? ORDER BY updated_at DESC LIMIT 1').get(book_id);
    if (!session) {
      const sid = uuidv4();
      const now = new Date().toISOString();
      db.prepare('INSERT INTO chat_sessions (id, book_id, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?)').run(sid, book_id, '默认对话', now, now);
      session = { id: sid };
    }
    const now = new Date().toISOString();
    db.prepare('INSERT INTO chat_messages (id, session_id, book_id, role, content, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(uuidv4(), session.id, book_id, role || 'user', content, now);
    db.prepare('UPDATE chat_sessions SET updated_at = ? WHERE id = ?').run(now, session.id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ detail: e.message });
  }
});

app.get(`${API}/list-generated`, (req, res) => {
  const { book_id } = req.query;
  if (!book_id) return res.json([]);
  
  const chapters = db.prepare('SELECT id, book_id, idx, title, distilled_content FROM chapters WHERE book_id = ? ORDER BY idx').all(book_id);
  const docs = [];
  
  for (const ch of chapters) {
    let d = {};
    try { d = JSON.parse(ch.distilled_content || '{}'); } catch {}
    const deepPoints = d.deep || [];
    if (deepPoints.length > 0) {
      docs.push({
        id: ch.id,
        bookId: ch.book_id,
        chapterIdx: ch.idx,
        title: ch.title,
        depth: 'deep',
        pointsCount: deepPoints.length,
        points: deepPoints,
      });
    }
  }
  
  const bookDocs = db.prepare('SELECT id, book_id, title, content, custom_prompt, created_at FROM documents WHERE book_id = ? ORDER BY created_at DESC').all(book_id);
  for (const doc of bookDocs) {
    docs.push({
      id: doc.id,
      bookId: doc.book_id,
      title: doc.title,
      type: 'generated',
      content: doc.content,
      customPrompt: doc.custom_prompt,
      createdAt: doc.created_at,
    });
  }
  
  res.json(docs);
});

app.get(`${API}/get-generated`, (req, res) => {
  const { doc_id } = req.query;
  if (!doc_id) return res.status(400).json({ detail: 'doc_id is required' });
  
  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(doc_id);
  if (doc) {
    return res.json({
      id: doc.id,
      bookId: doc.book_id,
      title: doc.title,
      content: doc.content,
      customPrompt: doc.custom_prompt,
      createdAt: doc.created_at,
    });
  }
  
  const ch = db.prepare('SELECT * FROM chapters WHERE id = ?').get(doc_id);
  if (ch) {
    let d = {};
    try { d = JSON.parse(ch.distilled_content || '{}'); } catch {}
    return res.json({
      id: ch.id,
      bookId: ch.book_id,
      title: ch.title,
      depth: 'deep',
      points: d.deep || [],
      allDistilled: d,
    });
  }
  
  res.status(404).json({ detail: 'Document not found' });
});

app.get(`${API}/global-search`, (req, res) => {
  const { q } = req.query;
  if (!q || q.trim().length === 0) return res.json({ results: [], total: 0 });
  const query = q.toLowerCase().trim();
  const results = [];

  const books = db.prepare('SELECT * FROM books').all();
  for (const book of books) {
    if (book.title.toLowerCase().includes(query)) {
      results.push({ type: 'book', book_id: book.id, title: book.title, subtitle: book.author, match_field: 'title' });
    }
  }

  const chapters = db.prepare('SELECT ch.*, b.title as book_title FROM chapters ch JOIN books b ON ch.book_id = b.id').all();
  for (const ch of chapters) {
    if (ch.title && ch.title.toLowerCase().includes(query)) {
      results.push({ type: 'chapter', book_id: ch.book_id, chapter_idx: ch.idx, title: ch.title, subtitle: ch.book_title, match_field: 'chapter_title' });
    }
    if (ch.content && ch.content.toLowerCase().includes(query)) {
      const idx = ch.content.toLowerCase().indexOf(query);
      results.push({
        type: 'chapter_content', book_id: ch.book_id, chapter_idx: ch.idx, title: ch.title, subtitle: ch.book_title,
        context: ch.content.substring(Math.max(0, idx - 60), Math.min(ch.content.length, idx + query.length + 60)),
        match_field: 'content',
      });
    }
  }

  const distilled = db.prepare("SELECT ch.*, b.title as book_title FROM chapters ch JOIN books b ON ch.book_id = b.id WHERE ch.distilled_content IS NOT NULL AND ch.distilled_content != '{}'").all();
  for (const ch of distilled) {
    let d = {};
    try { d = JSON.parse(ch.distilled_content); } catch { continue; }
    for (const depth of ['shallow', 'medium', 'deep']) {
      for (const pt of (d[depth] || [])) {
        if ((pt.summary || '').toLowerCase().includes(query) || (pt.evidence || '').toLowerCase().includes(query) || (pt.category || '').toLowerCase().includes(query)) {
          results.push({
            type: 'distilled', book_id: ch.book_id, chapter_idx: ch.idx, chapter_title: ch.title, book_title: ch.book_title,
            point: pt, depth, match_field: 'distilled_point',
          });
        }
      }
    }
  }

  res.json({ query: q, results: results.slice(0, 50), total: results.length });
});

app.get(`${API}/user/stats`, (req, res) => {
  const totalBooks = db.prepare('SELECT COUNT(*) as c FROM books').get()?.c || 0;
  const distilledBooks = db.prepare("SELECT COUNT(*) as c FROM books WHERE status = 'completed'").get()?.c || 0;
  const totalChapters = db.prepare('SELECT SUM(total_chapters) as c FROM books').get()?.c || 0;
  const totalPoints = db.prepare("SELECT SUM(distilled_points) as c FROM books").get()?.c || 0;
  
  let totalPointsFromChapters = 0;
  const allChapters = db.prepare("SELECT distilled_content FROM chapters WHERE distilled_content IS NOT NULL AND distilled_content != '{}'").all();
  for (const ch of allChapters) {
    try { const d = JSON.parse(ch.distilled_content); totalPointsFromChapters += (d.shallow?.length || 0) + (d.medium?.length || 0) + (d.deep?.length || 0); } catch {}
  }

  let studyDays = 0;
  let streak = 0;
  try {
    const checkins = db.prepare('SELECT DISTINCT date(created_at) as d FROM checkins ORDER BY d DESC').all();
    studyDays = checkins.length;
    const today = new Date().toISOString().split('T')[0];
    let checkDate = new Date(today);
    for (const c of checkins) {
      const cDate = c.d.split('T')[0];
      if (cDate === checkDate.toISOString().split('T')[0]) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else break;
    }
  } catch {}

  let checkinDates = [];
  try {
    checkinDates = db.prepare("SELECT DISTINCT date(created_at) as d FROM checkins ORDER BY d DESC LIMIT 30").all().map(r => r.d.split('T')[0]);
  } catch {}

  res.json({
    total_books: totalBooks,
    distilled_books: distilledBooks,
    total_chapters: totalChapters,
    total_points: totalPoints || totalPointsFromChapters,
    study_days: studyDays,
    streak,
    checkin_dates: checkinDates,
  });
});

app.post(`${API}/checkin`, (req, res) => {
  const now = new Date().toISOString();
  const today = now.split('T')[0];
  const existing = db.prepare("SELECT id FROM checkins WHERE user_id = 'default' AND date(created_at) = ?").get(today);
  if (existing) return res.json({ success: true, message: '今日已签到' });
  const id = uuidv4();
  db.prepare('INSERT INTO checkins (id, user_id, created_at) VALUES (?, ?, ?)').run(id, 'default', now);
  res.json({ success: true, message: '签到成功' });
});

app.get(`${API}/progress-eta`, (req, res) => {
  const { book_id } = req.query;
  const book = db.prepare('SELECT * FROM books WHERE id = ?').get(book_id);
  if (!book) return res.status(404).json({ detail: 'Book not found' });
  
  const totalChapters = db.prepare('SELECT COUNT(*) as c FROM chapters WHERE book_id = ?').get(book_id)?.c || 0;
  const distilledChapters = db.prepare("SELECT COUNT(*) as c FROM chapters WHERE book_id = ? AND length(distilled_content) > 10").get(book_id)?.c || 0;
  const progress = totalChapters > 0 ? Math.round((distilledChapters / totalChapters) * 100) : 0;
  const remaining = totalChapters - distilledChapters;
  const avgTimePerChapter = 30;
  const etaSeconds = remaining * avgTimePerChapter;
  
  res.json({
    phase: book.status,
    progress,
    total_chapters: totalChapters,
    distilled_chapters: distilledChapters,
    remaining,
    eta_seconds: etaSeconds,
    eta_display: etaSeconds > 3600 ? `${Math.round(etaSeconds/3600)}h` : etaSeconds > 60 ? `${Math.round(etaSeconds/60)}m` : `${etaSeconds}s`,
  });
});

app.get(`${API}/book-structure`, (req, res) => {
  const { book_id } = req.query;
  if (!book_id) return res.status(400).json({ detail: 'book_id required' });
  
  const book = db.prepare('SELECT * FROM books WHERE id = ?').get(book_id);
  if (!book) return res.status(404).json({ detail: 'Book not found' });
  
  const chapters = db.prepare('SELECT id, book_id, idx, title, distilled_content FROM chapters WHERE book_id = ? ORDER BY idx').all(book_id);
  
  const hasVolumes = chapters.some(ch => {
    try {
      const d = JSON.parse(ch.distilled_content || '{}');
      return d.volume;
    } catch { return false; }
  });

  if (hasVolumes) {
    const volumeMap = new Map();
    for (const ch of chapters) {
      let volume = '未分卷';
      try {
        const d = JSON.parse(ch.distilled_content || '{}');
        volume = d.volume || '未分卷';
      } catch {}
      if (!volumeMap.has(volume)) volumeMap.set(volume, []);
      volumeMap.get(volume).push({
        id: ch.id,
        idx: ch.idx,
        title: ch.title,
        hasDistilled: ch.distilled_content && ch.distilled_content.length > 10,
      });
    }
    const tree = [];
    for (const [volume, chs] of volumeMap) {
      tree.push({ id: `vol-${volume}`, label: volume, type: 'volume', children: chs.map(ch => ({
        id: ch.id, label: ch.title, type: 'chapter', hasDistilled: ch.hasDistilled,
      }))});
    }
    res.json({ hasVolumes: true, tree });
  } else {
    const tree = chapters.map(ch => ({
      id: ch.id, label: ch.title, type: 'chapter', idx: ch.idx,
      hasDistilled: ch.distilled_content && ch.distilled_content.length > 10,
    }));
    res.json({ hasVolumes: false, tree });
  }
});

app.get(`${API}/book-folder`, (req, res) => {
  const { book_id } = req.query;
  if (!book_id) return res.status(400).json({ detail: 'book_id required' });
  
  const book = db.prepare('SELECT * FROM books WHERE id = ?').get(book_id);
  if (!book) return res.status(404).json({ detail: 'Book not found' });
  
  const chapters = db.prepare('SELECT id, book_id, idx, title, content, distilled_content FROM chapters WHERE book_id = ? ORDER BY idx').all(book_id);
  
  const folder = {
    id: book_id,
    name: book.title,
    type: 'folder',
    children: chapters.map(ch => ({
      id: ch.id,
      name: ch.title,
      type: 'file',
      idx: ch.idx,
      size: ch.content ? ch.content.length : 0,
      hasDistilled: ch.distilled_content && ch.distilled_content.length > 10,
      preview: ch.content ? ch.content.substring(0, 100).trim() : '',
    })),
  };
  
  res.json(folder);
});

app.get(`${API}/book-documents`, (req, res) => {
  const { book_id } = req.query;
  if (!book_id) return res.status(400).json({ detail: 'book_id required' });
  const docs = db.prepare('SELECT id, title, content, created_at, custom_prompt FROM documents WHERE book_id = ? ORDER BY created_at DESC').all(book_id);
  res.json({ documents: docs });
});

app.post(`${API}/update-chapter-title`, (req, res) => {
  const { book_id, chapter_idx, title } = req.body;
  if (!book_id || chapter_idx == null || !title) return res.status(400).json({ detail: 'Missing params' });
  db.prepare('UPDATE chapters SET title = ? WHERE book_id = ? AND idx = ?').run(title, book_id, chapter_idx);
  res.json({ success: true });
});

app.post(`${API}/delete-chapter`, (req, res) => {
  const { book_id, chapter_idx } = req.body;
  if (!book_id || chapter_idx == null) return res.status(400).json({ detail: 'Missing params' });
  db.prepare('DELETE FROM chapters WHERE book_id = ? AND idx = ?').run(book_id, chapter_idx);
  const remaining = db.prepare('SELECT id, idx FROM chapters WHERE book_id = ? ORDER BY idx').all(book_id);
  remaining.forEach((ch, i) => {
    if (ch.idx !== i) db.prepare('UPDATE chapters SET idx = ? WHERE id = ?').run(i, ch.id);
  });
  res.json({ success: true });
});

app.post(`${API}/auto-clean-chapters`, async (req, res) => {
  const { book_id } = req.body;
  if (!book_id) return res.status(400).json({ detail: 'book_id required' });
  const chapters = db.prepare('SELECT * FROM chapters WHERE book_id = ? ORDER BY idx').all(book_id);
  const cleaned = chapters.filter(ch => {
    const content = (ch.content || '').replace(/[\s\u3000]+/g, '');
    if (content.length < 30) return false;
    const title = (ch.title || '').trim();
    if (title.startsWith('##') || title.startsWith('###')) return false;
    if (/^\d+\.\s*(Mr\.|Ms\.|Dr\.|译者注|参考)/.test(title)) return false;
    if (/^(目录|前言|序言|附录|参考文献|致谢|版权页)/.test(title)) return false;
    return true;
  });
  cleaned.forEach((ch, i) => {
    if (ch.idx !== i) {
      db.prepare('UPDATE chapters SET idx = ? WHERE id = ?').run(i, ch.id);
    }
  });
  res.json({
    chapters: cleaned.map(ch => ({
      id: ch.id,
      idx: ch.idx,
      title: ch.title,
      content: ch.content,
      status: ch.distilled_content ? 'done' : 'pending',
    })),
  });
});

app.post(`${API}/split-as-volumes`, (req, res) => {
  const { book_id } = req.body;
  if (!book_id) return res.status(400).json({ detail: 'book_id required' });
  
  const book = db.prepare('SELECT * FROM books WHERE id = ?').get(book_id);
  if (!book) return res.status(404).json({ detail: 'Book not found' });
  
  const allContent = db.prepare('SELECT content FROM chapters WHERE book_id = ? ORDER BY idx').all(book_id)
    .map(c => c.content).join('\n\n');
  
  const result = parseChaptersWithVolumes(allContent);
  
  if (!result.hasVolumes) {
    return res.json({ hasVolumes: false, message: '本书未检测到卷/篇/部结构，已保持原有章节划分' });
  }
  
  db.prepare('DELETE FROM chapters WHERE book_id = ?').run(book_id);
  
  const ins = db.prepare('INSERT INTO chapters (id, book_id, idx, title, content, distilled_content) VALUES (?,?,?,?,?,?)');
  for (const ch of result.chapters) {
    ins.run(uuidv4(), book_id, ch.idx, ch.title, ch.content, JSON.stringify({ volume: ch.volume }));
  }
  
  res.json({ hasVolumes: true, volumes: result.volumes, chapters: result.chapters.length });
});

app.get(`${API}/community/resources`, (req, res) => {
  const { category, sort, search, page = 1, limit = 20 } = req.query;
  let query = 'SELECT cr.*, u.username as author_name FROM community_resources cr LEFT JOIN users u ON cr.user_id = u.id WHERE cr.is_published = 1';
  const params = [];
  
  if (category && category !== 'all') {
    query += " AND cr.categories LIKE ?";
    params.push('%"' + category + '"%');
  }
  if (search) {
    query += " AND (cr.title LIKE ? OR cr.description LIKE ?)";
    params.push('%' + search + '%', '%' + search + '%');
  }
  
  if (sort === 'popular') {
    query += ' ORDER BY cr.likes DESC, cr.views DESC';
  } else {
    query += ' ORDER BY cr.created_at DESC';
  }
  
  const offset = (parseInt(page) - 1) * parseInt(limit);
  query += ` LIMIT ? OFFSET ?`;
  params.push(parseInt(limit), offset);
  
  const resources = db.prepare(query).all(...params);
  
  const countQuery = 'SELECT COUNT(*) as total FROM community_resources WHERE is_published = 1';
  const total = db.prepare(countQuery).get().total;
  
  res.json({ items: resources, total, page: parseInt(page), limit: parseInt(limit) });
});

app.get(`${API}/community/resources/:id`, (req, res) => {
  const resource = db.prepare('SELECT cr.*, u.username as author_name FROM community_resources cr LEFT JOIN users u ON cr.user_id = u.id WHERE cr.id = ?').get(req.params.id);
  if (!resource) return res.status(404).json({ detail: 'Resource not found' });
  
  db.prepare('UPDATE community_resources SET views = views + 1 WHERE id = ?').run(req.params.id);
  
  const comments = db.prepare('SELECT cc.*, u.username as author_name FROM community_comments cc LEFT JOIN users u ON cc.user_id = u.id WHERE cc.resource_id = ? ORDER BY cc.created_at ASC').all(req.params.id);
  
  res.json({ ...resource, comments, views: resource.views + 1 });
});

app.post(`${API}/community/resources`, (req, res) => {
  const { title, description, book_id, categories, content, cover_color } = req.body;
  if (!title) return res.status(400).json({ detail: '标题必填' });
  
  const authHeader = req.headers.authorization;
  let userId = 'anonymous';
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const jwt = require('jsonwebtoken');
      const JWT_SECRET = process.env.JWT_SECRET || 'knowscape-secret-key-2024';
      const decoded = jwt.verify(authHeader.split(' ')[1], JWT_SECRET);
      userId = decoded.userId;
      if (checkDailyTask(userId, 'publish', 3)) {
        addPoints(userId, 5, 'task', '发布资源');
      }
    } catch {}
  }
  
  const id = uuidv4();
  db.prepare('INSERT INTO community_resources (id, user_id, book_id, title, description, categories, content, cover_color) VALUES (?,?,?,?,?,?,?,?)').run(id, userId, book_id || null, title, description || '', JSON.stringify(categories || []), content || '', cover_color || '#3B82F6');
  
  const resource = db.prepare('SELECT cr.*, u.username as author_name FROM community_resources cr LEFT JOIN users u ON cr.user_id = u.id WHERE cr.id = ?').get(id);
  res.json(resource);
});

app.delete(`${API}/community/resources/:id`, (req, res) => {
  db.prepare('DELETE FROM community_resources WHERE id = ?').run(req.params.id);
  db.prepare('DELETE FROM community_comments WHERE resource_id = ?').run(req.params.id);
  db.prepare('DELETE FROM community_likes WHERE resource_id = ?').run(req.params.id);
  res.json({ success: true });
});

app.post(`${API}/community/resources/:id/like`, (req, res) => {
  const authHeader = req.headers.authorization;
  let userId = 'anonymous';
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const jwt = require('jsonwebtoken');
      const JWT_SECRET = process.env.JWT_SECRET || 'knowscape-secret-key-2024';
      const decoded = jwt.verify(authHeader.split(' ')[1], JWT_SECRET);
      userId = decoded.userId;
    } catch {}
  }
  
  const existing = db.prepare('SELECT id FROM community_likes WHERE user_id = ? AND resource_id = ?').get(userId, req.params.id);
  if (existing) {
    db.prepare('DELETE FROM community_likes WHERE id = ?').run(existing.id);
    db.prepare('UPDATE community_resources SET likes = likes - 1 WHERE id = ?').run(req.params.id);
    res.json({ liked: false });
  } else {
    db.prepare('INSERT INTO community_likes (id, user_id, resource_id) VALUES (?, ?, ?)').run(uuidv4(), userId, req.params.id);
    db.prepare('UPDATE community_resources SET likes = likes + 1 WHERE id = ?').run(req.params.id);
    if (userId !== 'anonymous' && checkDailyTask(userId, 'like', 10)) {
      addPoints(userId, 1, 'task', '点赞资源');
    }
    res.json({ liked: true });
  }
});

app.get(`${API}/community/resources/:id/comments`, (req, res) => {
  const comments = db.prepare('SELECT cc.*, u.username as author_name FROM community_comments cc LEFT JOIN users u ON cc.user_id = u.id WHERE cc.resource_id = ? ORDER BY cc.created_at ASC').all(req.params.id);
  res.json(comments);
});

app.post(`${API}/community/resources/:id/comments`, (req, res) => {
  const { content, parent_id } = req.body;
  if (!content) return res.status(400).json({ detail: '内容必填' });
  
  const authHeader = req.headers.authorization;
  let userId = 'anonymous';
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const jwt = require('jsonwebtoken');
      const JWT_SECRET = process.env.JWT_SECRET || 'knowscape-secret-key-2024';
      const decoded = jwt.verify(authHeader.split(' ')[1], JWT_SECRET);
      userId = decoded.userId;
      if (checkDailyTask(userId, 'comment', 5)) {
        addPoints(userId, 2, 'task', '发布评论');
      }
    } catch {}
  }
  
  const id = uuidv4();
  db.prepare('INSERT INTO community_comments (id, user_id, resource_id, content, parent_id) VALUES (?,?,?,?,?)').run(id, userId, req.params.id, content, parent_id || null);
  db.prepare('UPDATE community_resources SET comments_count = comments_count + 1 WHERE id = ?').run(req.params.id);
  
  const comment = db.prepare('SELECT cc.*, u.username as author_name FROM community_comments cc LEFT JOIN users u ON cc.user_id = u.id WHERE cc.id = ?').get(id);
  res.json(comment);
});

app.get(`${API}/community/co-reading`, (req, res) => {
  const items = db.prepare('SELECT * FROM co_reading WHERE status = ? ORDER BY created_at DESC').all('active');
  res.json(items);
});

app.post(`${API}/community/co-reading`, (req, res) => {
  const { book_id, title, description, cover_color, end_date } = req.body;
  if (!title) return res.status(400).json({ detail: '标题必填' });
  
  const authHeader = req.headers.authorization;
  let userId = 'anonymous';
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const jwt = require('jsonwebtoken');
      const JWT_SECRET = process.env.JWT_SECRET || 'knowscape-secret-key-2024';
      const decoded = jwt.verify(authHeader.split(' ')[1], JWT_SECRET);
      userId = decoded.userId;
    } catch {}
  }
  
  const id = uuidv4();
  db.prepare('INSERT INTO co_reading (id, book_id, title, description, cover_color, start_date, end_date) VALUES (?,?,?,?,?,?,?)').run(id, book_id || null, title, description || '', cover_color || '#10B981', new Date().toISOString().split('T')[0], end_date || null);
  db.prepare('INSERT INTO co_reading_members (id, co_reading_id, user_id, role) VALUES (?,?,?,?)').run(uuidv4(), id, userId, 'creator');
  
  const item = db.prepare('SELECT * FROM co_reading WHERE id = ?').get(id);
  res.json(item);
});

app.post(`${API}/community/co-reading/:id/join`, (req, res) => {
  const authHeader = req.headers.authorization;
  let userId = 'anonymous';
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const jwt = require('jsonwebtoken');
      const JWT_SECRET = process.env.JWT_SECRET || 'knowscape-secret-key-2024';
      const decoded = jwt.verify(authHeader.split(' ')[1], JWT_SECRET);
      userId = decoded.userId;
    } catch {}
  }
  
  const existing = db.prepare('SELECT id FROM co_reading_members WHERE co_reading_id = ? AND user_id = ?').get(req.params.id, userId);
  if (existing) return res.status(400).json({ detail: '已加入' });
  
  db.prepare('INSERT INTO co_reading_members (id, co_reading_id, user_id) VALUES (?,?,?)').run(uuidv4(), req.params.id, userId);
  db.prepare('UPDATE co_reading SET current_participants = current_participants + 1 WHERE id = ?').run(req.params.id);
  
  res.json({ success: true });
});

app.get(`${API}/community/stats`, (req, res) => {
  const resourceCount = db.prepare('SELECT COUNT(*) as c FROM community_resources WHERE is_published = 1').get().c;
  const coReadingCount = db.prepare("SELECT COUNT(*) as c FROM co_reading WHERE status = 'active'").get().c;
  const userCount = db.prepare('SELECT COUNT(DISTINCT user_id) as c FROM community_resources').get().c;
  res.json({ resources: resourceCount, users: userCount, co_reading: coReadingCount });
});

app.post(`${API}/folder-auto-add`, (req, res) => {
  const { book_id, prompt } = req.body;
  if (!book_id || !prompt) return res.status(400).json({ detail: 'book_id and prompt required' });
  
  const book = db.prepare('SELECT * FROM books WHERE id = ?').get(book_id);
  if (!book) return res.status(404).json({ detail: 'Book not found' });
  
  const chapters = db.prepare('SELECT id, idx, title, content FROM chapters WHERE book_id = ? ORDER BY idx').all(book_id);
  
  const context = chapters.slice(0, 5).map(c => c.title + ': ' + (c.content || '').substring(0, 200)).join('\n\n');
  
  const API_KEY = process.env.DEEPSEEK_API_KEY || process.env.QWEN_API_KEY || process.env.OPENROUTER_API_KEY || '';
  const API_BASE = process.env.LLM_API_BASE || process.env.DEEPSEEK_API_BASE || 'https://api.deepseek.com/v1';
  const MODEL = process.env.LLM_MODEL || 'deepseek-chat';
  
  if (!API_KEY) {
    return res.json({ 
      success: false, 
      message: 'LLM API 未配置，请在设置中配置 API Key',
      suggestions: chapters.slice(0, 10).map(c => ({ id: c.id, idx: c.idx, title: c.title }))
    });
  }
  
  const systemPrompt = `你是书籍分析助手。根据用户的需求，分析书籍结构并给出建议。
用户请求: ${prompt}
书籍: ${book.title}
章节列表: ${chapters.map(c => c.title).join(', ')}`;

  fetch(API_BASE + '/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + API_KEY },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: '请根据用户需求分析这本书，给出结构化的建议。书籍内容摘要:\n' + context }
      ],
      max_tokens: 1000,
      temperature: 0.3,
    }),
  })
    .then(r => r.json())
    .then(data => {
      const answer = data.choices?.[0]?.message?.content || 'AI 分析完成';
      res.json({ success: true, answer, suggestions: chapters.slice(0, 10).map(c => ({ id: c.id, idx: c.idx, title: c.title })) });
    })
    .catch(e => {
      res.json({ success: false, message: 'AI 分析失败: ' + e.message, suggestions: chapters.slice(0, 10).map(c => ({ id: c.id, idx: c.idx, title: c.title })) });
    });
});

const POINT_PACKAGES = [
  { id: 'pkg_trial', name: '体验包', points: 100, price: 20 },
  { id: 'pkg_light', name: '轻量包', points: 500, price: 90 },
  { id: 'pkg_pro', name: '进阶包', points: 1000, price: 160 },
  { id: 'pkg_premium', name: '尊享包', points: 3000, price: 450 },
];

app.get(`${API}/points/packages`, (req, res) => {
  res.json(POINT_PACKAGES);
});

app.post(`${API}/points/purchase`, authMiddleware, (req, res) => {
  const { package_id, custom_amount } = req.body;
  
  let points, amount;
  if (package_id) {
    const pkg = POINT_PACKAGES.find(p => p.id === package_id);
    if (!pkg) return res.status(400).json({ detail: '无效套餐' });
    points = pkg.points;
    amount = pkg.price;
  } else if (custom_amount && custom_amount >= 1) {
    amount = custom_amount;
    points = Math.floor(custom_amount * 5);
  } else {
    return res.status(400).json({ detail: '请选择套餐或输入金额' });
  }
  
  const orderId = uuidv4();
  db.prepare('INSERT INTO orders (id, user_id, type, amount, points, status) VALUES (?,?,?,?,?,?)').run(orderId, req.user.id, 'points_purchase', amount, points, 'completed');
  
  addPoints(req.user.id, points, 'purchase', '购买积分 (' + amount + '元)');
  
  const balance = db.prepare('SELECT balance FROM user_points WHERE user_id = ?').get(req.user.id);
  res.json({ success: true, order_id: orderId, points_added: points, balance: balance?.balance || 0 });
});

const SUBSCRIPTION_PLANS = {
  basic: { name: '基础', price: 29, monthly_points: 300, ebook_quota: 10, features: ['去广告', '青铜头衔'] },
  standard: { name: '标准', price: 59, monthly_points: 800, ebook_quota: 30, features: ['加速队列', '高级模型', '白银头衔'] },
  advanced: { name: '高级', price: 89, monthly_points: 1500, ebook_quota: 50, features: ['VIP队列', '高级模型', '黄金头衔', '优先客服'] },
  flagship: { name: '旗舰', price: 199, monthly_points: 3000, ebook_quota: 100, features: ['无限队列', '高级模型', '黑金头衔', '专属客服', '私有知识库', '5人团队协作'] },
};

app.get(`${API}/subscription/plans`, (req, res) => {
  res.json(SUBSCRIPTION_PLANS);
});

app.get(`${API}/subscription/status`, authMiddleware, (req, res) => {
  const sub = db.prepare('SELECT * FROM subscriptions WHERE user_id = ? AND status = ?').get(req.user.id, 'active');
  if (!sub || (sub.expire_at && new Date(sub.expire_at) < new Date())) {
    res.json({ plan: 'free', status: 'expired', benefits: SUBSCRIPTION_PLANS.basic });
    return;
  }
  const benefits = SUBSCRIPTION_PLANS[sub.plan] || SUBSCRIPTION_PLANS.basic;
  res.json({ ...sub, benefits });
});

app.post(`${API}/subscription/purchase`, authMiddleware, (req, res) => {
  const { plan, redeem_code } = req.body;
  if (!SUBSCRIPTION_PLANS[plan]) return res.status(400).json({ detail: '无效套餐' });
  
  if (redeem_code) {
    const code = db.prepare('SELECT * FROM redeem_codes WHERE code = ? AND type = ? AND is_used = 0').get(redeem_code, 'subscription');
    if (!code) return res.status(400).json({ detail: '无效兑换码' });
    if (code.plan && code.plan !== plan) return res.status(400).json({ detail: '兑换码不适用于此套餐' });
    db.prepare(`UPDATE redeem_codes SET is_used = 1, used_by = ?, used_at = datetime('now') WHERE id = ?`).run(req.user.id, code.id);
  } else {
    const pkg = SUBSCRIPTION_PLANS[plan];
    const orderId = uuidv4();
    db.prepare('INSERT INTO orders (id, user_id, type, plan, amount, points, status) VALUES (?,?,?,?,?,?,?)').run(orderId, req.user.id, 'subscription', plan, pkg.price, 0, 'completed');
  }
  
  const expireDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const existing = db.prepare('SELECT id FROM subscriptions WHERE user_id = ?').get(req.user.id);
  if (existing) {
    db.prepare('UPDATE subscriptions SET plan = ?, status = ?, monthly_points = ?, ebook_quota = ?, ebook_used = 0, expire_at = ? WHERE user_id = ?').run(plan, 'active', SUBSCRIPTION_PLANS[plan].monthly_points, SUBSCRIPTION_PLANS[plan].ebook_quota, expireDate, req.user.id);
  } else {
    db.prepare('INSERT INTO subscriptions (id, user_id, plan, status, monthly_points, ebook_quota, expire_at) VALUES (?,?,?,?,?,?,?)').run(uuidv4(), req.user.id, plan, 'active', SUBSCRIPTION_PLANS[plan].monthly_points, SUBSCRIPTION_PLANS[plan].ebook_quota, expireDate);
  }
  
  const sub = db.prepare('SELECT * FROM subscriptions WHERE user_id = ?').get(req.user.id);
  res.json({ success: true, subscription: sub, benefits: SUBSCRIPTION_PLANS[plan] });
});

app.post(`${API}/ebook/generate-code`, authMiddleware, (req, res) => {
  const sub = db.prepare('SELECT * FROM subscriptions WHERE user_id = ? AND status = ?').get(req.user.id, 'active');
  if (!sub || sub.ebook_used >= sub.ebook_quota) {
    return res.status(400).json({ detail: '电子书配额不足' });
  }
  
  const { book_name } = req.body;
  const code = 'EB-' + req.user.id.substring(0, 8) + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();
  const expireDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  
  db.prepare('INSERT INTO ebook_benefits (id, user_id, book_code, book_name, expire_at) VALUES (?,?,?,?,?)').run(uuidv4(), req.user.id, code, book_name || '', expireDate);
  db.prepare('UPDATE subscriptions SET ebook_used = ebook_used + 1 WHERE user_id = ?').run(req.user.id);
  
  res.json({ success: true, code, book_name, expire_at: expireDate, remaining: sub.ebook_quota - sub.ebook_used - 1 });
});

app.get(`${API}/ebook/codes`, authMiddleware, (req, res) => {
  const codes = db.prepare('SELECT * FROM ebook_benefits WHERE user_id = ? ORDER BY created_at DESC').all(req.user.id);
  res.json(codes);
});

app.post(`${API}/redeem/validate`, authMiddleware, (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ detail: '请输入兑换码' });
  
  const redeemCode = db.prepare('SELECT * FROM redeem_codes WHERE code = ? AND is_used = 0').get(code);
  if (!redeemCode) return res.status(400).json({ detail: '无效或已使用的兑换码' });
  
  if (redeemCode.expire_at && new Date(redeemCode.expire_at) < new Date()) {
    return res.status(400).json({ detail: '兑换码已过期' });
  }
  
  db.prepare(`UPDATE redeem_codes SET is_used = 1, used_by = ?, used_at = datetime('now') WHERE id = ?`).run(req.user.id, redeemCode.id);
  
  if (redeemCode.type === 'points') {
    addPoints(req.user.id, redeemCode.value, 'redeem', '兑换码兑换');
    const balance = db.prepare('SELECT balance FROM user_points WHERE user_id = ?').get(req.user.id);
    res.json({ success: true, type: 'points', points_added: redeemCode.value, balance: balance?.balance || 0 });
  } else if (redeemCode.type === 'subscription') {
    const plan = redeemCode.plan || 'basic';
    const expireDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const existing = db.prepare('SELECT id FROM subscriptions WHERE user_id = ?').get(req.user.id);
    if (existing) {
      db.prepare('UPDATE subscriptions SET plan = ?, status = ?, monthly_points = ?, ebook_quota = ?, expire_at = ? WHERE user_id = ?').run(plan, 'active', SUBSCRIPTION_PLANS[plan].monthly_points, SUBSCRIPTION_PLANS[plan].ebook_quota, expireDate, req.user.id);
    } else {
      db.prepare('INSERT INTO subscriptions (id, user_id, plan, status, monthly_points, ebook_quota, expire_at) VALUES (?,?,?,?,?,?,?)').run(uuidv4(), req.user.id, plan, 'active', SUBSCRIPTION_PLANS[plan].monthly_points, SUBSCRIPTION_PLANS[plan].ebook_quota, expireDate);
    }
    res.json({ success: true, type: 'subscription', plan, expire_at: expireDate });
  }
});

app.get(`${API}/admin/redeem-codes`, authMiddleware, (req, res) => {
  if (!req.user.is_admin) return res.status(403).json({ detail: '需要管理员权限' });
  const codes = db.prepare('SELECT * FROM redeem_codes ORDER BY created_at DESC LIMIT 100').all();
  res.json(codes);
});

app.post(`${API}/admin/redeem-codes/generate`, authMiddleware, (req, res) => {
  if (!req.user.is_admin) return res.status(403).json({ detail: '需要管理员权限' });
  const { type, count, value, plan } = req.body;
  const codes = [];
  for (let i = 0; i < (count || 10); i++) {
    const code = 'KS-' + type.substring(0, 2).toUpperCase() + '-' + Math.random().toString(36).substring(2, 8).toUpperCase();
    db.prepare('INSERT INTO redeem_codes (id, code, type, value, plan) VALUES (?,?,?,?,?)').run(uuidv4(), code, type || 'points', value || 100, plan || null);
    codes.push(code);
  }
  res.json({ success: true, codes });
});

app.get(`${API}/admin/users`, authMiddleware, (req, res) => {
  if (!req.user.is_admin) return res.status(403).json({ detail: '需要管理员权限' });
  const users = db.prepare('SELECT id, username, email, is_admin, created_at FROM users ORDER BY created_at DESC').all();
  res.json(users);
});

app.post(`${API}/admin/users/:id/adjust-points`, authMiddleware, (req, res) => {
  if (!req.user.is_admin) return res.status(403).json({ detail: '需要管理员权限' });
  const { amount, description } = req.body;
  if (!amount) return res.status(400).json({ detail: '积分数必填' });
  addPoints(req.params.id, amount, 'admin_adjust', description || '管理员调整');
  const balance = db.prepare('SELECT balance FROM user_points WHERE user_id = ?').get(req.params.id);
  res.json({ success: true, balance: balance?.balance || 0 });
});

app.get(`${API}/admin/orders`, authMiddleware, (req, res) => {
  if (!req.user.is_admin) return res.status(403).json({ detail: '需要管理员权限' });
  const orders = db.prepare('SELECT o.*, u.username FROM orders o LEFT JOIN users u ON o.user_id = u.id ORDER BY o.created_at DESC LIMIT 100').all();
  res.json(orders);
});

app.post(`${API}/reading/start`, authMiddleware, (req, res) => {
  const { book_id } = req.body;
  const id = uuidv4();
  db.prepare('INSERT INTO reading_sessions (id, user_id, book_id, start_time) VALUES (?,?,?,?)').run(id, req.user.id, book_id || null, new Date().toISOString());
  res.json({ session_id: id });
});

app.post(`${API}/reading/stop`, authMiddleware, (req, res) => {
  const { session_id } = req.body;
  const session = db.prepare('SELECT * FROM reading_sessions WHERE id = ? AND user_id = ?').get(session_id, req.user.id);
  if (!session) return res.status(404).json({ detail: 'Session not found' });
  
  const now = new Date();
  const start = new Date(session.start_time);
  const minutes = Math.floor((now - start) / 60000);
  
  db.prepare('UPDATE reading_sessions SET end_time = ?, duration_minutes = ? WHERE id = ?').run(now.toISOString(), minutes, session_id);
  
  if (minutes >= 10 && checkDailyTask(req.user.id, 'reading', 1)) {
    addPoints(req.user.id, 3, 'task', '阅读满10分钟');
  }
  
  res.json({ duration_minutes: minutes, points_added: minutes >= 10 ? 3 : 0 });
});

const PORT = process.env.PORT || 8000;

app.post(`${API}/auth/register`, async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !password) return res.status(400).json({ detail: '用户名和密码必填' });

    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existing) return res.status(400).json({ detail: '用户名已存在' });

    if (email) {
      const existingEmail = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
      if (existingEmail) return res.status(400).json({ detail: '邮箱已被注册' });
    }

    const bcrypt = require('bcryptjs');
    const jwt = require('jsonwebtoken');
    const JWT_SECRET = process.env.JWT_SECRET || 'knowscape-secret-key-2024';

    const userId = uuidv4();
    const passwordHash = await bcrypt.hash(password, 10);
    db.prepare('INSERT INTO users (id, username, email, password_hash) VALUES (?, ?, ?, ?)').run(userId, username, email || null, passwordHash);

    db.prepare('INSERT INTO user_points (id, user_id, balance, total_earned) VALUES (?, ?, 100, 100)').run(uuidv4(), userId);
    db.prepare("INSERT INTO point_transactions (id, user_id, amount, type, description) VALUES (?, ?, ?, ?, ?)").run(uuidv4(), userId, 100, 'bonus', '注册奖励');

    db.prepare('INSERT INTO user_membership (id, user_id, level) VALUES (?, ?, ?)').run(uuidv4(), userId, 'free');

    const token = jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
    const sessionId = uuidv4();
    db.prepare("INSERT INTO sessions (id, user_id, token, expires_at) VALUES (?, ?, ?, datetime('now', '+7 days'))").run(sessionId, userId, token);

    const user = db.prepare('SELECT id, username, email, avatar, bio, is_admin FROM users WHERE id = ?').get(userId);
    res.json({ token, user });
  } catch (e) {
    res.status(500).json({ detail: e.message });
  }
});

app.post(`${API}/auth/login`, async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ detail: '用户名和密码必填' });

    const bcrypt = require('bcryptjs');
    const jwt = require('jsonwebtoken');
    const JWT_SECRET = process.env.JWT_SECRET || 'knowscape-secret-key-2024';

    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    if (!user) return res.status(401).json({ detail: '用户名或密码错误' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ detail: '用户名或密码错误' });

    if (!user.is_active) return res.status(403).json({ detail: '账号已被禁用' });

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
    db.prepare("INSERT INTO sessions (id, user_id, token, expires_at) VALUES (?, ?, ?, datetime('now', '+7 days'))").run(uuidv4(), user.id, token);

    const { password_hash, ...safeUser } = user;
    res.json({ token, user: safeUser });
  } catch (e) {
    res.status(500).json({ detail: e.message });
  }
});

app.get(`${API}/auth/me`, authMiddleware, (req, res) => {
  const user = req.user;
  const points = db.prepare('SELECT balance, total_earned FROM user_points WHERE user_id = ?').get(user.id) || { balance: 0, total_earned: 0 };
  const membership = db.prepare('SELECT level, expire_at FROM user_membership WHERE user_id = ?').get(user.id) || { level: 'free', expire_at: null };
  const benefits = getMembershipBenefits(membership.level);
  res.json({ ...user, points, membership: { ...membership, benefits } });
});

app.post(`${API}/auth/logout`, authMiddleware, (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader.split(' ')[1];
  db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  res.json({ success: true });
});

app.get(`${API}/points/balance`, authMiddleware, (req, res) => {
  const points = db.prepare('SELECT balance, total_earned FROM user_points WHERE user_id = ?').get(req.user.id) || { balance: 0, total_earned: 0 };
  res.json(points);
});

app.post(`${API}/points/signin`, authMiddleware, (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const existing = db.prepare("SELECT id FROM point_transactions WHERE user_id = ? AND type = 'signin' AND date(created_at) = ?").get(req.user.id, today);
  if (existing) return res.status(400).json({ detail: '今日已签到' });

  addPoints(req.user.id, 5, 'signin', '每日签到 +5');

  let streak = 0;
  const checkins = db.prepare("SELECT DISTINCT date(created_at) as d FROM checkins WHERE user_id = ? ORDER BY d DESC").all(req.user.id);
  const todayDate = new Date(today);
  let checkDate = new Date(today);
  for (const c of checkins) {
    if (c.d.split('T')[0] === checkDate.toISOString().split('T')[0]) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else break;
  }

  const points = db.prepare('SELECT balance FROM user_points WHERE user_id = ?').get(req.user.id);
  res.json({ success: true, balance: points?.balance || 0, streak });
});

app.get(`${API}/points/transactions`, authMiddleware, (req, res) => {
  const txns = db.prepare('SELECT * FROM point_transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 50').all(req.user.id);
  res.json(txns);
});

app.get(`${API}/points/balance-api`, authMiddleware, (req, res) => {
  const points = db.prepare('SELECT balance, total_earned FROM user_points WHERE user_id = ?').get(req.user.id) || { balance: 0, total_earned: 0 };
  res.json(points);
});

app.get(`${API}/membership/status`, authMiddleware, (req, res) => {
  const membership = db.prepare('SELECT level, expire_at FROM user_membership WHERE user_id = ?').get(req.user.id) || { level: 'free', expire_at: null };
  const benefits = getMembershipBenefits(membership.level);
  res.json({ ...membership, benefits });
});

app.get(`${API}/membership/benefits`, (req, res) => {
  res.json({
    free: getMembershipBenefits('free'),
    silver: getMembershipBenefits('silver'),
    gold: getMembershipBenefits('gold'),
  });
});

app.post(`${API}/membership/upgrade`, authMiddleware, (req, res) => {
  const { level, points_cost } = req.body;
  if (!['silver', 'gold'].includes(level)) return res.status(400).json({ detail: '无效的会员等级' });

  const costs = { silver: 500, gold: 2000 };
  const cost = points_cost || costs[level];

  if (!consumePoints(req.user.id, cost, 'membership', `升级为${level === 'silver' ? '白银' : '黄金'}会员`)) {
    return res.status(400).json({ detail: '积分不足' });
  }

  const expireDate = level === 'silver'
    ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

  const existing = db.prepare('SELECT id FROM user_membership WHERE user_id = ?').get(req.user.id);
  if (existing) {
    db.prepare('UPDATE user_membership SET level = ?, expire_at = ? WHERE user_id = ?').run(level, expireDate, req.user.id);
  } else {
    db.prepare('INSERT INTO user_membership (id, user_id, level, expire_at) VALUES (?, ?, ?, ?)').run(uuidv4(), req.user.id, level, expireDate);
  }

  res.json({ success: true, level, expire_at: expireDate });
});

app.get(`${API}/usage/stats`, authMiddleware, (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const dailyUsed = db.prepare('SELECT used_tokens FROM daily_quota WHERE user_id = ? AND date = ?').get(req.user.id, today);
  const membership = getMembershipLevel(req.user.id);
  const benefits = getMembershipBenefits(membership);

  const monthlyUsage = db.prepare("SELECT SUM(total_tokens) as total, SUM(cost_points) as cost FROM token_usage WHERE user_id = ? AND created_at >= date('now', 'start of month')").get(req.user.id);

  res.json({
    daily_used: dailyUsed?.used_tokens || 0,
    daily_limit: benefits.tokenDaily,
    monthly_tokens: monthlyUsage?.total || 0,
    monthly_cost: monthlyUsage?.cost || 0,
    membership,
  });
});

app.get(`${API}/ai/usage-stats`, (req, res) => {
  const { period = '7d', source, model } = req.query;
  
  let dateFilter = "created_at >= datetime('now', '-7 days')";
  if (period === '30d') dateFilter = "created_at >= datetime('now', '-30 days')";
  else if (period === '24h') dateFilter = "created_at >= datetime('now', '-24 hours')";
  else if (period === 'all') dateFilter = '1=1';
  
  let whereClause = dateFilter;
  const params = [];
  if (source) { whereClause += ' AND source = ?'; params.push(source); }
  if (model) { whereClause += ' AND model = ?'; params.push(model); }

  const overview = db.prepare(`
    SELECT 
      COUNT(*) as total_calls,
      SUM(prompt_tokens) as total_input_tokens,
      SUM(completion_tokens) as total_output_tokens,
      SUM(total_tokens) as total_tokens,
      SUM(cache_hit) as cache_hits,
      ROUND(AVG(duration_ms), 0) as avg_duration_ms,
      ROUND(AVG(total_tokens), 0) as avg_tokens_per_call
    FROM token_usage WHERE ${whereClause}
  `).get(...params);

  const byModel = db.prepare(`
    SELECT 
      model,
      COUNT(*) as calls,
      SUM(prompt_tokens) as input_tokens,
      SUM(completion_tokens) as output_tokens,
      SUM(total_tokens) as total_tokens,
      SUM(cache_hit) as cache_hits,
      ROUND(AVG(duration_ms), 0) as avg_duration_ms
    FROM token_usage WHERE ${whereClause}
    GROUP BY model ORDER BY total_tokens DESC
  `).all(...params);

  const bySource = db.prepare(`
    SELECT 
      source,
      COUNT(*) as calls,
      SUM(prompt_tokens) as input_tokens,
      SUM(completion_tokens) as output_tokens,
      SUM(total_tokens) as total_tokens,
      SUM(cache_hit) as cache_hits
    FROM token_usage WHERE ${whereClause}
    GROUP BY source ORDER BY total_tokens DESC
  `).all(...params);

  const hourlyTrend = db.prepare(`
    SELECT 
      strftime('%Y-%m-%d %H:00', created_at) as hour,
      COUNT(*) as calls,
      SUM(total_tokens) as tokens
    FROM token_usage WHERE ${whereClause}
    GROUP BY hour ORDER BY hour
  `).all(...params);

  const dailyTrend = db.prepare(`
    SELECT 
      date(created_at) as day,
      COUNT(*) as calls,
      SUM(total_tokens) as tokens,
      SUM(cache_hit) as cache_hits
    FROM token_usage WHERE ${whereClause}
    GROUP BY day ORDER BY day
  `).all(...params);

  const cacheStats = db.prepare(`
    SELECT 
      cache_hit,
      COUNT(*) as calls,
      SUM(total_tokens) as tokens
    FROM token_usage WHERE ${whereClause}
    GROUP BY cache_hit
  `).all(...params);

  const totalTokens = overview?.total_tokens || 1;
  const bySourceWithPercent = bySource.map(s => ({
    ...s,
    percent: overview?.total_tokens ? ((s.total_tokens / totalTokens) * 100).toFixed(1) : 0,
  }));

  res.json({
    overview: overview || {},
    byModel: byModel || [],
    bySource: bySourceWithPercent,
    hourlyTrend: hourlyTrend || [],
    dailyTrend: dailyTrend || [],
    cacheStats: cacheStats || [],
  });
});

app.get(`${API}/ai/usage-records`, (req, res) => {
  const { page = 1, pageSize = 20, source, model, startDate, endDate } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(pageSize);
  
  let whereClause = '1=1';
  const params = [];
  if (source) { whereClause += ' AND source = ?'; params.push(source); }
  if (model) { whereClause += ' AND model = ?'; params.push(model); }
  if (startDate) { whereClause += ' AND created_at >= ?'; params.push(startDate); }
  if (endDate) { whereClause += ' AND created_at <= ?'; params.push(endDate + ' 23:59:59'); }

  const total = db.prepare(`SELECT COUNT(*) as count FROM token_usage WHERE ${whereClause}`).get(...params);
  const records = db.prepare(`SELECT * FROM token_usage WHERE ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...params, parseInt(pageSize), offset);

  res.json({ total: total?.count || 0, records: records || [] });
});

db.prepare("UPDATE books SET status = 'parsed', progress = 0 WHERE status = 'distilling'").run();

function buildMindmapTree(bookId) {
  const book = db.prepare('SELECT * FROM books WHERE id = ?').get(bookId);
  if (!book) return null;
  const chapters = db.prepare('SELECT idx, title, distilled_content FROM chapters WHERE book_id = ? ORDER BY idx').all(bookId);
  const framework = db.prepare('SELECT * FROM frameworks WHERE book_id = ?').all(bookId);

  const children = chapters.map(ch => {
    let points = { shallow: [], medium: [], deep: [] };
    try { points = JSON.parse(ch.distilled_content || '{}'); } catch {}
    const chapterChildren = [];
    if (points.shallow?.length) {
      chapterChildren.push({ name: '浅层概要', children: points.shallow.map(p => ({ name: p.title || '', summary: p.summary || '', evidence: p.evidence || '' })) });
    }
    if (points.medium?.length) {
      chapterChildren.push({ name: '中层分析', children: points.medium.map(p => ({ name: p.title || '', summary: p.summary || '', evidence: p.evidence || '' })) });
    }
    if (points.deep?.length) {
      chapterChildren.push({ name: '深层洞察', children: points.deep.map(p => ({ name: p.title || '', summary: p.summary || '', evidence: p.evidence || '' })) });
    }
    return { name: ch.title, children: chapterChildren };
  });

  return { name: book.title, author: book.author || '', children };
}

function buildKnowledgeMapFromBook(bookId) {
  const book = db.prepare('SELECT * FROM books WHERE id = ?').get(bookId);
  if (!book) return null;

  const chapters = db.prepare('SELECT idx, title, distilled_content FROM chapters WHERE book_id = ? ORDER BY idx').all(bookId);
  const nodes = [];
  const edges = [];

  const rootNode = {
    id: 'root',
    label: book.title || '全书',
    type: 'root',
    depth: 0,
    children: [],
    style: { color: '#5470c6', size: 28, icon: '📖' },
    metadata: { source: 'book' },
  };
  nodes.push(rootNode);

  for (const ch of chapters) {
    const chNodeId = 'ch_' + ch.idx;
    nodes.push({
      id: chNodeId,
      label: ch.title || `章节 ${ch.idx}`,
      type: 'chapter',
      depth: 1,
      children: [],
      style: { color: '#91cc75', size: 20, icon: '📄' },
      metadata: { source: 'framework', chapter_idx: ch.idx },
    });
    edges.push({ source: 'root', target: chNodeId, type: 'hierarchy', style: { width: 2 } });
    rootNode.children.push(chNodeId);

    try {
      const dc = JSON.parse(ch.distilled_content || '{}');
      let pointIdx = 0;
      for (const depthKey of ['shallow', 'medium', 'deep']) {
        const pts = dc[depthKey] || [];
        const catNodeId = `${chNodeId}_${depthKey}`;
        if (pts.length > 0) {
          const depthLabel = depthKey === 'shallow' ? '浅层概要' : depthKey === 'medium' ? '中层分析' : '深层洞察';
          const depthColor = depthKey === 'shallow' ? '#fac858' : depthKey === 'medium' ? '#ee6666' : '#73c0de';
          nodes.push({
            id: catNodeId,
            label: depthLabel,
            type: depthKey,
            depth: 2,
            children: [],
            style: { color: depthColor, size: 14, icon: depthKey === 'deep' ? '💎' : depthKey === 'medium' ? '🔬' : '📋' },
            metadata: { source: 'distilled', chapter_idx: ch.idx, depth: depthKey },
          });
          edges.push({ source: chNodeId, target: catNodeId, type: 'hierarchy', style: { width: 1.5 } });
          const chNode = nodes.find(n => n.id === chNodeId);
          if (chNode) chNode.children.push(catNodeId);

          for (const pt of pts) {
            const ptNodeId = `${chNodeId}_${depthKey}_${pointIdx}`;
            nodes.push({
              id: ptNodeId,
              label: pt.title || '',
              type: depthKey,
              depth: 3,
              children: [],
              style: { color: depthColor, size: 10, icon: '' },
              metadata: { source: 'distilled', chapter_idx: ch.idx, depth: depthKey, summary: pt.summary || '', evidence: pt.evidence || '' },
            });
            edges.push({ source: catNodeId, target: ptNodeId, type: 'hierarchy', style: { width: 1 } });
            const catNode = nodes.find(n => n.id === catNodeId);
            if (catNode) catNode.children.push(ptNodeId);
            pointIdx++;
          }
        }
      }
    } catch {}
  }

  return {
    nodes,
    edges,
    styles: {
      colorMap: { principle: '#2ECC71', method: '#E67E22', strategy: '#9B59B6', model: '#1ABC9C', case: '#F1C40F', shallow: '#fac858', medium: '#ee6666', deep: '#73c0de' },
      layout: 'mindmap',
    },
  };
}

function executeMapAction(mapData, action) {
  const data = JSON.parse(JSON.stringify(mapData));
  switch (action.action) {
    case 'add_node': {
      const node = {
        id: 'node_' + Date.now(),
        label: action.params.label || '新节点',
        type: action.params.type || 'custom',
        depth: 2,
        children: [],
        style: { color: '#fc8452', size: 14, icon: '✨' },
        metadata: { source: 'user' },
      };
      data.nodes.push(node);
      if (action.params.parent_id) {
        data.edges.push({ source: action.params.parent_id, target: node.id, type: 'hierarchy', style: { width: 1 } });
        const parent = data.nodes.find(n => n.id === action.params.parent_id);
        if (parent) parent.children.push(node.id);
      }
      return data;
    }
    case 'delete_node': {
      const nodeId = action.params.node_id || action.params.label;
      const nodeIdx = data.nodes.findIndex(n => n.id === nodeId || n.label === nodeId);
      if (nodeIdx >= 0) {
        const toDelete = new Set([data.nodes[nodeIdx].id]);
        let changed = true;
        while (changed) {
          changed = false;
          for (const n of data.nodes) {
            if (n.children) {
              for (const childId of n.children) {
                if (toDelete.has(childId) && !toDelete.has(n.id)) {
                  toDelete.add(n.id);
                  changed = true;
                }
              }
            }
          }
        }
        data.nodes = data.nodes.filter(n => !toDelete.has(n.id));
        data.edges = data.edges.filter(e => !toDelete.has(e.source) && !toDelete.has(e.target));
      }
      return data;
    }
    case 'update_node': {
      const nodeId = action.params.node_id || action.params.old_label;
      const node = data.nodes.find(n => n.id === nodeId || n.label === nodeId);
      if (node) {
        if (action.params.label) node.label = action.params.label;
        if (action.params.type) node.type = action.params.type;
        if (action.params.color) node.style.color = action.params.color;
        if (action.params.summary) node.metadata.summary = action.params.summary;
      }
      return data;
    }
    case 'move_node': {
      const nodeId = action.params.node_id || action.params.label;
      const node = data.nodes.find(n => n.id === nodeId || n.label === nodeId);
      if (node && action.params.new_parent_id) {
        data.edges = data.edges.filter(e => e.target !== node.id);
        data.edges.push({ source: action.params.new_parent_id, target: node.id, type: 'hierarchy', style: { width: 1 } });
        data.nodes.forEach(n => {
          if (n.children) n.children = n.children.filter(c => c !== node.id);
        });
        const newParent = data.nodes.find(n => n.id === action.params.new_parent_id);
        if (newParent) newParent.children.push(node.id);
      }
      return data;
    }
    case 'change_layout': {
      data.styles.layout = action.params.layout || 'mindmap';
      return data;
    }
    case 'change_style': {
      if (action.params.node_type && action.params.color) {
        data.nodes.filter(n => n.type === action.params.node_type).forEach(n => { n.style.color = action.params.color; });
      }
      return data;
    }
    case 'add_edge': {
      if (action.params.source && action.params.target) {
        data.edges.push({ source: action.params.source, target: action.params.target, type: action.params.edge_type || 'association', style: { width: 1, color: '#aaa' } });
      }
      return data;
    }
    default:
      return data;
  }
}

function mindmapToMarkdown(node, indent = 0) {
  const prefix = '  '.repeat(indent) + (indent > 0 ? '- ' : '# ');
  let md = prefix + node.name + '\n';
  if (node.children) {
    for (const child of node.children) {
      md += mindmapToMarkdown(child, indent + 1);
    }
  }
  return md;
}

function mindmapToOpml(node, indent = 0) {
  const attrs = node.summary ? ` _note="${(node.summary || '').replace(/"/g, '&quot;').substring(0, 200)}"` : '';
  let opml = `${'  '.repeat(indent)}<outline text="${(node.name || '').replace(/"/g, '&quot;')}"${attrs}>\n`;
  if (node.children) {
    for (const child of node.children) {
      opml += mindmapToOpml(child, indent + 1);
    }
  }
  opml += `${'  '.repeat(indent)}</outline>\n`;
  return opml;
}

function mindmapToFreemind(node) {
  let mm = '<node TEXT="' + (node.name || '').replace(/"/g, '&quot;') + '"';
  if (node.summary) mm += ' NOTE="' + (node.summary || '').replace(/"/g, '&quot;').substring(0, 500) + '"';
  mm += '>\n';
  if (node.children) {
    for (const child of node.children) {
      mm += mindmapToFreemind(child);
    }
  }
  mm += '</node>\n';
  return mm;
}

function mindmapToHtml(tree, style) {
  const echartData = JSON.stringify({
    name: tree.name,
    children: (tree.children || []).map(ch => ({
      name: ch.name,
      children: (ch.children || []).map(sub => ({
        name: sub.name,
        children: (sub.children || []).map(p => ({ name: p.name }))
      }))
    }))
  });

  let layoutConfig = '';
  if (style === 'mindmap') {
    layoutConfig = `series:[{type:'tree',data:[${echartData}],layout:'radial',symbol:'circle',symbolSize:8,label:{position:'right',fontSize:10},leaves:{label:{position:'right',fontSize:10}},emphasis:{focus:'ancestor'},expandAndCollapse:true,animationDuration:550,animationDurationUpdate:750}]`;
  } else if (style === 'timeline') {
    layoutConfig = `series:[{type:'tree',data:[${echartData}],layout:'orthogonal',orient:'vertical',symbol:'roundRect',symbolSize:[80,30],label:{position:'bottom',fontSize:10,rotate:0},leaves:{label:{position:'bottom',fontSize:10}},lineStyle:{width:2,color:'#5470c6'},emphasis:{focus:'descendant'},expandAndCollapse:true}]`;
  } else if (style === 'compact') {
    layoutConfig = `series:[{type:'tree',data:[${echartData}],layout:'orthogonal',orient:'LR',symbol:'roundRect',symbolSize:[60,20],label:{position:'right',fontSize:8},leaves:{label:{position:'right',fontSize:8}},lineStyle:{width:1,color:'#ccc'},emphasis:{focus:'ancestor'},expandAndCollapse:true}]`;
  } else {
    layoutConfig = `series:[{type:'tree',data:[${echartData}],layout:'orthogonal',orient:'LR',symbol:'circle',symbolSize:10,label:{position:'right',fontSize:11},leaves:{label:{position:'right',fontSize:11}},lineStyle:{width:2,color:'#5470c6'},emphasis:{focus:'ancestor'},expandAndCollapse:true,animationDuration:550,animationDurationUpdate:750}]`;
  }

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<title>${tree.name} - 思维导图</title>
<script src="https://cdn.jsdelivr.net/npm/echarts@5/dist/echarts.min.js"></script>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#f8fafc}#chart{width:100vw;height:100vh}.toolbar{position:fixed;top:12px;right:12px;z-index:10;display:flex;gap:6px}.toolbar button{padding:6px 12px;border-radius:6px;border:1px solid #e2e8f0;background:white;cursor:pointer;font-size:12px;box-shadow:0 1px 3px rgba(0,0,0,.1)}.toolbar button:hover{background:#f1f5f9}</style>
</head>
<body>
<div id="chart"></div>
<div class="toolbar">
  <button onclick="chart.zoomIn()">放大</button>
  <button onclick="chart.zoomOut()">缩小</button>
  <button onclick="chart.dispatchAction({type:'restore'})">重置</button>
</div>
<script>
var chart = echarts.init(document.getElementById('chart'));
chart.setOption({
  tooltip:{trigger:'item',triggerOn:'mousemove'},
  ${layoutConfig}
});
window.addEventListener('resize',function(){chart.resize()});
</script>
</body>
</html>`;
}

function mindmapToCategoryHtml(tree) {
  const categories = ['方法论', '原则', '策略', '模型', '案例', '数据', '观点'];
  const catColors = ['#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de', '#3ba272', '#fc8452'];

  const children = (tree.children || []).flatMap(ch =>
    (ch.children || []).flatMap(sub =>
      (sub.children || []).map((p, i) => ({
        name: p.name,
        category: i % categories.length,
        chapter: ch.name,
      }))
    )
  );

  const nodes = [{ name: tree.name, category: -1, symbolSize: 30 }];
  const links = [];
  const catNodes = categories.map((c, i) => ({ name: c, category: i, symbolSize: 20 }));
  catNodes.forEach(c => { nodes.push(c); links.push({ source: tree.name, target: c.name }); });
  children.forEach(c => {
    nodes.push({ name: c.name, category: c.category });
    links.push({ source: categories[c.category], target: c.name });
  });

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<title>${tree.name} - 分类图谱</title>
<script src="https://cdn.jsdelivr.net/npm/echarts@5/dist/echarts.min.js"></script>
<style>*{margin:0;padding:0}body{font-family:sans-serif;background:#f8fafc}#chart{width:100vw;height:100vh}</style>
</head>
<body>
<div id="chart"></div>
<script>
var chart = echarts.init(document.getElementById('chart'));
chart.setOption({
  tooltip:{},
  legend:{data:${JSON.stringify(categories)}},
  series:[{type:'graph',layout:'force',data:${JSON.stringify(nodes.map(n=>({...n,label:{show:true,fontSize:10}})))},
  links:${JSON.stringify(links)},categories:${JSON.stringify(categories.map((c,i)=>({name:c})))},
  roam:true,force:{repulsion:200,edgeLength:120},emphasis:{focus:'adjacency'},
  itemStyle:{borderColor:'#fff',borderWidth:2}}]
});
window.addEventListener('resize',function(){chart.resize()});
</script>
</body>
</html>`;
}

app.get(`${API}/mindmap/export`, (req, res) => {
  try {
    const { book_id, format = 'json', style = 'tree' } = req.query;
    if (!book_id) return res.status(400).json({ detail: 'book_id required' });

    const tree = buildMindmapTree(book_id);
    if (!tree) return res.status(404).json({ detail: 'Book not found' });

    const safeTitle = (tree.name || 'mindmap').replace(/[^\w]/g, '_').substring(0, 50);

    switch (format) {
      case 'json': {
        if (style === 'classification') {
          const classified = { name: tree.name, categories: {} };
          for (const ch of (tree.children || [])) {
            for (const level of (ch.children || [])) {
              for (const pt of (level.children || [])) {
                const cat = level.name || '其他';
                if (!classified.categories[cat]) classified.categories[cat] = [];
                classified.categories[cat].push({ chapter: ch.name, ...pt });
              }
            }
          }
          return res.json(classified);
        }
        return res.json(tree);
      }
      case 'markdown': {
        const md = mindmapToMarkdown(tree);
        res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${safeTitle}.md"`);
        return res.send(md);
      }
      case 'html': {
        const html = style === 'classification' ? mindmapToCategoryHtml(tree) : mindmapToHtml(tree, style);
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${safeTitle}.html"`);
        return res.send(html);
      }
      case 'svg': {
        const svgHtml = mindmapToHtml(tree, style);
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Content-Disposition', `inline; filename="${safeTitle}_svg.html"`);
        return res.send(svgHtml);
      }
      case 'png': {
        const pngHtml = mindmapToHtml(tree, style);
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Content-Disposition', `inline; filename="${safeTitle}_png.html"`);
        return res.send(pngHtml);
      }
      case 'opml': {
        let opml = `<?xml version="1.0" encoding="UTF-8"?>\n<opml version="2.0">\n<head><title>${tree.name}</title></head>\n<body>\n`;
        opml += mindmapToOpml(tree);
        opml += `</body>\n</opml>`;
        res.setHeader('Content-Type', 'text/xml; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${safeTitle}.opml"`);
        return res.send(opml);
      }
      case 'freemind': {
        let mm = `<?xml version="1.0" encoding="UTF-8"?>\n<map version="1.0.1">\n`;
        mm += mindmapToFreemind(tree);
        mm += `</map>`;
        res.setHeader('Content-Type', 'application/xml; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${safeTitle}.mm"`);
        return res.send(mm);
      }
      default:
        return res.status(400).json({ detail: 'Unsupported format' });
    }
  } catch (e) {
    res.status(500).json({ detail: e.message });
  }
});

app.get(`${API}/mindmaps`, (req, res) => {
  const { book_id } = req.query;
  let maps;
  if (book_id) {
    maps = db.prepare('SELECT id, book_id, title, style, created_at, updated_at FROM mindmaps WHERE book_id = ? ORDER BY updated_at DESC').all(book_id);
  } else {
    maps = db.prepare('SELECT id, book_id, title, style, created_at, updated_at FROM mindmaps ORDER BY updated_at DESC LIMIT 50').all();
  }
  res.json(maps);
});

app.get(`${API}/mindmaps/:id`, (req, res) => {
  const map = db.prepare('SELECT * FROM mindmaps WHERE id = ?').get(req.params.id);
  if (!map) return res.status(404).json({ detail: 'Mindmap not found' });
  res.json(map);
});

app.post(`${API}/mindmaps`, (req, res) => {
  const { book_id, title, content, style } = req.body;
  if (!content) return res.status(400).json({ detail: 'content required' });
  const id = uuidv4();
  db.prepare('INSERT INTO mindmaps (id, book_id, title, content, style) VALUES (?,?,?,?,?)').run(id, book_id || null, title || '思维导图', JSON.stringify(content), style || 'tree');
  const map = db.prepare('SELECT * FROM mindmaps WHERE id = ?').get(id);
  let parsed = content;
  try { parsed = JSON.parse(map.content); } catch {}
  res.json({ ...map, content: parsed });
});

app.put(`${API}/mindmaps/:id`, (req, res) => {
  const { title, content, style } = req.body;
  const existing = db.prepare('SELECT id FROM mindmaps WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ detail: 'Mindmap not found' });
  if (title !== undefined) db.prepare("UPDATE mindmaps SET title = ?, updated_at = datetime('now') WHERE id = ?").run(title, req.params.id);
  if (content !== undefined) db.prepare("UPDATE mindmaps SET content = ?, updated_at = datetime('now') WHERE id = ?").run(JSON.stringify(content), req.params.id);
  if (style !== undefined) db.prepare("UPDATE mindmaps SET style = ?, updated_at = datetime('now') WHERE id = ?").run(style, req.params.id);
  const map = db.prepare('SELECT * FROM mindmaps WHERE id = ?').get(req.params.id);
  let parsed = map.content;
  try { parsed = JSON.parse(map.content); } catch {}
  res.json({ ...map, content: parsed });
});

app.delete(`${API}/mindmaps/:id`, (req, res) => {
  db.prepare('DELETE FROM mindmaps WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

app.post(`${API}/mindmaps/generate`, async (req, res) => {
  try {
    const { book_id, prompt, style } = req.body;
    if (!book_id) return res.status(400).json({ detail: 'book_id required' });

    const book = db.prepare('SELECT title, author FROM books WHERE id = ?').get(book_id);
    if (!book) return res.status(404).json({ detail: 'Book not found' });

    const chapters = db.prepare('SELECT idx, title, distilled_content FROM chapters WHERE book_id = ? ORDER BY idx').all(book_id);
    const chapterSummary = chapters.map(ch => {
      let points = {};
      try { points = JSON.parse(ch.distilled_content || '{}'); } catch {}
      const allPts = [...(points.shallow || []), ...(points.medium || []), ...(points.deep || [])];
      return `[${ch.idx}] ${ch.title}: ${allPts.map(p => p.title).join(', ')}`;
    }).join('\n');

    const llmConfig = getLlmConfig('chat');
    if (!llmConfig.api_key) {
      const tree = buildMindmapTree(book_id);
      return res.json({ success: true, content: tree, message: 'AI 未配置，使用蒸馏数据生成' });
    }

    const systemPrompt = `你是一个思维导图生成助手。根据书籍内容生成结构化的思维导图JSON数据。
输出格式必须是严格的JSON（不要包含markdown代码块标记），结构如下：
{
  "name": "书名",
  "children": [
    {
      "name": "章节名",
      "children": [
        {
          "name": "分类(浅层/中层/深层)",
          "children": [
            { "name": "知识点标题", "summary": "简要说明" }
          ]
        }
      ]
    }
  ]
}
只输出JSON，不要其他文字。`;

    const userMsg = `书籍: ${book.title}${book.author ? ' (作者: ' + book.author + ')' : ''}\n\n章节摘要:\n${chapterSummary}\n\n${prompt || '请生成完整的思维导图，包含所有章节的核心知识点。'}`;

    const resp = await fetch(`${llmConfig.base_url.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${llmConfig.api_key}` },
      body: JSON.stringify({ model: llmConfig.model, messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userMsg }], temperature: 0.3, max_tokens: 4096 }),
    });

    if (!resp.ok) throw new Error('LLM API error');
    const data = await resp.json();
    const answer = data.choices?.[0]?.message?.content || '';

    const jsonMatch = answer.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const tree = JSON.parse(jsonMatch[0]);
      const mapId = uuidv4();
      db.prepare('INSERT INTO mindmaps (id, book_id, title, content, style) VALUES (?,?,?,?,?)').run(mapId, book_id, book.title + ' - 思维导图', JSON.stringify(tree), style || 'tree');
      return res.json({ success: true, content: tree, mindmap_id: mapId });
    }

    const fallbackTree = buildMindmapTree(book_id);
    return res.json({ success: true, content: fallbackTree, message: 'AI 输出解析失败，使用蒸馏数据生成' });

  } catch (e) {
    console.error('Mindmap generate error:', e.message);
    const fallbackTree = buildMindmapTree(req.body.book_id);
    if (fallbackTree) return res.json({ success: true, content: fallbackTree, message: 'AI 生成失败，使用蒸馏数据: ' + e.message });
    res.status(500).json({ detail: e.message });
  }
});

app.get(`${API}/mindmap/tree`, (req, res) => {
  try {
    const { book_id } = req.query;
    if (!book_id) return res.status(400).json({ detail: 'book_id required' });
    const tree = buildMindmapTree(book_id);
    if (!tree) return res.status(404).json({ detail: 'Book not found' });
    res.json(tree);
  } catch (e) {
    res.status(500).json({ detail: e.message });
  }
});

app.post(`${API}/preprocess-book`, async (req, res) => {
  try {
    const { book_id } = req.body;
    if (!book_id) return res.status(400).json({ detail: 'book_id required' });
    const result = await preprocessBook(book_id);
    if (!result) return res.status(404).json({ detail: 'Book not found' });
    res.json({ success: true, ...result });
  } catch (e) {
    res.status(500).json({ detail: e.message });
  }
});

app.get(`${API}/preprocess-status/:book_id`, (req, res) => {
  const status = db.prepare('SELECT * FROM book_preprocessing WHERE book_id = ? ORDER BY created_at DESC LIMIT 1').get(req.params.book_id);
  res.json(status || null);
});

app.get(`${API}/knowledge-map`, (req, res) => {
  try {
    const { book_id } = req.query;
    if (!book_id) return res.status(400).json({ detail: 'book_id required' });
    let map = db.prepare('SELECT * FROM knowledge_maps WHERE book_id = ? ORDER BY version DESC LIMIT 1').get(book_id);
    if (!map) {
      const generated = buildKnowledgeMapFromBook(book_id);
      if (!generated) return res.status(404).json({ detail: 'Book not found' });
      const mapId = uuidv4();
      db.prepare('INSERT INTO knowledge_maps (id, book_id, title, layout, nodes_json, edges_json, styles_json) VALUES (?,?,?,?,?,?,?)').run(mapId, book_id, (db.prepare('SELECT title FROM books WHERE id = ?').get(book_id)?.title || '知识地图'), 'mindmap', JSON.stringify(generated.nodes), JSON.stringify(generated.edges), JSON.stringify(generated.styles));
      map = db.prepare('SELECT * FROM knowledge_maps WHERE id = ?').get(mapId);
    }
    res.json({
      id: map.id,
      book_id: map.book_id,
      title: map.title,
      layout: map.layout,
      nodes: JSON.parse(map.nodes_json || '[]'),
      edges: JSON.parse(map.edges_json || '[]'),
      styles: JSON.parse(map.styles_json || '{}'),
      version: map.version,
    });
  } catch (e) {
    res.status(500).json({ detail: e.message });
  }
});

app.post(`${API}/knowledge-map/generate`, async (req, res) => {
  try {
    const { book_id, layout = 'mindmap', prompt } = req.body;
    if (!book_id) return res.status(400).json({ detail: 'book_id required' });

    const generated = buildKnowledgeMapFromBook(book_id);
    if (!generated) return res.status(404).json({ detail: 'Book not found' });

    generated.styles.layout = layout;

    let existing = db.prepare('SELECT id, version FROM knowledge_maps WHERE book_id = ? ORDER BY version DESC LIMIT 1').get(book_id);
    const mapId = existing ? existing.id : uuidv4();
    const newVersion = existing ? existing.version + 1 : 1;

    if (existing) {
      db.prepare('INSERT INTO mindmap_versions (id, map_id, version, nodes_json, edges_json, styles_json) VALUES (?,?,?,?,?,?)').run(uuidv4(), mapId, existing.version, db.prepare('SELECT nodes_json, edges_json, styles_json FROM knowledge_maps WHERE id = ?').get(mapId).nodes_json, db.prepare('SELECT edges_json FROM knowledge_maps WHERE id = ?').get(mapId).edges_json, db.prepare('SELECT styles_json FROM knowledge_maps WHERE id = ?').get(mapId).styles_json);
      db.prepare(`UPDATE knowledge_maps SET layout=?, nodes_json=?, edges_json=?, styles_json=?, version=?, updated_at=datetime('now') WHERE id=?`).run(layout, JSON.stringify(generated.nodes), JSON.stringify(generated.edges), JSON.stringify(generated.styles), newVersion, mapId);
    } else {
      db.prepare('INSERT INTO knowledge_maps (id, book_id, title, layout, nodes_json, edges_json, styles_json, version) VALUES (?,?,?,?,?,?,?,?)').run(mapId, book_id, (db.prepare('SELECT title FROM books WHERE id = ?').get(book_id)?.title || '知识地图'), layout, JSON.stringify(generated.nodes), JSON.stringify(generated.edges), JSON.stringify(generated.styles), 1);
    }

    res.json({ success: true, id: mapId, version: newVersion, nodes: generated.nodes, edges: generated.edges, styles: generated.styles, layout });
  } catch (e) {
    res.status(500).json({ detail: e.message });
  }
});

app.post(`${API}/knowledge-map/chat`, async (req, res) => {
  try {
    const { book_id, instruction } = req.body;
    if (!book_id || !instruction) return res.status(400).json({ detail: 'book_id and instruction required' });

    let map = db.prepare('SELECT * FROM knowledge_maps WHERE book_id = ? ORDER BY version DESC LIMIT 1').get(book_id);
    if (!map) {
      const generated = buildKnowledgeMapFromBook(book_id);
      if (!generated) return res.status(404).json({ detail: 'Book not found' });
      const mapId = uuidv4();
      db.prepare('INSERT INTO knowledge_maps (id, book_id, title, layout, nodes_json, edges_json, styles_json) VALUES (?,?,?,?,?,?,?)').run(mapId, book_id, '知识地图', 'mindmap', JSON.stringify(generated.nodes), JSON.stringify(generated.edges), JSON.stringify(generated.styles));
      map = db.prepare('SELECT * FROM knowledge_maps WHERE id = ?').get(mapId);
    }

    const mapData = {
      nodes: JSON.parse(map.nodes_json || '[]'),
      edges: JSON.parse(map.edges_json || '[]'),
      styles: JSON.parse(map.styles_json || '{}'),
    };

    const nodeList = mapData.nodes.map(n => `${n.id}: ${n.label} (${n.type})`).join('\n');

    const llmConfig = getLlmConfig('chat');
    if (!llmConfig.api_key) {
      return res.json({ success: true, map_data: mapData, message: 'AI 未配置，请手动操作', actions: [] });
    }

    const systemPrompt = `你是一个知识地图编辑助手。用户会输入自然语言指令，你需要将其转换为结构化的JSON操作指令。

当前地图节点列表:
${nodeList.substring(0, 3000)}

可用操作（输出JSON数组，每个元素一个操作）：
- {"action":"add_node","params":{"label":"节点名","parent_id":"父节点ID","type":"chapter|shallow|medium|deep|custom"}}
- {"action":"delete_node","params":{"node_id":"节点ID或label"}}
- {"action":"update_node","params":{"node_id":"节点ID","label":"新名称","color":"#hex"}}
- {"action":"move_node","params":{"node_id":"节点ID","new_parent_id":"新父节点ID"}}
- {"action":"change_layout","params":{"layout":"mindmap|timeline|force|outline|compact"}}
- {"action":"change_style","params":{"node_type":"类型","color":"#hex"}}
- {"action":"add_edge","params":{"source":"源ID","target":"目标ID"}}

仅输出JSON数组，不附加任何解释。如果用户的指令无法转化为地图操作，输出空数组 []。`;

    const resp = await fetch(`${llmConfig.base_url.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${llmConfig.api_key}` },
      body: JSON.stringify({
        model: llmConfig.model,
        messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: instruction }],
        temperature: 0.2,
        max_tokens: 2048,
      }),
    });

    if (!resp.ok) throw new Error('LLM API error');
    const data = await resp.json();
    const answer = data.choices?.[0]?.message?.content || '[]';

    const jsonMatch = answer.match(/\[[\s\S]*\]/);
    let actions = [];
    try { actions = jsonMatch ? JSON.parse(jsonMatch[0]) : []; } catch {}

    let modifiedData = mapData;
    let actionMessages = [];
    for (const action of actions) {
      modifiedData = executeMapAction(modifiedData, action);
      actionMessages.push(`执行: ${action.action}(${JSON.stringify(action.params || {}).substring(0, 80)})`);
    }

    const newVersion = (map.version || 1) + 1;
    db.prepare('INSERT INTO mindmap_versions (id, map_id, version, nodes_json, edges_json, styles_json) VALUES (?,?,?,?,?,?)').run(uuidv4(), map.id, map.version, map.nodes_json, map.edges_json, map.styles_json);
    db.prepare(`UPDATE knowledge_maps SET nodes_json=?, edges_json=?, styles_json=?, layout=?, version=?, updated_at=datetime('now') WHERE id=?`).run(JSON.stringify(modifiedData.nodes), JSON.stringify(modifiedData.edges), JSON.stringify(modifiedData.styles), modifiedData.styles.layout || map.layout, newVersion, map.id);

    res.json({
      success: true,
      map_data: modifiedData,
      version: newVersion,
      message: actionMessages.length > 0 ? actionMessages.join('\n') : '已处理',
      actions,
    });
  } catch (e) {
    console.error('Knowledge map chat error:', e.message);
    res.status(500).json({ detail: e.message });
  }
});

app.post(`${API}/knowledge-map/save`, (req, res) => {
  try {
    const { book_id, nodes, edges, styles, layout } = req.body;
    if (!book_id) return res.status(400).json({ detail: 'book_id required' });
    let map = db.prepare('SELECT id, version FROM knowledge_maps WHERE book_id = ? ORDER BY version DESC LIMIT 1').get(book_id);
    const newVersion = map ? map.version + 1 : 1;
    const mapId = map ? map.id : uuidv4();
    if (map) {
      db.prepare(`UPDATE knowledge_maps SET nodes_json=?, edges_json=?, styles_json=?, layout=?, version=?, updated_at=datetime('now') WHERE id=?`).run(JSON.stringify(nodes), JSON.stringify(edges), JSON.stringify(styles || {}), layout || 'mindmap', newVersion, mapId);
    } else {
      db.prepare('INSERT INTO knowledge_maps (id, book_id, title, layout, nodes_json, edges_json, styles_json, version) VALUES (?,?,?,?,?,?,?,?)').run(mapId, book_id, '知识地图', layout || 'mindmap', JSON.stringify(nodes), JSON.stringify(edges), JSON.stringify(styles || {}), 1);
    }
    res.json({ success: true, id: mapId, version: newVersion });
  } catch (e) {
    res.status(500).json({ detail: e.message });
  }
});

app.get(`${API}/knowledge-map/history`, (req, res) => {
  try {
    const { book_id } = req.query;
    if (!book_id) return res.status(400).json({ detail: 'book_id required' });
    const map = db.prepare('SELECT id FROM knowledge_maps WHERE book_id = ? ORDER BY version DESC LIMIT 1').get(book_id);
    if (!map) return res.json({ versions: [] });
    const versions = db.prepare('SELECT id, version, created_at FROM mindmap_versions WHERE map_id = ? ORDER BY version DESC LIMIT 10').all(map.id);
    const current = db.prepare('SELECT id, version, updated_at FROM knowledge_maps WHERE id = ?').get(map.id);
    res.json({ versions: [{ id: current.id, version: current.version, created_at: current.updated_at, label: '当前版本' }, ...versions] });
  } catch (e) {
    res.status(500).json({ detail: e.message });
  }
});

app.post(`${API}/knowledge-map/rollback`, (req, res) => {
  try {
    const { book_id, version_id } = req.body;
    if (!book_id || !version_id) return res.status(400).json({ detail: 'book_id and version_id required' });
    const version = db.prepare('SELECT * FROM mindmap_versions WHERE id = ?').get(version_id);
    if (!version) return res.status(404).json({ detail: 'Version not found' });
    const map = db.prepare('SELECT id, version FROM knowledge_maps WHERE id = ?').get(version.map_id);
    const newVersion = map ? map.version + 1 : 1;
    db.prepare(`UPDATE knowledge_maps SET nodes_json=?, edges_json=?, styles_json=?, version=?, updated_at=datetime('now') WHERE id=?`).run(version.nodes_json, version.edges_json, version.styles_json, newVersion, version.map_id);
    res.json({ success: true, version: newVersion, nodes: JSON.parse(version.nodes_json), edges: JSON.parse(version.edges_json), styles: JSON.parse(version.styles_json) });
  } catch (e) {
    res.status(500).json({ detail: e.message });
  }
});

const fontStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, 'uploads', 'fonts');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.random().toString(36).substring(7)}${ext}`);
  },
});
const fontUpload = multer({
  storage: fontStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.ttf', '.otf', '.woff', '.woff2'];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(ext));
  },
});

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.post(`${API}/upload-font`, fontUpload.single('font'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ detail: 'No font file uploaded' });
    const name = req.body.name || req.file.originalname.replace(/\.[^.]+$/, '');
    res.json({ success: true, name, url: `/uploads/fonts/${req.file.filename}`, filename: req.file.filename });
  } catch (e) {
    res.status(500).json({ detail: e.message });
  }
});

app.listen(PORT, () => {
  console.log(`KnowScape API server running on http://localhost:${PORT}`);
});

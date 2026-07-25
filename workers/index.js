import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { sign, verify } from 'hono/jwt';
import bcrypt from 'bcryptjs';

const app = new Hono();

// ─── CORS ───
app.use('*', cors({
  origin: ['https://knowscape.pages.dev', 'https://*.knowscape.pages.dev', 'http://localhost:3000', 'http://localhost:5173'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

const API = '/api/v1';

// ─── 响应帮助函数 ───
function ok(c, data = null, message = 'success') {
  return c.json({ code: 0, message, data });
}

function fail(c, message = 'error', code = 1, status = 400) {
  return c.json({ code, message, data: null }, status);
}

// ─── 将 snake_case 对象转为 camelCase ───
function toCamelCase(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(toCamelCase);
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    const camelKey = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    result[camelKey] = (value !== null && typeof value === 'object' && !(value instanceof Date))
      ? toCamelCase(value) : value;
  }
  return result;
}

// ─── JWT 密钥 ───
function getJwtSecret(c) {
  return c.env.JWT_SECRET;
}

// ─── 尝试从请求中提取用户（不阻塞） ───
async function tryGetUserId(c) {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  try {
    const decoded = await verify(authHeader.split(' ')[1], getJwtSecret(c));
    return decoded.userId || null;
  } catch { return null; }
}

// ─── 表名映射（在 D1 中初始化） ───
const SCHEMA_SQL = `
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
CREATE TABLE IF NOT EXISTS agent_conversations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
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
  created_at TEXT DEFAULT (datetime('now'))
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
CREATE TABLE IF NOT EXISTS community_co_reading (
  id TEXT PRIMARY KEY,
  book_id TEXT NOT NULL,
  book_title TEXT NOT NULL,
  book_author TEXT DEFAULT '',
  description TEXT DEFAULT '',
  reader_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active',
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS checkins (
  id TEXT PRIMARY KEY, user_id TEXT DEFAULT 'default', created_at TEXT
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
CREATE TABLE IF NOT EXISTS redeem_codes (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  points INTEGER DEFAULT 0,
  uses_left INTEGER DEFAULT 1,
  max_uses INTEGER DEFAULT 1,
  created_by TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  expires_at TEXT
);
CREATE TABLE IF NOT EXISTS redeemed_codes (
  id TEXT PRIMARY KEY,
  code_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  redeemed_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS redeem_requests (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  username TEXT,
  plan TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  contact TEXT,
  admin_id TEXT,
  approved_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS user_storage (
  user_id TEXT PRIMARY KEY,
  permanent_bytes INTEGER DEFAULT 20971520,
  used_bytes INTEGER DEFAULT 0,
  shelf_capacity INTEGER DEFAULT 5,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS shelf_books (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  book_id TEXT UNIQUE NOT NULL,
  storage_type TEXT DEFAULT 'permanent',
  added_at TEXT DEFAULT (datetime('now')),
  expires_at TEXT,
  size_bytes INTEGER DEFAULT 0
);
`;

// ─── 中间件 ───

// JWT 认证中间件
async function authMiddleware(c, next) {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return fail(c, '请先登录', 1, 401);
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = await verify(token, getJwtSecret(c));
    // 跳过 session 检查，直接验证用户是否存在
    const user = await c.env.DB.prepare(
      'SELECT id, username, email, avatar, bio, is_admin, is_active FROM users WHERE id = ?'
    ).bind(decoded.userId).first();
    if (!user || !user.is_active) {
      return fail(c, '用户不存在或已被禁用', 1, 401);
    }
    c.set('user', user);
    await next();
  } catch (e) {
    console.error('AUTH ERROR:', e.message, e.stack, 'token prefix:', token?.substring(0, 10), 'secret:', getJwtSecret(c)?.substring(0, 10));
    return fail(c, '无效的登录凭证', 1, 401);
  }
}

// 管理员中间件
async function adminMiddleware(c, next) {
  const user = c.get('user');
  if (!user || !user.is_admin) {
    return fail(c, '需要管理员权限', 1, 403);
  }
  await next();
}

// ─── 积分工具函数 ───

async function addPoints(DB, userId, amount, type, description) {
  const points = await DB.prepare('SELECT * FROM user_points WHERE user_id = ?').bind(userId).first();
  if (points) {
    await DB.prepare(
      "UPDATE user_points SET balance = balance + ?, total_earned = total_earned + ?, updated_at = datetime('now') WHERE user_id = ?"
    ).run(amount, Math.max(0, amount), userId);
  } else {
    await DB.prepare(
      'INSERT INTO user_points (id, user_id, balance, total_earned) VALUES (?, ?, ?, ?)'
    ).run(crypto.randomUUID(), userId, amount, Math.max(0, amount));
  }
  await DB.prepare(
    'INSERT INTO point_transactions (id, user_id, amount, type, description) VALUES (?, ?, ?, ?, ?)'
  ).run(crypto.randomUUID(), userId, amount, type, description);
}

async function consumePoints(DB, userId, amount, type, description) {
  const points = await DB.prepare('SELECT * FROM user_points WHERE user_id = ?').bind(userId).first();
  if (!points || points.balance < amount) {
    return false;
  }
  await DB.prepare(
    "UPDATE user_points SET balance = balance - ?, updated_at = datetime('now') WHERE user_id = ?"
  ).run(amount, userId);
  await DB.prepare(
    'INSERT INTO point_transactions (id, user_id, amount, type, description) VALUES (?, ?, ?, ?, ?)'
  ).run(crypto.randomUUID(), userId, -amount, type, description);
  return true;
}

// ─── 初始化数据库 ───
const SCHEMA_STATEMENTS = SCHEMA_SQL.split(';').filter(s => s.trim());

app.use('*', async (c, next) => {
  if (c.env.DB) {
    for (const stmt of SCHEMA_STATEMENTS) {
      try { await c.env.DB.prepare(stmt).all(); } catch (_) { /* schema init — 表已存在时正常跳过 */ }
    }
  }
  await next();
});

// ══════════════════════════════════════════════
//  系统状态 API
// ══════════════════════════════════════════════

app.get(`${API}/status`, async (c) => {
  try {
    let dbOk = false, dbSize = 0;
    try {
      const r = await c.env.DB.prepare(
        "SELECT COUNT(*) as c FROM sqlite_master WHERE type='table'"
      ).first();
      dbOk = true;
      dbSize = r?.c || 0;
    } catch {}

    return ok(c, {
      status: 'ok',
      version: '2.0.0',
      uptime: Math.floor((Date.now() - (globalThis.__startedAt || Date.now())) / 1000),
      environment: typeof c.env.ENVIRONMENT === 'string' ? c.env.ENVIRONMENT : 'production',
      database: { connected: dbOk, tables: dbSize },
      features: {
        auth: true,
        community: true,
        agent: true,
        storage: true,
        points: true,
        admin: true,
      },
    });
  } catch (e) {
    return fail(c, e.message, 1, 500);
  }
});

// ══════════════════════════════════════════════
//  认证 API
// ══════════════════════════════════════════════

app.post(`${API}/auth/register`, async (c) => {
  try {
    const { username, email, password } = await c.req.json();
    if (!username || !password) return fail(c, '用户名和密码必填');

    const existing = await c.env.DB.prepare('SELECT id FROM users WHERE username = ?').bind(username).first();
    if (existing) return fail(c, '用户名已存在');

    if (email) {
      const existingEmail = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
      if (existingEmail) return fail(c, '邮箱已被注册');
    }

    const userId = crypto.randomUUID();
    const passwordHash = await bcrypt.hash(password, 10);
    await c.env.DB.prepare(
      'INSERT INTO users (id, username, email, password_hash) VALUES (?, ?, ?, ?)'
    ).run(userId, username, email || null, passwordHash);

    await c.env.DB.prepare(
      'INSERT INTO user_points (id, user_id, balance, total_earned) VALUES (?, ?, 100, 100)'
    ).run(crypto.randomUUID(), userId);
    await c.env.DB.prepare(
      "INSERT INTO point_transactions (id, user_id, amount, type, description) VALUES (?, ?, ?, ?, ?)"
    ).run(crypto.randomUUID(), userId, 100, 'bonus', '注册奖励');

    await c.env.DB.prepare(
      'INSERT INTO user_membership (id, user_id, level) VALUES (?, ?, ?)'
    ).run(crypto.randomUUID(), userId, 'free');

    const token = await sign({ userId }, getJwtSecret(c));
    await c.env.DB.prepare(
      "INSERT INTO sessions (id, user_id, token, expires_at) VALUES (?, ?, ?, datetime('now', '+7 days'))"
    ).run(crypto.randomUUID(), userId, token);

    const user = await c.env.DB.prepare(
      'SELECT id, username, email, avatar, bio, is_admin FROM users WHERE id = ?'
    ).bind(userId).first();

    return ok(c, { token, user });
  } catch (e) {
    return fail(c, e.message, 1, 500);
  }
});

app.post(`${API}/auth/login`, async (c) => {
  try {
    const { username, password } = await c.req.json();
    if (!username || !password) return fail(c, '用户名和密码必填');

    const user = await c.env.DB.prepare('SELECT * FROM users WHERE username = ?').bind(username).first();
    if (!user) return fail(c, '用户名或密码错误', 1, 401);

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return fail(c, '用户名或密码错误', 1, 401);

    if (!user.is_active) return fail(c, '账号已被禁用', 1, 403);

    const token = await sign({ userId: user.id }, getJwtSecret(c));
    // 不插入 sessions 表
    // await c.env.DB.prepare(
    //   "INSERT INTO sessions (id, user_id, token, expires_at) VALUES (?, ?, ?, datetime('now', '+7 days'))"
    // ).bind(crypto.randomUUID(), user.id, token).run();

    const { password_hash, ...safeUser } = user;
    return ok(c, { token, user: safeUser });
  } catch (e) {
    console.error('LOGIN ERROR:', e.message, e.stack);
    return fail(c, '登录失败: ' + e.message, 1, 500);
  }
});

app.get(`${API}/auth/me`, authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const points = await c.env.DB.prepare(
      'SELECT balance, total_earned FROM user_points WHERE user_id = ?'
    ).bind(user.id).first() || { balance: 0, total_earned: 0 };
    const membership = await c.env.DB.prepare(
      'SELECT level, expire_at FROM user_membership WHERE user_id = ?'
    ).bind(user.id).first() || { level: 'free', expire_at: null };
    return ok(c, { ...user, points, membership: { ...membership } });
  } catch (e) {
    return fail(c, e.message, 1, 500);
  }
});

app.post(`${API}/auth/logout`, authMiddleware, async (c) => {
  try {
    const authHeader = c.req.header('Authorization');
    const token = authHeader.split(' ')[1];
    await c.env.DB.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    return ok(c, null, '登出成功');
  } catch (e) {
    return fail(c, e.message, 1, 500);
  }
});

// ─── 用户资料更新 ───
app.post(`${API}/user/profile`, authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const { username, bio, email, avatar } = await c.req.json();
    if (username) {
      await c.env.DB.prepare('UPDATE users SET username = ? WHERE id = ?').bind(username, user.id).run();
    }
    if (bio !== undefined) {
      await c.env.DB.prepare('UPDATE users SET bio = ? WHERE id = ?').bind(bio, user.id).run();
    }
    if (email !== undefined) {
      await c.env.DB.prepare('UPDATE users SET email = ? WHERE id = ?').bind(email, user.id).run();
    }
    if (avatar !== undefined) {
      await c.env.DB.prepare('UPDATE users SET avatar = ? WHERE id = ?').bind(avatar, user.id).run();
    }
    return ok(c, null, '资料已更新');
  } catch (e) {
    return fail(c, e.message, 1, 500);
  }
});

// ══════════════════════════════════════════════
//  书籍 API
// ══════════════════════════════════════════════

app.get(`${API}/list-books`, async (c) => {
  try {
    const books = await c.env.DB.prepare('SELECT * FROM books ORDER BY created_at DESC').all();
    const result = await Promise.all(books.results.map(async (b) => {
      const total = await c.env.DB.prepare('SELECT COUNT(*) as c FROM chapters WHERE book_id = ?').bind(b.id).first();
      const chapters = await c.env.DB.prepare('SELECT distilled_content FROM chapters WHERE book_id = ?').bind(b.id).all();
      let distilledPoints = 0;
      for (const ch of chapters.results) {
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
    }));
    return ok(c, result);
  } catch (e) {
    return fail(c, e.message, 1, 500);
  }
});

app.post(`${API}/upload-book`, async (c) => {
  try {
    const { path: filePath, content, title: bookTitle } = await c.req.json();
    if (!filePath) return fail(c, '缺少文件路径');

    const ft = filePath.split('.').pop().toLowerCase() || 'txt';
    const title = bookTitle || filePath.split('/').pop().split('\\').pop().replace(/\.[^.]+$/, '');
    const bookId = crypto.randomUUID();
    const now = new Date().toISOString();

    // 如果提供了内容且使用了 R2，存到 R2
    if (content && c.env.R2) {
      const fileKey = `books/${bookId}/${filePath.split('/').pop() || 'file'}`;
      await c.env.R2.put(fileKey, content, {
        httpMetadata: { contentType: 'application/octet-stream' },
        customMetadata: { bookId, originalName: filePath, fileType: ft },
      });
    }

    await c.env.DB.prepare(
      'INSERT INTO books (id, title, author, file_path, file_type, status, progress, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)'
    ).run(bookId, title, '', filePath, ft, 'parsed', 0, now, now);

    // 简单分章处理：如果提供内容，按段落分章
    if (content) {
      const textContent = typeof content === 'string' ? content : '';
      const paragraphs = textContent.split(/\n{3,}/).filter(p => p.trim().length > 0);
      const chapters = [];
      if (paragraphs.length >= 3) {
        const chunkSize = Math.max(1, Math.ceil(paragraphs.length / Math.min(10, paragraphs.length)));
        for (let i = 0; i < paragraphs.length; i += chunkSize) {
          const chunk = paragraphs.slice(i, i + chunkSize).join('\n\n\n').trim();
          if (chunk) chapters.push([`章节 ${chapters.length + 1}`, chunk]);
        }
      } else {
        chapters.push(['全文', textContent.trim()]);
      }

      const ins = c.env.DB.prepare(
        'INSERT INTO chapters (id, book_id, idx, title, content, distilled_content) VALUES (?,?,?,?,?,?)'
      );
      for (let i = 0; i < chapters.length; i++) {
        await ins.run(crypto.randomUUID(), bookId, i, chapters[i][0], chapters[i][1], '');
      }
    }

    return ok(c, { book_id: bookId, title, chapters: 0 });
  } catch (e) {
    return fail(c, e.message, 1, 500);
  }
});

app.delete(`${API}/delete-book`, async (c) => {
  try {
    const book_id = c.req.query('book_id');
    if (!book_id) return fail(c, '缺少 book_id');

    // 从 R2 删除文件
    if (c.env.R2) {
      const book = await c.env.DB.prepare('SELECT file_path FROM books WHERE id = ?').bind(book_id).first();
      if (book && book.file_path) {
        try {
          const objects = await c.env.R2.list({ prefix: `books/${book_id}/` });
          for (const obj of objects.objects) {
            await c.env.R2.delete(obj.key);
          }
        } catch {}
      }
    }

    await c.env.DB.prepare('DELETE FROM graph_edges WHERE source_id IN (SELECT id FROM graph_nodes WHERE book_id = ?)').run(book_id);
    await c.env.DB.prepare('DELETE FROM graph_nodes WHERE book_id = ?').run(book_id);
    await c.env.DB.prepare('DELETE FROM frameworks WHERE book_id = ?').run(book_id);
    await c.env.DB.prepare('DELETE FROM chapters WHERE book_id = ?').run(book_id);
    await c.env.DB.prepare('DELETE FROM books WHERE id = ?').run(book_id);

    return ok(c, null, '删除成功');
  } catch (e) {
    return fail(c, e.message, 1, 500);
  }
});

app.get(`${API}/get-book`, async (c) => {
  try {
    const book_id = c.req.query('book_id');
    if (!book_id) return fail(c, '缺少 book_id');

    const book = await c.env.DB.prepare('SELECT * FROM books WHERE id = ?').bind(book_id).first();
    if (!book) return fail(c, 'Book not found', 1, 404);

    const total = await c.env.DB.prepare('SELECT COUNT(*) as c FROM chapters WHERE book_id = ?').bind(book_id).first();
    const distilled = await c.env.DB.prepare(
      "SELECT COUNT(*) as c FROM chapters WHERE book_id = ? AND distilled_content IS NOT NULL AND distilled_content != '{}'"
    ).bind(book_id).first();

    let distilledPoints = 0;
    const chs = await c.env.DB.prepare('SELECT distilled_content FROM chapters WHERE book_id = ?').bind(book_id).all();
    for (const ch of chs.results) {
      try {
        const d = JSON.parse(ch.distilled_content || '{}');
        distilledPoints += (d.shallow?.length || 0) + (d.medium?.length || 0) + (d.deep?.length || 0);
      } catch {}
    }

    const framework = await c.env.DB.prepare('SELECT framework_tree FROM frameworks WHERE book_id = ?').bind(book_id).first();
    const document = await c.env.DB.prepare(
      'SELECT id, title, created_at FROM documents WHERE book_id = ? ORDER BY created_at DESC LIMIT 1'
    ).bind(book_id).first();

    return ok(c, {
      ...book,
      stats: {
        total_chapters: total?.c || 0,
        distilled_chapters: distilled?.c || 0,
        distilled_points: distilledPoints,
        has_framework: !!framework,
        has_document: !!document,
      },
    });
  } catch (e) {
    return fail(c, e.message, 1, 500);
  }
});

// ══════════════════════════════════════════════
//  章节 API
// ══════════════════════════════════════════════

app.get(`${API}/get-chapter`, async (c) => {
  try {
    const book_id = c.req.query('book_id');
    const chapter_index = parseInt(c.req.query('chapter_index'));
    const ch = await c.env.DB.prepare('SELECT * FROM chapters WHERE book_id = ? AND idx = ?').bind(book_id, chapter_index).first();
    if (!ch) return fail(c, 'Chapter not found', 1, 404);

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

    return ok(c, {
      book_id: ch.book_id, chapter_index: ch.idx, title: ch.title,
      shallow: parsePoints(distill.shallow, ch.idx),
      medium: parsePoints(distill.medium, ch.idx),
      deep: parsePoints(distill.deep, ch.idx),
      original_text: ch.content,
    });
  } catch (e) {
    return fail(c, e.message, 1, 500);
  }
});

app.post(`${API}/distill-chapter`, async (c) => {
  try {
    const { book_id, chapter_index, depth = 'deep' } = await c.req.json();
    if (!book_id || chapter_index === undefined) return fail(c, '缺少 book_id 或 chapter_index');

    const ch = await c.env.DB.prepare('SELECT * FROM chapters WHERE book_id = ? AND idx = ?').bind(book_id, parseInt(chapter_index)).first();
    if (!ch) return fail(c, 'Chapter not found', 1, 404);

    const apiKey = c.env.DEEPSEEK_API_KEY;
    if (!apiKey) return fail(c, 'LLM API 未配置');

    const truncated = (ch.content || '').length > 4000 ? (ch.content || '').slice(0, 4000) + '...' : (ch.content || '');
    const prompt = `你是一位知识管理专家。请提取以下章节的知识点。

章节标题: ${ch.title}
章节内容:
${truncated}

请以 JSON 格式返回，包含以下层次(不需要的层次留空数组):
{
  "shallow": [{"id": "s1", "summary": "概要总结", "category": "分类", "originalRef": "引用位置"}],
  "medium": [{"id": "m1", "summary": "详细要点", "evidence": "原文依据", "category": "分类", "originalRef": "引用位置"}],
  "deep": [{"id": "d1", "summary": "深度洞察", "evidence": "分析依据", "citation": "引用", "category": "分类", "originalRef": "引用位置"}]
}`;

    const resp = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 4096,
      }),
    });

    if (!resp.ok) return fail(c, 'LLM API 调用失败', 1, 500);
    const data = await resp.json();
    const raw = data.choices?.[0]?.message?.content || '';
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return fail(c, 'LLM 未返回有效 JSON', 1, 500);

    const parsed = JSON.parse(jsonMatch[0]);
    await c.env.DB.prepare(
      'UPDATE chapters SET distilled_content = ? WHERE book_id = ? AND idx = ?'
    ).run(JSON.stringify(parsed), book_id, parseInt(chapter_index));

    const pointsFound = (parsed.shallow?.length || 0) + (parsed.medium?.length || 0) + (parsed.deep?.length || 0);
    return ok(c, { success: true, points_found: pointsFound, distilled_content: parsed });
  } catch (e) {
    return fail(c, e.message, 1, 500);
  }
});

// ══════════════════════════════════════════════
//  蒸馏 API
// ══════════════════════════════════════════════

app.post(`${API}/start-distillation`, async (c) => {
  try {
    const { book_id, depth = 'deep' } = await c.req.json();
    const book = await c.env.DB.prepare('SELECT * FROM books WHERE id = ?').bind(book_id).first();
    if (!book) return fail(c, 'Book not found', 1, 404);

    await c.env.DB.prepare("UPDATE books SET status = 'distilling' WHERE id = ?").run(book_id);

    // 使用 KV 存储蒸馏进度
    if (c.env.KV) {
      await c.env.KV.put(`distill:${book_id}`, JSON.stringify({ progress: 0, phase: 'starting' }));
    }

    // 异步蒸馏
    c.executionCtx.waitUntil((async () => {
      try {
        const chapters = await c.env.DB.prepare(
          'SELECT * FROM chapters WHERE book_id = ? ORDER BY idx'
        ).all(book_id);

        if (!chapters.results.length) {
          await c.env.DB.prepare("UPDATE books SET status = 'error' WHERE id = ?").run(book_id);
          return;
        }

        const apiKey = c.env.DEEPSEEK_API_KEY;
        let completed = 0;

        for (let i = 0; i < chapters.results.length; i++) {
          const ch = chapters.results[i];
          let existingDistilled = null;
          try { existingDistilled = JSON.parse(ch.distilled_content || '{}'); } catch {}
          if (existingDistilled && (existingDistilled.shallow?.length > 0)) {
            completed++;
            continue;
          }

          const truncated = (ch.content || '').length > 4000 ? (ch.content || '').slice(0, 4000) + '...' : (ch.content || '');
          const prompt = `你是一位知识管理专家。请提取以下章节的知识点。

章节标题: ${ch.title}
章节内容:
${truncated}

请以 JSON 格式返回，包含以下层次(不需要的层次留空数组):
{
  "shallow": [{"id": "s1", "summary": "概要总结", "category": "分类", "originalRef": "引用位置"}],
  "medium": [{"id": "m1", "summary": "详细要点", "evidence": "原文依据", "category": "分类", "originalRef": "引用位置"}],
  "deep": [{"id": "d1", "summary": "深度洞察", "evidence": "分析依据", "citation": "引用", "category": "分类", "originalRef": "引用位置"}]
}`;

          try {
            const resp = await fetch('https://api.deepseek.com/chat/completions', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
              body: JSON.stringify({
                model: 'deepseek-chat',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.1,
                max_tokens: 4096,
              }),
            });

            if (resp.ok) {
              const data = await resp.json();
              const raw = data.choices?.[0]?.message?.content || '';
              const jsonMatch = raw.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                await c.env.DB.prepare(
                  'UPDATE chapters SET distilled_content = ? WHERE book_id = ? AND idx = ?'
                ).run(JSON.stringify(parsed), book_id, ch.idx);
              }
            }
          } catch {}

          completed++;
          const pct = Math.round((completed / chapters.results.length) * 100);
          if (c.env.KV) {
            await c.env.KV.put(`distill:${book_id}`, JSON.stringify({ progress: pct, phase: 'distilling', chapter: i + 1, total: chapters.results.length }));
          }
          await c.env.DB.prepare('UPDATE books SET progress = ? WHERE id = ?').run(pct, book_id);
        }

        await c.env.DB.prepare("UPDATE books SET status = 'completed', progress = 100 WHERE id = ?").run(book_id);
        if (c.env.KV) {
          await c.env.KV.put(`distill:${book_id}`, JSON.stringify({ progress: 100, phase: 'completed' }));
        }
      } catch (e) {
        await c.env.DB.prepare("UPDATE books SET status = 'error' WHERE id = ?").run(book_id);
        if (c.env.KV) {
          await c.env.KV.put(`distill:${book_id}`, JSON.stringify({ progress: 0, phase: 'error', error: e.message }));
        }
      }
    })());

    return ok(c, { book_id, status: 'started' });
  } catch (e) {
    return fail(c, e.message, 1, 500);
  }
});

app.get(`${API}/get-distillation-status`, async (c) => {
  try {
    const book_id = c.req.query('book_id');
    const book = await c.env.DB.prepare('SELECT * FROM books WHERE id = ?').bind(book_id).first();
    if (!book) return fail(c, 'Book not found', 1, 404);

    let progressFromKV = null;
    if (c.env.KV) {
      try {
        const stored = await c.env.KV.get(`distill:${book_id}`);
        if (stored) progressFromKV = JSON.parse(stored);
      } catch (e) { console.error('WARN: KV distill read failed', e.message); }
    }

    const chapters = await c.env.DB.prepare(
      'SELECT idx, title, distilled_content FROM chapters WHERE book_id = ? ORDER BY idx'
    ).all(book_id);

    return ok(c, {
      book_id,
      is_running: book.status === 'distilling',
      overall_progress: progressFromKV?.progress || book.progress || 0,
      current_phase: progressFromKV?.phase || book.status,
      chapters: chapters.results.map(ch => {
        let status = 'pending';
        if (ch.distilled_content && ch.distilled_content !== '{}') {
          try {
            const d = JSON.parse(ch.distilled_content);
            if ((d.shallow?.length || 0) + (d.medium?.length || 0) + (d.deep?.length || 0) > 0) status = 'done';
          } catch { status = 'done'; }
        }
        return { index: ch.idx, title: ch.title, status, tokenCount: ch.content?.length || 0 };
      }),
    });
  } catch (e) {
    return fail(c, e.message, 1, 500);
  }
});

// ══════════════════════════════════════════════
//  知识图谱 API
// ══════════════════════════════════════════════

app.get(`${API}/knowledge-map`, async (c) => {
  try {
    const book_id = c.req.query('book_id');
    if (!book_id) return fail(c, 'book_id required');

    let map = await c.env.DB.prepare(
      'SELECT * FROM knowledge_maps WHERE book_id = ? ORDER BY version DESC LIMIT 1'
    ).bind(book_id).first();

    if (!map) {
      // 自动生成知识地图
      const chapters = await c.env.DB.prepare(
        'SELECT idx, title FROM chapters WHERE book_id = ? ORDER BY idx'
      ).all(book_id);
      const book = await c.env.DB.prepare('SELECT title FROM books WHERE id = ?').bind(book_id).first();
      if (!book) return fail(c, 'Book not found', 1, 404);

      const nodes = [
        { id: 'root', label: book.title || '全书', type: 'root', depth: 0, children: [], style: { color: '#5470c6', size: 28, icon: '📖' }, metadata: { source: 'book' } },
      ];
      const edges = [];

      for (const ch of chapters.results) {
        const chNodeId = 'ch_' + ch.idx;
        nodes.push({
          id: chNodeId, label: ch.title || `章节 ${ch.idx}`, type: 'chapter', depth: 1,
          children: [], style: { color: '#91cc75', size: 20, icon: '📄' },
          metadata: { source: 'framework', chapter_idx: ch.idx },
        });
        edges.push({ source: 'root', target: chNodeId, type: 'hierarchy', style: { width: 2 } });
      }

      const mapId = crypto.randomUUID();
      await c.env.DB.prepare(
        'INSERT INTO knowledge_maps (id, book_id, title, layout, nodes_json, edges_json, styles_json) VALUES (?,?,?,?,?,?,?)'
      ).run(mapId, book_id, book.title || '知识地图', 'mindmap', JSON.stringify(nodes), JSON.stringify(edges), JSON.stringify({}));

      map = await c.env.DB.prepare('SELECT * FROM knowledge_maps WHERE id = ?').bind(mapId).first();
    }

    return ok(c, {
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
    return fail(c, e.message, 1, 500);
  }
});

// ══════════════════════════════════════════════
//  社区 API
// ══════════════════════════════════════════════

app.get(`${API}/community/resources`, async (c) => {
  try {
    const category = c.req.query('category');
    const sort = c.req.query('sort');
    const search = c.req.query('search');
    const page = parseInt(c.req.query('page')) || 1;
    const limit = parseInt(c.req.query('limit')) || 20;

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

    const offset = (page - 1) * limit;
    query += ' LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const stmt = c.env.DB.prepare(query);
    const resources = params.length > 0 ? await stmt.bind(...params).all() : await stmt.all();
    const totalResult = await c.env.DB.prepare(
      'SELECT COUNT(*) as total FROM community_resources WHERE is_published = 1'
    ).first();

    return ok(c, { items: toCamelCase(resources.results || []), total: totalResult?.total || 0, page, limit });
  } catch (e) {
    return fail(c, e.message, 1, 500);
  }
});

const createResourceHandler = async (c) => {
  try {
    const { title, description, book_id, categories, content, cover_color } = await c.req.json();
    if (!title) return fail(c, '标题必填');

    const userId = (await tryGetUserId(c)) || 'anonymous';
    const id = crypto.randomUUID();
    await c.env.DB.prepare(
      'INSERT INTO community_resources (id, user_id, book_id, title, description, categories, content, cover_color) VALUES (?,?,?,?,?,?,?,?)'
    ).run(id, userId, book_id || null, title, description || '', JSON.stringify(categories || []), content || '', cover_color || '#3B82F6');

    const resource = await c.env.DB.prepare(
      'SELECT cr.*, u.username as author_name FROM community_resources cr LEFT JOIN users u ON cr.user_id = u.id WHERE cr.id = ?'
    ).bind(id).first();

    return ok(c, resource, '发布成功');
  } catch (e) {
    return fail(c, e.message, 1, 500);
  }
};

app.post(`${API}/community/resource`, createResourceHandler);
app.post(`${API}/community/resources`, createResourceHandler);

app.post(`${API}/community/resources/:id/like`, async (c) => {
  try {
    const resourceId = c.req.param('id');

    const userId = (await tryGetUserId(c)) || 'anonymous';
    const existing = await c.env.DB.prepare(
      'SELECT id FROM community_likes WHERE user_id = ? AND resource_id = ?'
    ).bind(userId, resourceId).first();

    if (existing) {
      await c.env.DB.prepare('DELETE FROM community_likes WHERE id = ?').run(existing.id);
      await c.env.DB.prepare('UPDATE community_resources SET likes = likes - 1 WHERE id = ?').run(resourceId);
      return ok(c, { liked: false });
    } else {
      await c.env.DB.prepare(
        'INSERT INTO community_likes (id, user_id, resource_id) VALUES (?, ?, ?)'
      ).run(crypto.randomUUID(), userId, resourceId);
      await c.env.DB.prepare('UPDATE community_resources SET likes = likes + 1 WHERE id = ?').run(resourceId);
      return ok(c, { liked: true });
    }
  } catch (e) {
    return fail(c, e.message, 1, 500);
  }
});

app.get(`${API}/community/stats`, async (c) => {
  try {
    const resourceCount = await c.env.DB.prepare(
      'SELECT COUNT(*) as c FROM community_resources WHERE is_published = 1'
    ).first();
    const userCount = await c.env.DB.prepare(
      'SELECT COUNT(DISTINCT user_id) as c FROM community_resources'
    ).first();
    return ok(c, {
      resources: resourceCount?.c || 0,
      users: userCount?.c || 0,
    });
  } catch (e) {
    return fail(c, e.message, 1, 500);
  }
});

app.get(`${API}/community/co-reading`, async (c) => {
  try {
    const items = await c.env.DB.prepare(
      'SELECT * FROM community_co_reading WHERE status = ? ORDER BY reader_count DESC LIMIT 10'
    ).bind('active').all();
    return ok(c, toCamelCase(items.results || []));
  } catch (e) {
    return fail(c, e.message, 1, 500);
  }
});

// ══════════════════════════════════════════════
//  积分 API
// ══════════════════════════════════════════════

app.post(`${API}/points/signin`, authMiddleware, async (c) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const existing = await c.env.DB.prepare(
      "SELECT id FROM point_transactions WHERE user_id = ? AND type = 'signin' AND date(created_at) = ?"
    ).bind(c.get('user').id, today).first();

    if (existing) return fail(c, '今日已签到');

    await addPoints(c.env.DB, c.get('user').id, 5, 'signin', '每日签到 +5');
    const points = await c.env.DB.prepare('SELECT balance FROM user_points WHERE user_id = ?').bind(c.get('user').id).first();

    return ok(c, { success: true, balance: points?.balance || 0 });
  } catch (e) {
    return fail(c, e.message, 1, 500);
  }
});

app.get(`${API}/points/balance`, authMiddleware, async (c) => {
  try {
    const points = await c.env.DB.prepare(
      'SELECT balance, total_earned FROM user_points WHERE user_id = ?'
    ).bind(c.get('user').id).first() || { balance: 0, total_earned: 0 };
    return ok(c, points);
  } catch (e) {
    return fail(c, e.message, 1, 500);
  }
});

app.get(`${API}/points/transactions`, authMiddleware, async (c) => {
  try {
    const txns = await c.env.DB.prepare(
      'SELECT * FROM point_transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 50'
    ).all(c.get('user').id);
    return ok(c, txns.results);
  } catch (e) {
    return fail(c, e.message, 1, 500);
  }
});

app.post(`${API}/points/consume`, authMiddleware, async (c) => {
  try {
    const { amount, description } = await c.req.json();
    if (!amount || amount <= 0) return fail(c, '无效的积分数量');

    const success = await consumePoints(c.env.DB, c.get('user').id, amount, 'consume', description || '消耗积分');
    if (!success) return fail(c, '积分不足');

    const points = await c.env.DB.prepare('SELECT balance FROM user_points WHERE user_id = ?').bind(c.get('user').id).first();
    return ok(c, { success: true, balance: points?.balance || 0 });
  } catch (e) {
    return fail(c, e.message, 1, 500);
  }
});

// ══════════════════════════════════════════════
//  订阅 API
// ══════════════════════════════════════════════

const SUBSCRIPTION_PLANS = {
  basic: { name: '基础', price: 29, monthly_points: 300, ebook_quota: 10, features: ['去广告', '青铜头衔'] },
  standard: { name: '标准', price: 59, monthly_points: 800, ebook_quota: 30, features: ['加速队列', '高级模型', '白银头衔'] },
  advanced: { name: '高级', price: 89, monthly_points: 1500, ebook_quota: 50, features: ['VIP队列', '高级模型', '黄金头衔', '优先客服'] },
  flagship: { name: '旗舰', price: 199, monthly_points: 3000, ebook_quota: 100, features: ['无限队列', '高级模型', '黑金头衔', '专属客服', '私有知识库', '5人团队协作'] },
};

app.get(`${API}/subscription/plans`, async (c) => {
  return ok(c, SUBSCRIPTION_PLANS);
});

app.get(`${API}/subscription/status`, authMiddleware, async (c) => {
  try {
    const sub = await c.env.DB.prepare(
      "SELECT * FROM subscriptions WHERE user_id = ? AND status = 'active'"
    ).bind(c.get('user').id).first();

    if (!sub || (sub.expire_at && new Date(sub.expire_at) < new Date())) {
      return ok(c, { plan: 'free', status: 'expired', benefits: SUBSCRIPTION_PLANS.basic });
    }

    const benefits = SUBSCRIPTION_PLANS[sub.plan] || SUBSCRIPTION_PLANS.basic;
    return ok(c, { ...sub, benefits });
  } catch (e) {
    return fail(c, e.message, 1, 500);
  }
});

// ══════════════════════════════════════════════
//  管理后台 API
// ══════════════════════════════════════════════

app.get(`${API}/admin/llm-config`, authMiddleware, adminMiddleware, async (c) => {
  try {
    // 从 KV 读取 LLM 配置，如果没有则使用环境变量
    let settings = {
      providers: {
        deepseek: {
          name: 'DeepSeek',
          base_url: 'https://api.deepseek.com',
          api_key: c.env.DEEPSEEK_API_KEY || '',
          model: 'deepseek-chat',
          temperature: 0.7,
          max_tokens: 4096,
        },
      },
      default_provider: 'deepseek',
      agents: { distill: 'deepseek', chat: 'deepseek', rag: 'deepseek', generate: 'deepseek' },
    };

    if (c.env.KV) {
      try {
        const stored = await c.env.KV.get('llm_config');
        if (stored) settings = JSON.parse(stored);
      } catch {}
    }

    const providers = Object.entries(settings.providers || {}).map(([k, v]) => ({
      id: k,
      name: v.name || k,
      base_url: v.base_url || '',
      api_key: v.api_key ? v.api_key.slice(0, 8) + '****' : '',
      model: v.model || '',
      temperature: v.temperature ?? 0.7,
      max_tokens: v.max_tokens ?? 4096,
    }));

    return ok(c, {
      providers,
      default_provider: settings.default_provider || 'deepseek',
      agents: settings.agents || { distill: 'deepseek', chat: 'deepseek', rag: 'deepseek', generate: 'deepseek' },
    });
  } catch (e) {
    return fail(c, e.message, 1, 500);
  }
});

app.post(`${API}/admin/llm-config`, authMiddleware, adminMiddleware, async (c) => {
  try {
    const { providers, default_provider, agents } = await c.req.json();

    // 从 KV 读取现有配置
    let existing = {
      providers: {
        deepseek: {
          name: 'DeepSeek',
          base_url: 'https://api.deepseek.com',
          api_key: c.env.DEEPSEEK_API_KEY || '',
          model: 'deepseek-chat',
          temperature: 0.7,
          max_tokens: 4096,
        },
      },
      default_provider: 'deepseek',
      agents: { distill: 'deepseek', chat: 'deepseek', rag: 'deepseek', generate: 'deepseek' },
    };

    if (c.env.KV) {
      try {
        const stored = await c.env.KV.get('llm_config');
        if (stored) existing = JSON.parse(stored);
      } catch {}
    }

    const providersObj = {};
    if (providers && Array.isArray(providers)) {
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
    }

    const newSettings = {
      providers: Object.keys(providersObj).length > 0 ? providersObj : existing.providers,
      default_provider: default_provider || existing.default_provider || 'deepseek',
      agents: agents || existing.agents || { distill: 'deepseek', chat: 'deepseek', rag: 'deepseek', generate: 'deepseek' },
    };

    if (c.env.KV) {
      await c.env.KV.put('llm_config', JSON.stringify(newSettings));
    }

    return ok(c, null, 'LLM配置已更新');
  } catch (e) {
    return fail(c, e.message, 1, 500);
  }
});

// ══════════════════════════════════════════════
//  其他 API
// ══════════════════════════════════════════════

app.get(`${API}/settings`, async (c) => {
  try {
    let settings = {
      providers: {
        deepseek: {
          name: 'DeepSeek',
          base_url: 'https://api.deepseek.com',
          api_key: c.env.DEEPSEEK_API_KEY || '',
          model: 'deepseek-chat',
          temperature: 0.7,
          max_tokens: 4096,
        },
      },
      default_provider: 'deepseek',
      agents: { distill: 'deepseek', chat: 'deepseek', rag: 'deepseek', generate: 'deepseek' },
    };

    if (c.env.KV) {
      try {
        const stored = await c.env.KV.get('llm_config');
        if (stored) settings = JSON.parse(stored);
      } catch {}
    }

    const providers = Object.entries(settings.providers || {}).map(([k, v]) => ({
      id: k,
      name: v.name || k,
      base_url: v.base_url || '',
      api_key: v.api_key ? v.api_key.slice(0, 8) + '****' : '',
      model: v.model || '',
      temperature: v.temperature ?? 0.7,
      max_tokens: v.max_tokens ?? 4096,
    }));

    return ok(c, {
      providers,
      default_provider_id: settings.default_provider || '',
      agent_mappings: settings.agents || { distill: '', chat: '', rag: '', generate: '' },
    });
  } catch (e) {
    return fail(c, e.message, 1, 500);
  }
});

app.post(`${API}/settings`, authMiddleware, adminMiddleware, async (c) => {
  try {
    const { providers, default_provider_id, agent_mappings } = await c.req.json();
    if (!providers || !Array.isArray(providers)) return fail(c, '无效的设置格式');

    let existing = {
      providers: {
        deepseek: {
          name: 'DeepSeek',
          base_url: 'https://api.deepseek.com',
          api_key: c.env.DEEPSEEK_API_KEY || '',
          model: 'deepseek-chat',
          temperature: 0.7,
          max_tokens: 4096,
        },
      },
      default_provider: 'deepseek',
      agents: { distill: 'deepseek', chat: 'deepseek', rag: 'deepseek', generate: 'deepseek' },
    };

    if (c.env.KV) {
      try {
        const stored = await c.env.KV.get('llm_config');
        if (stored) existing = JSON.parse(stored);
      } catch {}
    }

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

    if (c.env.KV) {
      await c.env.KV.put('llm_config', JSON.stringify(out));
    }

    return ok(c, null, '设置已保存');
  } catch (e) {
    return fail(c, e.message, 1, 500);
  }
});

app.get(`${API}/global-search`, async (c) => {
  try {
    const q = c.req.query('q');
    if (!q || q.trim().length === 0) return ok(c, { results: [], total: 0 });

    const query = q.toLowerCase().trim();
    const results = [];

    // 搜索书籍
    const books = await c.env.DB.prepare('SELECT * FROM books').all();
    for (const book of books.results) {
      if (book.title.toLowerCase().includes(query)) {
        results.push({ type: 'book', book_id: book.id, title: book.title, subtitle: book.author, match_field: 'title' });
      }
    }

    // 搜索章节
    const chapters = await c.env.DB.prepare(
      'SELECT ch.*, b.title as book_title FROM chapters ch JOIN books b ON ch.book_id = b.id'
    ).all();
    for (const ch of chapters.results) {
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

    return ok(c, { query: q, results: results.slice(0, 50), total: results.length });
  } catch (e) {
    return fail(c, e.message, 1, 500);
  }
});

app.get(`${API}/user/stats`, async (c) => {
  try {
    const totalBooks = (await c.env.DB.prepare('SELECT COUNT(*) as c FROM books').first())?.c || 0;
    const distilledBooks = (await c.env.DB.prepare("SELECT COUNT(*) as c FROM books WHERE status = 'completed'").first())?.c || 0;
    const totalChapters = (await c.env.DB.prepare('SELECT SUM(total_chapters) as c FROM books').first())?.c || 0;

    let totalPoints = 0;
    const allChapters = await c.env.DB.prepare(
      "SELECT distilled_content FROM chapters WHERE distilled_content IS NOT NULL AND distilled_content != '{}'"
    ).all();
    for (const ch of allChapters.results) {
      try {
        const d = JSON.parse(ch.distilled_content);
        totalPoints += (d.shallow?.length || 0) + (d.medium?.length || 0) + (d.deep?.length || 0);
      } catch {}
    }

    const checkinDatesResult = await c.env.DB.prepare(
      "SELECT DISTINCT date(created_at) as d FROM checkins ORDER BY d DESC LIMIT 30"
    ).all();
    const checkinDates = checkinDatesResult.results.map(r => r.d);

    return ok(c, {
      total_books: totalBooks,
      distilled_books: distilledBooks,
      total_chapters: totalChapters,
      total_points: totalPoints,
      study_days: checkinDates.length,
      checkin_dates: checkinDates,
    });
  } catch (e) {
    return fail(c, e.message, 1, 500);
  }
});

app.post(`${API}/checkin`, async (c) => {
  try {
    const now = new Date().toISOString();
    const today = now.split('T')[0];
    const existing = await c.env.DB.prepare(
      "SELECT id FROM checkins WHERE user_id = 'default' AND date(created_at) = ?"
    ).bind(today).first();

    if (existing) return ok(c, { success: true, message: '今日已签到' });

    await c.env.DB.prepare(
      'INSERT INTO checkins (id, user_id, created_at) VALUES (?, ?, ?)'
    ).run(crypto.randomUUID(), 'default', now);

    return ok(c, { success: true, message: '签到成功' });
  } catch (e) {
    return fail(c, e.message, 1, 500);
  }
});

// ─── 健康检查 ───

app.get(`${API}/health`, async (c) => {
  return ok(c, { status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Agent 对话 ───

app.get(`${API}/agent/conversations`, authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const rows = await c.env.DB.prepare(
      "SELECT * FROM agent_conversations WHERE user_id = ? ORDER BY updated_at DESC"
    ).bind(user.id).all();
    return ok(c, rows.results || []);
  } catch (e) {
    return fail(c, e.message);
  }
});

app.get(`${API}/agent/conversations/:id/messages`, authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const convId = c.req.param('id');
    const conv = await c.env.DB.prepare(
      "SELECT * FROM agent_conversations WHERE id = ? AND user_id = ?"
    ).bind(convId, user.id).first();
    if (!conv) return fail(c, '对话不存在', 1, 404);
    const msgs = await c.env.DB.prepare(
      "SELECT * FROM agent_messages WHERE conversation_id = ? ORDER BY created_at"
    ).bind(convId).all();
    return ok(c, msgs.results || []);
  } catch (e) {
    return fail(c, e.message);
  }
});

app.post(`${API}/agent/conversations`, authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const { title } = await c.req.json();
    const id = crypto.randomUUID();
    await c.env.DB.prepare(
      "INSERT INTO agent_conversations (id, user_id, title) VALUES (?, ?, ?)"
    ).bind(id, user.id, title || '新对话').run();
    return ok(c, { id, title: title || '新对话' });
  } catch (e) {
    return fail(c, e.message);
  }
});

app.delete(`${API}/agent/conversations/:id`, authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const convId = c.req.param('id');
    await c.env.DB.prepare(
      "DELETE FROM agent_conversations WHERE id = ? AND user_id = ?"
    ).bind(convId, user.id).run();
    return ok(c, null, '已删除');
  } catch (e) {
    return fail(c, e.message);
  }
});

app.post(`${API}/agent/chat`, authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const { conversation_id, message, book_id } = await c.req.json();
    if (!message) return fail(c, '消息不能为空');

    let convId = conversation_id;
    let bookTitle = '';

    // 创建新对话
    if (!convId) {
      convId = crypto.randomUUID();
      await c.env.DB.prepare(
        "INSERT INTO agent_conversations (id, user_id, title, book_id) VALUES (?, ?, ?, ?)"
      ).bind(convId, user.id, message.slice(0, 50), book_id || null).run();
    } else {
      const conv = await c.env.DB.prepare(
        "SELECT * FROM agent_conversations WHERE id = ? AND user_id = ?"
      ).bind(convId, user.id).first();
      if (!conv) return fail(c, '对话不存在', 1, 404);
      bookTitle = conv.book_title || '';
    }

    // 保存用户消息
    const msgId = crypto.randomUUID();
    await c.env.DB.prepare(
      "INSERT INTO agent_messages (id, conversation_id, role, content) VALUES (?, ?, 'user', ?)"
    ).bind(msgId, convId, message).run();

    // 取最近上下文
    const recent = await c.env.DB.prepare(
      "SELECT role, content FROM agent_messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT 10"
    ).bind(convId).all();
    const contextMessages = (recent.results || []).reverse();

    const apiKey = c.env.DEEPSEEK_API_KEY;
    let answer = '抱歉，AI 服务暂未配置';

    if (apiKey) {
      const systemPrompt = bookTitle
        ? `你是 KnowScape 智能助手，正在帮助用户阅读《${bookTitle}》。请基于书籍内容回答用户问题，并提供有深度的见解。`
        : '你是 KnowScape 智能助手，帮助用户阅读、理解和梳理知识。回答要简洁、有深度。';

      const resp = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            { role: 'system', content: systemPrompt },
            ...contextMessages.map(m => ({ role: m.role, content: m.content })),
          ],
          temperature: 0.7,
          max_tokens: 2048,
        }),
      });

      if (resp.ok) {
        const data = await resp.json();
        answer = data.choices?.[0]?.message?.content || '抱歉，AI 未返回有效响应';
      } else {
        answer = 'AI 服务暂时不可用，请稍后再试';
      }
    }

    // 保存助手回复
    const respId = crypto.randomUUID();
    await c.env.DB.prepare(
      "INSERT INTO agent_messages (id, conversation_id, role, content) VALUES (?, ?, 'assistant', ?)"
    ).bind(respId, convId, answer).run();

    // 更新对话时间
    await c.env.DB.prepare(
      "UPDATE agent_conversations SET updated_at = datetime('now') WHERE id = ?"
    ).bind(convId).run();

    return ok(c, {
      conversation_id: convId,
      answer,
      token_usage: null,
      tool_calls: [],
      tool_results: [],
    });
  } catch (e) {
    return fail(c, e.message, 1, 500);
  }
});

app.post(`${API}/agent/export`, authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const { conversation_id } = await c.req.json();
    if (!conversation_id) return fail(c, '缺少 conversation_id');

    const conv = await c.env.DB.prepare(
      "SELECT * FROM agent_conversations WHERE id = ? AND user_id = ?"
    ).bind(conversation_id, user.id).first();
    if (!conv) return fail(c, '对话不存在', 1, 404);

    const msgs = await c.env.DB.prepare(
      "SELECT role, content, created_at FROM agent_messages WHERE conversation_id = ? ORDER BY created_at"
    ).bind(conversation_id).all();

    const markdown = (msgs.results || []).map(m => {
      const prefix = m.role === 'user' ? '**你**' : '**AI**';
      return `## ${prefix}（${m.created_at}）\n\n${m.content}\n\n---\n`;
    }).join('\n');

    const title = conv.title || '对话导出';
    const content = `# ${title}\n\n${markdown}`;

    return new Response(content, {
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Content-Disposition': `attachment; filename="${title}.md"`,
      },
    });
  } catch (e) {
    return fail(c, e.message, 1, 500);
  }
});

// ─── 管理员：用户管理 ───
app.get(`${API}/admin/users`, authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    if (!user.is_admin) return fail(c, '无权限', 1, 403);
    const users = await c.env.DB.prepare('SELECT id, username, email, is_active, is_admin, created_at FROM users ORDER BY created_at DESC').all();
    return ok(c, users.results || []);
  } catch (e) { return fail(c, e.message); }
});

app.post(`${API}/admin/users/:id/toggle-active`, authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    if (!user.is_admin) return fail(c, '无权限', 1, 403);
    const targetId = c.req.param('id');
    const target = await c.env.DB.prepare('SELECT id, is_active FROM users WHERE id = ?').bind(targetId).first();
    if (!target) return fail(c, '用户不存在', 1, 404);
    await c.env.DB.prepare('UPDATE users SET is_active = ? WHERE id = ?').bind(target.is_active ? 0 : 1, targetId).run();
    return ok(c, null, target.is_active ? '已禁用' : '已启用');
  } catch (e) { return fail(c, e.message); }
});

app.post(`${API}/admin/users/:id/toggle-admin`, authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    if (!user.is_admin) return fail(c, '无权限', 1, 403);
    const targetId = c.req.param('id');
    const target = await c.env.DB.prepare('SELECT id, is_admin FROM users WHERE id = ?').bind(targetId).first();
    if (!target) return fail(c, '用户不存在', 1, 404);
    await c.env.DB.prepare('UPDATE users SET is_admin = ? WHERE id = ?').bind(target.is_admin ? 0 : 1, targetId).run();
    return ok(c, null, target.is_admin ? '已撤销管理员' : '已设为管理员');
  } catch (e) { return fail(c, e.message); }
});

// ─── 管理员：系统设置 ───
app.get(`${API}/admin/settings`, authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    if (!user.is_admin) return fail(c, '无权限', 1, 403);
    const rows = await c.env.DB.prepare('SELECT key, value FROM system_settings').all();
    const settings = {};
    (rows.results || []).forEach(r => { settings[r.key] = r.value; });
    return ok(c, settings);
  } catch (e) { return fail(c, e.message); }
});

app.post(`${API}/admin/settings`, authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    if (!user.is_admin) return fail(c, '无权限', 1, 403);
    const body = await c.req.json();
    for (const [key, value] of Object.entries(body)) {
      await c.env.DB.prepare(
        'INSERT OR REPLACE INTO system_settings (key, value, updated_at) VALUES (?, ?, datetime(\'now\'))'
      ).bind(key, String(value)).run();
    }
    return ok(c, null, '设置已保存');
  } catch (e) { return fail(c, e.message); }
});

// ─── 管理员：积分配置 ───
app.get(`${API}/admin/points-config`, authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    if (!user.is_admin) return fail(c, '无权限', 1, 403);
    const defaults = { checkin: 5, comment: 2, like: 1, publish: 5, read: 3 };
    const rows = await c.env.DB.prepare("SELECT key, value FROM system_settings WHERE key LIKE 'points_%'").all();
    (rows.results || []).forEach(r => { defaults[r.key.replace('points_', '')] = parseInt(r.value) || defaults[r.key.replace('points_', '')]; });
    return ok(c, defaults);
  } catch (e) { return fail(c, e.message); }
});

app.post(`${API}/admin/points-config`, authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    if (!user.is_admin) return fail(c, '无权限', 1, 403);
    const body = await c.req.json();
    for (const [key, value] of Object.entries(body)) {
      await c.env.DB.prepare(
        'INSERT OR REPLACE INTO system_settings (key, value, updated_at) VALUES (?, ?, datetime(\'now\'))'
      ).bind(`points_${key}`, String(value)).run();
    }
    return ok(c, null, '积分配置已保存');
  } catch (e) { return fail(c, e.message); }
});

// ─── 管理员：兑换码管理 ───
app.get(`${API}/admin/redeem-codes`, authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    if (!user.is_admin) return fail(c, '无权限', 1, 403);
    const codes = await c.env.DB.prepare('SELECT * FROM redeem_codes ORDER BY created_at DESC').all();
    return ok(c, codes.results || []);
  } catch (e) { return fail(c, e.message); }
});

app.post(`${API}/admin/redeem-codes`, authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    if (!user.is_admin) return fail(c, '无权限', 1, 403);
    const { points, count = 1, expires_days = 30 } = await c.req.json();
    const codes = [];
    for (let i = 0; i < count; i++) {
      const code = 'KS-' + Math.random().toString(36).substring(2, 8).toUpperCase() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();
      const id = crypto.randomUUID();
      await c.env.DB.prepare(
        "INSERT INTO redeem_codes (id, code, points, created_by, expires_at) VALUES (?, ?, ?, ?, datetime('now', '+' || ? || ' days'))"
      ).bind(id, code, points || 0, user.id, expires_days || 30).run();
      codes.push(code);
    }
    return ok(c, codes, `已生成 ${count} 个兑换码`);
  } catch (e) { return fail(c, e.message); }
});

// ─── 用户：兑换码 ───
app.post(`${API}/redeem`, authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const { code } = await c.req.json();
    if (!code) return fail(c, '请输入兑换码');
    const rc = await c.env.DB.prepare(
      "SELECT * FROM redeem_codes WHERE code = ? AND (expires_at IS NULL OR expires_at > datetime('now'))"
    ).bind(code.toUpperCase()).first();
    if (!rc) return fail(c, '无效或已过期的兑换码');
    const existing = await c.env.DB.prepare(
      'SELECT id FROM redeemed_codes WHERE code_id = ? AND user_id = ?'
    ).bind(rc.id, user.id).first();
    if (existing) return fail(c, '该兑换码已被你使用过');
    if (rc.uses_left <= 0) return fail(c, '兑换码已用完');
    // Add points to user
    const pointsRecord = await c.env.DB.prepare('SELECT id FROM user_points WHERE user_id = ?').bind(user.id).first();
    if (pointsRecord) {
      await c.env.DB.prepare('UPDATE user_points SET balance = balance + ?, total_earned = total_earned + ? WHERE user_id = ?').bind(rc.points, rc.points, user.id).run();
    } else {
      await c.env.DB.prepare('INSERT INTO user_points (id, user_id, balance, total_earned) VALUES (?, ?, ?, ?)').bind(crypto.randomUUID(), user.id, rc.points, rc.points).run();
    }
    await c.env.DB.prepare('INSERT INTO redeemed_codes (id, code_id, user_id) VALUES (?, ?, ?)').bind(crypto.randomUUID(), rc.id, user.id).run();
    await c.env.DB.prepare('UPDATE redeem_codes SET uses_left = uses_left - 1 WHERE id = ?').bind(rc.id).run();
    return ok(c, { points: rc.points }, `成功兑换 ${rc.points} 积分`);
  } catch (e) { return fail(c, e.message); }
});

// ─── 用户：套餐兑换请求 ───
app.post(`${API}/redeem-plan`, authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const { plan, contact } = await c.req.json();
    if (!plan) return fail(c, '请选择要兑换的套餐');
    const validPlans = ['basic', 'standard', 'premium', 'flagship'];
    if (!validPlans.includes(plan)) return fail(c, '无效套餐');

    // Check if user already has a pending request
    const pending = await c.env.DB.prepare(
      "SELECT id FROM redeem_requests WHERE user_id = ? AND status = 'pending'"
    ).bind(user.id).first();
    if (pending) return fail(c, '你已有一个待审批的兑换请求，请等待管理员处理');

    const id = crypto.randomUUID();
    await c.env.DB.prepare(
      "INSERT INTO redeem_requests (id, user_id, username, plan, contact) VALUES (?, ?, ?, ?, ?)"
    ).bind(id, user.id, user.username || '未知', plan, contact || '').run();
    return ok(c, { id }, '兑换请求已提交，等待管理员审核');
  } catch (e) { return fail(c, e.message); }
});

// ─── 管理员：获取兑换请求列表 ───
app.get(`${API}/admin/redeem-requests`, authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    if (!user.is_admin) return fail(c, '无权限', 1, 403);
    const status = c.req.query('status') || 'pending';
    const requests = await c.env.DB.prepare(
      "SELECT * FROM redeem_requests WHERE status = ? ORDER BY created_at DESC LIMIT 100"
    ).bind(status).all();
    return ok(c, requests.results);
  } catch (e) { return fail(c, e.message); }
});

// ─── 管理员：审批兑换请求（一键绑定套餐 + 积分） ───
app.post(`${API}/admin/redeem-requests/:id/approve`, authMiddleware, async (c) => {
  try {
    const admin = c.get('user');
    if (!admin.is_admin) return fail(c, '无权限', 1, 403);
    const reqId = c.req.param('id');
    const request = await c.env.DB.prepare(
      "SELECT * FROM redeem_requests WHERE id = ? AND status = 'pending'"
    ).bind(reqId).first();
    if (!request) return fail(c, '兑换请求不存在或已处理');

    const plan = request.plan;
    const userId = request.user_id;

    // Subscription storage caps per plan
    const caps = {
      basic: { perm: 104857600, shelf: 20 },
      standard: { perm: 209715200, shelf: 50 },
      premium: { perm: 524288000, shelf: 100 },
      flagship: { perm: 1073741824, shelf: 9999 }
    };
    const cap = caps[plan] || { perm: 20971520, shelf: 5 };

    // Bind subscription (upsert)
    const existing = await c.env.DB.prepare(
      "SELECT id, plan FROM subscriptions WHERE user_id = ? AND status = 'active'"
    ).bind(userId).first();
    if (existing) {
      await c.env.DB.prepare(
        "UPDATE subscriptions SET plan = ?, updated_at = datetime('now'), expire_at = datetime('now', '+30 days') WHERE user_id = ? AND status = 'active'"
      ).bind(plan, userId).run();
    } else {
      await c.env.DB.prepare(
        "INSERT INTO subscriptions (id, user_id, plan, status, expire_at) VALUES (?, ?, ?, 'active', datetime('now', '+30 days'))"
      ).bind(crypto.randomUUID(), userId, plan).run();
    }

    // Update user_storage caps
    const st = await c.env.DB.prepare('SELECT * FROM user_storage WHERE user_id = ?').bind(userId).first();
    if (st) {
      await c.env.DB.prepare(
        'UPDATE user_storage SET permanent_bytes = ?, shelf_capacity = ? WHERE user_id = ?'
      ).bind(cap.perm, cap.shelf, userId).run();
    } else {
      await c.env.DB.prepare(
        'INSERT INTO user_storage (user_id, permanent_bytes, shelf_capacity) VALUES (?, ?, ?)'
      ).bind(userId, cap.perm, cap.shelf).run();
    }

    // Bonus points based on plan
    const bonusPoints = { basic: 300, standard: 800, premium: 1500, flagship: 3000 };
    const points = bonusPoints[plan] || 0;
    if (points > 0) {
      const p = await c.env.DB.prepare('SELECT id FROM user_points WHERE user_id = ?').bind(userId).first();
      if (p) {
        await c.env.DB.prepare('UPDATE user_points SET balance = balance + ?, total_earned = total_earned + ? WHERE user_id = ?').bind(points, points, userId).run();
      } else {
        await c.env.DB.prepare('INSERT INTO user_points (id, user_id, balance, total_earned) VALUES (?, ?, ?, ?)').bind(crypto.randomUUID(), userId, points, points).run();
      }
      await c.env.DB.prepare('INSERT INTO point_transactions (id, user_id, amount, type, description) VALUES (?, ?, ?, ?, ?)').bind(crypto.randomUUID(), userId, points, 'redeem_plan', `套餐 ${plan} 兑换赠送 ${points} 积分`).run();
    }

    // Mark request as approved
    await c.env.DB.prepare(
      "UPDATE redeem_requests SET status = 'approved', admin_id = ?, approved_at = datetime('now') WHERE id = ?"
    ).bind(admin.id, reqId).run();

    return ok(c, { plan, points }, `已批准 ${request.username || userId} 的 ${plan} 套餐兑换请求`);
  } catch (e) { return fail(c, e.message); }
});

// ─── 用户：订阅管理 ───
app.get(`${API}/user/subscription`, authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const sub = await c.env.DB.prepare("SELECT * FROM subscriptions WHERE user_id = ? AND status = 'active' AND (expires_at IS NULL OR expires_at > datetime('now'))").bind(user.id).first();
    return ok(c, sub || null);
  } catch (e) { return fail(c, e.message); }
});

app.post(`${API}/user/subscribe`, authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const { plan } = await c.req.json();
    const plans = { basic: 29, standard: 59, premium: 89, flagship: 199 };
    if (!plans[plan]) return fail(c, '无效套餐');
    // In real app, handle payment here
    const existing = await c.env.DB.prepare("SELECT id FROM subscriptions WHERE user_id = ? AND status = 'active'").bind(user.id).first();
    if (existing) {
      await c.env.DB.prepare("UPDATE subscriptions SET plan = ?, updated_at = datetime('now'), expires_at = datetime('now', '+1 month') WHERE user_id = ? AND status = 'active'").bind(plan, user.id).run();
    } else {
      await c.env.DB.prepare("INSERT INTO subscriptions (id, user_id, plan, status, started_at, expires_at) VALUES (?, ?, ?, 'active', datetime('now'), datetime('now', '+1 month'))").bind(crypto.randomUUID(), user.id, plan).run();
    }
    return ok(c, { plan }, `已订阅 ${plan} 套餐`);
  } catch (e) { return fail(c, e.message); }
});

// ─── 导出 ───

export default app;

// ─── 存储与书架系统 ───

// 获取存储状态
app.get(`${API}/user/storage`, authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    let st = await c.env.DB.prepare('SELECT * FROM user_storage WHERE user_id = ?').bind(user.id).first();
    if (!st) {
      const sub = await c.env.DB.prepare("SELECT plan FROM subscriptions WHERE user_id = ? AND status = 'active' AND (expires_at IS NULL OR expires_at > datetime('now'))").bind(user.id).first();
      const subPlan = sub?.plan || 'free';
      const caps = { basic: { perm: 104857600, shelf: 20 }, standard: { perm: 209715200, shelf: 50 }, premium: { perm: 524288000, shelf: 100 }, flagship: { perm: 1073741824, shelf: 9999 } };
      const cap = caps[subPlan] || { perm: 20971520, shelf: 5 };
      await c.env.DB.prepare('INSERT INTO user_storage (user_id, permanent_bytes, shelf_capacity) VALUES (?, ?, ?)').bind(user.id, cap.perm, cap.shelf).run();
      st = await c.env.DB.prepare('SELECT * FROM user_storage WHERE user_id = ?').bind(user.id).first();
    }
    const shelfBooks = await c.env.DB.prepare("SELECT sb.*, b.title, b.author, b.file_type FROM shelf_books sb LEFT JOIN books b ON sb.book_id = b.id WHERE sb.user_id = ? ORDER BY sb.added_at DESC").bind(user.id).all();
    const now = new Date().toISOString();
    const shortTermBooks = (shelfBooks.results || []).filter(b => b.storage_type === 'short_term' && b.expires_at);
    return ok(c, {
      permanent_bytes: st.permanent_bytes || 20971520,
      used_bytes: st.used_bytes || 0,
      shelf_capacity: st.shelf_capacity || 5,
      shelf_used: (shelfBooks.results || []).length,
      short_term_count: shortTermBooks.length,
      books: (shelfBooks.results || []).map(b => ({
        ...b, expires_in_days: b.expires_at ? Math.max(0, Math.floor((new Date(b.expires_at).getTime() - Date.now()) / 86400000)) : null
      }))
    });
  } catch (e) { return fail(c, e.message); }
});

// 积分扩容永久存储：50积分 = 20MB
app.post(`${API}/user/storage/expand`, authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const { points = 50 } = await c.req.json();
    const extraBytes = Math.floor(points / 50) * 20971520;
    if (extraBytes <= 0) return fail(c, '至少需要50积分');
    const up = await c.env.DB.prepare('SELECT balance FROM user_points WHERE user_id = ?').bind(user.id).first();
    if (!up || up.balance < points) return fail(c, '积分不足');
    await c.env.DB.prepare('UPDATE user_points SET balance = balance - ? WHERE user_id = ?').bind(points, user.id).run();
    await c.env.DB.prepare('UPDATE user_storage SET permanent_bytes = permanent_bytes + ?, used_bytes = used_bytes + 0 WHERE user_id = ?').bind(extraBytes, user.id).run();
    const st = await c.env.DB.prepare('SELECT permanent_bytes FROM user_storage WHERE user_id = ?').bind(user.id).first();
    return ok(c, { permanent_bytes: st.permanent_bytes, expanded: extraBytes }, `扩容成功，永久存储增加 ${extraBytes / 1048576}MB`);
  } catch (e) { return fail(c, e.message); }
});

// 积分扩容书架：20积分 = 1位置
app.post(`${API}/user/shelf/expand`, authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const { points = 20 } = await c.req.json();
    const extraSlots = Math.floor(points / 20);
    if (extraSlots <= 0) return fail(c, '至少需要20积分');
    const up = await c.env.DB.prepare('SELECT balance FROM user_points WHERE user_id = ?').bind(user.id).first();
    if (!up || up.balance < points) return fail(c, '积分不足');
    await c.env.DB.prepare('UPDATE user_points SET balance = balance - ? WHERE user_id = ?').bind(points, user.id).run();
    await c.env.DB.prepare('UPDATE user_storage SET shelf_capacity = shelf_capacity + ? WHERE user_id = ?').bind(extraSlots, user.id).run();
    return ok(c, { extra_slots: extraSlots }, `书架扩容 ${extraSlots} 个位置`);
  } catch (e) { return fail(c, e.message); }
});

// 延长短期存储：10积分 = 7天
app.post(`${API}/user/storage/extend`, authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const { book_id } = await c.req.json();
    const sb = await c.env.DB.prepare("SELECT * FROM shelf_books WHERE book_id = ? AND user_id = ? AND storage_type = 'short_term'").bind(book_id, user.id).first();
    if (!sb) return fail(c, '书籍不在短期存储中');
    const up = await c.env.DB.prepare('SELECT balance FROM user_points WHERE user_id = ?').bind(user.id).first();
    if (!up || up.balance < 10) return fail(c, '需要10积分');
    await c.env.DB.prepare('UPDATE user_points SET balance = balance - 10 WHERE user_id = ?').bind(user.id).run();
    await c.env.DB.prepare("UPDATE shelf_books SET expires_at = datetime(expires_at, '+7 days') WHERE id = ?").bind(sb.id).run();
    return ok(c, null, '短期存储已延长7天');
  } catch (e) { return fail(c, e.message); }
});

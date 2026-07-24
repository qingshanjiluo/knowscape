import { Hono } from 'hono';
import { jwt, sign, verify } from 'hono/jwt';
import bcrypt from 'bcryptjs';

const app = new Hono();
const API = '/api/v1';

// ─── 响应帮助函数 ───
function ok(c, data = null, message = 'success') {
  return c.json({ code: 0, message, data });
}

function fail(c, message = 'error', code = 1, status = 400) {
  return c.json({ code, message, data: null }, status);
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
`;

// ─── 中间件 ───

// JWT 认证中间件
async function authMiddleware(c, next) {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return fail(c, '请先登录', 1, 401);
  }
  const token = authHeader.split(' ')[1];
  const JWT_SECRET = c.env.JWT_SECRET || 'knowscape-secret-key-2024';
  try {
    const decoded = await verify(token, JWT_SECRET);
    const session = await c.env.DB.prepare(
      "SELECT * FROM sessions WHERE token = ? AND expires_at > datetime('now')"
    ).first(token);
    if (!session) {
      return fail(c, '登录已过期', 1, 401);
    }
    const user = await c.env.DB.prepare(
      'SELECT id, username, email, avatar, bio, is_admin, is_active FROM users WHERE id = ?'
    ).first(decoded.userId);
    if (!user || !user.is_active) {
      return fail(c, '用户不存在或已被禁用', 1, 401);
    }
    c.set('user', user);
    await next();
  } catch (e) {
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
  const points = await DB.prepare('SELECT * FROM user_points WHERE user_id = ?').first(userId);
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
  const points = await DB.prepare('SELECT * FROM user_points WHERE user_id = ?').first(userId);
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

app.use('*', async (c, next) => {
  // 在每个请求开始时确保表存在
  if (c.env.DB) {
    try {
      await c.env.DB.exec(SCHEMA_SQL);
    } catch (e) {
      // 如果表已存在则忽略
    }
  }
  await next();
});

// ══════════════════════════════════════════════
//  认证 API
// ══════════════════════════════════════════════

app.post(`${API}/auth/register`, async (c) => {
  try {
    const { username, email, password } = await c.req.json();
    if (!username || !password) return fail(c, '用户名和密码必填');

    const existing = await c.env.DB.prepare('SELECT id FROM users WHERE username = ?').first(username);
    if (existing) return fail(c, '用户名已存在');

    if (email) {
      const existingEmail = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?').first(email);
      if (existingEmail) return fail(c, '邮箱已被注册');
    }

    const JWT_SECRET = c.env.JWT_SECRET || 'knowscape-secret-key-2024';
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

    const token = await sign({ userId }, JWT_SECRET);
    await c.env.DB.prepare(
      "INSERT INTO sessions (id, user_id, token, expires_at) VALUES (?, ?, ?, datetime('now', '+7 days'))"
    ).run(crypto.randomUUID(), userId, token);

    const user = await c.env.DB.prepare(
      'SELECT id, username, email, avatar, bio, is_admin FROM users WHERE id = ?'
    ).first(userId);

    return ok(c, { token, user });
  } catch (e) {
    return fail(c, e.message, 1, 500);
  }
});

app.post(`${API}/auth/login`, async (c) => {
  try {
    const { username, password } = await c.req.json();
    if (!username || !password) return fail(c, '用户名和密码必填');

    const JWT_SECRET = c.env.JWT_SECRET || 'knowscape-secret-key-2024';
    const user = await c.env.DB.prepare('SELECT * FROM users WHERE username = ?').first(username);
    if (!user) return fail(c, '用户名或密码错误', 1, 401);

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return fail(c, '用户名或密码错误', 1, 401);

    if (!user.is_active) return fail(c, '账号已被禁用', 1, 403);

    const token = await sign({ userId: user.id }, JWT_SECRET);
    await c.env.DB.prepare(
      "INSERT INTO sessions (id, user_id, token, expires_at) VALUES (?, ?, ?, datetime('now', '+7 days'))"
    ).run(crypto.randomUUID(), user.id, token);

    const { password_hash, ...safeUser } = user;
    return ok(c, { token, user: safeUser });
  } catch (e) {
    return fail(c, e.message, 1, 500);
  }
});

app.get(`${API}/auth/me`, authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const points = await c.env.DB.prepare(
      'SELECT balance, total_earned FROM user_points WHERE user_id = ?'
    ).first(user.id) || { balance: 0, total_earned: 0 };
    const membership = await c.env.DB.prepare(
      'SELECT level, expire_at FROM user_membership WHERE user_id = ?'
    ).first(user.id) || { level: 'free', expire_at: null };
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

// ══════════════════════════════════════════════
//  书籍 API
// ══════════════════════════════════════════════

app.get(`${API}/list-books`, async (c) => {
  try {
    const books = await c.env.DB.prepare('SELECT * FROM books ORDER BY created_at DESC').all();
    const result = await Promise.all(books.results.map(async (b) => {
      const total = await c.env.DB.prepare('SELECT COUNT(*) as c FROM chapters WHERE book_id = ?').first(b.id);
      const chapters = await c.env.DB.prepare('SELECT distilled_content FROM chapters WHERE book_id = ?').all(b.id);
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
      const book = await c.env.DB.prepare('SELECT file_path FROM books WHERE id = ?').first(book_id);
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
    await c.env.DB.prepare('DELETE FROM documents WHERE book_id = ?').run(book_id);
    await c.env.DB.prepare('DELETE FROM annotations WHERE book_id = ?').run(book_id);
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

    const book = await c.env.DB.prepare('SELECT * FROM books WHERE id = ?').first(book_id);
    if (!book) return fail(c, 'Book not found', 1, 404);

    const total = await c.env.DB.prepare('SELECT COUNT(*) as c FROM chapters WHERE book_id = ?').first(book_id);
    const distilled = await c.env.DB.prepare(
      "SELECT COUNT(*) as c FROM chapters WHERE book_id = ? AND distilled_content IS NOT NULL AND distilled_content != '{}'"
    ).first(book_id);

    let distilledPoints = 0;
    const chs = await c.env.DB.prepare('SELECT distilled_content FROM chapters WHERE book_id = ?').all(book_id);
    for (const ch of chs.results) {
      try {
        const d = JSON.parse(ch.distilled_content || '{}');
        distilledPoints += (d.shallow?.length || 0) + (d.medium?.length || 0) + (d.deep?.length || 0);
      } catch {}
    }

    const framework = await c.env.DB.prepare('SELECT framework_tree FROM frameworks WHERE book_id = ?').first(book_id);
    const document = await c.env.DB.prepare(
      'SELECT id, title, created_at FROM documents WHERE book_id = ? ORDER BY created_at DESC LIMIT 1'
    ).first(book_id);

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
    const ch = await c.env.DB.prepare('SELECT * FROM chapters WHERE book_id = ? AND idx = ?').first(book_id, chapter_index);
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

    const ch = await c.env.DB.prepare('SELECT * FROM chapters WHERE book_id = ? AND idx = ?').first(book_id, parseInt(chapter_index));
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
    const book = await c.env.DB.prepare('SELECT * FROM books WHERE id = ?').first(book_id);
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
    const book = await c.env.DB.prepare('SELECT * FROM books WHERE id = ?').first(book_id);
    if (!book) return fail(c, 'Book not found', 1, 404);

    let progressFromKV = null;
    if (c.env.KV) {
      try {
        const stored = await c.env.KV.get(`distill:${book_id}`);
        if (stored) progressFromKV = JSON.parse(stored);
      } catch {}
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
    ).first(book_id);

    if (!map) {
      // 自动生成知识地图
      const chapters = await c.env.DB.prepare(
        'SELECT idx, title FROM chapters WHERE book_id = ? ORDER BY idx'
      ).all(book_id);
      const book = await c.env.DB.prepare('SELECT title FROM books WHERE id = ?').first(book_id);
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

      map = await c.env.DB.prepare('SELECT * FROM knowledge_maps WHERE id = ?').first(mapId);
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

    const resources = await c.env.DB.prepare(query).all(...params);
    const totalResult = await c.env.DB.prepare(
      'SELECT COUNT(*) as total FROM community_resources WHERE is_published = 1'
    ).first();

    return ok(c, { items: resources.results, total: totalResult?.total || 0, page, limit });
  } catch (e) {
    return fail(c, e.message, 1, 500);
  }
});

app.post(`${API}/community/resource`, async (c) => {
  try {
    const { title, description, book_id, categories, content, cover_color } = await c.req.json();
    if (!title) return fail(c, '标题必填');

    // 尝试从 JWT 获取用户
    let userId = 'anonymous';
    const authHeader = c.req.header('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.split(' ')[1];
        const JWT_SECRET = c.env.JWT_SECRET || 'knowscape-secret-key-2024';
        const decoded = await verify(token, JWT_SECRET);
        userId = decoded.userId;
      } catch {}
    }

    const id = crypto.randomUUID();
    await c.env.DB.prepare(
      'INSERT INTO community_resources (id, user_id, book_id, title, description, categories, content, cover_color) VALUES (?,?,?,?,?,?,?,?)'
    ).run(id, userId, book_id || null, title, description || '', JSON.stringify(categories || []), content || '', cover_color || '#3B82F6');

    const resource = await c.env.DB.prepare(
      'SELECT cr.*, u.username as author_name FROM community_resources cr LEFT JOIN users u ON cr.user_id = u.id WHERE cr.id = ?'
    ).first(id);

    return ok(c, resource, '发布成功');
  } catch (e) {
    return fail(c, e.message, 1, 500);
  }
});

app.post(`${API}/community/resources/:id/like`, async (c) => {
  try {
    const resourceId = c.req.param('id');

    let userId = 'anonymous';
    const authHeader = c.req.header('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.split(' ')[1];
        const JWT_SECRET = c.env.JWT_SECRET || 'knowscape-secret-key-2024';
        const decoded = await verify(token, JWT_SECRET);
        userId = decoded.userId;
      } catch {}
    }

    const existing = await c.env.DB.prepare(
      'SELECT id FROM community_likes WHERE user_id = ? AND resource_id = ?'
    ).first(userId, resourceId);

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

// ══════════════════════════════════════════════
//  积分 API
// ══════════════════════════════════════════════

app.post(`${API}/points/signin`, authMiddleware, async (c) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const existing = await c.env.DB.prepare(
      "SELECT id FROM point_transactions WHERE user_id = ? AND type = 'signin' AND date(created_at) = ?"
    ).first(c.get('user').id, today);

    if (existing) return fail(c, '今日已签到');

    await addPoints(c.env.DB, c.get('user').id, 5, 'signin', '每日签到 +5');
    const points = await c.env.DB.prepare('SELECT balance FROM user_points WHERE user_id = ?').first(c.get('user').id);

    return ok(c, { success: true, balance: points?.balance || 0 });
  } catch (e) {
    return fail(c, e.message, 1, 500);
  }
});

app.get(`${API}/points/balance`, authMiddleware, async (c) => {
  try {
    const points = await c.env.DB.prepare(
      'SELECT balance, total_earned FROM user_points WHERE user_id = ?'
    ).first(c.get('user').id) || { balance: 0, total_earned: 0 };
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

    const points = await c.env.DB.prepare('SELECT balance FROM user_points WHERE user_id = ?').first(c.get('user').id);
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
    ).first(c.get('user').id);

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
    ).first(today);

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

// ─── 导出 ───

export default app;

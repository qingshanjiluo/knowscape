// ─── 知境（KnowScape）API 接口定义 ───
// 双模式适配：Tauri IPC（桌面端） + REST API（云端）

import type {
  BookInfo,
  ChapterContent,
  DistillStatus,
  DistillDepth,
  GraphData,
  ChatMessage,
  GeneratedDocument,
  SearchResult,
  Annotation,
  StreamChunk,
} from '@/types';

// ─── Tauri IPC 封装 ───

let tauriInvoke: ((cmd: string, args?: Record<string, unknown>) => Promise<unknown>) | null = null;

async function ensureTauri() {
  if (tauriInvoke !== null) return;
  if (typeof window !== 'undefined' && '.__TAURI_IPC__' in window) {
    try {
      const mod = await import('@tauri-apps/api/core');
      tauriInvoke = mod.invoke;
    } catch {
      tauriInvoke = (cmd: string, args?: Record<string, unknown>) =>
        (window as any).__TAURI_IPC__.invoke(cmd, args);
    }
  }
}

async function invoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  await ensureTauri();
  if (tauriInvoke) {
    try {
      return (await tauriInvoke(command, args)) as T;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`[Tauri] ${command} 失败: ${msg}`);
    }
  }
  return restCall<T>(command, args);
}

// ─── REST API 封装 ───

function toCamelCase(obj: unknown): unknown {
  if (Array.isArray(obj)) return obj.map(toCamelCase);
  if (obj !== null && typeof obj === 'object' && !(obj instanceof Date)) {
    return Object.fromEntries(
      Object.entries(obj as Record<string, unknown>).map(([k, v]) => [
        k.replace(/_([a-z])/g, (_, c) => c.toUpperCase()),
        toCamelCase(v),
      ])
    );
  }
  return obj;
}

function toSnakeCase(obj: unknown): unknown {
  if (Array.isArray(obj)) return obj.map(toSnakeCase);
  if (obj !== null && typeof obj === 'object' && !(obj instanceof Date)) {
    return Object.fromEntries(
      Object.entries(obj as Record<string, unknown>).map(([k, v]) => [
        k.replace(/[A-Z]/g, c => `_${c.toLowerCase()}`),
        toSnakeCase(v),
      ])
    );
  }
  return obj;
}

const API_BASE = '/api/v1';

async function restCall<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  const methodMap: Record<string, string> = {
    upload_book: 'POST',
    list_books: 'GET',
    delete_book: 'DELETE',
    start_distillation: 'POST',
    get_distillation_status: 'GET',
    cancel_distillation: 'POST',
    distill_chapter: 'POST',
    get_chapter: 'GET',
    get_framework: 'GET',
    get_type_index: 'GET',
    get_graph_data: 'GET',
    search: 'GET',
    ask_question: 'POST',
    add_annotation: 'POST',
    get_annotations: 'GET',
    delete_annotation: 'DELETE',
    export_book: 'GET',
    generate_document: 'POST',
    get_document: 'GET',
  };

  const method = methodMap[command] || 'GET';
  const url = new URL(`${API_BASE}/${command.replace(/_/g, '-')}`, window.location.origin);

  if (method === 'GET' && args) {
    Object.entries(args).forEach(([k, v]) => url.searchParams.set(k, String(v)));
  }

  const res = await fetch(url.toString(), {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: method !== 'GET' ? JSON.stringify(toSnakeCase(args)) : undefined,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `API Error: ${res.status}`);
  }

  const data = await res.json();
  return toCamelCase(data.data ?? data) as T;
}

// ─── SSE 流式封装 ───

async function streamCall(
  command: string,
  args: Record<string, unknown>,
  onChunk: (chunk: StreamChunk) => void,
  onError?: (error: Error) => void
): Promise<void> {
  try {
    const res = await fetch(`${API_BASE}/${command.replace(/_/g, '-')}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
    });

    if (!res.ok) {
      throw new Error(`API Error: ${res.status}`);
    }

    const reader = res.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const chunk = JSON.parse(line.slice(6));
            onChunk(chunk);
          } catch {
            // skip malformed chunks
          }
        }
      }
    }
  } catch (err) {
    onError?.(err instanceof Error ? err : new Error(String(err)));
  }
}

// ─── 书籍管理 API ───

export const bookApi = {
  /** 上传书籍文件 */
  async upload(filePath: string, content?: string): Promise<string> {
    return invoke<string>('upload_book', { path: filePath, content });
  },

  /** 获取所有书籍列表 */
  async list(): Promise<BookInfo[]> {
    return invoke<BookInfo[]>('list_books');
  },

  /** 删除书籍 */
  async delete(bookId: string): Promise<void> {
    return invoke<void>('delete_book', { book_id: bookId });
  },

  /** 获取单本书详情 */
  async get(bookId: string): Promise<BookInfo> {
    return invoke<BookInfo>('get_book', { book_id: bookId });
  },

  /** 智能分卷 */
  async splitAsVolumes(bookId: string) {
    const resp = await fetch(`${API_BASE}/split-as-volumes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ book_id: bookId }),
    });
    if (!resp.ok) throw new Error('分卷失败');
    return resp.json();
  },
};

// ─── 蒸馏管理 API ───

export const distillApi = {
  async start(bookId: string, depth: DistillDepth = 'medium', customPrompt?: string): Promise<void> {
    return invoke<void>('start_distillation', { book_id: bookId, depth, custom_prompt: customPrompt || '' });
  },

  async getStatus(bookId: string): Promise<DistillStatus> {
    return invoke<DistillStatus>('get_distillation_status', { book_id: bookId });
  },

  async cancel(bookId: string): Promise<void> {
    return invoke<void>('cancel_distillation', { book_id: bookId });
  },

  async distillChapter(bookId: string, chapterIndex: number, depth: DistillDepth, customPrompt?: string): Promise<{ success: boolean; points_found: number; distilled_content: any }> {
    return invoke<any>('distill_chapter', { book_id: bookId, chapter_index: chapterIndex, depth, custom_prompt: customPrompt || '' });
  },
};

// ─── 内容获取 API ───

export const contentApi = {
  /** 获取章节内容（蒸馏+原文） */
  async getChapter(bookId: string, chapterIndex: number, depth: DistillDepth): Promise<ChapterContent> {
    return invoke<ChapterContent>('get_chapter', {
      book_id: bookId,
      chapter_index: chapterIndex,
      depth,
    });
  },

  /** 获取全书框架树 */
  async getFramework(bookId: string): Promise<any> {
    return invoke('get_framework', { book_id: bookId });
  },

  /** 获取类型索引 */
  async getTypeIndex(bookId: string): Promise<any> {
    return invoke('get_type_index', { book_id: bookId });
  },

  /** 获取知识图谱数据 */
  async getGraphData(bookId: string): Promise<GraphData> {
    return invoke<GraphData>('get_graph_data', { book_id: bookId });
  },

  /** 全文搜索 */
  async search(bookId: string, query: string): Promise<SearchResult[]> {
    return invoke<SearchResult[]>('search', { book_id: bookId, query });
  },
};

// ─── RAG 对话 API ───

export const chatApi = {
  /** 发送问题（流式响应） */
  async ask(
    bookId: string,
    question: string,
    sessionId: string,
    onChunk: (chunk: StreamChunk) => void,
    onError?: (error: Error) => void
  ): Promise<void> {
    return streamCall('ask_question', {
      book_id: bookId,
      question,
      session_id: sessionId,
    }, onChunk, onError);
  },

  /** 获取对话历史 */
  async getHistory(sessionId: string): Promise<ChatMessage[]> {
    return invoke<ChatMessage[]>('get_chat_history', { session_id: sessionId });
  },
};

// ─── 批注 API ───

export const annotationApi = {
  /** 添加批注 */
  async add(bookId: string, chapterIndex: number, annotation: Omit<Annotation, 'id' | 'createdAt'>): Promise<void> {
    return invoke<void>('add_annotation', {
      book_id: bookId,
      chapter_index: chapterIndex,
      annotation,
    });
  },

  /** 获取章节批注 */
  async list(bookId: string, chapterIndex: number): Promise<Annotation[]> {
    return invoke<Annotation[]>('get_annotations', {
      book_id: bookId,
      chapter_index: chapterIndex,
    });
  },

  /** 删除批注 */
  async delete(annotationId: string): Promise<void> {
    return invoke<void>('delete_annotation', { annotation_id: annotationId });
  },
};

// ─── 深度生成 API ───

export const generateApi = {
  async start(
    bookId: string,
    config: any,
    onChunk: (chunk: StreamChunk) => void,
    onError?: (error: Error) => void
  ): Promise<void> {
    return streamCall('generate_document', {
      book_id: bookId,
      config,
    }, onChunk, onError);
  },

  async generateDocument(bookId: string, customPrompt?: string): Promise<{ id: string; title: string; content: string }> {
    return invoke<any>('generate_document', { book_id: bookId, custom_prompt: customPrompt || '' });
  },

  async getDocument(bookId: string): Promise<{ id: string; title: string; content: string } | null> {
    return invoke<any>('get_document', { book_id: bookId });
  },

  async list(bookId: string): Promise<GeneratedDocument[]> {
    return invoke<GeneratedDocument[]>('list_generated', { book_id: bookId });
  },

  /** 获取单个生成结果 */
  async get(docId: string): Promise<GeneratedDocument> {
    return invoke<GeneratedDocument>('get_generated', { doc_id: docId });
  },
};

// ─── 导出 API ───

export const exportApi = {
  async exportBook(bookId: string, format: 'markdown' | 'pdf' | 'html' | 'json'): Promise<Blob> {
    const resp = await fetch(`/api/v1/export-book?book_id=${bookId}&format=${format}`);
    if (!resp.ok) throw new Error('导出失败');
    return resp.blob();
  },
};

// ─── 搜索 API ───

export const searchApi = {
  /** 全局搜索 */
  async search(query: string): Promise<SearchResult[]> {
    return invoke<SearchResult[]>('global_search', { query });
  },
};

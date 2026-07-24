import { create } from 'zustand';
import { bookApi, distillApi, contentApi, generateApi } from '@/api';
import { useToastStore } from '@/stores/toastStore';
import type {
  BookInfo,
  ChapterSummary,
  ChapterContent,
  DistillStatus,
  DistillLog,
  DistillDepth,
} from '@/types';

interface BookStore {
  books: BookInfo[];
  selectedBookId: string | null;
  chapters: ChapterSummary[];
  currentChapter: ChapterContent | null;
  distillStatus: DistillStatus | null;
  logs: DistillLog[];
  logsBookId: string | null;
  selectedDepth: DistillDepth;
  isLoading: boolean;
  wholeBookDoc: string | null;

  loadBooks: () => Promise<void>;
  selectBook: (bookId: string | null) => void;
  loadChapter: (bookId: string, chapterIndex: number) => Promise<void>;
  deleteBook: (bookId: string) => Promise<void>;
  uploadBook: (fileOrPath: File | string) => Promise<void>;
  startDistillation: (bookId: string, depth: DistillDepth, customPrompt?: string) => Promise<void>;
  cancelDistillation: (bookId: string) => Promise<void>;
  distillChapter: (bookId: string, chapterIndex: number, depth: DistillDepth, customPrompt?: string) => Promise<void>;
  setSelectedDepth: (depth: DistillDepth) => void;
  addLog: (log: Omit<DistillLog, 'id'>) => void;
  clearLogs: () => void;
  loadDocument: (bookId: string) => Promise<void>;
  generateDocument: (bookId: string, customPrompt?: string) => Promise<void>;
}

let progressUnlisten: (() => void) | null = null;
let progressPollTimer: ReturnType<typeof setInterval> | null = null;

function stopProgressPolling() {
  if (progressPollTimer) {
    clearInterval(progressPollTimer);
    progressPollTimer = null;
  }
}

async function setupProgressListener(
  emit: (partial: Partial<BookStore>) => void,
  getBooks: () => BookInfo[]
) {
  if (progressUnlisten) {
    progressUnlisten();
    progressUnlisten = null;
  }
  try {
    const { listen } = await import('@tauri-apps/api/event');
    progressUnlisten = await listen<{ bookId: string; progress: number; phase?: string; chapterIndex?: number; chapterTitle?: string }>(
      'distillation-progress',
      (event) => {
        const { bookId, progress, phase, chapterTitle } = event.payload;
        emit({
          books: getBooks().map(b =>
            b.id === bookId
              ? {
                  ...b,
                  status: (phase === 'completed' ? 'completed' : 'distilling') as BookInfo['status'],
                  progress: {
                    ...b.progress,
                    percent: progress,
                    phase: (phase || 'distilling') as BookInfo['progress']['phase'],
                    message: phase === 'completed'
                      ? '蒸馏完成'
                      : chapterTitle
                        ? `蒸馏中: ${chapterTitle}`
                        : '蒸馏中...',
                  },
                }
              : b
          ),
        });
      }
    );
  } catch {
    // Not in Tauri environment
  }
}

function startSSEProgress(bookId: string, emit: (partial: Partial<BookStore>) => void, getBooks: () => BookInfo[], addLog: (log: Omit<DistillLog, 'id'>) => void) {
  stopProgressPolling();

  const es = new EventSource(`/api/v1/distill-progress?book_id=${bookId}`);
  let latestPhase = '';

  es.onmessage = (ev) => {
    try {
      const data = JSON.parse(ev.data);
      if (data.type === 'done') {
        es.close();
        stopProgressPolling();
        return;
      }

      if (data.type === 'log') {
        addLog({ level: data.level || 'info', message: data.message || '', timestamp: data.timestamp || new Date().toISOString() });
        return;
      }

      if (data.type === 'phase') {
        latestPhase = data.phase;
      }

      if (data.type === 'completed') {
        addLog({ level: 'success', message: '全书蒸馏流程完成', timestamp: new Date().toISOString() });
      }

      const progress = data.percent ?? data.overall_progress ?? data.progress ?? 0;
      const message = data.message || '';
      const chapterTitle = data.chapter_title || '';

      emit({
        books: getBooks().map(b =>
          b.id === bookId
            ? {
                ...b,
                status: (data.type === 'completed' ? 'completed' : 'distilling') as BookInfo['status'],
                progress: {
                  ...b.progress,
                  percent: progress,
                  phase: (latestPhase || 'distilling') as BookInfo['progress']['phase'],
                  currentChapter: data.chapter_index ?? b.progress.currentChapter,
                  totalChapters: data.total ?? b.progress.totalChapters,
                  message: data.type === 'completed' ? '蒸馏完成' : message || (chapterTitle ? `蒸馏: ${chapterTitle}` : '蒸馏中...'),
                },
              }
            : b
        ),
      });
    } catch {}
  };

  es.onerror = () => {
    es.close();
  };
}

export const useBookStore = create<BookStore>((set, get) => ({
  books: [],
  selectedBookId: null,
  chapters: [],
  currentChapter: null,
  distillStatus: null,
  logs: [],
  logsBookId: null,
  selectedDepth: 'medium',
  isLoading: false,
  wholeBookDoc: null,

  loadBooks: async () => {
    set({ isLoading: true });
    try {
      const books = await bookApi.list();
      set({ books, isLoading: false });
      setupProgressListener(
        (partial) => set(partial),
        () => get().books
      );
    } catch {
      set({ isLoading: false });
    }
  },

  selectBook: async (bookId) => {
    if (!bookId) {
      set({ selectedBookId: null, chapters: [], distillStatus: null, currentChapter: null, wholeBookDoc: null });
      return;
    }

    const currentLogsBookId = get().logsBookId;
    if (currentLogsBookId !== bookId) {
      set({ logs: [], logsBookId: bookId });
    }
    set({ selectedBookId: bookId, currentChapter: null });

    const book = get().books.find(b => b.id === bookId);
    if (!book) return;

    try {
      const status = await distillApi.getStatus(bookId);
      set({
        chapters: status.chapters || [],
        distillStatus: status,
      });
    } catch {}

    get().loadDocument(bookId);
  },

  loadChapter: async (bookId, chapterIndex) => {
    const depth = get().selectedDepth;
    try {
      const chapter = await contentApi.getChapter(bookId, chapterIndex, depth);
      set({ currentChapter: chapter });
    } catch (err) {
      console.error('Failed to load chapter:', err);
    }
  },

  deleteBook: async (bookId) => {
    try {
      await bookApi.delete(bookId);
    } catch {}
    set(s => ({
      books: s.books.filter(b => b.id !== bookId),
      selectedBookId: s.selectedBookId === bookId ? null : s.selectedBookId,
    }));
  },

  uploadBook: async (fileOrPath: File | string) => {
    const toast = useToastStore.getState();
    const fileName = fileOrPath instanceof File ? fileOrPath.name : fileOrPath.split(/[/\\]/).pop() || fileOrPath;
    try {
      let result: any;
      if (fileOrPath instanceof File) {
        const ext = fileOrPath.name.split('.').pop()?.toLowerCase() || '';
        if (['epub', 'pdf', 'docx', 'doc', 'png', 'jpg', 'jpeg', 'gif', 'bmp', 'tiff', 'webp'].includes(ext)) {
          const buffer = await fileOrPath.arrayBuffer();
          const bytes = new Uint8Array(buffer);
          let binary = '';
          for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          const b64 = btoa(binary);
          result = await bookApi.upload(fileOrPath.name, b64);
        } else {
          const text = await fileOrPath.text();
          result = await bookApi.upload(fileOrPath.name, text);
        }
      } else {
        result = await bookApi.upload(fileOrPath);
      }

      const bookId = typeof result === 'string' ? result : result.book_id || result;
      const conversionLogs = result?.conversion_logs || [];

      if (conversionLogs.length > 0) {
        for (const log of conversionLogs) {
          if (log.level === 'success') {
            toast.addToast(log.message, 'success', 3000);
          } else if (log.level === 'warn') {
            toast.addToast(log.message, 'warning', 4000);
          }
        }
      }

      const books = await bookApi.list();
      set({ books, selectedBookId: bookId });
      toast.addToast(`"${fileName}" 上传成功`, 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('Upload failed:', msg);
      toast.addToast(`上传失败: ${msg}`, 'error', 5000);
      throw err;
    }
  },

  startDistillation: async (bookId, depth, customPrompt) => {
    set(s => ({
      selectedDepth: depth,
      logsBookId: bookId,
      books: s.books.map(b =>
        b.id === bookId
          ? { ...b, status: 'distilling', progress: { ...b.progress, phase: 'distilling', percent: 0, message: '蒸馏启动中...' } }
          : b
      ),
    }));

    const addLog = get().addLog;

    try {
      await distillApi.start(bookId, depth, customPrompt);
      startSSEProgress(bookId, (partial) => set(partial), () => get().books, addLog);
    } catch (err) {
      console.error('Distillation start failed:', err);
      addLog({ level: 'error', message: `蒸馏启动失败: ${err instanceof Error ? err.message : String(err)}`, timestamp: new Date().toISOString() });
      set(s => ({
        books: s.books.map(b =>
          b.id === bookId
            ? { ...b, status: 'parsed', progress: { ...b.progress, phase: 'parsed', message: '蒸馏启动失败' } }
            : b
        ),
      }));
    }
  },

  cancelDistillation: async (bookId) => {
    try {
      await distillApi.cancel(bookId);
    } catch {}
    set(s => ({
      books: s.books.map(b =>
        b.id === bookId
          ? { ...b, status: 'parsed', progress: { ...b.progress, phase: 'parsed', percent: 20, message: '蒸馏已取消' } }
          : b
      ),
    }));
  },

  distillChapter: async (bookId, chapterIndex, depth, customPrompt) => {
    const addLog = get().addLog;
    addLog({ level: 'info', message: `开始蒸馏第 ${chapterIndex + 1} 章...`, timestamp: new Date().toISOString() });

    try {
      const result = await distillApi.distillChapter(bookId, chapterIndex, depth, customPrompt);
      if (result.success) {
        addLog({ level: 'success', message: `第 ${chapterIndex + 1} 章蒸馏完成，提取 ${result.points_found} 个论点`, timestamp: new Date().toISOString() });
        await get().loadChapter(bookId, chapterIndex);
        const books = await bookApi.list();
        set({ books });
      } else {
        addLog({ level: 'error', message: `第 ${chapterIndex + 1} 章蒸馏失败`, timestamp: new Date().toISOString() });
      }
    } catch (err) {
      addLog({ level: 'error', message: `蒸馏失败: ${err instanceof Error ? err.message : String(err)}`, timestamp: new Date().toISOString() });
    }
  },

  setSelectedDepth: (depth) => set({ selectedDepth: depth }),

  addLog: (log) => {
    set(s => ({ logs: [...s.logs, { ...log, id: `l${Date.now()}-${Math.random().toString(36).slice(2, 6)}` }] }));
  },

  clearLogs: () => set({ logs: [] }),

  loadDocument: async (bookId) => {
    try {
      const doc = await generateApi.getDocument(bookId);
      set({ wholeBookDoc: doc?.content || null });
    } catch {
      set({ wholeBookDoc: null });
    }
  },

  generateDocument: async (bookId, customPrompt) => {
    const addLog = get().addLog;
    addLog({ level: 'info', message: '正在生成全书综合文档...', timestamp: new Date().toISOString() });
    try {
      const doc = await generateApi.generateDocument(bookId, customPrompt);
      set({ wholeBookDoc: doc.content });
      addLog({ level: 'success', message: '全书文档生成完成', timestamp: new Date().toISOString() });
    } catch (err) {
      addLog({ level: 'error', message: `文档生成失败: ${err instanceof Error ? err.message : String(err)}`, timestamp: new Date().toISOString() });
    }
  },
}));

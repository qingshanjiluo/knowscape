import { create } from 'zustand';
import { useToastStore } from '@/stores/toastStore';
import type { ChatMessage } from '@/types';

interface ChatSource {
  chapter_index: number;
  chapter_title: string;
  point_summary: string;
}

interface ChatStore {
  messages: ChatMessage[];
  isStreaming: boolean;
  progress: number;
  generationType: string | null;
  error: string | null;

  addMessage: (message: ChatMessage) => void;
  sendMessage: (content: string, bookId: string | null) => Promise<void>;
  startGeneration: (type: string, customPrompt?: string) => void;
  stopGeneration: () => void;
  clearMessages: () => void;
  clearError: () => void;
  loadChatHistory: (bookId: string) => Promise<void>;
  saveMessage: (bookId: string, role: string, content: string) => Promise<void>;
}

async function chatWithBook(
  bookId: string,
  question: string,
  history: { role: string; content: string }[]
): Promise<{ answer: string; sources?: ChatSource[] }> {
  const resp = await fetch('/api/v1/ask-question', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ book_id: bookId, question, history }),
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ detail: resp.statusText }));
    throw new Error(err.detail || '请求失败');
  }

  return resp.json();
}

function getSourcesSummary(sources?: ChatSource[]): string {
  if (!sources || sources.length === 0) return '';
  const refs = sources.map(s => `[${s.chapter_title}]`).join('、');
  return `\n\n📚 参考章节: ${refs}`;
}

export const useChatStore = create<ChatStore>((set, get) => ({
  messages: [],
  isStreaming: false,
  progress: 0,
  generationType: null,
  error: null,

  addMessage: (message) => {
    set((state) => ({
      messages: [...state.messages, message],
    }));
  },

  sendMessage: async (content: string, bookId: string | null) => {
    const toast = useToastStore.getState();

    if (!bookId) {
      toast.addToast('请先选择一本书进行对话', 'warning');
      return;
    }

    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
    };

    const tempMessage: ChatMessage = {
      id: `msg-${Date.now() + 1}`,
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
      isStreaming: true,
    };

    set((state) => ({
      messages: [...state.messages, userMessage, tempMessage],
      isStreaming: true,
      error: null,
    }));

    const history = get().messages.slice(-10).filter(m => !m.isStreaming).map(m => ({
      role: m.role,
      content: m.content,
    }));

    try {
      const result = await chatWithBook(bookId, content, history);
      const sourcesText = getSourcesSummary(result.sources);
      const answerText = result.answer + sourcesText;

      set((state) => ({
        messages: state.messages.map(msg =>
          msg.id === tempMessage.id
            ? { ...msg, content: answerText, isStreaming: false }
            : msg
        ),
        isStreaming: false,
      }));

      get().saveMessage(bookId, 'user', content);
      get().saveMessage(bookId, 'assistant', answerText);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '未知错误';
      set((state) => ({
        messages: state.messages.filter(msg => msg.id !== tempMessage.id),
        isStreaming: false,
        error: errorMsg,
      }));
      toast.addToast(`对话失败: ${errorMsg}`, 'error');
    }
  },

  startGeneration: async (type: string, customPrompt?: string) => {
    const { useBookStore } = await import('@/stores/bookStore');
    const bookId = useBookStore.getState().selectedBookId;
    if (!bookId) {
      useToastStore.getState().addToast('请先选择一本书', 'warning');
      return;
    }

    set({ isStreaming: true, progress: 0, generationType: type });

    try {
      const userMessage: ChatMessage = {
        id: `msg-${Date.now()}`,
        role: 'user',
        content: `请求生成: ${type === 'mindmap' ? '思维导图' : type === 'summary' ? '内容总结' : type === 'tags' ? '标签生成' : type}`,
        timestamp: new Date().toISOString(),
      };
      set((state) => ({ messages: [...state.messages, userMessage] }));

      const messageContent = customPrompt || `请帮我生成全书的${type === 'mindmap' ? '思维导图' : type === 'summary' ? '内容总结' : type === 'tags' ? '标签分类' : '综合分析文档'}，包含框架结构和关键知识点。`;
      
      const resp = await fetch('/api/v1/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          book_id: bookId,
          message: messageContent,
          history: get().messages.slice(-6).filter(m => !m.isStreaming).map(m => ({ role: m.role, content: m.content })),
        }),
      });

      if (!resp.ok) throw new Error('生成失败');
      const data = await resp.json();

      const assistantMessage: ChatMessage = {
        id: `msg-${Date.now() + 1}`,
        role: 'assistant',
        content: data.answer || '生成完成',
        timestamp: new Date().toISOString(),
      };
      set((state) => ({
        messages: [...state.messages, assistantMessage],
        isStreaming: false,
        progress: 100,
        generationType: null,
      }));
      setTimeout(() => set({ progress: 0 }), 500);
    } catch (error) {
      set({ isStreaming: false, progress: 0, generationType: null });
      useToastStore.getState().addToast(`生成失败: ${error instanceof Error ? error.message : '未知错误'}`, 'error');
    }
  },

  stopGeneration: () => {
    set((state) => ({
      isStreaming: false,
      generationType: null,
      messages: state.messages.map(msg =>
        msg.isStreaming ? { ...msg, content: msg.content + ' [已停止]', isStreaming: false } : msg
      ),
    }));
  },

  clearMessages: () => {
    set({ messages: [], error: null });
  },

  clearError: () => {
    set({ error: null });
  },

  loadChatHistory: async (bookId: string) => {
    try {
      const resp = await fetch(`/api/v1/get-chat-history?book_id=${bookId}`);
      if (!resp.ok) return;
      const data = await resp.json();
      if (!Array.isArray(data) || data.length === 0) return;
      const loaded: ChatMessage[] = data.map((m: { id: string; role: string; content: string; timestamp: string }) => ({
        id: m.id,
        role: m.role as 'user' | 'assistant',
        content: m.content,
        timestamp: m.timestamp,
      }));
      set({ messages: loaded });
    } catch {
      // Silently fail - start fresh
    }
  },

  saveMessage: async (bookId: string, role: string, content: string) => {
    try {
      await fetch('/api/v1/save-chat-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ book_id: bookId, role, content }),
      });
    } catch {
      // Best effort - don't break the UI
    }
  },
}));

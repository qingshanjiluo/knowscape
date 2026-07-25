import { useState, useRef, useCallback, useEffect } from 'react';
import {
  BookOpen,
  Upload,
  Trash2,
  Search,
  ChevronLeft,
  ChevronRight,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Send,
  Bot,
  User,
  GripHorizontal,
  Wrench,
  BarChart3,
  HardDrive,
} from 'lucide-react';
import { useBookStore } from '@/stores/bookStore';
import { useUIStore } from '@/stores/uiStore';
import type { BookStatus } from '@/types';
import ProgressRing from '@/components/ui/ProgressRing';
import { StorageIndicator, ShelfCapacity, StorageUpgradeDialog } from '@/components/storage';

const STATUS_ICONS: Record<BookStatus, { icon: typeof CheckCircle2; color: string }> = {
  idle: { icon: BookOpen, color: 'var(--color-ks-text-muted)' },
  importing: { icon: Loader2, color: 'var(--color-ks-warning)' },
  parsing: { icon: Loader2, color: 'var(--color-ks-warning)' },
  parsed: { icon: CheckCircle2, color: 'var(--color-ks-success)' },
  distilling: { icon: Loader2, color: 'var(--color-ks-primary)' },
  completed: { icon: CheckCircle2, color: 'var(--color-ks-success)' },
  error: { icon: AlertCircle, color: 'var(--color-ks-error)' },
};

const SPINNING: Record<string, boolean> = {
  importing: true,
  parsing: true,
  distilling: true,
};

export default function Sidebar() {
  const books = useBookStore((s) => s.books);
  const selectedBookId = useBookStore((s) => s.selectedBookId);
  const selectBook = useBookStore((s) => s.selectBook);
  const deleteBook = useBookStore((s) => s.deleteBook);
  const uploadBook = useBookStore((s) => s.uploadBook);
  const isLoading = useBookStore((s) => s.isLoading);

  const collapsed = useUIStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const setViewMode = useUIStore((s) => s.setViewMode);

  const [searchQuery, setSearchQuery] = useState('');
  const [hoveredBookId, setHoveredBookId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [showStorageDialog, setShowStorageDialog] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'assistant'; content: string; toolCalls?: { tool: string; args: string; result_summary: string }[] }[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [bottomTab, _setBottomTab] = useState<'agent' | 'mindmap'>('agent');
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);

  const [splitRatio, setSplitRatio] = useState(0.55);
  const isDragging = useRef(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  const filteredBooks = books.filter((b) =>
    b.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    b.author.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const distilledCount = books.filter((b) => b.stats.distilledPoints > 0).length;
  const totalPoints = books.reduce((sum, b) => sum + b.stats.distilledPoints, 0);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  useEffect(() => {
    if (!selectedBookId) {
      setChatMessages([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const resp = await fetch(`/api/v1/get-chat-history?book_id=${selectedBookId}`);
        if (!resp.ok) return;
        const data = await resp.json();
        if (cancelled || !Array.isArray(data) || data.length === 0) return;
        setChatMessages(data.map((m: { role: string; content: string }) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })));
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [selectedBookId]);

  const handleUpload = useCallback(async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selected = await open({
        multiple: false,
        filters: [{ name: '书籍', extensions: ['epub', 'pdf', 'md', 'markdown'] }],
      });
      if (selected) {
        const path = typeof selected === 'string' ? selected : ('path' in selected ? (selected as { path: string }).path : null);
        if (path) uploadBook(path);
      }
    } catch {
      fileInputRef.current?.click();
    }
  }, [uploadBook]);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        uploadBook(file);
        e.target.value = '';
      }
    },
    [uploadBook],
  );

  const handleDelete = useCallback(
    async (bookId: string) => {
      if (confirmDeleteId === bookId) {
        await deleteBook(bookId);
        setConfirmDeleteId(null);
      } else {
        setConfirmDeleteId(bookId);
        setTimeout(() => setConfirmDeleteId((prev) => (prev === bookId ? null : prev)), 3000);
      }
    },
    [confirmDeleteId, deleteBook],
  );

  const sendChat = useCallback(async () => {
    const text = chatInput.trim();
    if (!text || chatLoading) return;

    setChatInput('');
    setChatMessages((prev) => [...prev, { role: 'user', content: text }]);
    setChatLoading(true);

    try {
      const history = chatMessages.slice(-6).map((m) => ({ role: m.role, content: m.content }));
      let resp = await fetch('/api/v1/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ book_id: selectedBookId || null, message: text, history }),
      });
      
      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        if (errData.detail?.includes('provider') || errData.detail?.includes('LLM') || errData.detail?.includes('配置') || resp.status === 500) {
          resp = await fetch('/api/v1/ask-question', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ book_id: selectedBookId || null, question: text, history }),
          });
        } else {
          throw new Error(errData.detail || `请求失败 (${resp.status})`);
        }
      }
      
      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.detail || `请求失败 (${resp.status})。请在设置中配置 LLM 提供商。`);
      }
      
      const data = await resp.json();
      const answer = data.answer || data.detail || '抱歉，暂时无法回答。';
      setChatMessages((prev) => [...prev, { role: 'assistant', content: answer, toolCalls: data.tool_calls || [] }]);

      if (selectedBookId) {
        fetch('/api/v1/save-chat-message', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ book_id: selectedBookId, role: 'user', content: text }) }).catch(() => {});
        fetch('/api/v1/save-chat-message', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ book_id: selectedBookId, role: 'assistant', content: answer }) }).catch(() => {});
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '未知错误';
      const hint = msg.includes('配置') || msg.includes('provider') || msg.includes('LLM') ? '\n💡 请在右上角设置中配置 LLM 提供商' : '';
      setChatMessages((prev) => [...prev, { role: 'assistant', content: `[错误] ${msg}${hint}` }]);
    } finally {
      setChatLoading(false);
    }
  }, [chatInput, chatLoading, chatMessages, selectedBookId]);

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    const startY = e.clientY;
    const startRatio = splitRatio;
    const sidebarEl = sidebarRef.current;
    if (!sidebarEl) return;
    const sidebarHeight = sidebarEl.clientHeight;

    const onMove = (ev: MouseEvent) => {
      if (!isDragging.current) return;
      const delta = ev.clientY - startY;
      const newRatio = Math.min(0.8, Math.max(0.2, startRatio + delta / sidebarHeight));
      setSplitRatio(newRatio);
    };
    const onUp = () => {
      isDragging.current = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [splitRatio]);

  return (
    <>
    <aside
      ref={sidebarRef}
      className="flex flex-col h-full select-none overflow-hidden w-full"
      style={{
        backgroundColor: 'var(--color-ks-sidebar)',
      }}
    >
      <button
        onClick={toggleSidebar}
        className="flex items-center justify-center w-full h-8 cursor-pointer transition-opacity duration-150 hover:opacity-70 shrink-0"
        style={{ color: 'var(--color-ks-text-muted)' }}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>

      {!collapsed && (
        <>
          {/* Top: Book List Section */}
          <div className="flex flex-col shrink-0" style={{ height: `${splitRatio * 100}%`, minHeight: 120 }}>
            {/* Search + Upload */}
            <div className="px-3 mb-2 flex items-center gap-1.5">
              <div
                className="flex-1 flex items-center gap-2 h-8 px-2.5 rounded-[var(--radius-ks-sm)]"
                style={{ backgroundColor: 'var(--color-ks-card)', border: '1px solid var(--color-ks-border)' }}
              >
                <Search size={13} style={{ color: 'var(--color-ks-text-muted)', flexShrink: 0 }} />
                <input
                  type="text"
                  placeholder="搜索书籍..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-transparent text-xs outline-none placeholder:text-[var(--color-ks-text-disabled)]"
                  style={{ color: 'var(--color-ks-text)', fontFamily: 'var(--font-family-ks-heading)' }}
                />
              </div>
              <button
                onClick={handleUpload}
                className="flex items-center justify-center h-8 w-8 rounded-[var(--radius-ks-sm)] cursor-pointer transition-opacity duration-150 hover:opacity-80 shrink-0"
                style={{ backgroundColor: 'var(--color-ks-primary)', color: 'white' }}
                title="导入书籍"
              >
                <Upload size={13} />
              </button>
            </div>

            {/* Book List */}
            <div className="flex-1 overflow-y-auto px-1.5">
              {isLoading && books.length === 0 ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 size={18} className="ks-animate-spin" style={{ color: 'var(--color-ks-text-muted)' }} />
                </div>
              ) : filteredBooks.length === 0 ? (
                <div className="text-center py-8 text-xs" style={{ color: 'var(--color-ks-text-muted)' }}>
                  {searchQuery ? '未找到匹配的书籍' : '暂无书籍，点击上方导入'}
                </div>
              ) : (
                <div className="flex flex-col gap-0.5">
                  {filteredBooks.map((book) => {
                    const { icon: StatusIcon, color: statusColor } = STATUS_ICONS[book.status] ?? STATUS_ICONS.idle;
                    const isSpinning = SPINNING[book.status] ?? false;
                    const isSelected = book.id === selectedBookId;
                    const isHovered = book.id === hoveredBookId;
                    const isConfirmingDelete = book.id === confirmDeleteId;

                    return (
                      <div
                        key={book.id}
                        className="group relative flex items-center gap-2.5 px-2.5 py-2 rounded-[var(--radius-ks-sm)] cursor-pointer transition-colors duration-100"
                        style={{
                          backgroundColor: isSelected ? 'var(--color-ks-hover)' : isHovered ? 'rgba(74, 111, 165, 0.03)' : 'transparent',
                        }}
                        onClick={() => { selectBook(book.id); setViewMode('distill'); }}
                        onMouseEnter={() => setHoveredBookId(book.id)}
                        onMouseLeave={() => { setHoveredBookId(null); if (!isConfirmingDelete) setConfirmDeleteId(null); }}
                      >
                        <StatusIcon size={14} className={isSpinning ? 'ks-animate-spin' : ''} style={{ color: statusColor, flexShrink: 0 }} />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium truncate leading-4" style={{ color: isSelected ? 'var(--color-ks-text)' : 'var(--color-ks-text-secondary)', fontFamily: 'var(--font-family-ks-heading)' }}>
                            {book.title}
                          </div>
                          <div className="text-[11px] truncate leading-4 mt-0.5" style={{ color: 'var(--color-ks-text-muted)' }}>
                            {book.author}
                          </div>
                        </div>
                        {book.stats.distilledPoints > 0 && (
                          <ProgressRing value={book.progress.percent} size={24} strokeWidth={2} color={book.status === 'completed' ? 'var(--color-ks-success)' : undefined} showLabel={false} />
                        )}
                        {isHovered && book.status !== 'distilling' && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDelete(book.id); }}
                            className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded-[var(--radius-ks-sm)] cursor-pointer transition-colors duration-100 z-10"
                            style={{ backgroundColor: isConfirmingDelete ? 'var(--color-ks-error)' : 'var(--color-ks-border)', color: isConfirmingDelete ? 'white' : 'var(--color-ks-text-muted)' }}
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Progress Dashboard */}
            <div className="px-3 py-2 border-t" style={{ borderColor: 'var(--color-ks-border)' }}>
              <div className="flex items-center gap-1 mb-1.5">
                <BarChart3 size={10} style={{ color: 'var(--color-ks-primary)' }} />
                <span className="text-[10px] font-medium" style={{ color: 'var(--color-ks-text-secondary)', fontFamily: 'var(--font-family-ks-heading)' }}>
                  阅读概览
                </span>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <div className="py-1 px-1.5 rounded" style={{ backgroundColor: 'var(--color-ks-hover)' }}>
                  <div className="text-[10px]" style={{ color: 'var(--color-ks-text-muted)' }}>书籍</div>
                  <div className="text-xs font-semibold" style={{ color: 'var(--color-ks-text)' }}>{books.length}</div>
                </div>
                <div className="py-1 px-1.5 rounded" style={{ backgroundColor: 'var(--color-ks-hover)' }}>
                  <div className="text-[10px]" style={{ color: 'var(--color-ks-text-muted)' }}>已蒸馏</div>
                  <div className="text-xs font-semibold" style={{ color: 'var(--color-ks-success)' }}>{distilledCount}</div>
                </div>
                <div className="py-1 px-1.5 rounded" style={{ backgroundColor: 'var(--color-ks-hover)' }}>
                  <div className="text-[10px]" style={{ color: 'var(--color-ks-text-muted)' }}>知识点</div>
                  <div className="text-xs font-semibold" style={{ color: 'var(--color-ks-warning)' }}>{totalPoints}</div>
                </div>
                <div className="py-1 px-1.5 rounded" style={{ backgroundColor: 'var(--color-ks-hover)' }}>
                  <div className="text-[10px]" style={{ color: 'var(--color-ks-text-muted)' }}>待处理</div>
                  <div className="text-xs font-semibold" style={{ color: 'var(--color-ks-error)' }}>{books.length - distilledCount}</div>
                </div>
              </div>
            </div>

            {/* Storage & Shelf */}
            <div className="border-t" style={{ borderColor: 'var(--color-ks-border)' }}>
              <StorageIndicator />
              <ShelfCapacity onUpgrade={() => setShowStorageDialog(true)} />
            </div>
          </div>

          {/* Drag Handle */}
          <div
            className="shrink-0 flex items-center justify-center h-4 cursor-row-resize hover:opacity-80 transition-opacity"
            style={{ borderTop: '1px solid var(--color-ks-border)', borderBottom: '1px solid var(--color-ks-border)', backgroundColor: 'var(--color-ks-card)' }}
            onMouseDown={handleDragStart}
          >
            <GripHorizontal size={12} style={{ color: 'var(--color-ks-text-muted)' }} />
          </div>

          {/* Bottom: AI Assistant */}
          <div className="flex flex-col min-h-0" style={{ flex: 1 }}>
            <div className="flex items-center gap-2 px-3 py-2 shrink-0" style={{ borderBottom: '1px solid var(--color-ks-border)' }}>
              <Bot size={13} style={{ color: 'var(--color-ks-primary)' }} />
              <span className="text-[11px] font-semibold font-[var(--font-family-ks-heading)]" style={{ color: 'var(--color-ks-text)' }}>
                AI 助手
              </span>
              {selectedBookId && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: 'var(--color-ks-hover)', color: 'var(--color-ks-text-muted)' }}>
                  当前书籍
                </span>
              )}
            </div>

            {/* Chat messages */}
            {bottomTab === 'agent' && (
            <>
            <div className="flex-1 overflow-y-auto px-3 py-1">
              {chatMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-2 py-4">
                  <Bot size={20} style={{ color: 'var(--color-ks-text-disabled)' }} />
                  <p className="text-[11px] text-center leading-relaxed" style={{ color: 'var(--color-ks-text-muted)' }}>
                    向 AI 提问，它会基于{selectedBookId ? '当前书籍' : '所有书籍'}内容回答
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {chatMessages.map((msg, i) => (
                    <div key={i} className="flex flex-col gap-1">
                      {/* User message */}
                      {msg.role === 'user' && (
                        <div className="flex gap-2 justify-end">
                          <div
                            className="max-w-[85%] px-2.5 py-1.5 rounded-lg text-[11px] leading-relaxed whitespace-pre-wrap"
                            style={{ backgroundColor: 'var(--color-ks-primary)', color: 'white' }}
                          >
                            {msg.content}
                          </div>
                          <div className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center mt-0.5" style={{ backgroundColor: 'var(--color-ks-hover)', color: 'var(--color-ks-text-secondary)' }}>
                            <User size={10} />
                          </div>
                        </div>
                      )}

                      {/* Tool calls */}
                      {msg.role === 'assistant' && msg.toolCalls && msg.toolCalls.length > 0 && (
                        <div className="flex gap-2 justify-start ml-7">
                          <div className="max-w-[85%] flex flex-col gap-1">
                            {msg.toolCalls.map((tc, j) => {
                              const toolNames: Record<string, string> = {
                                read_chapter: '📖 阅读章节', list_chapters: '📋 章节列表', get_framework: '🏗️ 知识框架',
                                distill_chapter: '🔬 蒸馏章节', generate_document: '📝 生成文档', search_knowledge: '🔍 搜索知识', get_stats: '📊 统计信息',
                              };
                              return (
                                <div key={j} className="flex items-center gap-1.5 px-2 py-1 rounded text-[10px]" style={{ backgroundColor: 'var(--color-ks-hover)', border: '1px solid var(--color-ks-border)', color: 'var(--color-ks-text-secondary)' }}>
                                  <Wrench size={9} style={{ color: 'var(--color-ks-primary)', flexShrink: 0 }} />
                                  <span className="font-medium font-[var(--font-family-ks-heading)]">{toolNames[tc.tool] || tc.tool}</span>
                                  {tc.result_summary && <span className="truncate opacity-60">· {tc.result_summary}</span>}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Assistant text */}
                      {msg.role === 'assistant' && (
                        <div className="flex gap-2 justify-start">
                          <div className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center mt-0.5" style={{ backgroundColor: 'var(--color-ks-primary)', color: 'white' }}>
                            <Bot size={10} />
                          </div>
                          <div
                            className="max-w-[85%] px-2.5 py-1.5 rounded-lg text-[11px] leading-relaxed whitespace-pre-wrap"
                            style={{ backgroundColor: 'var(--color-ks-card)', color: 'var(--color-ks-text-secondary)', border: '1px solid var(--color-ks-border)' }}
                          >
                            {msg.content}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  {chatLoading && (
                    <div className="flex gap-2">
                      <div className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--color-ks-primary)', color: 'white' }}>
                        <Bot size={10} />
                      </div>
                      <div className="px-2.5 py-1.5 rounded-lg" style={{ backgroundColor: 'var(--color-ks-card)', border: '1px solid var(--color-ks-border)' }}>
                        <Loader2 size={12} className="ks-animate-spin" style={{ color: 'var(--color-ks-text-muted)' }} />
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>
              )}
            </div>

            {/* Chat input */}
            <div className="shrink-0 px-3 pb-2 pt-1">
              <div
                className="flex items-center gap-1.5 h-8 px-2 rounded-[var(--radius-ks-sm)]"
                style={{ backgroundColor: 'var(--color-ks-card)', border: '1px solid var(--color-ks-border)' }}
              >
                <input
                  ref={chatInputRef}
                  type="text"
                  placeholder="问我任何问题..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); } }}
                  disabled={chatLoading}
                  className="flex-1 bg-transparent text-[11px] outline-none placeholder:text-[var(--color-ks-text-disabled)]"
                  style={{ color: 'var(--color-ks-text)', fontFamily: 'var(--font-family-ks-heading)' }}
                />
                <button
                  onClick={sendChat}
                  disabled={!chatInput.trim() || chatLoading}
                  className="p-1 rounded cursor-pointer transition-opacity disabled:opacity-30 hover:opacity-80"
                  style={{ color: 'var(--color-ks-primary)' }}
                >
                  <Send size={12} />
                </button>
              </div>
            </div>
            </>
            )}
          </div>
        </>
      )}

      {/* Collapsed state: upload button */}
      {collapsed && (
        <div className="flex flex-col items-center gap-2 mt-2 shrink-0">
          <button
            onClick={handleUpload}
            className="p-1.5 rounded-[var(--radius-ks-sm)] cursor-pointer transition-opacity duration-150 hover:opacity-70"
            style={{ color: 'var(--color-ks-text-muted)' }}
            aria-label="Upload book"
          >
            <Upload size={16} />
          </button>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".epub,.pdf,.txt,.md,.markdown,.docx,.doc,.html,.htm,.png,.jpg,.jpeg,.gif,.bmp,.tiff,.webp"
        className="hidden"
        onChange={handleFileChange}
      />
    </aside>

      <StorageUpgradeDialog
        open={showStorageDialog}
        onClose={() => setShowStorageDialog(false)}
      />
    </>
  );
}

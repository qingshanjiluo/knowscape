import { useCallback, useRef, useState, useEffect } from 'react';
import { Upload, ArrowUpDown, BookOpen, FileUp, FileText, Loader2, CheckCircle } from 'lucide-react';
import type { BookInfo } from '@/types';
import { useBookStore } from '@/stores/bookStore';
import { useUIStore } from '@/stores/uiStore';
import { Button, Modal } from '@/components/ui';
import BookGrid from './BookGrid';

type SortKey = 'title' | 'author' | 'createdAt' | 'updatedAt';
type SortDir = 'asc' | 'desc';

function sortBooks(books: BookInfo[], key: SortKey, dir: SortDir): BookInfo[] {
  const sorted = [...books].sort((a, b) => {
    const av = a[key];
    const bv = b[key];
    if (av < bv) return dir === 'asc' ? -1 : 1;
    if (av > bv) return dir === 'asc' ? 1 : -1;
    return 0;
  });
  return sorted;
}

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'updatedAt', label: '最近更新' },
  { key: 'createdAt', label: '导入时间' },
  { key: 'title', label: '书名' },
  { key: 'author', label: '作者' },
];

async function openFilePicker(): Promise<string | null> {
  try {
    const { open } = await import('@tauri-apps/plugin-dialog');
    const selected = await open({
      multiple: false,
      filters: [{ name: '书籍', extensions: ['epub', 'pdf', 'md', 'markdown', 'txt'] }],
    });
    if (selected && typeof selected === 'string') return selected;
    if (selected && typeof selected === 'object' && 'path' in selected) return (selected as { path: string }).path;
    return null;
  } catch {
    return null;
  }
}

export default function BookLibrary() {
  const books = useBookStore((s) => s.books);
  const selectBook = useBookStore((s) => s.selectBook);
  const deleteBook = useBookStore((s) => s.deleteBook);
  const loadBooks = useBookStore((s) => s.loadBooks);
  const setViewMode = useUIStore((s) => s.setViewMode);

  const [sortKey, setSortKey] = useState<SortKey>('updatedAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [parsingBookId, setParsingBookId] = useState<string | null>(null);
  const [parsingStatus, setParsingStatus] = useState<'parsing' | 'splitting' | 'titling' | 'done' | 'error'>('parsing');
  const [parsingMessage, setParsingMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const sorted = sortBooks(books, sortKey, sortDir);

  useEffect(() => {
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, []);

  useEffect(() => {
    if (!parsingBookId || parsingStatus === 'done' || parsingStatus === 'error') return;
    pollingRef.current = setInterval(async () => {
      try {
        const resp = await fetch(`/api/v1/preprocess-status/${parsingBookId}`);
        const data = await resp.json();
        const book = books.find(b => b.id === parsingBookId);
        if (book?.status === 'parsed' || data) {
          setParsingStatus('done');
          setParsingMessage('解析完成！可开始蒸馏');
          if (pollingRef.current) clearInterval(pollingRef.current);
          loadBooks();
        }
      } catch {}
    }, 1500);
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, [parsingBookId, parsingStatus]);

  const handleSelect = useCallback(
    (id: string) => {
      selectBook(id);
      setViewMode('distill');
    },
    [selectBook, setViewMode],
  );

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files) return;
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const ext = file.name.split('.').pop()?.toLowerCase() || '';
        if (['epub', 'pdf', 'md', 'markdown', 'txt'].includes(ext)) {
          try {
            const formData = new FormData();
            formData.append('file', file);
            const resp = await fetch('/api/v1/upload-book', { method: 'POST', body: formData });
            const data = await resp.json();
            if (data.id) {
              setParsingBookId(data.id);
              setParsingStatus('parsing');
              setParsingMessage('正在解析书籍内容...');
              loadBooks();
            }
          } catch (err) {
            console.error('Upload failed:', err);
          }
        }
      }
      setUploadModalOpen(false);
    },
    [loadBooks],
  );

  const handleTauriUpload = useCallback(async () => {
    const path = await openFilePicker();
    if (path) {
      try {
        const resp = await fetch('/api/v1/upload-book', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ file_path: path }),
        });
        const data = await resp.json();
        if (data.id) {
          setParsingBookId(data.id);
          setParsingStatus('parsing');
          setParsingMessage('正在解析书籍内容...');
          loadBooks();
        }
      } catch (err) {
        console.error('Upload failed:', err);
      }
      setUploadModalOpen(false);
    }
  }, [loadBooks]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles],
  );

  const toggleSortDir = () => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div
        className="flex items-center justify-between px-6 py-4 shrink-0"
        style={{ borderBottom: '1px solid var(--color-ks-border)' }}
      >
        <div className="flex items-center gap-3">
          <h1
            className="text-xl font-semibold font-[var(--font-family-ks-heading)]"
            style={{ color: 'var(--color-ks-text)' }}
          >
            所有书籍
            <span
              className="ml-2 text-sm font-normal"
              style={{ color: 'var(--color-ks-text-muted)' }}
            >
              ({books.length})
            </span>
          </h1>
        </div>

        <div className="flex items-center gap-2">
          {/* Sort dropdown */}
          <div className="flex items-center gap-1">
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className="text-xs py-1.5 px-2 rounded-[var(--radius-ks-sm)] cursor-pointer font-[var(--font-family-ks-heading)] outline-none"
              style={{
                backgroundColor: 'var(--color-ks-card)',
                border: '1px solid var(--color-ks-border)',
                color: 'var(--color-ks-text-secondary)',
              }}
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.key} value={opt.key}>
                  {opt.label}
                </option>
              ))}
            </select>
            <button
              onClick={toggleSortDir}
              className="p-1.5 rounded-[var(--radius-ks-sm)] cursor-pointer transition-colors duration-150 hover:opacity-80"
              style={{
                color: 'var(--color-ks-text-muted)',
                backgroundColor: 'var(--color-ks-card)',
                border: '1px solid var(--color-ks-border)',
              }}
              title={sortDir === 'asc' ? '升序' : '降序'}
            >
              <ArrowUpDown size={14} />
            </button>
          </div>

          {/* Upload button */}
          <Button
            variant="primary"
            size="sm"
            icon={<Upload size={14} />}
            onClick={() => setUploadModalOpen(true)}
          >
            导入书籍
          </Button>
        </div>
      </div>

      {/* Content with drag-and-drop zone */}
      <div
        className="flex-1 overflow-y-auto p-6 relative"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Drag overlay */}
        {dragActive && (
          <div
            className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 ks-animate-fade-in"
            style={{
              backgroundColor: 'rgba(74, 111, 165, 0.08)',
              border: '2px dashed var(--color-ks-primary)',
              borderRadius: 'var(--radius-ks-lg)',
              margin: 12,
            }}
          >
            <FileUp
              size={48}
              strokeWidth={1.5}
              style={{ color: 'var(--color-ks-primary)' }}
            />
            <p
              className="text-base font-medium font-[var(--font-family-ks-heading)]"
              style={{ color: 'var(--color-ks-primary)' }}
            >
              释放文件以导入
            </p>
          </div>
        )}

        {sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-6" style={{ color: 'var(--color-ks-text-muted)' }}>
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: 'var(--color-ks-hover)' }}>
              <BookOpen size={32} style={{ color: 'var(--color-ks-primary)' }} />
            </div>
            <div className="text-center">
              <p className="text-base font-semibold" style={{ color: 'var(--color-ks-text)', fontFamily: 'var(--font-family-ks-heading)' }}>
                {books.length === 0 ? '开始你的第一次阅读' : '未找到匹配的书籍'}
              </p>
              <p className="text-xs mt-1 max-w-xs" style={{ color: 'var(--color-ks-text-muted)' }}>
                {books.length === 0 ? '上传一本书籍，AI 将自动为你拆解、蒸馏、生成知识图谱' : '尝试其他搜索条件'}
              </p>
            </div>
            {books.length === 0 && (
              <>
                <div className="grid grid-cols-4 gap-3 w-full max-w-sm">
                  {[
                    { ext: 'EPUB', color: 'var(--color-ks-primary)' },
                    { ext: 'PDF', color: 'var(--color-ks-error)' },
                    { ext: 'DOCX', color: 'var(--color-ks-info)' },
                    { ext: 'MD', color: 'var(--color-ks-success)' },
                  ].map((f) => (
                    <div key={f.ext} className="flex flex-col items-center gap-1 py-2 rounded-lg" style={{ backgroundColor: 'var(--color-ks-hover)', border: '1px solid var(--color-ks-border)' }}>
                      <FileText size={16} style={{ color: f.color }} />
                      <span className="text-[10px] font-medium" style={{ color: 'var(--color-ks-text-secondary)' }}>.{f.ext}</span>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-4 text-[10px]" style={{ color: 'var(--color-ks-text-disabled)' }}>
                  <span>📄 导入</span>
                  <span>→</span>
                  <span>🤖 蒸馏</span>
                  <span>→</span>
                  <span>📊 学习</span>
                </div>
              </>
            )}
          </div>
        ) : (
          <BookGrid
            books={sorted}
            onSelect={handleSelect}
            onDelete={deleteBook}
            onAddBook={() => setUploadModalOpen(true)}
          />
        )}

        {parsingBookId && parsingStatus !== 'done' && parsingStatus !== 'error' && (
          <div className="fixed bottom-6 right-6 z-50 w-80 rounded-xl p-4 shadow-lg" style={{ backgroundColor: 'var(--color-ks-card)', border: '1px solid var(--color-ks-border)' }}>
            <div className="flex items-center gap-3">
              <Loader2 size={18} className="animate-spin" style={{ color: 'var(--color-ks-primary)' }} />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold font-[var(--font-family-ks-heading)]" style={{ color: 'var(--color-ks-text)' }}>
                  书籍解析中
                </div>
                <div className="text-[10px] mt-0.5" style={{ color: 'var(--color-ks-text-muted)' }}>
                  {parsingMessage}
                </div>
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              {['parsing', 'splitting', 'titling', 'done'].map((step, i) => (
                <div key={step} className="flex-1 flex flex-col items-center gap-1">
                  <div className="h-1 w-full rounded-full" style={{
                    backgroundColor: ['parsing', 'splitting', 'titling', 'done'].indexOf(parsingStatus) >= i ? 'var(--color-ks-primary)' : 'var(--color-ks-border)',
                  }} />
                  <span className="text-[8px]" style={{ color: ['parsing', 'splitting', 'titling', 'done'].indexOf(parsingStatus) >= i ? 'var(--color-ks-primary)' : 'var(--color-ks-text-disabled)' }}>
                    {['解析', '分章', '提取', '完成'][i]}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
        {parsingBookId && parsingStatus === 'done' && (
          <div className="fixed bottom-6 right-6 z-50 w-80 rounded-xl p-4 shadow-lg" style={{ backgroundColor: 'var(--color-ks-card)', border: '1px solid var(--color-ks-success)' }}>
            <div className="flex items-center gap-3">
              <CheckCircle size={18} style={{ color: 'var(--color-ks-success)' }} />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold font-[var(--font-family-ks-heading)]" style={{ color: 'var(--color-ks-text)' }}>
                  解析完成
                </div>
                <div className="text-[10px] mt-0.5" style={{ color: 'var(--color-ks-text-muted)' }}>
                  可以开始蒸馏了
                </div>
              </div>
              <button onClick={() => setParsingBookId(null)} className="text-[10px] px-2 py-1 rounded cursor-pointer" style={{ color: 'var(--color-ks-text-muted)' }}>
                关闭
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Upload modal */}
      <Modal
        isOpen={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        title="导入书籍"
      >
        <div className="flex flex-col gap-4">
          <p
            className="text-sm"
            style={{ color: 'var(--color-ks-text-secondary)' }}
          >
            支持 EPUB、PDF、Markdown、TXT 格式的书籍文件
          </p>

          {/* Drop zone in modal */}
          <label
            htmlFor="book-file-input"
            className={[
              'flex flex-col items-center justify-center gap-3 py-10 cursor-pointer',
              'rounded-[var(--radius-ks-md)] transition-colors duration-150',
            ].join(' ')}
            style={{
              border: '2px dashed var(--color-ks-border)',
              backgroundColor: 'var(--color-ks-bg)',
            }}
          >
            <BookOpen
              size={32}
              strokeWidth={1.5}
              style={{ color: 'var(--color-ks-text-muted)' }}
            />
            <div className="text-center">
              <p
                className="text-sm font-medium font-[var(--font-family-ks-heading)]"
                style={{ color: 'var(--color-ks-text)' }}
              >
                拖拽文件到这里，或点击选择
              </p>
              <p
                className="text-xs mt-1"
                style={{ color: 'var(--color-ks-text-muted)' }}
              >
                .epub / .pdf / .md
              </p>
            </div>
          </label>

          <input
            ref={fileInputRef}
            id="book-file-input"
            type="file"
            accept=".epub,.pdf,.md,.markdown"
            multiple
            className="hidden"
            onChange={(e) => {
              handleFiles(e.target.files);
              e.target.value = '';
            }}
          />

          <Button
            variant="primary"
            size="sm"
            icon={<Upload size={14} />}
            onClick={handleTauriUpload}
          >
            选择本地文件
          </Button>
        </div>
      </Modal>
    </div>
  );
}

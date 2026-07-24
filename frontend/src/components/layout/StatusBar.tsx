import { Settings } from 'lucide-react';
import { useBookStore } from '@/stores/bookStore';
import { useUIStore } from '@/stores/uiStore';
import ProgressBar from '@/components/ui/ProgressBar';

export default function StatusBar() {
  const books = useBookStore((s) => s.books);
  const selectedBookId = useBookStore((s) => s.selectedBookId);
  const logs = useBookStore((s) => s.logs);
  const setSettingsOpen = useUIStore((s) => s.setSettingsOpen);

  const selectedBook = books.find((b) => b.id === selectedBookId);
  const isDistilling = selectedBook?.status === 'distilling';
  const progressPercent = selectedBook?.progress.percent ?? 0;
  const currentMessage = selectedBook?.progress.message ?? '';

  const phaseLabels: Record<string, string> = {
    parsing: '解析中',
    distilling: '蒸馏中',
    framing: '构建框架',
    document: '生成文档',
    completed: '已完成',
    idle: '就绪',
    parsed: '已解析',
  };

  const phaseLabel = selectedBook
    ? phaseLabels[selectedBook.progress.phase] || currentMessage
    : '';

  return (
    <footer
      className="flex items-center h-9 px-3 shrink-0 select-none"
      style={{
        backgroundColor: 'var(--color-ks-card)',
        borderTop: '1px solid var(--color-ks-border)',
      }}
    >
      {/* Left: Distillation progress */}
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {isDistilling && (
          <>
            <ProgressBar
              value={progressPercent}
              height={3}
              className="w-40"
            />
            <span
              className="text-[11px] tabular-nums shrink-0 font-[var(--font-family-ks-heading)]"
              style={{ color: 'var(--color-ks-text-muted)' }}
            >
              {Math.round(progressPercent)}%
            </span>
            {selectedBook && selectedBook.progress.phase !== 'completed' && selectedBook.progress.phase !== 'parsed' && (
              <span className="text-[10px] ml-2" style={{ color: 'var(--color-ks-text-muted)' }}>
                预估剩余: {selectedBook.stats.totalChapters > 0 ? Math.max(1, Math.ceil((selectedBook.stats.totalChapters - Math.round(selectedBook.stats.totalChapters * progressPercent / 100)) * 0.5)) : '?'}m
              </span>
            )}
          </>
        )}
        {selectedBook && !isDistilling && (
          <span
            className="text-[11px] font-[var(--font-family-ks-heading)] truncate"
            style={{ color: 'var(--color-ks-text-muted)' }}
          >
            {selectedBook.title} -- {phaseLabel}
          </span>
        )}
        {!selectedBook && (
          <span
            className="text-[11px] font-[var(--font-family-ks-heading)]"
            style={{ color: 'var(--color-ks-text-disabled)' }}
          >
            知境 -- 知识蒸馏与整理
          </span>
        )}
      </div>

      {/* Center: Current operation */}
      <div className="flex items-center justify-center px-4 flex-shrink-0">
        {currentMessage && isDistilling && (
          <span
            className="text-[11px] truncate max-w-[300px] font-[var(--font-family-ks-heading)]"
            style={{ color: 'var(--color-ks-text-secondary)' }}
          >
            {phaseLabel}
          </span>
        )}
      </div>

      {/* Right: Log count + Settings */}
      <div className="flex items-center gap-3 shrink-0 ml-auto">
        {logs.length > 0 && (
          <span
            className="text-[11px] tabular-nums font-[var(--font-family-ks-heading)]"
            style={{ color: 'var(--color-ks-text-muted)' }}
          >
            {logs.length} 条日志
          </span>
        )}
        <button
          onClick={() => setSettingsOpen(true)}
          className="p-1 rounded-[var(--radius-ks-sm)] cursor-pointer transition-opacity duration-150 hover:opacity-70"
          style={{ color: 'var(--color-ks-text-muted)' }}
          aria-label="Settings"
        >
          <Settings size={13} />
        </button>
      </div>
    </footer>
  );
}

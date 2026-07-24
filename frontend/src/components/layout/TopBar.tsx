import { BookOpen, Settings } from 'lucide-react';
import { useBookStore } from '@/stores/bookStore';
import { useUIStore } from '@/stores/uiStore';
import ProgressBar from '@/components/ui/ProgressBar';

export default function TopBar() {
  const books = useBookStore((s) => s.books);
  const selectedBookId = useBookStore((s) => s.selectedBookId);
  const setSettingsOpen = useUIStore((s) => s.setSettingsOpen);

  const selectedBook = books.find((b) => b.id === selectedBookId);

  return (
    <header
      className="flex items-center h-12 px-4 shrink-0 select-none"
      style={{
        backgroundColor: 'var(--color-ks-card)',
        borderBottom: '1px solid var(--color-ks-border)',
      }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2 mr-4">
        <BookOpen
          size={20}
          style={{ color: 'var(--color-ks-primary)' }}
          strokeWidth={2}
        />
        <span
          className="text-sm font-semibold tracking-tight font-[var(--font-family-ks-heading)]"
          style={{ color: 'var(--color-ks-text)' }}
        >
          知境
        </span>
      </div>

      {/* Separator */}
      <div
        className="w-px h-5 mx-2"
        style={{ backgroundColor: 'var(--color-ks-border)' }}
      />

      {/* Book title */}
      <span
        className="text-sm font-[var(--font-family-ks-heading)] truncate mr-auto"
        style={{ color: selectedBook ? 'var(--color-ks-text)' : 'var(--color-ks-text-muted)' }}
      >
        {selectedBook?.title ?? '选择一本书开始'}
      </span>

      {/* Overall progress */}
      {selectedBook && (
        <div className="flex items-center gap-2.5 ml-4">
          <ProgressBar
            value={selectedBook.progress.percent}
            height={3}
            className="w-32"
          />
          <span
            className="text-xs tabular-nums font-[var(--font-family-ks-heading)]"
            style={{ color: 'var(--color-ks-text-muted)' }}
          >
            {Math.round(selectedBook.progress.percent)}%
          </span>
        </div>
      )}

      {/* Settings button */}
      <button
        onClick={() => setSettingsOpen(true)}
        className="p-1.5 ml-3 rounded-[var(--radius-ks-sm)] cursor-pointer transition-opacity duration-150 hover:opacity-70"
        style={{ color: 'var(--color-ks-text-secondary)' }}
        aria-label="Settings"
      >
        <Settings size={16} />
      </button>
    </header>
  );
}

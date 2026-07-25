import { Trash2, Clock } from 'lucide-react';
import type { BookInfo, BookStatus } from '@/types';
import { ProgressRing, Badge } from '@/components/ui';
import { ExpiryBadge } from '@/components/storage';
import { calcDaysLeft } from '@/types/storage';
import { useState } from 'react';
import { StorageUpgradeDialog } from '@/components/storage';

interface BookCardProps {
  book: BookInfo;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}

const STATUS_CONFIG: Record<BookStatus, { label: string; color: string }> = {
  idle: { label: '待处理', color: 'var(--color-ks-text-muted)' },
  importing: { label: '导入中', color: 'var(--color-ks-warning)' },
  parsing: { label: '解析中', color: 'var(--color-ks-warning)' },
  parsed: { label: '已解析', color: 'var(--color-ks-secondary)' },
  distilling: { label: '蒸馏中', color: 'var(--color-ks-primary)' },
  completed: { label: '已完成', color: 'var(--color-ks-success)' },
  error: { label: '出错', color: 'var(--color-ks-error)' },
};

const FORMAT_LABELS: Record<string, string> = {
  epub: 'EPUB',
  pdf: 'PDF',
  markdown: 'MD',
  md: 'MD',
  txt: 'TXT',
};

export default function BookCard({ book, onSelect, onDelete }: BookCardProps) {
  const statusCfg = STATUS_CONFIG[book.status];
  const formatLabel = FORMAT_LABELS[book.sourceFormat ?? ''] ?? (book.sourceFormat || '未知').toUpperCase();
  const isProcessing = book.status === 'importing' || book.status === 'parsing' || book.status === 'distilling';
  const [showStorageDialog, setShowStorageDialog] = useState(false);

  const isShortTerm = book.storageType === 'short-term';
  const daysLeft = book.expiresAt ? calcDaysLeft(book.expiresAt) : 7;

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(book.id);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(book.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(book.id);
        }
      }}
      className={[
        'group relative flex flex-col overflow-hidden cursor-pointer',
        'rounded-[var(--radius-ks-lg)] transition-all duration-200',
        'hover:scale-[1.02] hover:shadow-lg',
        'focus-visible:outline-2 focus-visible:outline-offset-2',
      ].join(' ')}
      style={{
        backgroundColor: 'var(--color-ks-card)',
        border: '1px solid var(--color-ks-border)',
        boxShadow: '0 1px 3px var(--color-ks-shadow)',
      }}
    >
      {/* Color strip */}
      <div
        className="h-1.5 w-full shrink-0"
        style={{ backgroundColor: book.coverColor ?? 'var(--color-ks-primary)' }}
      />

      {/* Content */}
      <div className="flex flex-col flex-1 p-4 gap-3">
        {/* Top row: title + delete */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3
              className="text-sm font-semibold leading-snug truncate font-[var(--font-family-ks-heading)]"
              style={{ color: 'var(--color-ks-text)' }}
            >
              {book.title}
            </h3>
            <p
              className="text-xs mt-0.5 truncate"
              style={{ color: 'var(--color-ks-text-muted)' }}
            >
              {book.author}
            </p>
          </div>

          <button
            onClick={handleDelete}
            className={[
              'shrink-0 p-1 rounded-[var(--radius-ks-sm)]',
              'opacity-0 group-hover:opacity-100 transition-opacity duration-150',
              'cursor-pointer hover:opacity-80',
            ].join(' ')}
            style={{ color: 'var(--color-ks-text-muted)' }}
            aria-label={`删除《${book.title}》`}
          >
            <Trash2 size={14} />
          </button>
        </div>

        {/* Progress ring + status */}
        <div className="flex items-center gap-3">
          <ProgressRing
            value={book.progress.percent}
            size={36}
            strokeWidth={3}
            showLabel
          />
          <div className="flex flex-col gap-1">
            <Badge
              color={statusCfg.color}
              size="sm"
            >
              {statusCfg.label}
            </Badge>
            <Badge
              size="sm"
              variant="outlined"
              color="var(--color-ks-text-muted)"
            >
              {formatLabel}
            </Badge>
          </div>
        </div>

        {/* Stats */}
        <div
          className="flex items-center justify-between text-xs pt-2"
          style={{
            borderTop: '1px solid var(--color-ks-border)',
            color: 'var(--color-ks-text-secondary)',
          }}
        >
          <span>{book.stats.totalChapters} 章</span>
          <div className="flex items-center gap-2">
            {isShortTerm && book.expiresAt && (
              <ExpiryBadge
                expiresAt={book.expiresAt}
                onExtend={() => setShowStorageDialog(true)}
              />
            )}
            <span>{book.stats.distilledPoints} 论点</span>
          </div>
        </div>

        {/* Storage upgrade dialog */}
        {isShortTerm && (
          <StorageUpgradeDialog
            open={showStorageDialog}
            onClose={() => setShowStorageDialog(false)}
            bookId={book.id}
          />
        )}
      </div>

      {/* Processing shimmer overlay */}
      {isProcessing && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.4) 50%, transparent 70%)',
            animation: 'ks-shimmer 2s ease-in-out infinite',
          }}
        />
      )}
    </div>
  );
}

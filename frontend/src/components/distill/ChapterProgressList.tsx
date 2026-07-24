import type { ChapterSummary, DistillCategory } from '@/types';
import { DISTILL_CATEGORY_COLORS } from '@/types';
import { CheckCircle2, Loader2, Clock } from 'lucide-react';

interface ChapterProgressListProps {
  chapters: ChapterSummary[];
  elapsedMap?: Record<number, number>;
}

function StatusIcon({ status }: { status: ChapterSummary['status'] }) {
  switch (status) {
    case 'done':
      return (
        <CheckCircle2
          size={16}
          strokeWidth={2}
          style={{ color: 'var(--color-ks-success)' }}
          className="shrink-0"
        />
      );
    case 'processing':
      return (
        <Loader2
          size={16}
          strokeWidth={2}
          className="shrink-0 ks-animate-spin"
          style={{ color: 'var(--color-ks-primary)' }}
        />
      );
    case 'error':
      return (
        <CheckCircle2
          size={16}
          strokeWidth={2}
          style={{ color: 'var(--color-ks-error)' }}
          className="shrink-0"
        />
      );
    default:
      return (
        <Clock
          size={16}
          strokeWidth={1.5}
          style={{ color: 'var(--color-ks-text-disabled)' }}
          className="shrink-0"
        />
      );
  }
}

function CategoryDots({ distribution }: { distribution?: Partial<Record<DistillCategory, number>> }) {
  if (!distribution) return null;

  const entries = Object.entries(distribution).filter(([, count]) => (count ?? 0) > 0);
  if (entries.length === 0) return null;

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {entries.map(([cat]) => (
        <span
          key={cat}
          className="inline-block w-2 h-2 rounded-full shrink-0"
          style={{ backgroundColor: DISTILL_CATEGORY_COLORS[cat as DistillCategory] }}
          title={`${cat}`}
        />
      ))}
    </div>
  );
}

function getProgressBarColor(status: ChapterSummary['status']): string {
  if (status === 'done') return 'var(--color-ks-success)';
  if (status === 'processing') return 'var(--color-ks-primary)';
  if (status === 'error') return 'var(--color-ks-error)';
  return 'var(--color-ks-border)';
}

function getProgressGradient(status: ChapterSummary['status'], percent: number): string {
  if (status === 'done') return 'linear-gradient(90deg, var(--color-ks-success), #22c55e)';
  if (status === 'processing') {
    return `linear-gradient(90deg, var(--color-ks-primary), #60a5fa ${percent}%, var(--color-ks-primary-light) 100%)`;
  }
  if (status === 'error') return 'linear-gradient(90deg, var(--color-ks-error), #ef4444)';
  return 'none';
}

function getProgressPercent(chapter: ChapterSummary): number {
  if (chapter.status === 'done') return 100;
  if (chapter.status === 'processing' && chapter.tokenCount) {
    return Math.min(90, Math.max(10, Math.round(chapter.tokenCount / 30)));
  }
  if (chapter.status === 'error') return 100;
  return 0;
}

export default function ChapterProgressList({ chapters, elapsedMap = {} }: ChapterProgressListProps) {
  return (
    <div
      className="flex flex-col overflow-y-auto rounded-[var(--radius-ks-md)]"
      style={{
        maxHeight: 320,
        border: '1px solid var(--color-ks-border)',
      }}
    >
      {chapters.map((chapter) => {
        const percent = getProgressPercent(chapter);
        const elapsed = chapter.elapsed_ms || elapsedMap[chapter.index] || 0;

        return (
          <div
            key={chapter.index}
            className={[
              'flex items-start gap-3 px-4 py-3',
              'transition-colors duration-150',
            ].join(' ')}
            style={{
              borderBottom: '1px solid var(--color-ks-border)',
              backgroundColor: chapter.status === 'processing'
                ? 'var(--color-ks-hover)'
                : 'transparent',
            }}
          >
            {/* Status icon */}
            <div className="mt-0.5">
              <StatusIcon status={chapter.status} />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[10px] tabular-nums shrink-0" style={{ color: 'var(--color-ks-text-disabled)', minWidth: 20 }}>
                    {chapter.index + 1}.
                  </span>
                  <span
                    className="text-sm font-[var(--font-family-ks-heading)] truncate"
                    style={{
                      color: chapter.status === 'done'
                        ? 'var(--color-ks-text)'
                        : 'var(--color-ks-text-secondary)',
                      fontWeight: chapter.status === 'processing' ? 500 : 400,
                    }}
                  >
                    {chapter.title || `章节 ${chapter.index + 1}`}
                  </span>
                </div>

                {chapter.status === 'done' && chapter.pointCount != null && (
                  <span
                    className="text-xs shrink-0 tabular-nums"
                    style={{ color: 'var(--color-ks-success)' }}
                  >
                    {chapter.pointCount} 论点
                  </span>
                )}
                {chapter.status === 'processing' && (
                  <span
                    className="text-xs shrink-0"
                    style={{ color: 'var(--color-ks-primary)' }}
                  >
                    分析中...
                  </span>
                )}
                {chapter.status === 'error' && (
                  <span
                    className="text-xs shrink-0"
                    style={{ color: 'var(--color-ks-error)' }}
                  >
                    失败
                  </span>
                )}
                {elapsed > 0 && (
                  <span
                    className="text-xs shrink-0 tabular-nums flex items-center gap-1"
                    style={{ color: 'var(--color-ks-text-muted)' }}
                  >
                    <Clock size={10} />
                    {elapsed >= 60000
                      ? `${(elapsed / 60000).toFixed(1)}m`
                      : `${(elapsed / 1000).toFixed(1)}s`}
                  </span>
                )}
              </div>

              {/* Token count */}
              {chapter.tokenCount != null && (
                <span
                  className="text-xs tabular-nums"
                  style={{ color: 'var(--color-ks-text-muted)' }}
                >
                  {chapter.tokenCount.toLocaleString()} tokens
                </span>
              )}

              {/* Category dots */}
              {chapter.status === 'done' && (
                <div className="mt-1.5">
                  <CategoryDots distribution={chapter.categoryDistribution} />
                </div>
              )}

              {/* Mini progress bar - always show */}
              <div
                className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full"
                style={{ backgroundColor: 'var(--color-ks-border)' }}
              >
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${percent}%`,
                    background: getProgressGradient(chapter.status, percent),
                    backgroundColor: getProgressBarColor(chapter.status),
                    transition: 'width 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
                    boxShadow: chapter.status === 'processing' ? '0 0 8px var(--color-ks-primary)' : 'none',
                  }}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

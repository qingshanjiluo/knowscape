import { Library, Plus, AlertTriangle } from 'lucide-react';
import { useStorageStore } from '@/stores/storageStore';

interface ShelfCapacityProps {
  onUpgrade?: () => void;
}

export function ShelfCapacity({ onUpgrade }: ShelfCapacityProps) {
  const getSummary = useStorageStore((s) => s.getSummary);
  const summary = getSummary();

  const pct = Math.min(100, Math.round((summary.shelfUsed / summary.shelfCapacity) * 100));
  const isNearFull = summary.shelfUsed >= summary.shelfCapacity - 1;
  const isFull = summary.shelfUsed >= summary.shelfCapacity;

  return (
    <div className="px-3 py-2">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          <Library className="w-3.5 h-3.5" style={{ color: isFull ? 'var(--color-ks-error, #ef4444)' : isNearFull ? 'var(--color-ks-warning, #f59e0b)' : 'var(--color-ks-text-muted)' }} />
          <span className="text-[11px] font-[var(--font-family-ks-heading)]" style={{ color: 'var(--color-ks-text-muted)' }}>
            书架
          </span>
        </div>
        {isNearFull && !isFull && (
          <AlertTriangle className="w-3 h-3" style={{ color: 'var(--color-ks-warning, #f59e0b)' }} />
        )}
      </div>
      <div className="flex items-center justify-between">
        <span
          className="text-[11px] tabular-nums font-medium"
          style={{ color: isFull ? 'var(--color-ks-error, #ef4444)' : 'var(--color-ks-text)' }}
        >
          {summary.shelfUsed} / {summary.shelfCapacity}
        </span>
        {isNearFull && onUpgrade && (
          <button
            onClick={onUpgrade}
            className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors"
            style={{ backgroundColor: 'var(--color-ks-primary, #4A6FA5)', color: 'white' }}
          >
            <Plus className="w-2.5 h-2.5" />
            扩容
          </button>
        )}
      </div>
      <div className="w-full h-1 rounded-full overflow-hidden mt-1" style={{ backgroundColor: 'var(--color-ks-border)' }}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${pct}%`,
            backgroundColor: isFull ? 'var(--color-ks-error, #ef4444)' : isNearFull ? 'var(--color-ks-warning, #f59e0b)' : 'var(--color-ks-primary, #4A6FA5)',
          }}
        />
      </div>
    </div>
  );
}
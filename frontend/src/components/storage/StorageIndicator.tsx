import { HardDrive, AlertTriangle } from 'lucide-react';
import { useStorageStore } from '@/stores/storageStore';
import { formatBytes } from '@/types/storage';

export function StorageIndicator() {
  const getSummary = useStorageStore((s) => s.getSummary);
  const summary = getSummary();

  const usedBytes = summary.permanentUsedBytes + summary.shortTermUsedBytes;
  const totalBytes = summary.permanentTotalBytes + summary.shortTermUsedBytes;
  const pct = totalBytes > 0 ? Math.min(100, Math.round((usedBytes / totalBytes) * 100)) : 0;

  const isNearFull = pct >= 80;

  return (
    <div className="px-3 py-2">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          <HardDrive className="w-3.5 h-3.5" style={{ color: isNearFull ? 'var(--color-ks-warning, #f59e0b)' : 'var(--color-ks-text-muted)' }} />
          <span className="text-[11px] font-[var(--font-family-ks-heading)]" style={{ color: 'var(--color-ks-text-muted)' }}>
            存储空间
          </span>
        </div>
        {isNearFull && (
          <AlertTriangle className="w-3 h-3" style={{ color: 'var(--color-ks-warning, #f59e0b)' }} />
        )}
      </div>
      <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--color-ks-border)' }}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${pct}%`,
            backgroundColor: isNearFull ? 'var(--color-ks-warning, #f59e0b)' : 'var(--color-ks-primary, #4A6FA5)',
          }}
        />
      </div>
      <div className="flex justify-between mt-0.5">
        <span className="text-[10px]" style={{ color: 'var(--color-ks-text-disabled)' }}>
          {formatBytes(usedBytes)} / {formatBytes(totalBytes)}
        </span>
        <span className="text-[10px]" style={{ color: 'var(--color-ks-text-disabled)' }}>
          {pct}%
        </span>
      </div>
      {summary.shortTermItems.length > 0 && (
        <div className="mt-1 text-[10px]" style={{ color: 'var(--color-ks-warning, #f59e0b)' }}>
          {summary.shortTermItems.length} 本短期存储
        </div>
      )}
    </div>
  );
}
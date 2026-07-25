import { useState } from 'react';
import { X, CircleDollarSign, HardDrive, Library, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { useStorageStore } from '@/stores/storageStore';
import { POINTS_COST, SUBSCRIPTION_LABELS, formatBytes } from '@/types/storage';
import type { SubscriptionTier } from '@/types/storage';

interface StorageUpgradeDialogProps {
  open: boolean;
  onClose: () => void;
  bookId?: string;
}

export function StorageUpgradeDialog({ open, onClose, bookId }: StorageUpgradeDialogProps) {
  const getSummary = useStorageStore((s) => s.getSummary);
  const points = useStorageStore((s) => s.points.total);
  const upgradeStorage = useStorageStore((s) => s.upgradePermanentStorage);
  const upgradeShelf = useStorageStore((s) => s.upgradeShelfCapacity);
  const extendRetention = useStorageStore((s) => s.extendRetention);
  const summary = getSummary();
  const [showPointsHistory, setShowPointsHistory] = useState(false);

  if (!open) return null;

  const handleUpgradeStorage = () => {
    const result = upgradeStorage();
    if (result.ok) onClose();
  };

  const handleUpgradeShelf = () => {
    const result = upgradeShelf();
    if (result.ok) onClose();
  };

  const handleExtendRetention = () => {
    if (!bookId) return;
    const result = extendRetention(bookId);
    if (result.ok) onClose();
  };

  const entitle = useStorageStore.getState().getEntitlements();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div
        className="w-full max-w-md mx-4 rounded-xl shadow-xl overflow-hidden"
        style={{ backgroundColor: 'var(--color-ks-card, white)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--color-ks-border)' }}>
          <div>
            <h2 className="text-base font-semibold" style={{ color: 'var(--color-ks-text)' }}>存储与书架管理</h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-ks-text-muted)' }}>
              {SUBSCRIPTION_LABELS[summary.tier]} · 积分: {points}
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 transition-colors">
            <X className="w-4 h-4" style={{ color: 'var(--color-ks-text-muted)' }} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Storage overview */}
          <div className="p-3 rounded-lg bg-slate-50 space-y-2">
            <div className="flex items-center gap-2 text-xs font-medium" style={{ color: 'var(--color-ks-text-secondary)' }}>
              <HardDrive className="w-3.5 h-3.5" />
              永久存储
            </div>
            <div className="flex items-center justify-between text-sm">
              <span style={{ color: 'var(--color-ks-text)' }}>{formatBytes(summary.permanentUsedBytes)}</span>
              <span style={{ color: 'var(--color-ks-text-muted)' }}>/ {formatBytes(summary.permanentTotalBytes)}</span>
            </div>
            <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--color-ks-border)' }}>
              <div
                className="h-full rounded-full bg-blue-500 transition-all"
                style={{ width: `${Math.min(100, Math.round((summary.permanentUsedBytes / Math.max(1, summary.permanentTotalBytes)) * 100))}%` }}
              />
            </div>
            {summary.shortTermItems.length > 0 && (
              <div className="text-xs" style={{ color: 'var(--color-ks-warning, #f59e0b)' }}>
                {summary.shortTermItems.length} 本短期存储 · 共 {formatBytes(summary.shortTermUsedBytes)}
              </div>
            )}
          </div>

          {/* Points balance */}
          <div className="flex items-center justify-between p-3 rounded-lg" style={{ backgroundColor: 'var(--color-ks-primary, #4A6FA5)' }}>
            <div className="flex items-center gap-2">
              <CircleDollarSign className="w-5 h-5 text-yellow-500" />
              <span className="text-sm font-semibold text-white">{points} 积分</span>
            </div>
            <button
              onClick={() => setShowPointsHistory(!showPointsHistory)}
              className="text-[11px] text-white/70 hover:text-white transition-colors"
            >
              {showPointsHistory ? '收起' : '明细'}
            </button>
          </div>

          {showPointsHistory && (
            <div className="max-h-32 overflow-y-auto space-y-1">
              {summary.pointsBalance !== undefined && useStorageStore.getState().points.history.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between px-2 py-1 text-xs rounded" style={{ backgroundColor: 'var(--color-ks-hover, #f1f5f9)' }}>
                  <span style={{ color: 'var(--color-ks-text-secondary)' }}>{tx.description}</span>
                  <span style={{ color: tx.type === 'earn' ? '#10b981' : '#ef4444' }}>
                    {tx.type === 'earn' ? '+' : '-'}{tx.amount}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Upgrade options */}
          <div className="space-y-2">
            <div className="text-xs font-medium" style={{ color: 'var(--color-ks-text-secondary)' }}>扩容选项</div>

            {/* Permanent storage upgrade */}
            <button
              onClick={handleUpgradeStorage}
              disabled={points < POINTS_COST.PERMANENT_STORAGE_20MB}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all text-left disabled:opacity-40"
              style={{ borderColor: 'var(--color-ks-border)' }}
            >
              <HardDrive className="w-4 h-4 text-blue-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium" style={{ color: 'var(--color-ks-text)' }}>永久存储 +20MB</div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--color-ks-text-muted)' }}>
                  {POINTS_COST.PERMANENT_STORAGE_20MB} 积分
                </div>
              </div>
              <div className="flex items-center gap-1 text-xs shrink-0" style={{ color: points >= POINTS_COST.PERMANENT_STORAGE_20MB ? '#10b981' : '#ef4444' }}>
                {points >= POINTS_COST.PERMANENT_STORAGE_20MB ? (
                  <><CheckCircle2 className="w-3 h-3" /> 可兑换</>
                ) : (
                  <><AlertCircle className="w-3 h-3" /> 不足</>
                )}
              </div>
            </button>

            {/* Shelf capacity upgrade */}
            <button
              onClick={handleUpgradeShelf}
              disabled={points < POINTS_COST.SHELF_CAPACITY_1}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all text-left disabled:opacity-40"
              style={{ borderColor: 'var(--color-ks-border)' }}
            >
              <Library className="w-4 h-4 text-emerald-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium" style={{ color: 'var(--color-ks-text)' }}>书架容量 +1 本</div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--color-ks-text-muted)' }}>
                  {POINTS_COST.SHELF_CAPACITY_1} 积分
                </div>
              </div>
              <div className="flex items-center gap-1 text-xs shrink-0" style={{ color: points >= POINTS_COST.SHELF_CAPACITY_1 ? '#10b981' : '#ef4444' }}>
                {points >= POINTS_COST.SHELF_CAPACITY_1 ? (
                  <><CheckCircle2 className="w-3 h-3" /> 可兑换</>
                ) : (
                  <><AlertCircle className="w-3 h-3" /> 不足</>
                )}
              </div>
            </button>

            {/* Extend retention */}
            {bookId && (
              <button
                onClick={handleExtendRetention}
                disabled={points < POINTS_COST.EXTEND_RETENTION_7DAYS}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all text-left disabled:opacity-40"
                style={{ borderColor: 'var(--color-ks-border)' }}
              >
                <Clock className="w-4 h-4 text-amber-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium" style={{ color: 'var(--color-ks-text)' }}>短期存储 +7 天</div>
                  <div className="text-xs mt-0.5" style={{ color: 'var(--color-ks-text-muted)' }}>
                    {POINTS_COST.EXTEND_RETENTION_7DAYS} 积分
                  </div>
                </div>
                <div className="flex items-center gap-1 text-xs shrink-0" style={{ color: points >= POINTS_COST.EXTEND_RETENTION_7DAYS ? '#10b981' : '#ef4444' }}>
                  {points >= POINTS_COST.EXTEND_RETENTION_7DAYS ? (
                    <><CheckCircle2 className="w-3 h-3" /> 续期</>
                  ) : (
                    <><AlertCircle className="w-3 h-3" /> 不足</>
                  )}
                </div>
              </button>
            )}
          </div>

          {/* Tier benefits comparison */}
          <div className="pt-2">
            <div className="text-xs font-medium mb-2" style={{ color: 'var(--color-ks-text-secondary)' }}>各档位对比</div>
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead>
                  <tr style={{ color: 'var(--color-ks-text-muted)' }}>
                    <th className="text-left pb-1 pr-2">权益</th>
                    <th className="pb-1 px-1">免费</th>
                    <th className="pb-1 px-1">基础</th>
                    <th className="pb-1 px-1">标准</th>
                    <th className="pb-1 px-1">高级</th>
                    <th className="pb-1 pl-1">旗舰</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { label: '书架', key: 'shelfCapacity' as const, suffix: '本' },
                    { label: '永久存储', key: 'permanentStorageMB' as const, suffix: 'MB' },
                    { label: '短期保留', key: 'shortTermRetentionDays' as const, suffix: '天' },
                  ].map((row) => (
                    <tr key={row.key} style={{ color: 'var(--color-ks-text)' }}>
                      <td className="py-1 pr-2 text-slate-500">{row.label}</td>
                      {(['free', 'basic', 'standard', 'premium', 'flagship'] as SubscriptionTier[]).map((t) => (
                        <td key={t} className="py-1 text-center font-medium tabular-nums">
                          {entitle[row.key]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
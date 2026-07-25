import { Clock, AlertTriangle, RotateCcw } from 'lucide-react';
import { calcDaysLeft, getExpiryWarningLevel, calcExpiryLabel } from '@/types/storage';

interface ExpiryBadgeProps {
  expiresAt: string;
  onExtend?: () => void;
}

export function ExpiryBadge({ expiresAt, onExtend }: ExpiryBadgeProps) {
  const daysLeft = calcDaysLeft(expiresAt);
  const level = getExpiryWarningLevel(daysLeft);

  if (daysLeft <= 0) {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-100 text-red-600">
        <AlertTriangle className="w-3 h-3" />
        已过期
      </span>
    );
  }

  const colors = {
    critical: 'bg-red-50 text-red-500 border-red-200',
    warning: 'bg-amber-50 text-amber-600 border-amber-200',
    normal: 'bg-slate-50 text-slate-500 border-slate-200',
  };

  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border ${colors[level]}`}
    >
      <Clock className="w-3 h-3" />
      {calcExpiryLabel(daysLeft)}
      {daysLeft <= 3 && onExtend && (
        <button
          onClick={(e) => { e.stopPropagation(); onExtend(); }}
          className="ml-0.5 p-0.5 rounded hover:bg-white/50 transition-colors"
          title="续期（10积分延长7天）"
        >
          <RotateCcw className="w-2.5 h-2.5" />
        </button>
      )}
    </span>
  );
}
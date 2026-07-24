import { useToastStore } from '@/stores/toastStore';
import { CheckCircle, XCircle, Info, AlertTriangle, X } from 'lucide-react';

const ICON_MAP = {
  success: CheckCircle,
  error: XCircle,
  info: Info,
  warning: AlertTriangle,
};

const COLOR_MAP = {
  success: { bg: 'var(--color-ks-success)', border: 'var(--color-ks-success)' },
  error: { bg: '#dc3545', border: '#dc3545' },
  info: { bg: 'var(--color-ks-primary)', border: 'var(--color-ks-primary)' },
  warning: { bg: '#f0ad4e', border: '#f0ad4e' },
};

export default function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  const removeToast = useToastStore((s) => s.removeToast);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => {
        const Icon = ICON_MAP[toast.type];
        const colors = COLOR_MAP[toast.type];
        return (
          <div
            key={toast.id}
            className="pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-lg shadow-lg max-w-sm ks-animate-slide-up"
            style={{
              backgroundColor: 'var(--color-ks-card)',
              border: `1px solid ${colors.border}`,
              color: 'var(--color-ks-text)',
            }}
          >
            <Icon size={18} style={{ color: colors.bg, flexShrink: 0, marginTop: 1 }} />
            <span className="text-sm flex-1 leading-relaxed">{toast.message}</span>
            <button
              onClick={() => removeToast(toast.id)}
              className="flex-shrink-0 p-0.5 opacity-50 hover:opacity-100 transition-opacity cursor-pointer"
              style={{ color: 'var(--color-ks-text-muted)' }}
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

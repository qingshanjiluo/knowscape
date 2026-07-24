import { useEffect, useCallback, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

type ModalSize = 'sm' | 'md' | 'lg';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  size?: ModalSize;
}

const sizeStyles: Record<ModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
};

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
}: ModalProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 ks-animate-fade-in"
        style={{ backgroundColor: 'rgba(44, 40, 37, 0.3)', backdropFilter: 'blur(4px)' }}
        onClick={onClose}
      />

      {/* Dialog */}
      <div
        className={[
          'relative w-full mx-4 ks-animate-slide-down',
          'rounded-[var(--radius-ks-lg)] shadow-xl',
          sizeStyles[size],
        ].join(' ')}
        style={{
          backgroundColor: 'var(--color-ks-card)',
          border: '1px solid var(--color-ks-border)',
        }}
      >
        {/* Header */}
        {title && (
          <div
            className="flex items-center justify-between px-5 py-3.5"
            style={{ borderBottom: '1px solid var(--color-ks-border)' }}
          >
            <h3
              className="text-base font-semibold font-[var(--font-family-ks-heading)]"
              style={{ color: 'var(--color-ks-text)' }}
            >
              {title}
            </h3>
            <button
              onClick={onClose}
              className="p-1 rounded-[var(--radius-ks-sm)] cursor-pointer transition-colors duration-150 hover:opacity-70"
              style={{ color: 'var(--color-ks-text-muted)' }}
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* Body */}
        <div className="px-5 py-4 max-h-[70vh] overflow-y-auto">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}

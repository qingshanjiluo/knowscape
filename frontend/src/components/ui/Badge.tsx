import type { DistillCategory } from '@/types';
import { DISTILL_CATEGORY_COLORS, DISTILL_CATEGORY_LABELS } from '@/types';

type BadgeSize = 'sm' | 'md';
type BadgeVariant = 'solid' | 'outlined';

interface BadgeProps {
  children?: React.ReactNode;
  /** Color override -- accepts CSS variable or hex */
  color?: string;
  /** DistillCategory -- auto-applies category color and label */
  category?: DistillCategory;
  size?: BadgeSize;
  variant?: BadgeVariant;
  className?: string;
}

const sizeStyles: Record<BadgeSize, string> = {
  sm: 'px-1.5 py-px text-[11px] leading-5',
  md: 'px-2 py-0.5 text-xs leading-5',
};

export default function Badge({
  children,
  color,
  category,
  size = 'sm',
  variant = 'solid',
  className = '',
}: BadgeProps) {
  const resolvedColor = category ? DISTILL_CATEGORY_COLORS[category] : (color ?? 'var(--color-ks-primary)');
  const label = category ? DISTILL_CATEGORY_LABELS[category] : children;

  const isOutlined = variant === 'outlined';

  return (
    <span
      className={[
        'inline-flex items-center gap-1 rounded-[var(--radius-ks-full)]',
        'font-[var(--font-family-ks-heading)] font-medium select-none whitespace-nowrap',
        sizeStyles[size],
        className,
      ].join(' ')}
      style={{
        backgroundColor: isOutlined ? 'transparent' : resolvedColor,
        color: isOutlined ? resolvedColor : 'white',
        border: isOutlined ? `1px solid ${resolvedColor}` : '1px solid transparent',
      }}
    >
      {label}
    </span>
  );
}

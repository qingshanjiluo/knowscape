interface ProgressBarProps {
  /** Value from 0 to 100 */
  value: number;
  /** Bar height in pixels */
  height?: number;
  /** Whether to show percentage label */
  showLabel?: boolean;
  /** Whether the fill animates */
  animated?: boolean;
  className?: string;
}

export default function ProgressBar({
  value,
  height = 4,
  showLabel = false,
  animated = true,
  className = '',
}: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, value));

  return (
    <div className={['relative w-full', className].join(' ')}>
      {showLabel && (
        <div
          className="text-xs font-[var(--font-family-ks-heading)] text-[var(--color-ks-text-secondary)] mb-1 tabular-nums"
        >
          {Math.round(clamped)}%
        </div>
      )}
      <div
        className="w-full overflow-hidden rounded-full"
        style={{
          height,
          backgroundColor: 'var(--color-ks-border)',
        }}
      >
        <div
          className={[
            'h-full rounded-full',
            animated ? 'transition-[width] duration-500 ease-out' : '',
          ].join(' ')}
          style={{
            width: `${clamped}%`,
            background: `linear-gradient(90deg, var(--color-ks-primary) 0%, var(--color-ks-accent) 100%)`,
          }}
        />
      </div>
    </div>
  );
}

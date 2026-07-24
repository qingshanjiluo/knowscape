interface ProgressRingProps {
  /** Value from 0 to 100 */
  value: number;
  /** Outer diameter in pixels */
  size?: number;
  /** Stroke width in pixels */
  strokeWidth?: number;
  /** Override ring color (defaults to primary) */
  color?: string;
  /** Show percentage label inside the ring */
  showLabel?: boolean;
  className?: string;
}

export default function ProgressRing({
  value,
  size = 40,
  strokeWidth = 3,
  color,
  showLabel = false,
  className = '',
}: ProgressRingProps) {
  const clamped = Math.max(0, Math.min(100, value));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;
  const center = size / 2;

  const ringColor = color ?? 'var(--color-ks-primary)';

  return (
    <div
      className={['relative inline-flex items-center justify-center shrink-0', className].join(' ')}
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
      >
        {/* Track */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="var(--color-ks-border)"
          strokeWidth={strokeWidth}
        />
        {/* Fill */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={ringColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-500 ease-out"
        />
      </svg>
      {showLabel && (
        <span
          className="absolute inset-0 flex items-center justify-center text-[var(--color-ks-text-secondary)] font-[var(--font-family-ks-heading)] tabular-nums"
          style={{ fontSize: Math.max(9, size * 0.25) }}
        >
          {Math.round(clamped)}
        </span>
      )}
    </div>
  );
}

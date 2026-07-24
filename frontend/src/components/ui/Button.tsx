import { type ButtonHTMLAttributes, type ReactNode } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
  children: ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: [
    'text-white',
    'shadow-sm',
    'hover:opacity-90',
    'active:opacity-100',
  ].join(' '),
  secondary: [
    'border',
    'shadow-sm',
    'hover:opacity-90',
    'active:opacity-100',
  ].join(' '),
  ghost: [
    'border-transparent',
    'hover:opacity-100',
    'active:opacity-90',
  ].join(' '),
  danger: [
    'text-white',
    'shadow-sm',
    'hover:opacity-90',
    'active:opacity-100',
  ].join(' '),
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'h-7 px-2.5 text-xs gap-1.5 rounded-[var(--radius-ks-sm)]',
  md: 'h-8 px-3.5 text-sm gap-2 rounded-[var(--radius-ks-sm)]',
  lg: 'h-10 px-5 text-base gap-2.5 rounded-[var(--radius-ks-md)]',
};

const variantBg: Record<ButtonVariant, string> = {
  primary: 'var(--color-ks-primary)',
  secondary: 'var(--color-ks-card)',
  ghost: 'transparent',
  danger: 'var(--color-ks-error)',
};

const variantBorder: Record<ButtonVariant, string> = {
  primary: 'transparent',
  secondary: 'var(--color-ks-border)',
  ghost: 'transparent',
  danger: 'transparent',
};

const variantText: Record<ButtonVariant, string> = {
  primary: 'white',
  secondary: 'var(--color-ks-text)',
  ghost: 'var(--color-ks-text-secondary)',
  danger: 'white',
};

function Spinner({ size }: { size: ButtonSize }) {
  const px = size === 'sm' ? 12 : size === 'md' ? 14 : 16;
  return (
    <svg
      className="ks-animate-spin shrink-0"
      width={px}
      height={px}
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        opacity="0.3"
      />
      <path
        d="M12 2a10 10 0 0 1 10 10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  children,
  className = '',
  style,
  ...rest
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <button
      className={[
        'inline-flex items-center justify-center font-[var(--font-family-ks-heading)]',
        'font-medium leading-none select-none transition-all duration-150',
        'focus-visible:outline-2 focus-visible:outline-offset-2',
        sizeStyles[size],
        variantStyles[variant],
        isDisabled ? 'opacity-50 cursor-not-allowed pointer-events-none' : 'cursor-pointer',
        className,
      ].join(' ')}
      style={{
        backgroundColor: variantBg[variant],
        borderColor: variantBorder[variant],
        color: variantText[variant],
        ...style,
      }}
      disabled={isDisabled}
      {...rest}
    >
      {loading ? (
        <Spinner size={size} />
      ) : icon ? (
        <span className="shrink-0 [&>svg]:w-[1em] [&>svg]:h-[1em]">{icon}</span>
      ) : null}
      <span>{children}</span>
    </button>
  );
}

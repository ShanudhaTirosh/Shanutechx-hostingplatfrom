'use client';

import {
  ButtonHTMLAttributes,
  HTMLAttributes,
  InputHTMLAttributes,
  TextareaHTMLAttributes,
  SelectHTMLAttributes,
  ReactNode,
  useState,
  useEffect,
  useRef,
  createContext,
  useContext,
  useCallback,
  forwardRef,
} from 'react';

// ════════════════════════════════════════════════════════════════
// Card
// ════════════════════════════════════════════════════════════════
interface CardProps extends HTMLAttributes<HTMLDivElement> {
  title?: string;
  description?: string;
  action?: ReactNode;
  flat?: boolean;
  /** @deprecated glow no longer used, kept for back-compat */
  glow?: boolean;
}

export function Card({ title, description, action, flat, className = '', children, ...props }: CardProps) {
  return (
    <div
      className={`rounded-xl p-5 ${flat ? '' : ''} ${className}`}
      style={{
        background: 'var(--card-bg)',
        border: '1px solid var(--card-border)',
        boxShadow: 'var(--card-shadow)',
      }}
      {...props}
    >
      {(title || description || action) && (
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            {title && (
              <h3
                className="text-sm font-semibold tracking-tight"
                style={{ color: 'var(--color-text-primary)' }}
              >
                {title}
              </h3>
            )}
            {description && (
              <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                {description}
              </p>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      {children}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// Button
// ════════════════════════════════════════════════════════════════
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'success' | 'glow';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: ReactNode;
  iconRight?: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  iconRight,
  className = '',
  children,
  disabled,
  ...props
}: ButtonProps) {
  const sizes: Record<string, string> = {
    xs: 'px-2.5 py-1 text-xs gap-1',
    sm: 'px-3 py-1.5 text-xs gap-1.5',
    md: 'px-4 py-2 text-sm gap-2',
    lg: 'px-5 py-2.5 text-sm gap-2',
  };

  // Inline styles keyed by variant — uses CSS variables for theme awareness
  const variantStyles: Record<string, React.CSSProperties> = {
    primary: {
      background: 'var(--color-accent, #ffffff)',
      color: 'var(--color-accent-contrast, #0a0a0a)',
      border: '1px solid var(--color-accent, #ffffff)',
      fontWeight: 600,
    },
    secondary: {
      background: 'var(--color-surface-2, rgba(255, 255, 255, 0.05))',
      color: 'var(--color-text-primary, #ffffff)',
      border: '1px solid var(--color-border, rgba(255, 255, 255, 0.12))',
    },
    danger: {
      background: 'var(--color-danger-bg)',
      color: 'var(--color-danger)',
      border: '1px solid var(--color-danger-border)',
    },
    ghost: {
      background: 'transparent',
      color: 'var(--color-text-secondary)',
      border: '1px solid transparent',
    },
    success: {
      background: 'var(--color-success-bg)',
      color: 'var(--color-success)',
      border: '1px solid var(--color-success-border)',
    },
    glow: {
      background: 'var(--color-accent, #ffffff)',
      color: 'var(--color-accent-contrast, #0a0a0a)',
      border: '1px solid var(--color-accent, #ffffff)',
      boxShadow: '0 0 16px rgba(255, 255, 255, 0.25)',
      fontWeight: 600,
    },
  };

  return (
    <button
      disabled={disabled || loading}
      style={variantStyles[variant]}
      className={`stx-btn rounded-xl font-medium transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center ${sizes[size]} ${className}`}
      {...props}
    >
      {loading && (
        <span
          className="h-3.5 w-3.5 rounded-full border-2 border-t-transparent animate-spin shrink-0"
          style={{ borderColor: variant === 'primary' || variant === 'glow' ? 'var(--color-accent-contrast, #0a0a0a)' : 'currentColor', borderTopColor: 'transparent' }}
        />
      )}
      {!loading && icon && <span className="shrink-0">{icon}</span>}
      {children}
      {iconRight && <span className="shrink-0">{iconRight}</span>}
    </button>
  );
}

// ════════════════════════════════════════════════════════════════
// IconButton
// ════════════════════════════════════════════════════════════════
interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'ghost' | 'glass' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  tooltip?: string;
}

export function IconButton({ variant = 'ghost', size = 'md', tooltip, className = '', children, ...props }: IconButtonProps) {
  const sizes: Record<string, string> = { sm: 'h-7 w-7', md: 'h-8 w-8', lg: 'h-10 w-10' };

  const variantStyle: Record<string, React.CSSProperties> = {
    ghost: { color: 'var(--color-text-secondary)' },
    glass: { background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' },
    danger: { color: 'var(--color-text-muted)' },
  };

  return (
    <button
      title={tooltip}
      style={variantStyle[variant]}
      className={`rounded-lg flex items-center justify-center transition-all duration-150
        hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]
        ${variant === 'danger' ? 'hover:!text-[var(--color-danger)] hover:!bg-[var(--color-danger-bg)]' : ''}
        focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]
        ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

// ════════════════════════════════════════════════════════════════
// Input
// ════════════════════════════════════════════════════════════════
interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  icon?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, icon, className = '', id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="text-xs font-medium"
            style={{ color: 'var(--color-text-muted)' }}
          >
            {label}
          </label>
        )}
        <div className="relative">
          {icon && (
            <div
              className="absolute left-3 top-1/2 -translate-y-1/2"
              style={{ color: 'var(--color-text-faint)' }}
            >
              {icon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            className={`stx-input w-full rounded-lg ${icon ? 'pl-9' : 'px-3.5'} pr-3.5 py-2.5 text-sm
              ${error ? 'border-[var(--color-danger)] focus:shadow-[0_0_0_3px_var(--color-danger-bg)]' : ''}
              ${className}`}
            {...props}
          />
        </div>
        {error && (
          <p className="text-xs" style={{ color: 'var(--color-danger)' }}>{error}</p>
        )}
        {hint && !error && (
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{hint}</p>
        )}
      </div>
    );
  }
);
Input.displayName = 'Input';

// ════════════════════════════════════════════════════════════════
// Textarea
// ════════════════════════════════════════════════════════════════
interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export function Textarea({ label, error, hint, className = '', id, ...props }: TextareaProps) {
  const textareaId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={textareaId} className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
          {label}
        </label>
      )}
      <textarea
        id={textareaId}
        className={`stx-input w-full rounded-lg px-3.5 py-2.5 text-sm resize-none
          ${error ? 'border-[var(--color-danger)]' : ''}
          ${className}`}
        {...props}
      />
      {error && <p className="text-xs" style={{ color: 'var(--color-danger)' }}>{error}</p>}
      {hint && !error && <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{hint}</p>}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// Select
// ════════════════════════════════════════════════════════════════
interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
}

export function Select({ label, error, options, className = '', id, ...props }: SelectProps) {
  const selectId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={selectId} className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
          {label}
        </label>
      )}
      <select
        id={selectId}
        className={`stx-input w-full rounded-lg px-3.5 py-2.5 text-sm appearance-none pr-9
          bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2371717a%22%20stroke-width%3D%222.5%22%3E%3Cpath%20d%3D%22M6%209l6%206%206-6%22%2F%3E%3C%2Fsvg%3E')]
          bg-[length:12px_12px] bg-[right_12px_center] bg-no-repeat
          ${error ? 'border-[var(--color-danger)]' : ''}
          ${className}`}
        {...props}
      >
        {options.map((o) => (
          <option
            key={o.value}
            value={o.value}
            style={{ background: 'var(--color-surface)', color: 'var(--color-text-primary)' }}
          >
            {o.label}
          </option>
        ))}
      </select>
      {error && <p className="text-xs" style={{ color: 'var(--color-danger)' }}>{error}</p>}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// Toggle / Switch
// ════════════════════════════════════════════════════════════════
export function Toggle({
  checked,
  onChange,
  label,
  disabled,
  size = 'md',
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  size?: 'sm' | 'md';
}) {
  const dims =
    size === 'sm'
      ? { track: 'w-8 h-[18px]', thumb: 'h-3.5 w-3.5', move: 'translate-x-[14px]' }
      : { track: 'w-10 h-[22px]', thumb: 'h-[18px] w-[18px]', move: 'translate-x-[18px]' };

  return (
    <label className={`inline-flex items-center gap-2.5 ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative ${dims.track} rounded-full transition-colors duration-200`}
        style={{ background: checked ? 'var(--color-accent)' : 'var(--color-surface-3)' }}
      >
        <span
          className={`absolute left-[2px] top-1/2 -translate-y-1/2 ${dims.thumb} rounded-full bg-white shadow-sm transition-transform duration-200 ${checked ? dims.move : ''}`}
        />
      </button>
      {label && <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{label}</span>}
    </label>
  );
}

// ════════════════════════════════════════════════════════════════
// Badge / Status
// ════════════════════════════════════════════════════════════════
type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'muted';

const STATUS_VARIANT: Record<string, BadgeVariant> = {
  draft: 'muted',
  awaiting_payment: 'warning',
  paid: 'success',
  cancelled: 'danger',
  pending: 'muted',
  auto_approved: 'success',
  manually_approved: 'success',
  manual_review: 'warning',
  rejected: 'danger',
  building: 'warning',
  running: 'success',
  failed: 'danger',
  stopped: 'muted',
  starting: 'warning',
  stopping: 'warning',
  paused: 'info',
  open: 'warning',
  closed: 'muted',
  low: 'muted',
  medium: 'warning',
  high: 'danger',
  admin: 'info',
  support: 'info',
  dev: 'info',
  customer: 'muted',
  active: 'success',
  inactive: 'muted',
  verified: 'success',
  ssl_provisioning: 'warning',
  terminated: 'danger',
  bridge: 'info',
  host: 'info',
  overlay: 'warning',
  local: 'muted',
};

const BADGE_STYLES: Record<BadgeVariant, React.CSSProperties> = {
  success: { background: 'var(--color-success-bg)', color: 'var(--color-success)', border: '1px solid var(--color-success-border)' },
  warning: { background: 'var(--color-warning-bg)', color: 'var(--color-warning)', border: '1px solid var(--color-warning-border)' },
  danger:  { background: 'var(--color-danger-bg)',  color: 'var(--color-danger)',  border: '1px solid var(--color-danger-border)' },
  info:    { background: 'var(--color-info-bg)',    color: 'var(--color-info)',    border: '1px solid var(--color-info-border)' },
  muted:   { background: 'var(--color-surface-2)', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' },
};

const DOT_ANIMATED = new Set(['building', 'starting', 'stopping']);

export function Badge({
  status,
  dot = false,
  className = '',
}: {
  status?: string | null;
  dot?: boolean;
  className?: string;
}) {
  if (!status) return null;
  const variant: BadgeVariant = STATUS_VARIANT[status] ?? 'muted';
  const style = BADGE_STYLES[variant];
  const isDotAnimated = DOT_ANIMATED.has(status);

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${className}`}
      style={style}
    >
      {dot && (
        <span
          className={`h-1.5 w-1.5 rounded-full shrink-0 ${isDotAnimated ? 'animate-pulse-dot' : ''}`}
          style={{ background: 'currentColor', opacity: 0.85 }}
        />
      )}
      {status.replace(/_/g, ' ')}
    </span>
  );
}

// ════════════════════════════════════════════════════════════════
// Spinner
// ════════════════════════════════════════════════════════════════
export function Spinner({ label = 'Loading...', fullPage = false }: { label?: string; fullPage?: boolean }) {
  if (fullPage) {
    return (
      <div
        className="fixed inset-0 flex items-center justify-center z-50"
        style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      >
        <div className="flex flex-col items-center gap-4 animate-fade-in">
          <span
            className="h-9 w-9 rounded-full border-2 border-t-transparent animate-spin block"
            style={{ borderColor: 'var(--color-border-strong)', borderTopColor: 'var(--color-accent)' }}
          />
          <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{label}</span>
        </div>
      </div>
    );
  }
  return (
    <div
      className="flex items-center gap-2.5 text-sm py-10 justify-center animate-fade-in"
      style={{ color: 'var(--color-text-muted)' }}
    >
      <span
        className="h-4 w-4 rounded-full border-2 border-t-transparent animate-spin"
        style={{ borderColor: 'var(--color-border-strong)', borderTopColor: 'var(--color-accent)' }}
      />
      {label}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// Skeleton Loaders
// ════════════════════════════════════════════════════════════════
export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton-shimmer rounded-lg ${className}`} />;
}

export function CardSkeleton() {
  return (
    <div
      className="rounded-xl p-5"
      style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3 flex-1">
          <Skeleton className="h-9 w-9 rounded-xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
        </div>
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-3/4" />
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-14 w-full rounded-lg" />
      ))}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// EmptyState
// ════════════════════════════════════════════════════════════════
export function EmptyState({
  title,
  message,
  icon,
  action,
  className,
}: {
  title?: string;
  message: string;
  icon?: ReactNode;
  action?: { label: string; onClick: () => void };
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center p-10 rounded-xl text-center space-y-3 animate-fade-in ${className || ''}`}
      style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}
    >
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center mb-1"
        style={{ background: 'var(--color-surface-2)', color: 'var(--color-text-muted)' }}
      >
        {icon || (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
        )}
      </div>
      {title && (
        <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>{title}</h3>
      )}
      <p className="text-xs leading-relaxed max-w-xs" style={{ color: 'var(--color-text-muted)' }}>{message}</p>
      {action && (
        <Button variant="secondary" size="sm" onClick={action.onClick} className="mt-2">
          {action.label}
        </Button>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// ErrorBanner
// ════════════════════════════════════════════════════════════════
export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div
      className="flex items-center justify-between gap-3 rounded-lg px-4 py-3 text-sm mb-4 animate-slide-down"
      style={{
        background: 'var(--color-danger-bg)',
        border: '1px solid var(--color-danger-border)',
        color: 'var(--color-danger)',
      }}
    >
      <div className="flex items-center gap-2.5">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <span>{message}</span>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="shrink-0 text-xs font-medium underline underline-offset-2 opacity-80 hover:opacity-100 transition-opacity"
        >
          Retry
        </button>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// ProgressBar
// ════════════════════════════════════════════════════════════════
export function ProgressBar({
  value,
  max = 100,
  color = 'accent',
  size = 'md',
  label,
  showValue,
  indeterminate,
}: {
  value?: number;
  max?: number;
  color?: 'accent' | 'success' | 'warning' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  showValue?: boolean;
  indeterminate?: boolean;
}) {
  const percent = value !== undefined ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  const heights: Record<string, string> = { sm: 'h-1', md: 'h-1.5', lg: 'h-2' };
  const fillColors: Record<string, string> = {
    accent:  'var(--color-accent)',
    success: 'var(--color-success)',
    warning: 'var(--color-warning)',
    danger:  'var(--color-danger)',
  };

  return (
    <div className="space-y-1.5">
      {(label || showValue) && (
        <div className="flex items-center justify-between text-xs" style={{ color: 'var(--color-text-muted)' }}>
          {label && <span>{label}</span>}
          {showValue && <span>{Math.round(percent)}%</span>}
        </div>
      )}
      <div
        className={`${heights[size]} rounded-full overflow-hidden`}
        style={{ background: 'var(--color-surface-3)' }}
      >
        {indeterminate ? (
          <div
            className="h-full w-1/4 rounded-full animate-progress"
            style={{ background: fillColors[color] }}
          />
        ) : (
          <div
            className="h-full rounded-full transition-[width] duration-700 ease-out"
            style={{ width: `${percent}%`, background: fillColors[color] }}
          />
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// MetricRing
// ════════════════════════════════════════════════════════════════
export function MetricRing({
  percent,
  size = 80,
  strokeWidth = 6,
  color = 'accent',
  label,
  valueLabel,
}: {
  percent: number;
  size?: number;
  strokeWidth?: number;
  color?: 'accent' | 'success' | 'danger' | 'warning';
  label?: string;
  valueLabel?: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(100, Math.max(0, percent)) / 100) * circumference;

  const strokeColors: Record<string, string> = {
    accent:  'var(--color-accent)',
    success: 'var(--color-success)',
    danger:  'var(--color-danger)',
    warning: 'var(--color-warning)',
  };

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none"
            stroke="var(--color-surface-3)"
            strokeWidth={strokeWidth}
          />
          <circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none"
            stroke={strokeColors[color]}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 0.8s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs font-bold" style={{ color: 'var(--color-text-primary)' }}>
            {valueLabel ?? `${Math.round(percent)}%`}
          </span>
        </div>
      </div>
      {label && (
        <span className="text-[10px] uppercase tracking-wider font-medium" style={{ color: 'var(--color-text-muted)' }}>
          {label}
        </span>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// Table
// ════════════════════════════════════════════════════════════════
export function Table({ headers, children, className = '' }: {
  headers: string[];
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`overflow-x-auto rounded-xl ${className}`}
      style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}
    >
      <table className="stx-table">
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function Tr({
  children,
  className = '',
  onClick,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <tr
      className={`transition-colors duration-150 ${onClick ? 'cursor-pointer' : ''} ${className}`}
      onClick={onClick}
    >
      {children}
    </tr>
  );
}

export function Td({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <td className={`px-4 py-3 text-sm ${className}`} style={{ color: 'var(--color-text-primary)' }}>
      {children}
    </td>
  );
}

// ════════════════════════════════════════════════════════════════
// Tabs
// ════════════════════════════════════════════════════════════════
export function Tabs({
  tabs,
  active,
  onChange,
}: {
  tabs: { label: string; value: string; count?: number; icon?: ReactNode }[];
  active: string;
  onChange: (v: string) => void;
}) {
  return (
    <div
      className="flex gap-0.5 rounded-lg p-1 w-fit mb-5"
      style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border-subtle)' }}
    >
      {tabs.map((tab) => {
        const isActive = active === tab.value;
        return (
          <button
            key={tab.value}
            onClick={() => onChange(tab.value)}
            className="relative rounded-md px-3.5 py-1.5 text-sm font-medium transition-all duration-150 flex items-center gap-1.5 focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
            style={
              isActive
                ? {
                    background: 'var(--color-bg)',
                    color: 'var(--color-text-primary)',
                    boxShadow: 'var(--card-shadow)',
                    border: '1px solid var(--color-border)',
                  }
                : { color: 'var(--color-text-muted)', border: '1px solid transparent' }
            }
          >
            {tab.icon}
            {tab.label}
            {tab.count !== undefined && (
              <span
                className="text-[10px] rounded-full px-1.5 py-0.5 leading-none font-mono"
                style={
                  isActive
                    ? { background: 'var(--color-accent-subtle)', color: 'var(--color-accent)' }
                    : { background: 'var(--color-surface-2)', color: 'var(--color-text-muted)' }
                }
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// Modal
// ════════════════════════════════════════════════════════════════
export function Modal({
  open,
  onClose,
  title,
  children,
  width = 'max-w-lg',
  closeOnOverlayClick = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  width?: string;
  closeOnOverlayClick?: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (open) {
      document.addEventListener('keydown', onKey);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 animate-fade-in"
        style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)' }}
        onClick={() => { if (closeOnOverlayClick) onClose(); }}
      />
      <div
        className={`relative z-10 w-full ${width} rounded-xl p-6 animate-scale-in`}
        style={{
          background: 'var(--card-bg)',
          border: '1px solid var(--color-border-strong)',
          boxShadow: '0 24px 48px rgba(0,0,0,0.35)',
        }}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-semibold text-base" style={{ color: 'var(--color-text-primary)' }}>
            {title}
          </h2>
          <IconButton variant="ghost" size="sm" onClick={onClose} tooltip="Close">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </IconButton>
        </div>
        {children}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// ConfirmDialog
// ════════════════════════════════════════════════════════════════
export function ConfirmDialog({
  open,
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel,
  confirmText,
  danger = false,
}: {
  open?: boolean;
  isOpen?: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  message: string;
  confirmLabel?: string;
  confirmText?: string;
  danger?: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const isOpened = open ?? isOpen ?? false;
  const label = confirmLabel ?? confirmText ?? 'Confirm';

  async function handle() {
    setLoading(true);
    await onConfirm();
    setLoading(false);
    onClose();
  }

  return (
    <Modal open={isOpened} onClose={onClose} title={title} width="max-w-sm">
      <p className="text-sm mb-6" style={{ color: 'var(--color-text-muted)' }}>{message}</p>
      <div className="flex gap-2.5 justify-end">
        <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
        <Button variant={danger ? 'danger' : 'primary'} size="sm" loading={loading} onClick={handle}>
          {label}
        </Button>
      </div>
    </Modal>
  );
}

// ════════════════════════════════════════════════════════════════
// Dropdown / Popover
// ════════════════════════════════════════════════════════════════
export function Dropdown({
  trigger,
  children,
  align = 'right',
}: {
  trigger: ReactNode;
  children: ReactNode;
  align?: 'left' | 'right';
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <div onClick={() => setOpen(!open)}>{trigger}</div>
      {open && (
        <div
          className={`absolute z-[50] mt-1.5 min-w-[176px] rounded-xl py-1 animate-scale-in origin-top ${align === 'right' ? 'right-0' : 'left-0'}`}
          style={{
            background: 'var(--card-bg)',
            border: '1px solid var(--color-border-strong)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
          }}
          onClick={() => setOpen(false)}
        >
          {children}
        </div>
      )}
    </div>
  );
}

export function DropdownItem({
  children,
  onClick,
  icon,
  danger,
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  icon?: ReactNode;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors duration-100 ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      style={
        danger
          ? { color: 'var(--color-danger)' }
          : { color: 'var(--color-text-secondary)' }
      }
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.background = danger
          ? 'var(--color-danger-bg)'
          : 'var(--color-surface-hover)';
        if (!danger) (e.currentTarget as HTMLElement).style.color = 'var(--color-text-primary)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.background = '';
        (e.currentTarget as HTMLElement).style.color = danger
          ? 'var(--color-danger)'
          : 'var(--color-text-secondary)';
      }}
    >
      {icon && <span className="shrink-0 w-4 h-4 flex items-center justify-center">{icon}</span>}
      {children}
    </button>
  );
}

// ════════════════════════════════════════════════════════════════
// Toast System
// ════════════════════════════════════════════════════════════════
type ToastType = 'success' | 'error' | 'info' | 'warning';
interface ToastItem { id: number; message: string; type: ToastType; }

const ToastContext = createContext<{ toast: (message: string, type?: ToastType) => void }>({ toast: () => {} });
export function useToast() { return useContext(ToastContext); }

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const counter = useRef(0);

  const toast = useCallback((message: string, type: ToastType = 'success') => {
    const id = ++counter.current;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4500);
  }, []);

  const dismiss = (id: number) => setToasts((prev) => prev.filter((t) => t.id !== id));

  const TOAST_STYLES: Record<ToastType, React.CSSProperties> = {
    success: { background: 'var(--color-success-bg)',  color: 'var(--color-success)',  border: '1px solid var(--color-success-border)' },
    error:   { background: 'var(--color-danger-bg)',   color: 'var(--color-danger)',   border: '1px solid var(--color-danger-border)' },
    info:    { background: 'var(--color-info-bg)',     color: 'var(--color-info)',     border: '1px solid var(--color-info-border)' },
    warning: { background: 'var(--color-warning-bg)',  color: 'var(--color-warning)',  border: '1px solid var(--color-warning-border)' },
  };

  const ICONS: Record<ToastType, ReactNode> = {
    success: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>,
    error:   <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>,
    info:    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>,
    warning: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 9v4M12 17h.01"/><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>,
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-5 right-5 z-[400] flex flex-col gap-2 max-w-xs w-full pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="flex items-start gap-3 rounded-xl px-4 py-3 text-sm shadow-lg animate-toast-enter cursor-pointer pointer-events-auto"
            style={{ ...TOAST_STYLES[t.type], backdropFilter: 'blur(12px)' }}
            onClick={() => dismiss(t.id)}
          >
            <span className="shrink-0 mt-0.5">{ICONS[t.type]}</span>
            <span className="flex-1 leading-relaxed">{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// ════════════════════════════════════════════════════════════════
// StatCard
// ════════════════════════════════════════════════════════════════
export function StatCard({
  label,
  value,
  icon,
  trend,
  color = 'accent',
  className,
}: {
  label: string;
  value: string | number;
  icon?: ReactNode;
  trend?: { value: string; up: boolean };
  color?: 'accent' | 'success' | 'warning' | 'danger' | 'violet' | 'teal' | 'orange' | 'green' | 'blue';
  className?: string;
}) {
  const colorKey = (
    color === 'violet' || color === 'blue' ? 'accent' :
    color === 'green' ? 'success' :
    color === 'orange' ? 'warning' :
    color === 'teal' ? 'accent' : color
  );

  const iconColors: Record<string, React.CSSProperties> = {
    accent:  { background: 'var(--color-accent-subtle)',  color: 'var(--color-accent)' },
    success: { background: 'var(--color-success-bg)',     color: 'var(--color-success)' },
    warning: { background: 'var(--color-warning-bg)',     color: 'var(--color-warning)' },
    danger:  { background: 'var(--color-danger-bg)',      color: 'var(--color-danger)' },
  };

  return (
    <div
      className={`rounded-xl p-5 flex items-center gap-4 group transition-all duration-200 ${className || ''}`}
      style={{
        background: 'var(--card-bg)',
        border: '1px solid var(--card-border)',
        boxShadow: 'var(--card-shadow)',
      }}
    >
      {icon && (
        <div
          className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-105"
          style={iconColors[colorKey]}
        >
          {icon}
        </div>
      )}
      <div className="min-w-0">
        <p className="text-xs mb-0.5" style={{ color: 'var(--color-text-muted)' }}>{label}</p>
        <p className="text-2xl font-bold leading-none" style={{ color: 'var(--color-text-primary)' }}>{value}</p>
        {trend && (
          <p className="text-xs mt-1.5" style={{ color: trend.up ? 'var(--color-success)' : 'var(--color-danger)' }}>
            {trend.up ? '↑' : '↓'} {trend.value}
          </p>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// KVRow / Detail Row
// ════════════════════════════════════════════════════════════════
export function KVRow({ label, value, mono }: { label: string; value: ReactNode; mono?: boolean }) {
  return (
    <div
      className="flex items-start justify-between gap-4 py-2.5 last:border-0"
      style={{ borderBottom: '1px solid var(--color-border-subtle)' }}
    >
      <span className="text-xs shrink-0" style={{ color: 'var(--color-text-muted)' }}>{label}</span>
      <span
        className={`text-sm text-right break-all ${mono ? 'font-mono text-xs' : ''}`}
        style={{ color: 'var(--color-text-primary)' }}
      >
        {value}
      </span>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// Chip / Tag
// ════════════════════════════════════════════════════════════════
export function Chip({
  children,
  onRemove,
  color = 'default',
}: {
  children: ReactNode;
  onRemove?: () => void;
  color?: 'default' | 'accent' | 'success' | 'warning' | 'danger';
}) {
  const styles: Record<string, React.CSSProperties> = {
    default: { background: 'var(--color-surface-2)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)' },
    accent:  { background: 'var(--color-accent-subtle)', color: 'var(--color-accent)', border: '1px solid var(--color-accent-border)' },
    success: { background: 'var(--color-success-bg)', color: 'var(--color-success)', border: '1px solid var(--color-success-border)' },
    warning: { background: 'var(--color-warning-bg)', color: 'var(--color-warning)', border: '1px solid var(--color-warning-border)' },
    danger:  { background: 'var(--color-danger-bg)',  color: 'var(--color-danger)',  border: '1px solid var(--color-danger-border)' },
  };

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-lg px-2 py-0.5 text-xs font-medium"
      style={styles[color]}
    >
      {children}
      {onRemove && (
        <button
          onClick={onRemove}
          className="opacity-60 hover:opacity-100 transition-opacity"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      )}
    </span>
  );
}

// ════════════════════════════════════════════════════════════════
// SearchInput
// ════════════════════════════════════════════════════════════════
export function SearchInput({
  value,
  onChange,
  placeholder = 'Search...',
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={`relative ${className || ''}`}>
      <svg
        className="absolute left-3 top-1/2 -translate-y-1/2"
        width="15" height="15" viewBox="0 0 24 24" fill="none"
        stroke="var(--color-text-faint)" strokeWidth="2" strokeLinecap="round"
      >
        <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
      </svg>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="stx-input w-full rounded-lg pl-9 pr-9 py-2 text-sm"
      />
      {value && (
        <button
          onClick={() => onChange('')}
          className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
          style={{ color: 'var(--color-text-faint)' }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--color-text-primary)')}
          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--color-text-faint)')}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// RevealSecret
// ════════════════════════════════════════════════════════════════
export function RevealSecret({ fetchSecret }: { fetchSecret: () => Promise<string> }) {
  const [value, setValue] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleReveal() {
    setLoading(true);
    setError(null);
    try { setValue(await fetchSecret()); }
    catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  }

  if (value) {
    return (
      <code
        className="text-xs rounded-lg px-2.5 py-1 select-all font-mono"
        style={{
          background: 'var(--color-surface-2)',
          color: 'var(--color-text-primary)',
          border: '1px solid var(--color-border)',
        }}
      >
        {value}
      </code>
    );
  }

  return (
    <div className="inline-flex items-center gap-2">
      <Button variant="secondary" size="sm" onClick={handleReveal} loading={loading}>
        Reveal
      </Button>
      {error && <span className="text-xs" style={{ color: 'var(--color-danger)' }}>{error}</span>}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// PageHeader
// ════════════════════════════════════════════════════════════════
export function PageHeader({
  title,
  description,
  action,
  breadcrumbs,
}: {
  title: string;
  description?: string | ReactNode;
  action?: ReactNode;
  breadcrumbs?: { label: string; href?: string }[];
}) {
  return (
    <div className="mb-6 animate-slide-down">
      {breadcrumbs && breadcrumbs.length > 0 && (
        <div className="flex items-center gap-1.5 text-xs mb-2" style={{ color: 'var(--color-text-muted)' }}>
          {breadcrumbs.map((bc, i) => (
            <span key={i} className="flex items-center gap-1.5">
              {i > 0 && <span style={{ color: 'var(--color-text-faint)' }}>/</span>}
              {bc.href ? (
                <a
                  href={bc.href}
                  className="transition-colors"
                  style={{ color: 'var(--color-text-muted)' }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--color-text-primary)')}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--color-text-muted)')}
                >
                  {bc.label}
                </a>
              ) : (
                <span style={{ color: 'var(--color-text-secondary)' }}>{bc.label}</span>
              )}
            </span>
          ))}
        </div>
      )}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            {title}
          </h1>
          {description && (
            <div className="text-sm mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
              {description}
            </div>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// Divider
// ════════════════════════════════════════════════════════════════
export function Divider({ label }: { label?: string }) {
  if (!label) {
    return <hr className="my-4" style={{ borderColor: 'var(--color-border-subtle)' }} />;
  }
  return (
    <div className="flex items-center gap-3 my-4">
      <hr className="flex-1" style={{ borderColor: 'var(--color-border-subtle)' }} />
      <span className="text-[10px] uppercase tracking-widest font-medium" style={{ color: 'var(--color-text-faint)' }}>
        {label}
      </span>
      <hr className="flex-1" style={{ borderColor: 'var(--color-border-subtle)' }} />
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// MetricCard
// ════════════════════════════════════════════════════════════════
export function MetricCard({
  title,
  value,
  change,
  changeType = 'neutral',
  icon,
}: {
  title: string;
  value: string | number;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  icon?: ReactNode;
}) {
  const changeStyles: Record<string, React.CSSProperties> = {
    positive: { color: 'var(--color-success)', background: 'var(--color-success-bg)', border: '1px solid var(--color-success-border)' },
    negative: { color: 'var(--color-danger)',  background: 'var(--color-danger-bg)',  border: '1px solid var(--color-danger-border)' },
    neutral:  { color: 'var(--color-text-muted)', background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' },
  };

  return (
    <Card className="flex flex-col justify-between gap-2">
      <div className="flex items-start justify-between gap-3">
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
          {title}
        </span>
        {icon && <div style={{ color: 'var(--color-text-muted)' }} className="shrink-0">{icon}</div>}
      </div>
      <div>
        <div className="text-2xl font-bold tracking-tight" style={{ color: 'var(--color-text-primary)' }}>
          {value}
        </div>
        {change && (
          <div
            className="mt-2 inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium"
            style={changeStyles[changeType]}
          >
            {change}
          </div>
        )}
      </div>
    </Card>
  );
}

// ════════════════════════════════════════════════════════════════
// Formatting Helpers
// ════════════════════════════════════════════════════════════════
export function formatMoney(amountInSmallestUnit: number, currencyLabel?: string) {
  const currency = currencyLabel || (typeof window !== 'undefined' ? localStorage.getItem('user_currency') || 'LKR' : 'LKR');
  return `${currency} ${(amountInSmallestUnit / 100).toFixed(2)}`;
}

export function formatBytes(bytes: number, decimals = 2): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`;
}

export function formatRelativeTime(dateString: string | number): string {
  const date = typeof dateString === 'number' ? new Date(dateString * 1000) : new Date(dateString);
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return date.toLocaleDateString();
}

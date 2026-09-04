'use client';

import {
  ButtonHTMLAttributes,
  HTMLAttributes,
  InputHTMLAttributes,
  TextareaHTMLAttributes,
  ReactNode,
  useState,
  useEffect,
  useRef,
  createContext,
  useContext,
  useCallback,
} from 'react';

// ─────────────────────────────────────────────────────────────
// Card
// ─────────────────────────────────────────────────────────────
interface CardProps extends HTMLAttributes<HTMLDivElement> {
  title?: string;
  description?: string;
  action?: ReactNode;
}

export function Card({ title, description, action, className = '', children, ...props }: CardProps) {
  return (
    <div className={`glass rounded-2xl p-6 ${className}`} {...props}>
      {(title || description || action) && (
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            {title && <h3 className="text-sm font-bold text-white tracking-tight">{title}</h3>}
            {description && <p className="text-xs text-text-muted mt-0.5">{description}</p>}
          </div>
          {action && <div>{action}</div>}
        </div>
      )}
      {children}
    </div>
  );
}


// ─────────────────────────────────────────────────────────────
// Button
// ─────────────────────────────────────────────────────────────
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  className = '',
  children,
  disabled,
  ...props
}: ButtonProps) {
  const sizes = { sm: 'px-3 py-1.5 text-xs', md: 'px-4 py-2 text-sm', lg: 'px-6 py-2.5 text-sm' };
  const variants: Record<string, string> = {
    primary: 'bg-brand-gradient text-white hover:opacity-90 shadow-glow-violet',
    secondary: 'glass text-text-primary hover:bg-white/[0.07]',
    danger: 'bg-red-500/20 text-red-300 border border-red-500/30 hover:bg-red-500/30',
    ghost: 'text-text-muted hover:text-text-primary hover:bg-white/[0.04]',
  };
  return (
    <button
      disabled={disabled || loading}
      className={`rounded-full font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 ${sizes[size]} ${variants[variant]} ${className}`}
      {...props}
    >
      {loading && <span className="h-3 w-3 rounded-full border-2 border-white/30 border-t-white animate-spin" />}
      {children}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────
// Input
// ─────────────────────────────────────────────────────────────
interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}
export function Input({ label, error, hint, className = '', id, ...props }: InputProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label htmlFor={inputId} className="text-xs font-medium text-text-muted">{label}</label>}
      <input
        id={inputId}
        className={`w-full bg-white/5 border rounded-xl px-4 py-2.5 text-sm placeholder:text-text-faint focus:outline-none transition-colors ${
          error ? 'border-red-500/40 focus:border-red-500/60' : 'border-white/10 focus:border-accent-violet/50 focus:bg-white/[0.07]'
        } ${className}`}
        {...props}
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
      {hint && !error && <p className="text-xs text-text-muted">{hint}</p>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Textarea
// ─────────────────────────────────────────────────────────────
interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}
export function Textarea({ label, error, hint, className = '', id, ...props }: TextareaProps) {
  const textareaId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label htmlFor={textareaId} className="text-xs font-medium text-text-muted">{label}</label>}
      <textarea
        id={textareaId}
        className={`w-full bg-white/5 border rounded-xl px-4 py-2.5 text-sm placeholder:text-text-faint focus:outline-none transition-colors resize-none ${
          error ? 'border-red-500/40 focus:border-red-500/60' : 'border-white/10 focus:border-accent-violet/50 focus:bg-white/[0.07]'
        } ${className}`}
        {...props}
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
      {hint && !error && <p className="text-xs text-text-muted">{hint}</p>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Badge / Status
// ─────────────────────────────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-white/10 text-text-muted',
  awaiting_payment: 'bg-yellow-500/15 text-yellow-300',
  paid: 'bg-emerald-500/15 text-emerald-300',
  cancelled: 'bg-red-500/15 text-red-300',
  pending: 'bg-white/10 text-text-muted',
  auto_approved: 'bg-emerald-500/15 text-emerald-300',
  manually_approved: 'bg-emerald-500/15 text-emerald-300',
  manual_review: 'bg-yellow-500/15 text-yellow-300',
  rejected: 'bg-red-500/15 text-red-300',
  building: 'bg-yellow-500/15 text-yellow-300',
  running: 'bg-emerald-500/15 text-emerald-300',
  failed: 'bg-red-500/15 text-red-300',
  stopped: 'bg-white/10 text-text-muted',
  starting: 'bg-yellow-500/15 text-yellow-300',
  stopping: 'bg-yellow-500/15 text-yellow-300',
  open: 'bg-yellow-500/15 text-yellow-300',
  closed: 'bg-white/10 text-text-muted',
  low: 'bg-white/10 text-text-muted',
  medium: 'bg-yellow-500/15 text-yellow-300',
  high: 'bg-red-500/15 text-red-300',
  admin: 'bg-accent-violet/20 text-accent-violet-light',
  support: 'bg-accent-teal-bright/15 text-accent-teal-bright',
  dev: 'bg-orange-500/15 text-orange-300',
  customer: 'bg-white/10 text-text-muted',
  active: 'bg-emerald-500/15 text-emerald-300',
  inactive: 'bg-white/10 text-text-muted',
  verified: 'bg-emerald-500/15 text-emerald-300',
  ssl_provisioning: 'bg-yellow-500/15 text-yellow-300',
  terminated: 'bg-red-500/15 text-red-300',
};

const STATUS_DOTS: Record<string, string> = {
  running: 'bg-emerald-400',
  building: 'bg-yellow-400',
  starting: 'bg-yellow-400',
  stopping: 'bg-yellow-400',
  failed: 'bg-red-400',
  stopped: 'bg-white/30',
  open: 'bg-yellow-400',
  active: 'bg-emerald-400',
  verified: 'bg-emerald-400',
  ssl_provisioning: 'bg-yellow-400',
  pending: 'bg-white/30',
};

export function Badge({ status, dot = false }: { status?: string | null; dot?: boolean }) {
  if (!status) return null;
  const color = STATUS_COLORS[status] ?? 'bg-white/10 text-text-muted';
  const dotColor = STATUS_DOTS[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${color}`}>
      {dot && dotColor && (
        <span className={`h-1.5 w-1.5 rounded-full ${dotColor} ${['building','starting','stopping'].includes(status) ? 'animate-pulse' : ''}`} />
      )}
      {status.replace(/_/g, ' ')}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────
// Spinner
// ─────────────────────────────────────────────────────────────
export function Spinner({ label = 'Loading...', fullPage = false }: { label?: string; fullPage?: boolean }) {
  if (fullPage) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-bg/80 backdrop-blur-sm z-50">
        <div className="flex flex-col items-center gap-3">
          <span className="h-8 w-8 rounded-full border-2 border-white/10 border-t-accent-teal-bright animate-spin" />
          <span className="text-text-muted text-sm">{label}</span>
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 text-text-muted text-sm py-10 justify-center">
      <span className="h-4 w-4 rounded-full border-2 border-white/20 border-t-accent-teal-bright animate-spin" />
      {label}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Skeleton Loaders
// ─────────────────────────────────────────────────────────────
export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-white/5 rounded ${className}`} />;
}

export function CardSkeleton() {
  return (
    <Card className="border border-white/[0.06]">
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
    </Card>
  );
}

export function TableSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-16 w-full rounded-xl" />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// EmptyState Box Container
// ─────────────────────────────────────────────────────────────
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
    <div className={`flex flex-col items-center justify-center p-8 sm:p-12 border border-white/[0.08] rounded-2xl bg-surface-secondary/40 text-center space-y-3 shadow-sm ${className || ''}`}>
      <div className="w-12 h-12 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center text-text-muted shadow-inner mb-1">
        {icon || (
          <svg className="w-6 h-6 text-text-muted/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
        )}
      </div>
      {title && <h3 className="text-sm font-semibold text-text-primary">{title}</h3>}
      <p className="text-xs text-text-muted max-w-md font-sans leading-relaxed">{message}</p>
      {action && (
        <Button variant="secondary" size="sm" onClick={action.onClick} className="mt-2">
          {action.label}
        </Button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ErrorBanner
// ─────────────────────────────────────────────────────────────
export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300 mb-4">
      <div className="flex items-center gap-3">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <span>{message}</span>
      </div>
      {onRetry && (
        <Button size="sm" variant="ghost" onClick={onRetry} className="text-red-300 hover:text-white">
          ↺ Retry
        </Button>
      )}
    </div>
  );
}


// ─────────────────────────────────────────────────────────────
// Table
// ─────────────────────────────────────────────────────────────
export function Table({ headers, children, className = '' }: {
  headers: string[];
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`overflow-x-auto rounded-2xl glass ${className}`}>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/[0.06]">
            {headers.map((h) => (
              <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wide whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function Tr({ children, className = '', onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  return (
    <tr
      className={`border-b border-white/[0.04] last:border-0 transition-colors ${onClick ? 'cursor-pointer hover:bg-white/[0.03]' : ''} ${className}`}
      onClick={onClick}
    >
      {children}
    </tr>
  );
}

export function Td({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <td className={`px-4 py-3 text-text-primary ${className}`}>{children}</td>;
}

// ─────────────────────────────────────────────────────────────
// Tabs
// ─────────────────────────────────────────────────────────────
export function Tabs({
  tabs,
  active,
  onChange,
}: {
  tabs: { label: string; value: string; count?: number }[];
  active: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex gap-1 glass rounded-xl p-1 w-fit mb-6">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          onClick={() => onChange(tab.value)}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-all flex items-center gap-1.5 ${
            active === tab.value
              ? 'bg-white/[0.08] text-text-primary'
              : 'text-text-muted hover:text-text-primary'
          }`}
        >
          {tab.label}
          {tab.count !== undefined && (
            <span className="text-xs rounded-full bg-white/10 px-1.5 py-0.5 leading-none">{tab.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Modal
// ─────────────────────────────────────────────────────────────
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
    if (open) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-md transition-all"
        onClick={() => { if (closeOnOverlayClick) onClose(); }}
      />
      <div className={`relative z-10 w-full ${width} glass rounded-2xl p-6 animate-scale-in shadow-card border border-white/10`}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-semibold text-base text-text-primary">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="text-text-muted hover:text-text-primary transition-colors p-1.5 rounded-lg hover:bg-white/10"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ConfirmDialog
// ─────────────────────────────────────────────────────────────
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
      <p className="text-text-muted text-xs mb-6">{message}</p>
      <div className="flex gap-3 justify-end">
        <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
        <Button variant={danger ? 'danger' : 'primary'} size="sm" loading={loading} onClick={handle}>
          {label}
        </Button>
      </div>
    </Modal>
  );
}


// ─────────────────────────────────────────────────────────────
// Toast System
// ─────────────────────────────────────────────────────────────
type ToastType = 'success' | 'error' | 'info';
interface ToastItem { id: number; message: string; type: ToastType; }

const ToastContext = createContext<{
  toast: (message: string, type?: ToastType) => void;
}>({ toast: () => {} });

export function useToast() { return useContext(ToastContext); }

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const counter = useRef(0);

  const toast = useCallback((message: string, type: ToastType = 'success') => {
    const id = ++counter.current;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  const COLORS: Record<ToastType, string> = {
    success: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
    error: 'border-red-500/30 bg-red-500/10 text-red-300',
    info: 'border-accent-violet/30 bg-accent-violet/10 text-accent-violet-light',
  };

  const ICONS: Record<ToastType, string> = {
    success: 'M20 6L9 17l-5-5',
    error: 'M18 6L6 18M6 6l12 12',
    info: 'M13 16h-1v-4h-1m1-4h.01',
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm">
        {toasts.map((t) => (
          <div key={t.id} className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-card backdrop-blur-md animate-slide-up ${COLORS[t.type]}`}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5">
              <path d={ICONS[t.type]}/>
            </svg>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// ─────────────────────────────────────────────────────────────
// Stat Card
// ─────────────────────────────────────────────────────────────
export function StatCard({
  label,
  value,
  icon,
  trend,
  color = 'violet',
}: {
  label: string;
  value: string | number;
  icon?: ReactNode;
  trend?: { value: string; up: boolean };
  color?: 'violet' | 'teal' | 'green' | 'orange';
}) {
  const colors = {
    violet: { bg: 'bg-accent-violet/10', text: 'text-accent-violet-light', glow: 'rgba(124,58,237,0.15)' },
    teal:   { bg: 'bg-accent-teal/10',   text: 'text-accent-teal-bright',  glow: 'rgba(34,211,238,0.15)' },
    green:  { bg: 'bg-emerald-500/10',   text: 'text-emerald-400',         glow: 'rgba(52,211,153,0.15)' },
    orange: { bg: 'bg-orange-500/10',    text: 'text-orange-300',          glow: 'rgba(251,146,60,0.15)' },
  };
  const c = colors[color];
  return (
    <div className="glass rounded-2xl p-5 flex items-center gap-4 hover:bg-white/[0.05] transition-colors">
      {icon && (
        <div className={`h-11 w-11 rounded-xl ${c.bg} flex items-center justify-center ${c.text} shrink-0`} style={{ boxShadow: `0 0 16px ${c.glow}` }}>
          {icon}
        </div>
      )}
      <div className="min-w-0">
        <p className="text-xs text-text-muted mb-0.5">{label}</p>
        <p className="text-2xl font-bold text-text-primary leading-none">{value}</p>
        {trend && (
          <p className={`text-xs mt-1 ${trend.up ? 'text-emerald-400' : 'text-red-400'}`}>
            {trend.up ? '↑' : '↓'} {trend.value}
          </p>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Formatting Helpers
// ─────────────────────────────────────────────────────────────
export function formatMoney(amountInSmallestUnit: number, currencyLabel = 'LKR') {
  return `${currencyLabel} ${(amountInSmallestUnit / 100).toFixed(2)}`;
}

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

  if (value) return <code className="text-xs bg-black/40 rounded px-2 py-1 select-all font-mono">{value}</code>;
  return (
    <div className="inline-flex items-center gap-2">
      <Button variant="secondary" size="sm" onClick={handleReveal} loading={loading}>Reveal password</Button>
      {error && <span className="text-xs text-red-300">{error}</span>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Section Header
// ─────────────────────────────────────────────────────────────
export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string | ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <h1 className="text-xl font-semibold text-text-primary">{title}</h1>
        {description && <div className="text-text-muted text-sm mt-0.5">{description}</div>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

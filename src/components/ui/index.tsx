import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Loader2, X } from 'lucide-react';
import { cn, avatarHue, initials } from '../../lib/utils';
import type { UserProfile } from '../../types';

// ---------- Button ----------

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success' | 'soft';
type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'icon' | 'icon-sm';

const BTN_VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-brand text-brand-fg hover:bg-brand-strong shadow-[0_6px_16px_-6px_var(--brand)]',
  secondary: 'bg-fg text-canvas hover:opacity-90',
  outline: 'border border-line bg-surface text-fg hover:bg-surface-2 hover:border-line-strong',
  ghost: 'text-muted hover:bg-surface-2 hover:text-fg',
  danger: 'bg-danger text-white hover:brightness-110 shadow-[0_6px_16px_-6px_var(--danger)]',
  success: 'bg-success text-white hover:brightness-110 shadow-[0_6px_16px_-6px_var(--success)]',
  soft: 'bg-brand-soft text-brand hover:brightness-95 dark:hover:brightness-125',
};

const BTN_SIZES: Record<ButtonSize, string> = {
  xs: 'h-7 px-2.5 text-xs gap-1.5 rounded-lg',
  sm: 'h-9 px-3.5 text-sm gap-2 rounded-xl',
  md: 'h-10 px-4 text-sm gap-2 rounded-xl',
  lg: 'h-12 px-6 text-[15px] gap-2.5 rounded-2xl',
  icon: 'h-10 w-10 rounded-xl',
  'icon-sm': 'h-8 w-8 rounded-lg',
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, disabled, children, type = 'button', ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={cn(
        'inline-flex shrink-0 select-none items-center justify-center font-semibold whitespace-nowrap transition-all duration-150 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50',
        BTN_VARIANTS[variant],
        BTN_SIZES[size],
        className,
      )}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  ),
);
Button.displayName = 'Button';

// ---------- Form controls ----------

const CONTROL =
  'w-full rounded-xl border border-line bg-surface px-3.5 text-sm text-fg placeholder:text-subtle transition-colors hover:border-line-strong focus:border-brand focus:outline-none focus:ring-4 focus:ring-[var(--ring)] disabled:opacity-60';

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & { icon?: React.ReactNode; trailing?: React.ReactNode }>(
  ({ className, icon, trailing, ...props }, ref) => (
    <div className="relative">
      {icon && <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-subtle [&>svg]:h-4 [&>svg]:w-4">{icon}</span>}
      <input ref={ref} className={cn(CONTROL, 'h-11', icon && 'pl-10', trailing && 'pr-11', className)} {...props} />
      {trailing && <span className="absolute right-2 top-1/2 -translate-y-1/2">{trailing}</span>}
    </div>
  ),
);
Input.displayName = 'Input';

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => <textarea ref={ref} className={cn(CONTROL, 'min-h-[96px] resize-y py-3 leading-relaxed', className)} {...props} />,
);
Textarea.displayName = 'Textarea';

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <div className="relative">
      <select ref={ref} className={cn(CONTROL, 'h-11 cursor-pointer appearance-none pr-10', className)} {...props}>
        {children}
      </select>
      <svg className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" /></svg>
    </div>
  ),
);
Select.displayName = 'Select';

export function Field({ label, hint, children, className, htmlFor }: { label: string; hint?: React.ReactNode; children: React.ReactNode; className?: string; htmlFor?: string }) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={htmlFor} className="block text-[13px] font-semibold text-fg">{label}</label>
      {children}
      {hint && <p className="text-xs text-subtle">{hint}</p>}
    </div>
  );
}

export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label?: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50',
        checked ? 'bg-success' : 'bg-surface-3',
      )}
    >
      <span className={cn('inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform', checked ? 'translate-x-[22px]' : 'translate-x-0.5')} />
    </button>
  );
}

// ---------- Segmented control ----------

export function Segmented<T extends string>({ value, onChange, options, className, size = 'md' }: {
  value: T;
  onChange: (v: NoInfer<T>) => void;
  options: { value: NoInfer<T>; label: React.ReactNode; count?: number }[];
  className?: string;
  size?: 'sm' | 'md';
}) {
  return (
    <div className={cn('inline-flex max-w-full overflow-x-auto scrollbar-hide rounded-xl border border-line bg-surface-2 p-1', className)}>
      {options.map(o => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            'relative inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg font-semibold transition-colors',
            size === 'sm' ? 'h-7 px-2.5 text-xs' : 'h-8 px-3 text-[13px]',
            value === o.value ? 'bg-surface text-fg shadow-card' : 'text-muted hover:text-fg',
          )}
        >
          {o.label}
          {o.count !== undefined && (
            <span className={cn('rounded-md px-1.5 text-[11px] tabular', value === o.value ? 'bg-brand-soft text-brand' : 'bg-surface-3 text-muted')}>{o.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}

// ---------- Display ----------

export function Card({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('card', className)} {...props}>{children}</div>;
}

export function CardHeader({ title, subtitle, icon, action, className }: { title: React.ReactNode; subtitle?: React.ReactNode; icon?: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-start justify-between gap-4', className)}>
      <div className="flex min-w-0 items-center gap-3">
        {icon && <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-muted [&>svg]:h-[18px] [&>svg]:w-[18px]">{icon}</div>}
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold text-fg">{title}</h3>
          {subtitle && <p className="truncate text-xs text-subtle">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

type PillTone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info' | 'xp';
const PILL_TONES: Record<PillTone, string> = {
  neutral: 'bg-surface-2 text-muted border-line',
  brand: 'bg-brand-soft text-brand border-transparent',
  success: 'bg-success-soft text-success border-transparent',
  warning: 'bg-warning-soft text-warning border-transparent',
  danger: 'bg-danger-soft text-danger border-transparent',
  info: 'bg-info-soft text-info border-transparent',
  xp: 'bg-xp-soft text-xp border-transparent',
};

export function Pill({ tone = 'neutral', className, children, dot }: { tone?: PillTone; className?: string; children: React.ReactNode; dot?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold', PILL_TONES[tone], className)}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

export function Avatar({ user, size = 36, className, ring }: { user?: Pick<UserProfile, 'uid' | 'username' | 'firstName' | 'lastName'> | null; size?: number; className?: string; ring?: boolean }) {
  const hue = avatarHue(user?.uid || user?.username || '?');
  return (
    <div
      title={user?.username}
      className={cn('flex shrink-0 items-center justify-center rounded-full font-bold text-white select-none', ring && 'ring-2 ring-surface', className)}
      style={{
        width: size,
        height: size,
        fontSize: Math.max(10, size * 0.36),
        background: `linear-gradient(135deg, hsl(${hue} 80% 62%), hsl(${(hue + 35) % 360} 75% 48%))`,
      }}
    >
      {initials(user)}
    </div>
  );
}

export function AvatarStack({ users, max = 4, size = 28 }: { users: (UserProfile | undefined)[]; max?: number; size?: number }) {
  const shown = users.slice(0, max);
  const rest = users.length - shown.length;
  return (
    <div className="flex -space-x-2">
      {shown.map((u, i) => <Avatar key={u?.uid || i} user={u} size={size} ring />)}
      {rest > 0 && (
        <div className="flex items-center justify-center rounded-full bg-surface-3 text-[11px] font-bold text-muted ring-2 ring-surface" style={{ width: size, height: size }}>
          +{rest}
        </div>
      )}
    </div>
  );
}

export function ProgressBar({ value, className, tone = 'brand' }: { value: number; className?: string; tone?: 'brand' | 'danger' | 'success' | 'xp' | 'warning' }) {
  const colors = { brand: 'bg-brand', danger: 'bg-danger', success: 'bg-success', xp: 'bg-xp', warning: 'bg-warning' };
  return (
    <div className={cn('h-1.5 w-full overflow-hidden rounded-full bg-surface-3', className)}>
      <motion.div
        className={cn('h-full rounded-full', colors[tone])}
        initial={{ width: 0 }}
        animate={{ width: `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%` }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      />
    </div>
  );
}

export function ProgressRing({ value, size = 56, stroke = 5, children, color = 'var(--brand)', track = 'var(--surface-3)' }: { value: number; size?: number; stroke?: number; children?: React.ReactNode; color?: string; track?: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <motion.circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - Math.min(1, Math.max(0, value))) }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  );
}

export function EmptyState({ icon, title, description, action, className }: { icon?: React.ReactNode; title: string; description?: string; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center justify-center rounded-2xl border border-dashed border-line-strong bg-surface/50 px-6 py-14 text-center', className)}>
      {icon && <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-2 text-subtle [&>svg]:h-6 [&>svg]:w-6">{icon}</div>}
      <p className="font-semibold text-fg">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Stat({ label, value, icon, tone = 'brand', hint }: { label: string; value: React.ReactNode; icon: React.ReactNode; tone?: PillTone; hint?: React.ReactNode }) {
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-medium text-muted">{label}</p>
        <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg [&>svg]:h-4 [&>svg]:w-4', PILL_TONES[tone])}>{icon}</div>
      </div>
      <p className="mt-3 font-display text-2xl font-bold tabular text-fg sm:text-3xl">{value}</p>
      {hint && <p className="mt-1 text-xs text-subtle">{hint}</p>}
    </Card>
  );
}

// ---------- Modal ----------

export function Modal({ open, onClose, title, description, children, footer, size = 'md', icon, dismissible = true }: {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  icon?: React.ReactNode;
  dismissible?: boolean;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && dismissible) onClose(); };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const t = setTimeout(() => {
      const el = panelRef.current?.querySelector<HTMLElement>('input:not([type=hidden]),textarea,select,[data-autofocus]');
      el?.focus();
    }, 50);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      clearTimeout(t);
    };
  }, [open, onClose, dismissible]);

  const widths = { sm: 'sm:max-w-md', md: 'sm:max-w-lg', lg: 'sm:max-w-2xl', xl: 'sm:max-w-4xl' };

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-labelledby={title ? titleId : undefined}>
          <motion.div
            className="absolute inset-0 bg-[#05060d]/55 backdrop-blur-[3px]"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => dismissible && onClose()}
          />
          <motion.div
            ref={panelRef}
            initial={{ opacity: 0, y: 32, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.98 }}
            transition={{ type: 'spring', damping: 30, stiffness: 380 }}
            className={cn('relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl border border-line bg-surface shadow-pop sm:rounded-3xl', widths[size])}
          >
            {(title || dismissible) && (
              <div className="flex items-start gap-3 border-b border-line px-5 py-4 sm:px-6">
                {icon && <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand [&>svg]:h-5 [&>svg]:w-5">{icon}</div>}
                <div className="min-w-0 flex-1 pt-0.5">
                  {title && <h2 id={titleId} className="text-lg font-semibold leading-tight text-fg">{title}</h2>}
                  {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
                </div>
                {dismissible && (
                  <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Chiudi"><X className="h-4 w-4" /></Button>
                )}
              </div>
            )}
            <div className="flex-1 overflow-y-auto scroll-thin px-5 py-5 sm:px-6">{children}</div>
            {footer && <div className="flex flex-col-reverse gap-2 border-t border-line bg-surface-2/60 px-5 py-4 sm:flex-row sm:items-center sm:justify-end sm:px-6">{footer}</div>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

export function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel = 'Conferma', tone = 'danger', loading, icon, children, confirmDisabled }: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  tone?: 'danger' | 'primary';
  loading?: boolean;
  icon?: React.ReactNode;
  children?: React.ReactNode;
  confirmDisabled?: boolean;
}) {
  return (
    <Modal open={open} onClose={onClose} size="sm" dismissible={!loading}
      footer={<>
        <Button variant="outline" onClick={onClose} disabled={loading}>Annulla</Button>
        <Button variant={tone} onClick={onConfirm} loading={loading} disabled={confirmDisabled}>{confirmLabel}</Button>
      </>}
    >
      <div className="flex flex-col items-center text-center">
        {icon && <div className={cn('mb-4 flex h-14 w-14 items-center justify-center rounded-2xl [&>svg]:h-7 [&>svg]:w-7', tone === 'danger' ? 'bg-danger-soft text-danger' : 'bg-brand-soft text-brand')}>{icon}</div>}
        <h3 className="text-lg font-semibold text-fg">{title}</h3>
        <div className="mt-2 text-sm leading-relaxed text-muted">{message}</div>
        {children && <div className="mt-5 w-full">{children}</div>}
      </div>
    </Modal>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton rounded-xl', className)} />;
}

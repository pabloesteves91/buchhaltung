/*
 * Compatibility barrel for the app's original UI kit.
 *
 * Every page imports its primitives from `@/components/ui`. This module keeps
 * that surface stable while the implementation now sits on shadcn/ui + Radix
 * underneath. Raw shadcn primitives live in sibling files
 * (`@/components/ui/button`, `.../dialog`, …) and can be imported directly when
 * a page needs the full shadcn API.
 */
import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react'
import { Loader2, X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Button as ShadButton, buttonVariants } from './button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './dialog'
import { Input as ShadInput } from './input'
import { Textarea as ShadTextarea } from './textarea'
import { Skeleton } from './skeleton'

export { Skeleton }
export { buttonVariants }

type OldVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
type OldSize = 'sm' | 'md'

const VARIANT_MAP: Record<OldVariant, 'default' | 'outline' | 'ghost' | 'destructive'> = {
  primary: 'default',
  secondary: 'outline',
  ghost: 'ghost',
  danger: 'destructive',
}

export function Button({
  className,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  children,
  ...props
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'ref'> & {
  variant?: OldVariant
  size?: OldSize
  loading?: boolean
}) {
  return (
    <ShadButton
      variant={VARIANT_MAP[variant]}
      size={size === 'sm' ? 'sm' : 'default'}
      disabled={disabled || loading}
      className={cn('rounded-lg active:translate-y-px', className)}
      {...props}
    >
      {loading && <Loader2 className="size-4 animate-spin" />}
      {children}
    </ShadButton>
  )
}

export function Card({
  children,
  className,
  title,
  actions,
}: {
  children: ReactNode
  className?: string
  title?: ReactNode
  actions?: ReactNode
}) {
  return (
    <section
      className={cn(
        'rounded-xl border border-border bg-card text-card-foreground shadow-sm',
        className,
      )}
    >
      {(title || actions) && (
        <header className="flex items-center justify-between gap-3 border-b border-border/70 px-4 py-3">
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  )
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <ShadInput className={cn('rounded-lg', className)} {...props} />
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <ShadTextarea className={cn('rounded-lg', className)} {...props} />
}

export function Select({
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        'h-9 w-full rounded-lg border border-input bg-card px-3 text-sm shadow-xs outline-none transition-[color,box-shadow]',
        'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  )
}

export function Field({
  label,
  children,
  hint,
  error,
}: {
  label: string
  children: ReactNode
  hint?: string
  error?: string
}) {
  return (
    <label className="block space-y-1">
      <span className="block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
      {error ? (
        <span className="block text-xs font-medium text-destructive">{error}</span>
      ) : (
        hint && <span className="block text-xs text-muted-foreground">{hint}</span>
      )}
    </label>
  )
}

const BADGE_TONE = {
  slate: 'bg-secondary text-secondary-foreground',
  green: 'bg-green-100 text-green-800',
  amber: 'bg-amber-100 text-amber-800',
  red: 'bg-red-100 text-red-800',
  blue: 'bg-brand-100 text-brand-800',
} as const

export function Badge({
  children,
  tone = 'slate',
  className,
}: {
  children: ReactNode
  tone?: keyof typeof BADGE_TONE
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        BADGE_TONE[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

/** Wrap wide tables so they scroll horizontally on small screens instead of
 *  blowing out the page width. */
export function TableWrap({ children }: { children: ReactNode }) {
  return <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">{children}</div>
}

export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean
  onClose: () => void
  title: ReactNode
  children: ReactNode
  wide?: boolean
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          'max-h-[90vh] gap-0 overflow-hidden p-0',
          wide ? 'sm:max-w-3xl' : 'sm:max-w-lg',
        )}
      >
        <DialogHeader className="flex-row items-center justify-between space-y-0 border-b border-border/70 px-4 py-3">
          <DialogTitle className="text-sm font-semibold text-foreground">{title}</DialogTitle>
          <DialogDescription className="sr-only">
            {typeof title === 'string' ? title : 'Dialog'}
          </DialogDescription>
          <button
            onClick={onClose}
            className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label="Schliessen"
          >
            <X className="size-4" />
          </button>
        </DialogHeader>
        <div className="max-h-[calc(90vh-3rem)] overflow-y-auto p-4">{children}</div>
      </DialogContent>
    </Dialog>
  )
}

export function EmptyState({
  title,
  description,
  action,
  compact,
}: {
  title: string
  description?: string
  action?: ReactNode
  /** Slimmer, borderless variant for small sub-sections inside an existing Card. */
  compact?: boolean
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-1.5 text-center',
        compact
          ? 'px-2 py-6'
          : 'rounded-xl border border-dashed border-border bg-muted/50 px-6 py-12 gap-2',
      )}
    >
      <p className={cn('font-semibold text-foreground', compact ? 'text-sm' : 'text-sm')}>
        {title}
      </p>
      {description && (
        <p className={cn('max-w-sm text-muted-foreground', compact ? 'text-xs' : 'text-sm')}>
          {description}
        </p>
      )}
      {action}
    </div>
  )
}

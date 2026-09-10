import type { ComponentType, ReactNode } from 'react'
import { cn } from '@/lib/cn'

/**
 * Compact KPI tile. Replaces the ad-hoc metric boxes on the dashboard,
 * journal and reports pages. Numbers use tabular figures so columns of
 * StatCards line up.
 */
export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'default',
  className,
}: {
  label: ReactNode
  value: ReactNode
  hint?: ReactNode
  icon?: ComponentType<{ className?: string }>
  tone?: 'default' | 'positive' | 'negative'
  className?: string
}) {
  return (
    <div
      className={cn(
        'rounded-xl border border-border bg-card p-4 shadow-sm',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        {Icon && <Icon className="size-4 shrink-0 text-muted-foreground" />}
      </div>
      <p
        className={cn(
          'mt-1 text-2xl font-semibold tabular-nums tracking-tight',
          tone === 'positive' && 'text-success',
          tone === 'negative' && 'text-destructive',
          tone === 'default' && 'text-foreground',
        )}
      >
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

import type { ReactNode, ThHTMLAttributes, TdHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

/**
 * Thin, consistent table skeleton used across the list pages. Pages keep full
 * control of their row markup and click handlers — this only standardises the
 * chrome: sticky header, row dividers, hover, cell padding, and right-aligned
 * numeric columns with tabular figures.
 *
 *   <TableWrap>
 *     <DataTable minWidth={640} head={<><Th>Datum</Th><Th align="right">Betrag</Th></>}>
 *       {rows.map((r) => (
 *         <Tr key={r.id} onClick={...}>
 *           <Td>{r.date}</Td>
 *           <Td align="right">{fmt(r.amount)}</Td>
 *         </Tr>
 *       ))}
 *     </DataTable>
 *   </TableWrap>
 */
export function DataTable({
  head,
  children,
  minWidth,
  className,
}: {
  head: ReactNode
  children: ReactNode
  minWidth?: number
  className?: string
}) {
  return (
    <table
      className={cn('w-full border-collapse text-sm', className)}
      style={minWidth ? { minWidth } : undefined}
    >
      <thead className="sticky top-0 z-10 bg-card">
        <tr className="border-b border-border text-left text-xs font-medium text-muted-foreground">
          {head}
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  )
}

export function Th({
  className,
  align = 'left',
  ...props
}: ThHTMLAttributes<HTMLTableCellElement> & { align?: 'left' | 'right' | 'center' }) {
  return (
    <th
      className={cn(
        'px-3 py-2 font-medium whitespace-nowrap',
        align === 'right' && 'text-right',
        align === 'center' && 'text-center',
        className,
      )}
      {...props}
    />
  )
}

export function Tr({
  className,
  interactive,
  ...props
}: React.HTMLAttributes<HTMLTableRowElement> & { interactive?: boolean }) {
  return (
    <tr
      className={cn(
        'border-b border-border/70 last:border-0',
        interactive && 'cursor-pointer transition-colors hover:bg-muted/60',
        className,
      )}
      {...props}
    />
  )
}

export function Td({
  className,
  align = 'left',
  ...props
}: TdHTMLAttributes<HTMLTableCellElement> & { align?: 'left' | 'right' | 'center' }) {
  return (
    <td
      className={cn(
        'px-3 py-2 align-middle',
        align === 'right' && 'text-right tabular-nums',
        align === 'center' && 'text-center',
        className,
      )}
      {...props}
    />
  )
}

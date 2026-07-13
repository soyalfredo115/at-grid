import { useState, useMemo, useRef, useLayoutEffect } from 'react'
import type { ReactNode, ThHTMLAttributes, TdHTMLAttributes, HTMLAttributes } from 'react'

/**
 * Tabla Atelier — reglas finas, encabezados en versalitas, montos serif a la derecha.
 *
 *   <AtTable>
 *     <thead><tr><AtTh>Cliente</AtTh><AtTh right>USD</AtTh></tr></thead>
 *     <tbody>
 *       <AtRow>
 *         <AtTd strong>La Curacao</AtTd>
 *         <NumCell>{fmtUSD(18240)}</NumCell>
 *       </AtRow>
 *     </tbody>
 *   </AtTable>
 */

// ---------------------------------------------------------------------------
// useSortTable — hook local de ordenamiento
// ---------------------------------------------------------------------------

export function compareValues(a: unknown, b: unknown): number {
  if (typeof a === 'number' && typeof b === 'number') {
    return a - b
  }
  if (
    typeof a === 'string' &&
    typeof b === 'string' &&
    /^\d{4}-\d{2}-\d{2}/.test(a) &&
    /^\d{4}-\d{2}-\d{2}/.test(b)
  ) {
    return a < b ? -1 : a > b ? 1 : 0
  }
  const sa = String(a ?? '')
  const sb = String(b ?? '')
  return sa.localeCompare(sb, undefined, { sensitivity: 'base' })
}

export function useSortTable<T extends Record<string, unknown>>(rows: T[]): {
  sortKey: string | null
  sortDir: 'asc' | 'desc'
  setSort: (key: string) => void
  sorted: T[]
} {
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  function setSort(key: string) {
    if (sortKey === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const sorted = useMemo(() => {
    if (!sortKey) return rows
    return [...rows].sort((a, b) => {
      const cmp = compareValues(a[sortKey], b[sortKey])
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [rows, sortKey, sortDir])

  return { sortKey, sortDir, setSort, sorted }
}

// ---------------------------------------------------------------------------
// AtTable
// ---------------------------------------------------------------------------

export function AtTable({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLTableElement>(null)

  // Copia el texto de cada <th> como data-label en los <td> de la misma columna.
  // Así el CSS móvil puede usar ::before { content: attr(data-label) } sin cambios en las páginas.
  useLayoutEffect(() => {
    const table = ref.current
    if (!table) return
    const headers = Array.from(table.querySelectorAll('thead th')).map(
      (th) => th.textContent?.trim() ?? ''
    )
    table.querySelectorAll('tbody tr').forEach((tr) => {
      Array.from(tr.querySelectorAll('td')).forEach((td, i) => {
        if (headers[i]) td.setAttribute('data-label', headers[i])
      })
    })
  })

  return <table ref={ref} className="at-table w-full border-collapse">{children}</table>
}

// ---------------------------------------------------------------------------
// AtTh — con soporte opcional de ordenamiento
// ---------------------------------------------------------------------------

type AtThProps = ThHTMLAttributes<HTMLTableCellElement> & {
  right?: boolean
  sortKey?: string
  currentSort?: { key: string | null; dir: 'asc' | 'desc' }
  onSort?: (key: string) => void
}

function SortIndicator({ active, dir }: { active: boolean; dir: 'asc' | 'desc' }) {
  if (!active) {
    return <span className="ml-1 text-[var(--text-3,#a39b90)] select-none">↕</span>
  }
  return (
    <span className="ml-1 select-none">{dir === 'asc' ? '↑' : '↓'}</span>
  )
}

export function AtTh({
  right,
  className = '',
  children,
  sortKey,
  currentSort,
  onSort,
  ...rest
}: AtThProps) {
  const isSortable = Boolean(sortKey && onSort)
  const isActive = isSortable && currentSort?.key === sortKey

  function handleClick() {
    if (isSortable && sortKey) {
      onSort!(sortKey)
    }
  }

  return (
    <th
      onClick={isSortable ? handleClick : undefined}
      className={`px-8 py-3.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-3,#a39b90)]
        border-b border-[var(--border-2,#cec6b6)] ${right ? 'text-right' : 'text-left'}
        ${isSortable ? 'cursor-pointer hover:text-[var(--text,#1a1714)] transition-colors' : ''}
        ${className}`}
      {...rest}
    >
      {children}
      {isSortable && (
        <SortIndicator
          active={Boolean(isActive)}
          dir={isActive ? (currentSort?.dir ?? 'asc') : 'asc'}
        />
      )}
    </th>
  )
}

export function AtRow({ children, className = '', ...rest }: HTMLAttributes<HTMLTableRowElement> & { children: ReactNode }) {
  return <tr className={`transition-colors hover:bg-black/[0.018] ${className}`} {...rest}>{children}</tr>
}

export function AtTd({ strong, right, className = '', children, ...rest }: TdHTMLAttributes<HTMLTableCellElement> & { strong?: boolean; right?: boolean }) {
  return (
    <td
      className={`px-8 py-3.5 text-sm border-b border-[var(--border,#e0dace)] ${strong ? 'text-[var(--text,#1a1714)]' : 'text-[var(--text-2,#6b645c)]'}
        ${right ? 'text-right whitespace-nowrap' : ''} ${className}`}
      {...rest}
    >
      {children}
    </td>
  )
}

/** Celda de monto: serif, alineada a la derecha, sin corte. */
export function NumCell({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <td className={`px-8 py-3.5 border-b border-[var(--border,#e0dace)] text-right font-serif text-[15px] text-[var(--text,#1a1714)] whitespace-nowrap ${className}`}>
      {children}
    </td>
  )
}

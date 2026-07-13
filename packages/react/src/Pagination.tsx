/**
 * Pagination — barra de paginación estilo Atelier.
 *
 * Uso:
 *   const { page, setPage, pageCount, paged, from, to, total } = usePagination(items)
 *   <Pagination page={page} pageCount={pageCount} setPage={setPage} from={from} to={to} total={total} />
 *
 * No se renderiza si pageCount <= 1.
 */

import { useTranslation } from 'react-i18next'

interface PaginationProps {
  page: number
  pageCount: number
  setPage: (page: number) => void
  from: number
  to: number
  total: number
  /** Selector de filas por página (opcional; si se pasa, la barra se muestra aunque haya una sola página). */
  pageSize?: number
  pageSizeOptions?: number[]
  onPageSizeChange?: (n: number) => void
}

/** Genera la lista de ítems de página a mostrar (números y '...'). */
function buildPageItems(page: number, pageCount: number): Array<number | '...'> {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, i) => i + 1)
  }

  const items: Array<number | '...'> = []

  // Siempre primera
  items.push(1)

  const rangeStart = Math.max(2, page - 2)
  const rangeEnd = Math.min(pageCount - 1, page + 2)

  if (rangeStart > 2) items.push('...')

  for (let i = rangeStart; i <= rangeEnd; i++) {
    items.push(i)
  }

  if (rangeEnd < pageCount - 1) items.push('...')

  // Siempre última
  items.push(pageCount)

  return items
}

export function Pagination({
  page,
  pageCount,
  setPage,
  from,
  to,
  total,
  pageSize,
  pageSizeOptions,
  onPageSizeChange,
}: PaginationProps) {
  const { t } = useTranslation()
  if (pageCount <= 1 && !onPageSizeChange) return null

  const pageItems = buildPageItems(page, pageCount)

  const btnBase = 'px-2.5 py-1 text-xs rounded transition-colors'
  const btnActive = 'bg-[var(--text,#1a1714)] text-[var(--bg,#f6f4ef)]'
  const btnInactive = 'text-[var(--text-2,#6b645c)] hover:bg-[var(--bg-2,#efebe2)]'
  const btnNav = `${btnBase} ${btnInactive} disabled:opacity-30 disabled:cursor-not-allowed`

  return (
    <div className="flex items-center justify-between px-8 py-3 border-t border-[var(--border,#e0dace)] bg-[var(--bg-2,#efebe2)] text-sm">
      {/* Texto informativo + selector de tamaño */}
      <span className="flex items-center gap-3">
        <span className="text-[var(--text-2,#6b645c)] text-xs">
          {t('pagination.mostrando', { from, to, total })}
        </span>
        {onPageSizeChange && pageSize && (
          <label className="flex items-center gap-1.5 text-xs text-[var(--text-3,#a39b90)]">
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="px-1 py-0.5 text-xs border border-[var(--border,#e0dace)] rounded-[4px] bg-[var(--surface,#fffefb)] text-[var(--text,#1a1714)]
                cursor-pointer focus:outline-none focus:border-[var(--primary,#b8553a)]"
            >
              {(pageSizeOptions ?? [25, 50, 100, 250]).map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
            {t('pagination.porPagina')}
          </label>
        )}
      </span>

      {/* Controles de página */}
      <div className="flex items-center gap-1">
        {/* Prev */}
        <button
          className={btnNav}
          onClick={() => setPage(page - 1)}
          disabled={page === 1}
          aria-label={t('pagination.paginaAnterior')}
        >
          &lt;
        </button>

        {pageItems.map((item, idx) =>
          item === '...' ? (
            <span
              key={`ellipsis-${idx}`}
              className="px-2 py-1 text-xs text-[var(--text-3,#a39b90)] select-none"
            >
              …
            </span>
          ) : (
            <button
              key={item}
              className={`${btnBase} ${item === page ? btnActive : btnInactive}`}
              onClick={() => setPage(item)}
              aria-current={item === page ? 'page' : undefined}
            >
              {item}
            </button>
          )
        )}

        {/* Next */}
        <button
          className={btnNav}
          onClick={() => setPage(page + 1)}
          disabled={page === pageCount}
          aria-label={t('pagination.paginaSiguiente')}
        >
          &gt;
        </button>
      </div>
    </div>
  )
}

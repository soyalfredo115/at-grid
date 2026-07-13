import { useState, useMemo, useRef, useEffect, useLayoutEffect, useCallback } from 'react'
import type {
  ReactNode,
  CSSProperties,
  DragEvent,
  PointerEvent as ReactPointerEvent,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
} from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { useAutoAnimate } from '@formkit/auto-animate/react'
import {
  ChevronRight,
  ChevronsUpDown,
  ChevronsDownUp,
  Filter,
  RotateCcw,
  X,
  Layers,
  Search,
  Columns3,
  EllipsisVertical,
  Eye,
  EyeOff,
  ArrowUp,
  ArrowDown,
  ArrowLeftToLine,
  ArrowRightToLine,
  Download,
  Copy,
  Check,
  ChevronsLeftRight,
} from 'lucide-react'
import { compareValues } from './DataTable'
import { Pagination } from './Pagination'
import { downloadXlsx } from './lib/xlsx'
import type {
  AtGridFilterType,
  AtGridAggregate,
  SortState,
  ColumnFilterValue,
  PinSide,
  GroupNode,
  FlatItem,
} from '@soyalfredo115/at-grid-types'

/**
 * AtGrid — tabla Atelier declarativa con superpoderes, 100% código propio:
 *
 *   · Ordenar por columna (click en header; Shift+click = multi-sort)
 *   · Reordenar columnas (arrastrar headers)
 *   · Redimensionar columnas (arrastrar el borde derecho del header)
 *   · Fijar columnas a la izquierda/derecha (menú de columna)
 *   · Agrupar por columna con subtotales (arrastrar header a la barra o usar el select)
 *   · Búsqueda global (quick filter sobre todas las columnas)
 *   · Filtros por columna tipados: texto, número (`> < = a..b`), rango de fechas
 *     y set de valores con checkboxes (`filterType`)
 *   · Menú de columna (orden, agrupar, fijar, ocultar)
 *   · Ocultar / mostrar columnas (panel "Columnas" en la barra)
 *   · Selección de filas (`selectable`) con barra de agregados de la selección
 *   · Export Excel (.xlsx propio, sin librerías) y copia TSV al portapapeles
 *     (filas visibles o selección)
 *   · Autosize de columna (doble click en el borde del header o menú)
 *   · Tooltip automático en celdas con texto cortado
 *   · Grupos de encabezado de 2 niveles (`group` en la columna)
 *   · Clases condicionales por celda (`cellClass`)
 *   · Selector de filas por página + navegación por teclado
 *     (↑/↓ mueve, Enter abre/expande, Espacio selecciona, PageUp/PageDown pagina)
 *   · Estado persistido en localStorage por `storageKey` (orden, anchos, sort,
 *     agrupación, columnas ocultas y fijadas, tamaño de página)
 *
 *   <AtGrid
 *     columns={[
 *       { key: 'partner', label: 'Cliente', strong: true, groupable: true },
 *       { key: 'state', label: 'Estado', filterType: 'set' },
 *       { key: 'date', label: 'Fecha', filterType: 'date' },
 *       { key: 'amount_usd', label: 'USD', numeric: true, aggregate: 'sum', aggregateFormat: fmtUSD },
 *     ]}
 *     rows={rows}
 *     storageKey="cxc"
 *     selectable
 *     onRowClick={setSelected}
 *   />
 */

// ---------------------------------------------------------------------------
// Tipos
//
// AtGridFilterType, AtGridAggregate, SortState, ColumnFilterValue, PinSide,
// GroupNode y FlatItem viven en @soyalfredo115/at-grid-types (compartidos con
// la versión Angular). AtGridColumn, PersistedState, PopoverState y AtGridProps
// se quedan acá: esta versión agrega render/footer/aggregateFormat con ReactNode
// que la versión Angular no tiene (proyecta celdas custom como ng-template).
// ---------------------------------------------------------------------------

export type AtGridColumn<T> = {
  key: string
  label: string
  /** Grupo de encabezado (2º nivel): columnas contiguas con el mismo grupo comparten cabecera. */
  group?: string
  align?: 'left' | 'right'
  /** Monto: serif, derecha, sin corte (estilo NumCell). */
  numeric?: boolean
  strong?: boolean
  minWidth?: number
  sortable?: boolean
  filterable?: boolean
  /** Tipo de filtro de columna. Por defecto: 'number' si `numeric`, si no 'text'. */
  filterType?: AtGridFilterType
  groupable?: boolean
  /** Agregado mostrado en la fila de grupo y en la barra de selección. */
  aggregate?: AtGridAggregate<T>
  aggregateFormat?: (v: number) => ReactNode
  /** Celda de la fila de totales al pie (recibe las filas filtradas). */
  footer?: (rows: T[]) => ReactNode
  render?: (row: T) => ReactNode
  sortValue?: (row: T) => unknown
  filterValue?: (row: T) => string
  numValue?: (row: T) => number
  groupValue?: (row: T) => string
  /** Valor crudo para el export Excel / copia TSV (default: numVal si `numeric`, si no el valor de la celda). */
  exportValue?: (row: T) => string | number
  tdClassName?: string
  /** Clases condicionales por celda según la fila (p. ej. negativos en rojo). */
  cellClass?: (row: T) => string | false | null | undefined
}

type PersistedState = {
  order?: string[]
  widths?: Record<string, number>
  /** Legado: una sola columna de orden (versiones anteriores). */
  sort?: { key: string | null; dir: 'asc' | 'desc' }
  sorts?: SortState[]
  groupBy?: string[]
  showFilters?: boolean
  hidden?: string[]
  pinned?: Record<string, PinSide>
  pageSize?: number
}

type PopoverState =
  | { kind: 'menu'; key: string; anchor: HTMLElement }
  | { kind: 'set'; key: string; anchor: HTMLElement }
  | { kind: 'columns'; anchor: HTMLElement }
  | { kind: 'export'; anchor: HTMLElement }

type AtGridProps<T> = {
  columns: AtGridColumn<T>[]
  rows: T[]
  /** Clave de persistencia en localStorage (una por página/tabla). */
  storageKey?: string
  rowKey?: (row: T, index: number) => string | number
  onRowClick?: (row: T) => void
  /** Clases extra por fila (p. ej. resaltar la seleccionada). */
  rowClassName?: (row: T) => string
  /** Filas por página. Sin definir = sin paginación. Cuenta también las filas de grupo. */
  pageSize?: number
  /** Checkboxes de selección + barra de agregados de lo seleccionado. */
  selectable?: boolean
  /** Nombre del archivo del export Excel (default: storageKey). */
  exportFileName?: string
  /** Notifica cada cambio de selección (ej. para habilitar acciones en lote en la página). */
  onSelectionChange?: (rows: T[]) => void
  /** Acciones extra renderizadas en la barra de selección, junto a "limpiar selección". */
  selectionActions?: (rows: T[]) => ReactNode
  /** Cambiar este valor limpia la selección actual (ej. tras una acción en lote exitosa). */
  clearSelectionSignal?: number
}

const DEFAULT_COL_W = 140
const CHECKBOX_W = 40

// ---------------------------------------------------------------------------
// Helpers de valor
// ---------------------------------------------------------------------------

function cellRaw<T>(row: T, col: AtGridColumn<T>): unknown {
  return (row as Record<string, unknown>)[col.key]
}

function sortVal<T>(row: T, col: AtGridColumn<T>): unknown {
  return col.sortValue ? col.sortValue(row) : cellRaw(row, col)
}

function filterVal<T>(row: T, col: AtGridColumn<T>): string {
  return col.filterValue ? col.filterValue(row) : String(cellRaw(row, col) ?? '')
}

function numVal<T>(row: T, col: AtGridColumn<T>): number {
  if (col.numValue) return col.numValue(row)
  const v = cellRaw(row, col)
  return typeof v === 'number' ? v : Number(v) || 0
}

function groupVal<T>(row: T, col: AtGridColumn<T>): string {
  if (col.groupValue) return col.groupValue(row)
  const v = cellRaw(row, col)
  return v === null || v === undefined || v === '' ? '—' : String(v)
}

function aggNum<T>(col: AtGridColumn<T>, rows: T[]): number {
  const a = col.aggregate
  if (typeof a === 'function') return a(rows)
  if (a === 'count') return rows.length
  if (a === 'min' || a === 'max') {
    if (!rows.length) return 0
    let m = a === 'min' ? Infinity : -Infinity
    for (const r of rows) {
      const v = numVal(r, col)
      m = a === 'min' ? Math.min(m, v) : Math.max(m, v)
    }
    return m
  }
  const sum = rows.reduce((acc, r) => acc + numVal(r, col), 0)
  return a === 'avg' ? (rows.length ? sum / rows.length : 0) : sum
}

function filterTypeOf<T>(col: AtGridColumn<T>): AtGridFilterType {
  return col.filterType ?? (col.numeric ? 'number' : 'text')
}

function filterIsActive(f: ColumnFilterValue | undefined): boolean {
  if (f === undefined) return false
  if (typeof f === 'string') return f.trim() !== ''
  if (Array.isArray(f)) return true
  return Boolean(f.from || f.to)
}

function parseNum(s: string): number {
  return Number(s.replace(/,/g, ''))
}

/** Expresiones numéricas: `>1000`, `>=5`, `<0`, `!=10`, `=7`, `100..200` o `1000` (igual). */
function matchNumberExpr(v: number, expr: string): boolean {
  const s = expr.trim()
  if (!s) return true
  const range = s.match(/^(-?[\d.,]+)\s*\.\.\s*(-?[\d.,]+)$/)
  if (range) {
    const a = parseNum(range[1])
    const b = parseNum(range[2])
    if (Number.isNaN(a) || Number.isNaN(b)) return true
    return v >= Math.min(a, b) && v <= Math.max(a, b)
  }
  const m = s.match(/^(>=|<=|!=|<>|=|>|<)?\s*(-?[\d.,]+)$/)
  if (!m) return true // expresión incompleta: no filtrar todavía
  const n = parseNum(m[2])
  if (Number.isNaN(n)) return true
  switch (m[1]) {
    case '>':
      return v > n
    case '>=':
      return v >= n
    case '<':
      return v < n
    case '<=':
      return v <= n
    case '!=':
    case '<>':
      return v !== n
    default:
      return Math.abs(v - n) < 1e-9
  }
}

/** Normaliza un valor a fecha ISO `YYYY-MM-DD` (o '' si no parece fecha). */
function dateStr(v: unknown): string {
  if (!v) return ''
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  const s = String(v)
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : ''
}

function rowPassesFilter<T>(row: T, col: AtGridColumn<T>, f: ColumnFilterValue): boolean {
  if (Array.isArray(f)) return f.includes(groupVal(row, col))
  if (typeof f === 'string') {
    const s = f.trim()
    if (!s) return true
    if (filterTypeOf(col) === 'number') return matchNumberExpr(numVal(row, col), s)
    return filterVal(row, col).toLowerCase().includes(s.toLowerCase())
  }
  const d = dateStr(sortVal(row, col)) || dateStr(cellRaw(row, col))
  if (!d) return false
  if (f.from && d < f.from) return false
  if (f.to && d > f.to) return false
  return true
}

function loadPersisted(storageKey?: string): PersistedState {
  if (!storageKey) return {}
  try {
    const raw = localStorage.getItem('atgrid:' + storageKey)
    return raw ? (JSON.parse(raw) as PersistedState) : {}
  } catch {
    return {}
  }
}

function reconcileOrder(stored: string[] | undefined, keys: string[]): string[] {
  if (!stored?.length) return keys
  const valid = stored.filter((k) => keys.includes(k))
  return [...valid, ...keys.filter((k) => !valid.includes(k))]
}

// ---------------------------------------------------------------------------
// Popover — flotante anclado con posición fija (sobrevive al overflow del scroll)
// ---------------------------------------------------------------------------

function Popover({
  anchor,
  onClose,
  children,
  width = 224,
}: {
  anchor: HTMLElement
  onClose: () => void
  children: ReactNode
  width?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const r = anchor.getBoundingClientRect()
  const left = Math.max(8, Math.min(r.left, window.innerWidth - width - 8))
  const top = Math.min(r.bottom + 4, window.innerHeight - 16)

  useEffect(() => {
    function onDown(e: MouseEvent) {
      const t = e.target as Node
      if (ref.current?.contains(t) || anchor.contains(t)) return
      onClose()
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    function onScroll(e: Event) {
      if (ref.current?.contains(e.target as Node)) return
      onClose()
    }
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onClose)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onClose)
    }
  }, [anchor, onClose])

  return createPortal(
    <div
      ref={ref}
      style={{ position: 'fixed', top, left, width }}
      className="z-50 max-h-[70vh] overflow-y-auto bg-[var(--surface,#fffefb)] border border-[var(--border-2,#cec6b6)] rounded-[4px] py-1
        shadow-[0_10px_30px_rgba(26,23,20,0.10)]"
    >
      {children}
    </div>,
    document.body
  )
}

function MenuItem({
  onClick,
  disabled,
  active,
  children,
}: {
  onClick?: () => void
  disabled?: boolean
  active?: boolean
  children: ReactNode
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 transition-colors ${
        disabled
          ? 'text-[var(--text-3,#a39b90)]/60 cursor-default'
          : active
            ? 'text-[var(--primary,#b8553a)] bg-[var(--primary-tint,#f3e6df)]/50'
            : 'text-[var(--text-2,#6b645c)] hover:bg-[var(--bg-2,#efebe2)] hover:text-[var(--text,#1a1714)]'
      }`}
    >
      {children}
    </button>
  )
}

/** Checkbox con soporte de estado indeterminado (selección parcial). */
function TriCheckbox({
  checked,
  indeterminate,
  onChange,
  title,
}: {
  checked: boolean
  indeterminate?: boolean
  onChange: () => void
  title?: string
}) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = Boolean(indeterminate) && !checked
  }, [indeterminate, checked])
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={onChange}
      onClick={(e) => e.stopPropagation()}
      title={title}
      className="accent-[#b8553a] cursor-pointer align-middle"
    />
  )
}

// ---------------------------------------------------------------------------
// AtGrid
// ---------------------------------------------------------------------------

export default function AtGrid<T>({
  columns,
  rows,
  storageKey,
  rowKey,
  onRowClick,
  rowClassName,
  pageSize,
  selectable,
  exportFileName,
  onSelectionChange,
  selectionActions,
  clearSelectionSignal,
}: AtGridProps<T>) {
  const { t } = useTranslation('grid')

  const colMap = useMemo(() => new Map(columns.map((c) => [c.key, c])), [columns])
  const colKeys = useMemo(() => columns.map((c) => c.key), [columns])

  // -- Estado (inicializado desde localStorage una sola vez) ----------------
  const persisted = useRef(loadPersisted(storageKey))
  const [order, setOrder] = useState<string[]>(() => reconcileOrder(persisted.current.order, colKeys))
  const [widths, setWidths] = useState<Record<string, number>>(() => persisted.current.widths ?? {})
  const [sorts, setSorts] = useState<SortState[]>(() => {
    const legacy = persisted.current.sort?.key
      ? [{ key: persisted.current.sort.key, dir: persisted.current.sort.dir }]
      : []
    return (persisted.current.sorts ?? legacy).filter((s) => colKeys.includes(s.key))
  })
  const [groupBy, setGroupBy] = useState<string[]>(() =>
    (persisted.current.groupBy ?? []).filter((k) => colMap.get(k)?.groupable)
  )
  const [hidden, setHidden] = useState<string[]>(() =>
    (persisted.current.hidden ?? []).filter((k) => colKeys.includes(k))
  )
  const [pinned, setPinned] = useState<Record<string, PinSide>>(() => {
    const stored = persisted.current.pinned ?? {}
    const valid: Record<string, PinSide> = {}
    for (const [k, side] of Object.entries(stored)) {
      if (colKeys.includes(k) && (side === 'left' || side === 'right')) valid[k] = side
    }
    return valid
  })
  const [showFilters, setShowFilters] = useState<boolean>(() => persisted.current.showFilters ?? false)
  const [filters, setFilters] = useState<Record<string, ColumnFilterValue>>({})
  const [quickFilter, setQuickFilter] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())
  const [selected, setSelected] = useState<Set<T>>(() => new Set())
  const [pageSizeState, setPageSizeState] = useState<number | undefined>(
    () => persisted.current.pageSize ?? pageSize
  )
  // Columna en proceso de autosize (un frame a ancho mínimo para medir contenido real)
  const [autosizeKey, setAutosizeKey] = useState<string | null>(null)
  // Fila con foco de teclado (índice dentro de la página visible)
  const [focusIdx, setFocusIdx] = useState<number | null>(null)
  const [copied, setCopied] = useState(false)

  // Popovers (menú de columna, set filter, panel de columnas, export)
  const [popover, setPopover] = useState<PopoverState | null>(null)
  const [setSearch, setSetSearch] = useState('')
  const closePopover = useCallback(() => setPopover(null), [])

  // Drag & drop de headers
  const [dragCol, setDragCol] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<{ key: string; side: 'left' | 'right' } | null>(null)
  const [groupZoneHover, setGroupZoneHover] = useState(false)
  const [resizing, setResizing] = useState<string | null>(null)

  const thRefs = useRef(new Map<string, HTMLTableCellElement>())
  const tableRef = useRef<HTMLTableElement>(null)
  const [tbodyRef] = useAutoAnimate<HTMLTableSectionElement>({ duration: 150 })

  // La selección referencia filas por identidad: al cambiar el dataset se limpia.
  useEffect(() => {
    setSelected(new Set())
  }, [rows])

  // -- Persistencia ----------------------------------------------------------
  useEffect(() => {
    if (!storageKey) return
    try {
      const state: PersistedState = {
        order,
        widths,
        sorts,
        groupBy,
        showFilters,
        hidden,
        pinned,
        pageSize: pageSizeState,
      }
      localStorage.setItem('atgrid:' + storageKey, JSON.stringify(state))
    } catch {
      /* almacenamiento lleno o bloqueado: la tabla sigue funcionando */
    }
  }, [storageKey, order, widths, sorts, groupBy, showFilters, hidden, pinned, pageSizeState])

  // -- Columnas visibles y orden de display (fijadas izq · resto · fijadas der)
  const visibleCols = useMemo(
    () =>
      order
        .map((k) => colMap.get(k))
        .filter((c): c is AtGridColumn<T> => Boolean(c) && !groupBy.includes(c!.key) && !hidden.includes(c!.key)),
    [order, colMap, groupBy, hidden]
  )

  const displayCols = useMemo(() => {
    const left = visibleCols.filter((c) => pinned[c.key] === 'left')
    const mid = visibleCols.filter((c) => !pinned[c.key])
    const right = visibleCols.filter((c) => pinned[c.key] === 'right')
    return [...left, ...mid, ...right]
  }, [visibleCols, pinned])

  const fixedLayout = Object.keys(widths).length > 0

  const anyPinnedLeft = displayCols.some((c) => pinned[c.key] === 'left')
  const checkboxSticky = Boolean(selectable) && anyPinnedLeft

  const pinOffsets = useMemo(() => {
    const left = new Map<string, number>()
    const right = new Map<string, number>()
    let acc = checkboxSticky ? CHECKBOX_W : 0
    for (const c of displayCols) {
      if (pinned[c.key] !== 'left') continue
      left.set(c.key, acc)
      acc += widths[c.key] ?? DEFAULT_COL_W
    }
    let accR = 0
    for (const c of [...displayCols].reverse()) {
      if (pinned[c.key] !== 'right') continue
      right.set(c.key, accR)
      accR += widths[c.key] ?? DEFAULT_COL_W
    }
    return { left, right }
  }, [displayCols, pinned, widths, checkboxSticky])

  const lastLeftPinned = [...displayCols].reverse().find((c) => pinned[c.key] === 'left')?.key
  const firstRightPinned = displayCols.find((c) => pinned[c.key] === 'right')?.key

  /** Clase + estilo sticky para una celda de columna fijada (solo desktop, vía CSS). */
  function pinCell(colKey: string, bg: string): { className: string; style?: CSSProperties } {
    const side = pinned[colKey]
    if (!side) return { className: '' }
    const edge = colKey === lastLeftPinned ? ' at-pin-edge-l' : colKey === firstRightPinned ? ' at-pin-edge-r' : ''
    const style: CSSProperties = { ['--at-pin-bg' as string]: bg }
    if (side === 'left') style.left = pinOffsets.left.get(colKey) ?? 0
    else style.right = pinOffsets.right.get(colKey) ?? 0
    return { className: ' at-pin' + edge, style }
  }

  function checkboxPin(bg: string): { className: string; style?: CSSProperties } {
    if (!checkboxSticky) return { className: '' }
    return { className: ' at-pin', style: { left: 0, ['--at-pin-bg' as string]: bg } }
  }

  // -- Valores únicos para columnas con filtro tipo set -----------------------
  const setFilterValues = useMemo(() => {
    const map = new Map<string, Map<string, number>>()
    for (const col of columns) {
      if (col.filterable === false || filterTypeOf(col) !== 'set') continue
      const counts = new Map<string, number>()
      for (const r of rows) {
        const v = groupVal(r, col)
        counts.set(v, (counts.get(v) ?? 0) + 1)
      }
      map.set(col.key, counts)
    }
    return map
  }, [columns, rows])

  // -- Pipeline: filtrar → ordenar → agrupar ---------------------------------
  const filteredRows = useMemo(() => {
    const q = quickFilter.trim().toLowerCase()
    const active = Object.entries(filters).filter(([, v]) => filterIsActive(v))
    if (!q && !active.length) return rows
    return rows.filter((r) => {
      if (q && !columns.some((c) => filterVal(r, c).toLowerCase().includes(q))) return false
      return active.every(([key, f]) => {
        const col = colMap.get(key)
        if (!col) return true
        return rowPassesFilter(r, col, f)
      })
    })
  }, [rows, filters, quickFilter, colMap, columns])

  const sortedRows = useMemo(() => {
    if (!sorts.length) return filteredRows
    const active = sorts
      .map((s) => ({ s, col: colMap.get(s.key) }))
      .filter((x): x is { s: SortState; col: AtGridColumn<T> } => Boolean(x.col))
    if (!active.length) return filteredRows
    return [...filteredRows].sort((a, b) => {
      for (const { s, col } of active) {
        const c = compareValues(sortVal(a, col), sortVal(b, col))
        if (c) return s.dir === 'asc' ? c : -c
      }
      return 0
    })
  }, [filteredRows, sorts, colMap])

  const primarySort = sorts[0]

  const groupTree = useMemo(() => {
    if (!groupBy.length) return null
    const groupCols = groupBy.map((k) => colMap.get(k)).filter((c): c is AtGridColumn<T> => Boolean(c))
    if (!groupCols.length) return null
    const sortCol = primarySort ? colMap.get(primarySort.key) : undefined
    const mul = primarySort?.dir === 'desc' ? -1 : 1

    function build(input: T[], depth: number, parentPath: string): GroupNode<T>[] {
      const col = groupCols[depth]
      const buckets = new Map<string, T[]>()
      for (const r of input) {
        const v = groupVal(r, col)
        const arr = buckets.get(v)
        if (arr) arr.push(r)
        else buckets.set(v, [r])
      }
      const nodes: GroupNode<T>[] = [...buckets.entries()].map(([value, rs]) => {
        const path = `${parentPath}§${col.key}:${value}`
        return {
          path,
          colKey: col.key,
          value,
          depth,
          rows: rs,
          children: depth + 1 < groupCols.length ? build(rs, depth + 1, path) : [],
        }
      })
      // Orden de los grupos: por agregado si se ordena una columna agregada,
      // por valor (con dirección) si se ordena la columna agrupada, alfabético si no.
      if (sortCol?.aggregate && sortCol.key !== col.key) {
        nodes.sort((a, b) => (aggNum(sortCol, a.rows) - aggNum(sortCol, b.rows)) * mul)
      } else if (primarySort?.key === col.key) {
        nodes.sort((a, b) => compareValues(a.value, b.value) * mul)
      } else {
        nodes.sort((a, b) => compareValues(a.value, b.value))
      }
      return nodes
    }
    return build(sortedRows, 0, '')
  }, [groupBy, colMap, sortedRows, primarySort])

  const flatItems = useMemo<FlatItem<T>[]>(() => {
    if (!groupTree) {
      return sortedRows.map((row, index) => ({ type: 'row', row, depth: 0, index }))
    }
    const out: FlatItem<T>[] = []
    const counter = { i: 0 }
    function walk(nodes: GroupNode<T>[]) {
      for (const n of nodes) {
        out.push({ type: 'group', node: n })
        if (!expanded.has(n.path)) continue
        if (n.children.length) walk(n.children)
        else for (const row of n.rows) out.push({ type: 'row', row, depth: n.depth + 1, index: counter.i++ })
      }
    }
    walk(groupTree)
    return out
  }, [groupTree, sortedRows, expanded])

  // -- Paginación (sobre los items visibles, incluidas filas de grupo) --------
  const [page, setPage] = useState(1)
  useEffect(() => {
    setPage(1)
  }, [filters, quickFilter, sorts, groupBy, rows])
  // El tamaño de página es editable por el usuario; solo aplica si la tabla se declaró paginada.
  const effPageSize = pageSize ? (pageSizeState ?? pageSize) : undefined
  const sizeOptions = useMemo(() => {
    const s = new Set([25, 50, 100, 250])
    if (pageSize) s.add(pageSize)
    return [...s].sort((a, b) => a - b)
  }, [pageSize])
  const pageCount = effPageSize ? Math.max(1, Math.ceil(flatItems.length / effPageSize)) : 1
  const safePage = Math.min(page, pageCount)
  const pageItems = effPageSize
    ? flatItems.slice((safePage - 1) * effPageSize, safePage * effPageSize)
    : flatItems

  // El foco de teclado se invalida al cambiar los datos visibles o de página
  useEffect(() => {
    setFocusIdx(null)
  }, [flatItems, safePage])

  // -- Ordenar (click = una columna, Shift+click = multi-sort) -----------------
  const handleSort = useCallback((key: string, additive: boolean) => {
    setSorts((prev) => {
      const idx = prev.findIndex((s) => s.key === key)
      if (!additive) {
        if (prev.length === 1 && idx === 0) {
          return [{ key, dir: prev[0].dir === 'asc' ? 'desc' : 'asc' }]
        }
        return [{ key, dir: 'asc' }]
      }
      if (idx === -1) return [...prev, { key, dir: 'asc' }]
      if (prev[idx].dir === 'asc') {
        const next = [...prev]
        next[idx] = { key, dir: 'desc' }
        return next
      }
      return prev.filter((s) => s.key !== key)
    })
  }, [])

  const addGroup = useCallback((key: string) => {
    setGroupBy((g) => (g.includes(key) ? g : [...g, key]))
    setExpanded(new Set())
  }, [])

  const removeGroup = useCallback((key: string) => {
    setGroupBy((g) => g.filter((k) => k !== key))
    setExpanded(new Set())
  }, [])

  const toggleHidden = useCallback((key: string) => {
    setHidden((h) => (h.includes(key) ? h.filter((k) => k !== key) : [...h, key]))
  }, [])

  // -- Fijar columnas -----------------------------------------------------------
  /** Congela los anchos actuales de todas las columnas (pasa a table-layout fixed). */
  const ensureFixedWidths = useCallback(() => {
    if (fixedLayout) return widths
    const base: Record<string, number> = {}
    thRefs.current.forEach((el, k) => {
      base[k] = el.offsetWidth
    })
    setWidths(base)
    return base
  }, [fixedLayout, widths])

  function setPin(key: string, side: PinSide | null) {
    if (side) ensureFixedWidths()
    setPinned((prev) => {
      const next = { ...prev }
      if (side) next[key] = side
      else delete next[key]
      return next
    })
  }

  // -- Autosize: un frame con la columna al mínimo para medir el contenido real --
  function autosizeColumn(key: string) {
    ensureFixedWidths()
    setAutosizeKey(key)
  }

  useLayoutEffect(() => {
    if (!autosizeKey) return
    const key = autosizeKey
    let max = 40
    const th = thRefs.current.get(key)
    if (th) max = Math.max(max, th.scrollWidth)
    tableRef.current
      ?.querySelectorAll<HTMLElement>(`td[data-colkey="${key}"]`)
      .forEach((el) => {
        max = Math.max(max, el.scrollWidth)
      })
    const minW = colMap.get(key)?.minWidth ?? 64
    setWidths((prev) => ({ ...prev, [key]: Math.max(minW, max + 10) }))
    setAutosizeKey(null)
  }, [autosizeKey, colMap])

  // -- Selección ------------------------------------------------------------------
  function toggleRow(row: T) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(row)) next.delete(row)
      else next.add(row)
      return next
    })
  }

  function toggleRows(rowsIn: T[]) {
    setSelected((prev) => {
      const next = new Set(prev)
      const allIn = rowsIn.every((r) => next.has(r))
      if (allIn) rowsIn.forEach((r) => next.delete(r))
      else rowsIn.forEach((r) => next.add(r))
      return next
    })
  }

  const allFilteredSelected = filteredRows.length > 0 && filteredRows.every((r) => selected.has(r))
  const someFilteredSelected = !allFilteredSelected && filteredRows.some((r) => selected.has(r))
  const selectedRows = useMemo(() => [...selected], [selected])

  useEffect(() => {
    onSelectionChange?.(selectedRows)
  }, [selectedRows, onSelectionChange])

  useEffect(() => {
    if (clearSelectionSignal !== undefined) setSelected(new Set())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clearSelectionSignal])

  function toggleExpand(path: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  function expandAll() {
    const paths = new Set<string>()
    function walk(nodes: GroupNode<T>[]) {
      for (const n of nodes) {
        paths.add(n.path)
        walk(n.children)
      }
    }
    if (groupTree) walk(groupTree)
    setExpanded(paths)
  }

  function resetAll() {
    setOrder(colKeys)
    setWidths({})
    setSorts([])
    setGroupBy([])
    setHidden([])
    setPinned({})
    setFilters({})
    setQuickFilter('')
    setShowFilters(false)
    setExpanded(new Set())
    setSelected(new Set())
    setPageSizeState(pageSize)
    setFocusIdx(null)
    setPopover(null)
    if (storageKey) {
      try {
        localStorage.removeItem('atgrid:' + storageKey)
      } catch {
        /* sin acceso a storage */
      }
    }
  }

  // -- Export Excel (.xlsx generado en lib/xlsx.ts, sin librerías) --------------------
  function exportCell(r: T, c: AtGridColumn<T>): string | number {
    const v = c.exportValue ? c.exportValue(r) : c.numeric ? numVal(r, c) : (cellRaw(r, c) ?? '')
    return typeof v === 'number' ? v : String(v)
  }

  function exportXlsx(rowsToExport: T[]) {
    const cols = displayCols
    downloadXlsx(
      exportFileName ?? storageKey ?? 'tabla',
      cols.map((c) => c.label),
      rowsToExport.map((r) => cols.map((c) => exportCell(r, c)))
    )
  }

  // -- Copiar al portapapeles (TSV: pega directo en Excel) ---------------------------
  async function copyTSV(rowsToCopy: T[]) {
    const cols = displayCols
    const lines = [
      cols.map((c) => c.label).join('\t'),
      ...rowsToCopy.map((r) =>
        cols.map((c) => String(exportCell(r, c)).replace(/[\t\n]/g, ' ')).join('\t')
      ),
    ]
    try {
      await navigator.clipboard.writeText(lines.join('\n'))
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      /* clipboard bloqueado (contexto no seguro): no hay feedback */
    }
  }

  // -- Tooltip automático en celdas con contenido cortado -----------------------------
  function handleCellMouseOver(e: ReactMouseEvent<HTMLTableSectionElement>) {
    const td = (e.target as HTMLElement).closest('td') as HTMLElement | null
    if (!td) return
    const clipped =
      td.scrollWidth > td.clientWidth + 1 ||
      Array.from(td.querySelectorAll<HTMLElement>('.truncate')).some(
        (n) => n.scrollWidth > n.clientWidth + 1
      )
    if (clipped) {
      td.title = td.innerText.trim()
      td.dataset.autoTitle = '1'
    } else if (td.dataset.autoTitle) {
      td.removeAttribute('title')
      delete td.dataset.autoTitle
    }
  }

  // -- Navegación por teclado (wrapper de la tabla con tabIndex) -----------------------
  function scrollRowIntoView(idx: number) {
    requestAnimationFrame(() => {
      tableRef.current
        ?.querySelector<HTMLElement>(`tr[data-ridx="${idx}"]`)
        ?.scrollIntoView({ block: 'nearest' })
    })
  }

  function onGridKeyDown(e: ReactKeyboardEvent<HTMLDivElement>) {
    const tag = (e.target as HTMLElement).tagName
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || tag === 'BUTTON') return
    if (!pageItems.length) return
    const last = pageItems.length - 1
    const move = (delta: number) => {
      e.preventDefault()
      const next =
        focusIdx === null ? (delta > 0 ? 0 : last) : Math.max(0, Math.min(last, focusIdx + delta))
      setFocusIdx(next)
      scrollRowIntoView(next)
    }
    switch (e.key) {
      case 'ArrowDown':
        move(1)
        break
      case 'ArrowUp':
        move(-1)
        break
      case 'Home':
        e.preventDefault()
        setFocusIdx(0)
        scrollRowIntoView(0)
        break
      case 'End':
        e.preventDefault()
        setFocusIdx(last)
        scrollRowIntoView(last)
        break
      case 'PageDown':
        if (effPageSize) {
          e.preventDefault()
          setPage(Math.min(pageCount, safePage + 1))
        }
        break
      case 'PageUp':
        if (effPageSize) {
          e.preventDefault()
          setPage(Math.max(1, safePage - 1))
        }
        break
      case 'Enter': {
        if (focusIdx === null) break
        e.preventDefault()
        const it = pageItems[focusIdx]
        if (it.type === 'group') toggleExpand(it.node.path)
        else onRowClick?.(it.row)
        break
      }
      case ' ': {
        if (focusIdx === null || !selectable) break
        e.preventDefault()
        const it = pageItems[focusIdx]
        if (it.type === 'group') toggleRows(it.node.rows)
        else toggleRow(it.row)
        break
      }
    }
  }

  // -- Filtros por columna ------------------------------------------------------
  function setTextFilter(key: string, v: string) {
    setFilters((f) => ({ ...f, [key]: v }))
  }

  function setDateFilter(key: string, which: 'from' | 'to', v: string) {
    setFilters((f) => {
      const cur = f[key]
      const range = cur && typeof cur === 'object' && !Array.isArray(cur) ? { ...cur } : {}
      if (v) range[which] = v
      else delete range[which]
      const next = { ...f }
      if (range.from || range.to) next[key] = range
      else delete next[key]
      return next
    })
  }

  function toggleSetValue(key: string, value: string, allValues: string[]) {
    setFilters((f) => {
      const cur = f[key]
      const sel = new Set(Array.isArray(cur) ? cur : allValues)
      if (sel.has(value)) sel.delete(value)
      else sel.add(value)
      const next = { ...f }
      // Selección completa = sin filtro
      if (sel.size === allValues.length) delete next[key]
      else next[key] = [...sel]
      return next
    })
  }

  function setAllSetValues(key: string, mode: 'all' | 'none') {
    setFilters((f) => {
      const next = { ...f }
      if (mode === 'all') delete next[key]
      else next[key] = []
      return next
    })
  }

  // -- Redimensionar columnas ---------------------------------------------------
  function startResize(e: ReactPointerEvent, key: string) {
    e.preventDefault()
    e.stopPropagation()
    const col = colMap.get(key)
    const minW = col?.minWidth ?? 64
    // Primer resize: congelar los anchos actuales de TODAS las columnas para
    // pasar a table-layout fixed sin saltos.
    const base = ensureFixedWidths()
    const startX = e.clientX
    const startW = base[key] ?? DEFAULT_COL_W
    setResizing(key)
    function onMove(ev: globalThis.PointerEvent) {
      const w = Math.max(minW, startW + ev.clientX - startX)
      setWidths((prev) => ({ ...prev, [key]: w }))
    }
    function onUp() {
      window.removeEventListener('pointermove', onMove)
      setResizing(null)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp, { once: true })
  }

  // -- Reordenar columnas (drag & drop) ------------------------------------------
  function onHeaderDragStart(e: DragEvent, key: string) {
    setDragCol(key)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', key)
  }

  function onHeaderDragOver(e: DragEvent, key: string) {
    if (!dragCol || dragCol === key) return
    e.preventDefault()
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const side = e.clientX < rect.left + rect.width / 2 ? 'left' : 'right'
    setDropTarget((d) => (d?.key === key && d.side === side ? d : { key, side }))
  }

  function onHeaderDrop(e: DragEvent, key: string) {
    e.preventDefault()
    if (dragCol && dragCol !== key && dropTarget?.key === key) {
      setOrder((prev) => {
        const next = prev.filter((k) => k !== dragCol)
        const idx = next.indexOf(key) + (dropTarget.side === 'right' ? 1 : 0)
        next.splice(idx, 0, dragCol)
        return next
      })
    }
    setDragCol(null)
    setDropTarget(null)
  }

  function onDragEnd() {
    setDragCol(null)
    setDropTarget(null)
    setGroupZoneHover(false)
  }

  // -- Clases de celda --------------------------------------------------------------
  function tdCls(col: AtGridColumn<T>): string {
    const clip = fixedLayout ? ' overflow-hidden' : ''
    if (col.numeric) {
      return `px-8 py-3.5 border-b border-[var(--border,#e0dace)] text-right font-serif text-[15px] text-[var(--text,#1a1714)] whitespace-nowrap${clip} ${col.tdClassName ?? ''}`
    }
    return `px-8 py-3.5 text-sm border-b border-[var(--border,#e0dace)] ${col.strong ? 'text-[var(--text,#1a1714)]' : 'text-[var(--text-2,#6b645c)]'} ${
      col.align === 'right' ? 'text-right whitespace-nowrap' : ''
    }${clip} ${col.tdClassName ?? ''}`
  }

  function aggCell(col: AtGridColumn<T>, groupRows: T[]): ReactNode {
    if (!col.aggregate) return null
    const v = aggNum(col, groupRows)
    if (col.aggregateFormat) return col.aggregateFormat(v)
    return v.toLocaleString('es-HN', { maximumFractionDigits: 2 })
  }

  // -- Celda de la fila de filtros, según el tipo de la columna ----------------------
  const filterInputCls = `w-full min-w-[60px] px-2 py-1 text-xs font-normal normal-case tracking-normal
    border border-[var(--border,#e0dace)] rounded-[4px] bg-[var(--surface,#fffefb)] text-[var(--text,#1a1714)] placeholder:text-[var(--text-3,#a39b90)]
    focus:outline-none focus:border-[var(--primary,#b8553a)]`

  function filterCell(col: AtGridColumn<T>): ReactNode {
    if (col.filterable === false) return null
    const ft = filterTypeOf(col)
    const f = filters[col.key]

    if (ft === 'date') {
      const range = f && typeof f === 'object' && !Array.isArray(f) ? f : {}
      return (
        <div className="flex flex-col gap-1">
          <input
            type="date"
            value={range.from ?? ''}
            onChange={(e) => setDateFilter(col.key, 'from', e.target.value)}
            title={t('desde')}
            className={filterInputCls}
          />
          <input
            type="date"
            value={range.to ?? ''}
            onChange={(e) => setDateFilter(col.key, 'to', e.target.value)}
            title={t('hasta')}
            className={filterInputCls}
          />
        </div>
      )
    }

    if (ft === 'set') {
      const sel = Array.isArray(f) ? f : null
      const total = setFilterValues.get(col.key)?.size ?? 0
      const isOpen = popover?.kind === 'set' && popover.key === col.key
      return (
        <button
          onClick={(e) => {
            setSetSearch('')
            setPopover(isOpen ? null : { kind: 'set', key: col.key, anchor: e.currentTarget })
          }}
          className={`${filterInputCls} text-left flex items-center justify-between gap-1 ${
            sel ? 'border-[var(--primary,#b8553a)] text-[var(--primary-dark,#93422c)]' : ''
          }`}
        >
          <span className="truncate">{sel ? t('nSeleccionados', { n: sel.length }) : t('todos')}</span>
          <span className="text-[var(--text-3,#a39b90)] shrink-0 text-[10px]">{total}</span>
        </button>
      )
    }

    const sv = typeof f === 'string' ? f : ''
    return (
      <input
        type="text"
        value={sv}
        onChange={(e) => setTextFilter(col.key, e.target.value)}
        placeholder={ft === 'number' ? t('filtrarNum') : t('filtrar')}
        className={filterInputCls}
      />
    )
  }

  // -- Toolbar -----------------------------------------------------------------------
  const groupableCols = columns.filter((c) => c.groupable)
  const pendingGroupables = groupableCols.filter((c) => !groupBy.includes(c.key))
  const hasActiveFilters = Object.values(filters).some(filterIsActive)
  const grouped = groupBy.length > 0
  const dragIsGroupable = dragCol ? Boolean(colMap.get(dragCol)?.groupable) : false

  const tableStyle: CSSProperties | undefined = fixedLayout ? { tableLayout: 'fixed' } : undefined

  const aggregateCols = displayCols.filter((c) => c.aggregate)

  // Grupos de encabezado (2º nivel): runs contiguos de columnas con el mismo `group`
  const headerGroupRuns = useMemo(() => {
    if (!displayCols.some((c) => c.group)) return null
    const runs: { label: string; span: number }[] = []
    for (const c of displayCols) {
      const label = c.group ?? ''
      const lastRun = runs[runs.length - 1]
      if (lastRun && lastRun.label === label) lastRun.span++
      else runs.push({ label, span: 1 })
    }
    return runs
  }, [displayCols])

  // -- Contenido de los popovers -------------------------------------------------------
  function renderColumnMenu(key: string) {
    const col = colMap.get(key)
    if (!col) return null
    const sortable = col.sortable !== false
    const inSort = sorts.find((s) => s.key === key)
    const pin = pinned[key]
    return (
      <>
        {sortable && (
          <>
            <MenuItem
              active={inSort?.dir === 'asc'}
              onClick={() => {
                setSorts([{ key, dir: 'asc' }])
                closePopover()
              }}
            >
              <ArrowUp size={12} /> {t('ordenAsc')}
            </MenuItem>
            <MenuItem
              active={inSort?.dir === 'desc'}
              onClick={() => {
                setSorts([{ key, dir: 'desc' }])
                closePopover()
              }}
            >
              <ArrowDown size={12} /> {t('ordenDesc')}
            </MenuItem>
            {inSort && (
              <MenuItem
                onClick={() => {
                  setSorts((prev) => prev.filter((s) => s.key !== key))
                  closePopover()
                }}
              >
                <X size={12} /> {t('quitarOrden')}
              </MenuItem>
            )}
            <div className="my-1 border-t border-[var(--border,#e0dace)]" />
          </>
        )}
        <MenuItem
          active={pin === 'left'}
          onClick={() => {
            setPin(key, pin === 'left' ? null : 'left')
            closePopover()
          }}
        >
          <ArrowLeftToLine size={12} /> {t('fijarIzq')}
        </MenuItem>
        <MenuItem
          active={pin === 'right'}
          onClick={() => {
            setPin(key, pin === 'right' ? null : 'right')
            closePopover()
          }}
        >
          <ArrowRightToLine size={12} /> {t('fijarDer')}
        </MenuItem>
        {pin && (
          <MenuItem
            onClick={() => {
              setPin(key, null)
              closePopover()
            }}
          >
            <X size={12} /> {t('noFijar')}
          </MenuItem>
        )}
        <div className="my-1 border-t border-[var(--border,#e0dace)]" />
        <MenuItem
          onClick={() => {
            autosizeColumn(key)
            closePopover()
          }}
        >
          <ChevronsLeftRight size={12} /> {t('ajustarContenido')}
        </MenuItem>
        {col.groupable && (
          <MenuItem
            disabled={groupBy.includes(key)}
            onClick={() => {
              addGroup(key)
              closePopover()
            }}
          >
            <Layers size={12} /> {t('agruparPorCol')}
          </MenuItem>
        )}
        <MenuItem
          disabled={visibleCols.length <= 1}
          onClick={() => {
            toggleHidden(key)
            closePopover()
          }}
        >
          <EyeOff size={12} /> {t('ocultarColumna')}
        </MenuItem>
      </>
    )
  }

  function renderColumnsPanel() {
    return (
      <>
        {order.map((k) => {
          const col = colMap.get(k)
          if (!col) return null
          const isGrouped = groupBy.includes(k)
          const isHidden = hidden.includes(k)
          return (
            <MenuItem
              key={k}
              disabled={isGrouped || (!isHidden && visibleCols.length <= 1)}
              onClick={() => toggleHidden(k)}
            >
              {isHidden ? (
                <EyeOff size={12} className="shrink-0" />
              ) : (
                <Eye size={12} className="shrink-0 text-[var(--primary,#b8553a)]" />
              )}
              <span className={`truncate ${isHidden ? '' : 'text-[var(--text,#1a1714)]'}`}>{col.label}</span>
              {isGrouped && <span className="ml-auto text-[10px] text-[var(--text-3,#a39b90)]">{t('agrupada')}</span>}
            </MenuItem>
          )
        })}
        {hidden.length > 0 && (
          <>
            <div className="my-1 border-t border-[var(--border,#e0dace)]" />
            <MenuItem onClick={() => setHidden([])}>
              <Eye size={12} /> {t('mostrarTodas')}
            </MenuItem>
          </>
        )}
      </>
    )
  }

  function renderSetFilter(key: string) {
    const col = colMap.get(key)
    const counts = setFilterValues.get(key)
    if (!col || !counts) return null
    const allValues = [...counts.keys()].sort((a, b) => compareValues(a, b))
    const cur = filters[key]
    const sel = new Set(Array.isArray(cur) ? cur : allValues)
    const q = setSearch.trim().toLowerCase()
    const shown = q ? allValues.filter((v) => v.toLowerCase().includes(q)) : allValues
    return (
      <>
        <div className="px-2 pb-1">
          <input
            type="text"
            value={setSearch}
            onChange={(e) => setSetSearch(e.target.value)}
            placeholder={t('filtrar')}
            autoFocus
            className={filterInputCls}
          />
        </div>
        <div className="flex items-center gap-3 px-3 pb-1">
          <button
            onClick={() => setAllSetValues(key, 'all')}
            className="text-[10px] uppercase tracking-[0.12em] text-[var(--primary,#b8553a)] hover:text-[var(--primary-dark,#93422c)]"
          >
            {t('todos')}
          </button>
          <button
            onClick={() => setAllSetValues(key, 'none')}
            className="text-[10px] uppercase tracking-[0.12em] text-[var(--text-3,#a39b90)] hover:text-[var(--text,#1a1714)]"
          >
            {t('ninguno')}
          </button>
        </div>
        <div className="max-h-56 overflow-y-auto border-t border-[var(--border,#e0dace)]">
          {shown.map((v) => (
            <label
              key={v}
              className="flex items-center gap-2 px-3 py-1.5 text-xs text-[var(--text-2,#6b645c)] hover:bg-[var(--bg-2,#efebe2)] cursor-pointer"
            >
              <input
                type="checkbox"
                checked={sel.has(v)}
                onChange={() => toggleSetValue(key, v, allValues)}
                className="accent-[#b8553a]"
              />
              <span className="truncate text-[var(--text,#1a1714)]">{v}</span>
              <span className="ml-auto text-[10px] text-[var(--text-3,#a39b90)]">{counts.get(v)}</span>
            </label>
          ))}
          {shown.length === 0 && (
            <div className="px-3 py-2 text-xs text-[var(--text-3,#a39b90)] italic">{t('sinResultados')}</div>
          )}
        </div>
      </>
    )
  }

  function renderExportMenu() {
    return (
      <>
        <MenuItem
          onClick={() => {
            exportXlsx(sortedRows)
            closePopover()
          }}
        >
          <Download size={12} /> {t('exportarVisibles')}
        </MenuItem>
        <MenuItem
          disabled={selected.size === 0}
          onClick={() => {
            exportXlsx(sortedRows.filter((r) => selected.has(r)))
            closePopover()
          }}
        >
          <Download size={12} /> {t('exportarSeleccion', { n: selected.size })}
        </MenuItem>
        <div className="my-1 border-t border-[var(--border,#e0dace)]" />
        <MenuItem
          onClick={() => {
            void copyTSV(sortedRows)
            closePopover()
          }}
        >
          <Copy size={12} /> {t('copiarVisibles')}
        </MenuItem>
        <MenuItem
          disabled={selected.size === 0}
          onClick={() => {
            void copyTSV(sortedRows.filter((r) => selected.has(r)))
            closePopover()
          }}
        >
          <Copy size={12} /> {t('copiarSeleccion', { n: selected.size })}
        </MenuItem>
      </>
    )
  }

  return (
    <div>
      {/* ── Barra de control ── */}
      <div className="flex items-center gap-3 flex-wrap pb-3">
        {groupableCols.length > 0 && (
          <div
            onDragOver={(e) => {
              if (dragIsGroupable) {
                e.preventDefault()
                setGroupZoneHover(true)
              }
            }}
            onDragLeave={() => setGroupZoneHover(false)}
            onDrop={(e) => {
              e.preventDefault()
              if (dragCol && dragIsGroupable) addGroup(dragCol)
              setDragCol(null)
              setDropTarget(null)
              setGroupZoneHover(false)
            }}
            className={`flex items-center gap-2 flex-wrap min-h-[32px] px-3 py-1 border border-dashed rounded-[4px] transition-colors ${
              groupZoneHover ? 'border-[var(--primary,#b8553a)] bg-[var(--primary-tint,#f3e6df)]/60' : 'border-[var(--border-2,#cec6b6)]'
            }`}
          >
            <Layers size={12} className="text-[var(--text-3,#a39b90)] shrink-0" />
            <span className="text-[10px] uppercase tracking-[0.14em] text-[var(--text-3,#a39b90)]">{t('agruparPor')}</span>
            {groupBy.map((key) => (
              <span
                key={key}
                className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-[var(--primary-tint,#f3e6df)] text-[var(--primary-dark,#93422c)] rounded-[3px] text-[11px] font-medium uppercase tracking-[0.06em]"
              >
                {colMap.get(key)?.label ?? key}
                <button
                  onClick={() => removeGroup(key)}
                  className="hover:text-[var(--primary,#b8553a)]"
                  title={t('quitarGrupo')}
                >
                  <X size={11} />
                </button>
              </span>
            ))}
            {!grouped && <span className="text-xs text-[var(--text-3,#a39b90)] italic">{t('arrastraAqui')}</span>}
            {pendingGroupables.length > 0 && (
              <select
                value=""
                onChange={(e) => e.target.value && addGroup(e.target.value)}
                className="text-xs bg-transparent text-[var(--text-3,#a39b90)] cursor-pointer focus:outline-none hover:text-[var(--text,#1a1714)]"
              >
                <option value="">{t('agregar')}</option>
                {pendingGroupables.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        <div className="ml-auto flex items-center gap-1.5">
          {/* Búsqueda global */}
          <div className="relative mr-1">
            <Search
              size={12}
              className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--text-3,#a39b90)] pointer-events-none"
            />
            <input
              type="text"
              value={quickFilter}
              onChange={(e) => setQuickFilter(e.target.value)}
              placeholder={t('buscar')}
              className="w-40 focus:w-56 transition-[width] pl-6 pr-6 py-1 text-xs border border-[var(--border,#e0dace)] rounded-[4px]
                bg-[var(--surface,#fffefb)] text-[var(--text,#1a1714)] placeholder:text-[var(--text-3,#a39b90)] focus:outline-none focus:border-[var(--primary,#b8553a)]"
            />
            {quickFilter && (
              <button
                onClick={() => setQuickFilter('')}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[var(--text-3,#a39b90)] hover:text-[var(--text,#1a1714)]"
              >
                <X size={11} />
              </button>
            )}
          </div>
          <span className="text-xs text-[var(--text-3,#a39b90)] mr-2">
            {filteredRows.length.toLocaleString('es-HN')} {t('registros')}
          </span>
          {grouped && (
            <>
              <button
                onClick={expandAll}
                title={t('expandirTodo')}
                className="p-1.5 text-[var(--text-3,#a39b90)] hover:text-[var(--text,#1a1714)] transition-colors"
              >
                <ChevronsUpDown size={14} />
              </button>
              <button
                onClick={() => setExpanded(new Set())}
                title={t('colapsarTodo')}
                className="p-1.5 text-[var(--text-3,#a39b90)] hover:text-[var(--text,#1a1714)] transition-colors"
              >
                <ChevronsDownUp size={14} />
              </button>
            </>
          )}
          {hasActiveFilters && (
            <button
              onClick={() => setFilters({})}
              className="text-[10px] uppercase tracking-[0.12em] text-[var(--primary,#b8553a)] hover:text-[var(--primary-dark,#93422c)]"
            >
              {t('limpiarFiltros')}
            </button>
          )}
          <button
            onClick={() => setShowFilters((v) => !v)}
            title={t('filtros')}
            className={`p-1.5 transition-colors ${
              showFilters || hasActiveFilters ? 'text-[var(--primary,#b8553a)]' : 'text-[var(--text-3,#a39b90)] hover:text-[var(--text,#1a1714)]'
            }`}
          >
            <Filter size={14} />
          </button>
          {copied && (
            <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.12em] text-[var(--success,#2f6b4f)]">
              <Check size={12} /> {t('copiado')}
            </span>
          )}
          <button
            onClick={(e) =>
              setPopover(popover?.kind === 'export' ? null : { kind: 'export', anchor: e.currentTarget })
            }
            title={t('exportar')}
            className={`p-1.5 transition-colors ${
              popover?.kind === 'export' ? 'text-[var(--primary,#b8553a)]' : 'text-[var(--text-3,#a39b90)] hover:text-[var(--text,#1a1714)]'
            }`}
          >
            <Download size={14} />
          </button>
          <button
            onClick={(e) =>
              setPopover(popover?.kind === 'columns' ? null : { kind: 'columns', anchor: e.currentTarget })
            }
            title={t('columnas')}
            className={`p-1.5 transition-colors ${
              hidden.length > 0 || popover?.kind === 'columns'
                ? 'text-[var(--primary,#b8553a)]'
                : 'text-[var(--text-3,#a39b90)] hover:text-[var(--text,#1a1714)]'
            }`}
          >
            <Columns3 size={14} />
          </button>
          <button
            onClick={resetAll}
            title={t('restablecer')}
            className="p-1.5 text-[var(--text-3,#a39b90)] hover:text-[var(--text,#1a1714)] transition-colors"
          >
            <RotateCcw size={14} />
          </button>
        </div>
      </div>

      {/* ── Tabla ── */}
      <div
        className="overflow-x-auto focus:outline-none"
        tabIndex={0}
        onKeyDown={onGridKeyDown}
        onBlur={() => setFocusIdx(null)}
      >
        <table ref={tableRef} className="at-table w-full border-collapse" style={tableStyle}>
          {fixedLayout && (
            <colgroup>
              {selectable && <col style={{ width: CHECKBOX_W }} />}
              {displayCols.map((col) => (
                <col
                  key={col.key}
                  style={{ width: autosizeKey === col.key ? 40 : (widths[col.key] ?? DEFAULT_COL_W) }}
                />
              ))}
            </colgroup>
          )}
          <thead>
            {headerGroupRuns && (
              <tr>
                {selectable && <th className="px-3" />}
                {headerGroupRuns.map((run, i) => (
                  <th
                    key={i}
                    colSpan={run.span}
                    className={`px-3 pt-3 pb-1.5 text-center text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-3,#a39b90)] whitespace-nowrap ${
                      run.label ? 'border-b border-[var(--border-2,#cec6b6)]' : ''
                    }`}
                  >
                    {run.label}
                  </th>
                ))}
              </tr>
            )}
            <tr>
              {selectable && (
                <th
                  className={`w-10 px-3 py-3.5 border-b border-[var(--border-2,#cec6b6)] text-center${checkboxPin('var(--paper)').className}`}
                  style={checkboxPin('var(--paper)').style}
                >
                  <TriCheckbox
                    checked={allFilteredSelected}
                    indeterminate={someFilteredSelected}
                    onChange={() => toggleRows(filteredRows)}
                    title={t('seleccionarTodo')}
                  />
                </th>
              )}
              {displayCols.map((col) => {
                const sortable = col.sortable !== false
                const sortIdx = sorts.findIndex((s) => s.key === col.key)
                const isDrop = dropTarget?.key === col.key
                const menuOpen = popover?.kind === 'menu' && popover.key === col.key
                const pin = pinCell(col.key, 'var(--paper)')
                return (
                  <th
                    key={col.key}
                    ref={(el) => {
                      if (el) thRefs.current.set(col.key, el)
                      else thRefs.current.delete(col.key)
                    }}
                    draggable={resizing === null}
                    onDragStart={(e) => onHeaderDragStart(e, col.key)}
                    onDragOver={(e) => onHeaderDragOver(e, col.key)}
                    onDrop={(e) => onHeaderDrop(e, col.key)}
                    onDragEnd={onDragEnd}
                    onClick={sortable ? (e) => handleSort(col.key, e.shiftKey) : undefined}
                    className={`group relative px-8 py-3.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-3,#a39b90)]
                      border-b border-[var(--border-2,#cec6b6)] select-none whitespace-nowrap ${
                        col.align === 'right' || col.numeric ? 'text-right' : 'text-left'
                      } ${sortable ? 'cursor-pointer hover:text-[var(--text,#1a1714)] transition-colors' : ''} ${
                      fixedLayout ? 'overflow-hidden' : ''
                    } ${dragCol === col.key ? 'opacity-40' : ''}${pin.className}`}
                    style={{
                      ...pin.style,
                      ...(isDrop
                        ? {
                            boxShadow: `inset ${dropTarget.side === 'left' ? '2px' : '-2px'} 0 0 var(--clay)`,
                          }
                        : undefined),
                    }}
                  >
                    {col.label}
                    {sortable && (
                      <span className="ml-1 select-none">
                        {sortIdx >= 0 ? (
                          <>
                            {sorts[sortIdx].dir === 'asc' ? '↑' : '↓'}
                            {sorts.length > 1 && <sup className="ml-0.5 text-[8px]">{sortIdx + 1}</sup>}
                          </>
                        ) : (
                          <span className="text-[var(--text-3,#a39b90)]">↕</span>
                        )}
                      </span>
                    )}
                    {/* Menú de columna */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setPopover(menuOpen ? null : { kind: 'menu', key: col.key, anchor: e.currentTarget })
                      }}
                      onDragStart={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                      }}
                      title={t('menuColumna')}
                      className={`absolute right-[7px] top-1/2 -translate-y-1/2 p-0.5 transition-opacity ${
                        menuOpen
                          ? 'opacity-100 text-[var(--primary,#b8553a)]'
                          : 'opacity-0 group-hover:opacity-100 text-[var(--text-3,#a39b90)] hover:text-[var(--text,#1a1714)]'
                      }`}
                    >
                      <EllipsisVertical size={12} />
                    </button>
                    <span
                      onPointerDown={(e) => startResize(e, col.key)}
                      onClick={(e) => e.stopPropagation()}
                      onDoubleClick={(e) => {
                        e.stopPropagation()
                        autosizeColumn(col.key)
                      }}
                      onDragStart={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                      }}
                      title={t('ajustarContenido')}
                      className={`absolute right-0 top-0 h-full w-[5px] cursor-col-resize ${
                        resizing === col.key ? 'bg-[var(--primary,#b8553a)]/50' : 'hover:bg-[var(--primary,#b8553a)]/40'
                      }`}
                    />
                  </th>
                )
              })}
            </tr>
            {showFilters && (
              <tr>
                {selectable && (
                  <th
                    className={`px-3 py-2 border-b border-[var(--border,#e0dace)] bg-[var(--bg,#f6f4ef)]${checkboxPin('var(--paper)').className}`}
                    style={checkboxPin('var(--paper)').style}
                  />
                )}
                {displayCols.map((col) => {
                  const pin = pinCell(col.key, 'var(--paper)')
                  return (
                    <th
                      key={col.key}
                      className={`px-3 py-2 border-b border-[var(--border,#e0dace)] bg-[var(--bg,#f6f4ef)] font-normal${pin.className}`}
                      style={pin.style}
                    >
                      {filterCell(col)}
                    </th>
                  )
                })}
              </tr>
            )}
          </thead>
          <tbody ref={tbodyRef} onMouseOver={handleCellMouseOver}>
            {flatItems.length === 0 && (
              <tr>
                <td
                  colSpan={displayCols.length + (selectable ? 1 : 0)}
                  className="px-8 py-10 text-center text-sm text-[var(--text-3,#a39b90)] border-b border-[var(--border,#e0dace)]"
                >
                  {t('sinResultados')}
                </td>
              </tr>
            )}
            {pageItems.map((item, pi) => {
              const focused = focusIdx === pi
              if (item.type === 'group') {
                const node = item.node
                const open = expanded.has(node.path)
                const groupColLabel = colMap.get(node.colKey)?.label ?? node.colKey
                const allInGroup = node.rows.every((r) => selected.has(r))
                const someInGroup = !allInGroup && node.rows.some((r) => selected.has(r))
                return (
                  <tr
                    key={'g:' + node.path}
                    data-ridx={pi}
                    onClick={() => {
                      setFocusIdx(pi)
                      toggleExpand(node.path)
                    }}
                    className={`at-group cursor-pointer select-none bg-[var(--bg-2,#efebe2)]/60 hover:bg-[var(--bg-2,#efebe2)] transition-colors ${
                      focused ? 'shadow-[inset_2px_0_0_var(--clay)]' : ''
                    }`}
                  >
                    {selectable && (
                      <td
                        className={`px-3 py-2.5 border-b border-[var(--border,#e0dace)] text-center${checkboxPin('var(--paper2)').className}`}
                        style={checkboxPin('var(--paper2)').style}
                      >
                        <TriCheckbox
                          checked={allInGroup && node.rows.length > 0}
                          indeterminate={someInGroup}
                          onChange={() => toggleRows(node.rows)}
                        />
                      </td>
                    )}
                    {displayCols.map((col, i) => {
                      const pin = pinCell(col.key, 'var(--paper2)')
                      if (i === 0) {
                        return (
                          <td
                            key={col.key}
                            data-colkey={col.key}
                            className={`px-8 py-2.5 border-b border-[var(--border,#e0dace)] whitespace-nowrap${pin.className}`}
                            style={{ paddingLeft: 32 + node.depth * 20, ...pin.style }}
                          >
                            <span className="inline-flex items-center gap-2">
                              <ChevronRight
                                size={13}
                                className={`text-[var(--text-3,#a39b90)] shrink-0 transition-transform ${open ? 'rotate-90' : ''}`}
                              />
                              <span className="text-[10px] uppercase tracking-[0.12em] text-[var(--text-3,#a39b90)]">
                                {groupColLabel}
                              </span>
                              <span className="text-sm font-medium text-[var(--text,#1a1714)]">{node.value}</span>
                              <span className="text-xs text-[var(--text-3,#a39b90)]">· {node.rows.length}</span>
                            </span>
                          </td>
                        )
                      }
                      return (
                        <td
                          key={col.key}
                          data-colkey={col.key}
                          className={`px-8 py-2.5 border-b border-[var(--border,#e0dace)] text-right whitespace-nowrap ${
                            col.numeric ? 'font-serif text-[15px] text-[var(--text,#1a1714)]' : 'text-sm text-[var(--text-2,#6b645c)]'
                          }${pin.className}`}
                          style={pin.style}
                        >
                          {aggCell(col, node.rows)}
                        </td>
                      )
                    })}
                  </tr>
                )
              }
              const { row, depth, index } = item
              return (
                <tr
                  key={rowKey ? rowKey(row, index) : index}
                  data-ridx={pi}
                  onClick={() => {
                    setFocusIdx(pi)
                    onRowClick?.(row)
                  }}
                  className={`transition-colors hover:bg-black/[0.018] ${onRowClick ? 'cursor-pointer' : ''} ${
                    selectable && selected.has(row) ? 'bg-[var(--primary-tint,#f3e6df)]/30' : ''
                  } ${focused ? 'shadow-[inset_2px_0_0_var(--clay)] bg-black/[0.02]' : ''} ${
                    rowClassName ? rowClassName(row) : ''
                  }`}
                >
                  {selectable && (
                    <td
                      className={`px-3 py-3.5 border-b border-[var(--border,#e0dace)] text-center${checkboxPin('var(--paper)').className}`}
                      style={checkboxPin('var(--paper)').style}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <TriCheckbox checked={selected.has(row)} onChange={() => toggleRow(row)} />
                    </td>
                  )}
                  {displayCols.map((col, i) => {
                    const pin = pinCell(col.key, 'var(--paper)')
                    const extra = col.cellClass ? col.cellClass(row) : ''
                    return (
                      <td
                        key={col.key}
                        data-label={col.label}
                        data-colkey={col.key}
                        className={tdCls(col) + (extra ? ' ' + extra : '') + pin.className}
                        style={{
                          ...(grouped && i === 0 ? { paddingLeft: 32 + depth * 20 } : undefined),
                          ...pin.style,
                        }}
                      >
                        {col.render ? col.render(row) : String(cellRaw(row, col) ?? '—')}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
            {columns.some((c) => c.footer) && flatItems.length > 0 && (
              <tr className="bg-[var(--bg-2,#efebe2)]">
                {selectable && (
                  <td
                    className={`px-3 py-3.5 border-b border-[var(--border,#e0dace)]${checkboxPin('var(--paper2)').className}`}
                    style={checkboxPin('var(--paper2)').style}
                  />
                )}
                {displayCols.map((col) => {
                  const pin = pinCell(col.key, 'var(--paper2)')
                  return (
                    <td
                      key={col.key}
                      data-label={col.label}
                      data-colkey={col.key}
                      className={
                        (col.numeric
                          ? 'px-8 py-3.5 border-b border-[var(--border,#e0dace)] text-right font-serif text-[15px] text-[var(--text,#1a1714)] font-medium whitespace-nowrap'
                          : `px-8 py-3.5 text-sm border-b border-[var(--border,#e0dace)] text-[var(--text,#1a1714)] font-medium ${
                              col.align === 'right' ? 'text-right whitespace-nowrap' : ''
                            }`) + pin.className
                      }
                      style={pin.style}
                    >
                      {col.footer ? col.footer(filteredRows) : null}
                    </td>
                  )
                })}
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Barra de estado de la selección ── */}
      {selectable && selected.size > 0 && (
        <div className="flex items-center gap-4 flex-wrap px-8 py-2.5 border-t border-[var(--border,#e0dace)] bg-[var(--bg-2,#efebe2)]/60">
          <span className="text-xs text-[var(--text,#1a1714)] font-medium">{t('nSeleccionados', { n: selected.size })}</span>
          <button
            onClick={() => setSelected(new Set())}
            className="text-[10px] uppercase tracking-[0.12em] text-[var(--primary,#b8553a)] hover:text-[var(--primary-dark,#93422c)]"
          >
            {t('limpiarSeleccion')}
          </button>
          {selectionActions && (
            <div className="flex items-center gap-3">{selectionActions(selectedRows)}</div>
          )}
          <div className="ml-auto flex items-center gap-6 flex-wrap">
            {aggregateCols.map((col) => (
              <span key={col.key} className="inline-flex items-baseline gap-2">
                <span className="text-[10px] uppercase tracking-[0.14em] text-[var(--text-3,#a39b90)]">{col.label}</span>
                <span className="font-serif text-[15px] text-[var(--text,#1a1714)]">{aggCell(col, selectedRows)}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {effPageSize !== undefined && flatItems.length > Math.min(...sizeOptions) && (
        <Pagination
          page={safePage}
          pageCount={pageCount}
          setPage={setPage}
          from={(safePage - 1) * effPageSize + 1}
          to={Math.min(safePage * effPageSize, flatItems.length)}
          total={flatItems.length}
          pageSize={effPageSize}
          pageSizeOptions={sizeOptions}
          onPageSizeChange={(n) => {
            setPageSizeState(n)
            setPage(1)
          }}
        />
      )}

      {/* ── Popovers ── */}
      {popover?.kind === 'menu' && (
        <Popover anchor={popover.anchor} onClose={closePopover} width={208}>
          {renderColumnMenu(popover.key)}
        </Popover>
      )}
      {popover?.kind === 'columns' && (
        <Popover anchor={popover.anchor} onClose={closePopover} width={232}>
          {renderColumnsPanel()}
        </Popover>
      )}
      {popover?.kind === 'set' && (
        <Popover anchor={popover.anchor} onClose={closePopover} width={248}>
          {renderSetFilter(popover.key)}
        </Popover>
      )}
      {popover?.kind === 'export' && (
        <Popover anchor={popover.anchor} onClose={closePopover} width={232}>
          {renderExportMenu()}
        </Popover>
      )}
    </div>
  )
}

import type { AtGridColumn, AtGridFilterType, ColumnFilterValue, PersistedState } from './at-grid.types';

/**
 * AtGrid — lógica pura (sin Angular, sin DOM salvo localStorage).
 * Puerto directo de la versión React (SA Finance / AtGrid.tsx).
 */

export function cellRaw<T>(row: T, col: AtGridColumn<T>): unknown {
  return (row as Record<string, unknown>)[col.key];
}

export function sortVal<T>(row: T, col: AtGridColumn<T>): unknown {
  return col.sortValue ? col.sortValue(row) : cellRaw(row, col);
}

export function filterVal<T>(row: T, col: AtGridColumn<T>): string {
  return col.filterValue ? col.filterValue(row) : String(cellRaw(row, col) ?? '');
}

export function numVal<T>(row: T, col: AtGridColumn<T>): number {
  if (col.numValue) return col.numValue(row);
  const v = cellRaw(row, col);
  return typeof v === 'number' ? v : Number(v) || 0;
}

export function groupVal<T>(row: T, col: AtGridColumn<T>): string {
  if (col.groupValue) return col.groupValue(row);
  const v = cellRaw(row, col);
  return v === null || v === undefined || v === '' ? '—' : String(v);
}

export function aggNum<T>(col: AtGridColumn<T>, rows: T[]): number {
  const a = col.aggregate;
  if (typeof a === 'function') return a(rows);
  if (a === 'count') return rows.length;
  if (a === 'min' || a === 'max') {
    if (!rows.length) return 0;
    let m = a === 'min' ? Infinity : -Infinity;
    for (const r of rows) {
      const v = numVal(r, col);
      m = a === 'min' ? Math.min(m, v) : Math.max(m, v);
    }
    return m;
  }
  const sum = rows.reduce((acc, r) => acc + numVal(r, col), 0);
  return a === 'avg' ? (rows.length ? sum / rows.length : 0) : sum;
}

export function filterTypeOf<T>(col: AtGridColumn<T>): AtGridFilterType {
  return col.filterType ?? (col.numeric ? 'number' : 'text');
}

export function filterIsActive(f: ColumnFilterValue | undefined): boolean {
  if (f === undefined) return false;
  if (typeof f === 'string') return f.trim() !== '';
  if (Array.isArray(f)) return true;
  return Boolean(f.from || f.to);
}

function parseNum(s: string): number {
  return Number(s.replace(/,/g, ''));
}

/** Expresiones numéricas: `>1000`, `>=5`, `<0`, `!=10`, `=7`, `100..200` o `1000` (igual). */
export function matchNumberExpr(v: number, expr: string): boolean {
  const s = expr.trim();
  if (!s) return true;
  const range = s.match(/^(-?[\d.,]+)\s*\.\.\s*(-?[\d.,]+)$/);
  if (range) {
    const a = parseNum(range[1]);
    const b = parseNum(range[2]);
    if (Number.isNaN(a) || Number.isNaN(b)) return true;
    return v >= Math.min(a, b) && v <= Math.max(a, b);
  }
  const m = s.match(/^(>=|<=|!=|<>|=|>|<)?\s*(-?[\d.,]+)$/);
  if (!m) return true; // expresión incompleta: no filtrar todavía
  const n = parseNum(m[2]);
  if (Number.isNaN(n)) return true;
  switch (m[1]) {
    case '>':
      return v > n;
    case '>=':
      return v >= n;
    case '<':
      return v < n;
    case '<=':
      return v <= n;
    case '!=':
    case '<>':
      return v !== n;
    default:
      return Math.abs(v - n) < 1e-9;
  }
}

/** Normaliza un valor a fecha ISO `YYYY-MM-DD` (o '' si no parece fecha). */
export function dateStr(v: unknown): string {
  if (!v) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = String(v);
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : '';
}

export function rowPassesFilter<T>(row: T, col: AtGridColumn<T>, f: ColumnFilterValue): boolean {
  if (Array.isArray(f)) return f.includes(groupVal(row, col));
  if (typeof f === 'string') {
    const s = f.trim();
    if (!s) return true;
    if (filterTypeOf(col) === 'number') return matchNumberExpr(numVal(row, col), s);
    return filterVal(row, col).toLowerCase().includes(s.toLowerCase());
  }
  const d = dateStr(sortVal(row, col)) || dateStr(cellRaw(row, col));
  if (!d) return false;
  if (f.from && d < f.from) return false;
  if (f.to && d > f.to) return false;
  return true;
}

/** Comparador genérico: numérico, fecha ISO, o texto (localeCompare insensible a mayúsculas). */
export function compareValues(a: unknown, b: unknown): number {
  if (typeof a === 'number' && typeof b === 'number') {
    return a - b;
  }
  if (
    typeof a === 'string' &&
    typeof b === 'string' &&
    /^\d{4}-\d{2}-\d{2}/.test(a) &&
    /^\d{4}-\d{2}-\d{2}/.test(b)
  ) {
    return a < b ? -1 : a > b ? 1 : 0;
  }
  const sa = String(a ?? '');
  const sb = String(b ?? '');
  return sa.localeCompare(sb, undefined, { sensitivity: 'base' });
}

export function loadPersisted(storageKey?: string): PersistedState {
  if (!storageKey) return {};
  try {
    const raw = localStorage.getItem('atgrid:' + storageKey);
    return raw ? (JSON.parse(raw) as PersistedState) : {};
  } catch {
    return {};
  }
}

export function savePersisted(storageKey: string, state: PersistedState): void {
  try {
    localStorage.setItem('atgrid:' + storageKey, JSON.stringify(state));
  } catch {
    /* almacenamiento lleno o bloqueado: la tabla sigue funcionando */
  }
}

export function clearPersisted(storageKey: string): void {
  try {
    localStorage.removeItem('atgrid:' + storageKey);
  } catch {
    /* sin acceso a storage */
  }
}

export function reconcileOrder(stored: string[] | undefined, keys: string[]): string[] {
  if (!stored?.length) return keys;
  const valid = stored.filter((k) => keys.includes(k));
  return [...valid, ...keys.filter((k) => !valid.includes(k))];
}

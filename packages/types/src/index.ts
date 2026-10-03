/**
 * AtGrid — tipos primitivos compartidos, byte-idénticos entre la implementación
 * React (`@soyalfredo115/at-grid-react`) y Angular (`@soyalfredo115/at-grid-angular`).
 *
 * `AtGridColumn`, `PersistedState` y `PopoverState` NO viven acá: cada framework
 * tiene su propia variante (React agrega `render`/`footer`/callbacks que devuelven
 * ReactNode; Angular proyecta celdas custom como `ng-template` en vez de props) y
 * unificarlas forzaría un tipo mínimo común que perdería esas extensiones. Se
 * definen localmente en cada paquete.
 */

export type AtGridFilterType = 'text' | 'number' | 'date' | 'set' | 'multi';

export type AtGridAggregate<T> = 'sum' | 'avg' | 'count' | 'min' | 'max' | ((rows: T[]) => number);

export type SortState = { key: string; dir: 'asc' | 'desc' };

/** Valor combinado de un filtro `'multi'`: uno o más sub-filtros activos a la vez, en AND. */
export interface MultiFilterValue {
  /** Texto (contiene) o expresión numérica, según qué sub-tipo declare la columna. */
  text?: string;
  date?: { from?: string; to?: string };
  set?: string[];
}

/**
 * Valor de filtro por columna:
 *   string   → texto (contiene) o expresión numérica (`>1000`, `5..10`)
 *   string[] → set de valores seleccionados (presente = filtro activo)
 *   objeto   → rango de fechas ISO
 *   MultiFilterValue → combinación de sub-filtros (columna con `filterType: 'multi'`)
 */
export type ColumnFilterValue = string | string[] | { from?: string; to?: string } | MultiFilterValue;

export type PinSide = 'left' | 'right';

export interface GroupNode<T> {
  path: string;
  colKey: string;
  value: string;
  depth: number;
  rows: T[];
  children: GroupNode<T>[];
}

export type FlatItem<T> =
  | { type: 'group'; node: GroupNode<T> }
  | { type: 'row'; row: T; depth: number; index: number };

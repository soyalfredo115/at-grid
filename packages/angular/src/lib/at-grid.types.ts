/**
 * AtGrid — tipos compartidos.
 *
 * Puerto a Angular del AtGrid original (React) de SA Finance. Ver at-grid.component.ts
 * para la implementación y at-grid.helpers.ts para la lógica pura (sin Angular).
 *
 * Las celdas/pies personalizados NO van en la definición de columna (a diferencia de
 * la versión React, que pasaba una función `render`). En Angular se proyectan como
 * contenido: `<ng-template atGridCell="key" let-row>...</ng-template>` dentro de
 * `<at-grid>`. Ver at-grid-templates.directive.ts.
 */

export type {
  AtGridFilterType,
  AtGridAggregate,
  SortState,
  ColumnFilterValue,
  MultiFilterValue,
  PinSide,
  GroupNode,
  FlatItem,
} from '@soyalfredo115/at-grid-types';

import type { AtGridFilterType, AtGridAggregate, SortState, PinSide } from '@soyalfredo115/at-grid-types';

export interface AtGridColumn<T> {
  key: string;
  label: string;
  /** Grupo de encabezado (2º nivel): columnas contiguas con el mismo grupo comparten cabecera. */
  group?: string;
  align?: 'left' | 'right';
  /** Monto: alineado a la derecha, tabular-nums, sin corte. */
  numeric?: boolean;
  strong?: boolean;
  minWidth?: number;
  sortable?: boolean;
  filterable?: boolean;
  /** Tipo de filtro de columna. Por defecto: 'number' si `numeric`, si no 'text'. */
  filterType?: AtGridFilterType;
  groupable?: boolean;
  /** Agregado mostrado en la fila de grupo y en la barra de selección. */
  aggregate?: AtGridAggregate<T>;
  aggregateFormat?: (v: number) => string;
  sortValue?: (row: T) => unknown;
  filterValue?: (row: T) => string;
  numValue?: (row: T) => number;
  groupValue?: (row: T) => string;
  /** Valor crudo para el export Excel / copia TSV (default: numVal si `numeric`, si no el valor de la celda). */
  exportValue?: (row: T) => string | number;
  tdClassName?: string;
  /** Clases condicionales por celda según la fila (p. ej. negativos en rojo). */
  cellClass?: (row: T) => string | false | null | undefined;
  /** Habilita edición inline en esta celda (doble click, F2, o `cellValueChanged` en la tabla). Puede condicionarse por fila. */
  editable?: boolean | ((row: T) => boolean);
  /** Tipo de editor por defecto. `'select'` usa `editorOptions`. Sin definir: `'number'` si `numeric`, si no `'text'`. Para un editor 100% custom, proyectar `<ng-template atGridCellEditor="key" ...>`. */
  editorType?: 'text' | 'number' | 'date' | 'select';
  /** Opciones para `editorType: 'select'`. */
  editorOptions?: (string | { value: string; label: string })[];
  /** Valor string inicial mostrado en el editor (default: el valor crudo de la celda). */
  editValue?: (row: T) => string;
  /** Parsea el string del editor al tipo real de la columna (default: número si `numeric`/`'number'`, si no el string tal cual). */
  valueParser?: (raw: string, row: T) => unknown;
  /** Construye la fila con el nuevo valor (default: `{ ...row, [key]: value }`). */
  valueSetter?: (row: T, value: unknown) => T;
}

/** Parámetros de `cellValueChanged`: la tabla es controlada, no muta `rows` — el consumidor aplica `newRow` a su estado. */
export interface AtGridCellValueChanged<T> {
  row: T;
  rowIndex: number;
  col: AtGridColumn<T>;
  oldValue: unknown;
  newValue: unknown;
  newRow: T;
}

export interface EditHistoryEntry {
  rowId: string | number;
  colKey: string;
  oldValue: unknown;
  newValue: unknown;
}

export interface PersistedState {
  order?: string[];
  widths?: Record<string, number | undefined>;
  sorts?: SortState[];
  groupBy?: string[];
  showFilters?: boolean;
  hidden?: string[];
  pinned?: Record<string, PinSide>;
  pageSize?: number;
}

export type PopoverKind = 'menu' | 'set' | 'columns' | 'export';

export type PopoverState = { kind: PopoverKind; key?: string; anchor: HTMLElement };

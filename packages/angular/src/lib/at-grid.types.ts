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

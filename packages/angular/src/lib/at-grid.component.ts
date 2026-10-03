import { NgStyle, NgTemplateOutlet } from '@angular/common';
import {
  AfterContentInit,
  ChangeDetectionStrategy,
  Component,
  ContentChild,
  ContentChildren,
  ElementRef,
  Injector,
  OnInit,
  QueryList,
  TemplateRef,
  ViewChild,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { AtGridCellEditorComponent } from './at-grid-cell-editor.component';
import type { CellEditorCommit } from './at-grid-cell-editor.component';
import { AtGridPaginationComponent } from './at-grid-pagination.component';
import { AtGridPopoverComponent } from './at-grid-popover.component';
import {
  AtGridCellDirective,
  AtGridCellEditorDirective,
  AtGridFooterDirective,
  AtGridSelectionActionsDirective,
} from './at-grid-templates.directive';
import { downloadXlsx } from './at-grid-xlsx';
import {
  aggNum,
  cellRaw,
  clearPersisted,
  compareValues,
  defaultParseEdit,
  filterIsActive,
  filterTypeOf,
  filterVal,
  groupVal,
  isMultiFilterValue,
  loadPersisted,
  numVal,
  reconcileOrder,
  rowPassesFilter,
  savePersisted,
  sortVal,
} from './at-grid.helpers';
import type {
  AtGridCellValueChanged,
  AtGridColumn,
  ColumnFilterValue,
  EditHistoryEntry,
  FlatItem,
  GroupNode,
  PersistedState,
  PinSide,
  PopoverKind,
  PopoverState,
  SortState,
} from './at-grid.types';

const DEFAULT_COL_W = 140;
const CHECKBOX_W = 40;
const ROW_H = 45;
const GROUP_ROW_H = 41;
const OVERSCAN = 8;

function itemHeightOf<T>(item: FlatItem<T>): number {
  return item.type === 'group' ? GROUP_ROW_H : ROW_H;
}

/** Índice del último item cuyo offset acumulado es <= y (offsets tiene length = items.length + 1). */
function offsetIndexAt(offsets: number[], y: number): number {
  let lo = 0;
  let hi = offsets.length - 2;
  if (hi < 0) return 0;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (offsets[mid] <= y) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/**
 * AtGrid — tabla declarativa con superpoderes, 100% código propio.
 * Puerto a Angular (standalone, signals) del AtGrid original de SA Finance (React).
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
 *   · Autosize de columna (doble click en el borde del header o menú)
 *   · Tooltip automático en celdas con texto cortado
 *   · Grupos de encabezado de 2 niveles (`group` en la columna)
 *   · Clases condicionales por celda (`cellClass`)
 *   · Navegación por teclado (↑/↓ mueve, Enter abre/expande, Espacio selecciona,
 *     PageUp/PageDown pagina)
 *   · Estado persistido en localStorage por `storageKey`
 *
 *   <at-grid [columns]="columns" [rows]="rows" storageKey="ordenes" [selectable]="true"
 *            (rowClick)="abrir($event)">
 *     <ng-template atGridCell="estado" let-row>
 *       <span class="badge">{{ row.estado }}</span>
 *     </ng-template>
 *   </at-grid>
 */
@Component({
  selector: 'at-grid',
  standalone: true,
  imports: [NgStyle, NgTemplateOutlet, AtGridPaginationComponent, AtGridPopoverComponent, AtGridCellEditorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ag-toolbar">
      @if (groupableCols().length > 0) {
        <div
          class="ag-group-zone"
          [class.ag-group-zone-hover]="groupZoneHover()"
          (dragover)="onGroupZoneDragOver($event)"
          (dragleave)="onGroupZoneDragLeave()"
          (drop)="onGroupZoneDrop($event)"
        >
          <svg class="ag-group-zone-icon" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <rect x="4" y="4" width="16" height="6" rx="1"></rect>
            <rect x="4" y="13" width="16" height="6" rx="1"></rect>
          </svg>
          <span class="ag-group-zone-label">Agrupar por</span>
          @for (key of groupBy(); track key) {
            <span class="ag-group-chip">
              {{ groupColLabel(key) }}
              <button type="button" class="ag-group-chip-x" (click)="removeGroup(key)" title="Quitar grupo">×</button>
            </span>
          }
          @if (!grouped()) {
            <span class="ag-group-zone-hint">arrastra una columna aquí</span>
          }
          @if (pendingGroupables().length > 0) {
            <select class="ag-group-zone-select" (change)="onAddGroupSelect($event)">
              <option value="">agregar…</option>
              @for (c of pendingGroupables(); track c.key) {
                <option [value]="c.key">{{ c.label }}</option>
              }
            </select>
          }
        </div>
      }

      <div class="ag-toolbar-right">
        <div class="ag-search">
          <svg class="ag-search-icon" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <circle cx="10" cy="10" r="6"></circle>
            <line x1="20" y1="20" x2="14.5" y2="14.5"></line>
          </svg>
          <input
            type="text"
            class="ag-search-input"
            [value]="quickFilter()"
            (input)="quickFilter.set($any($event.target).value)"
            placeholder="Buscar…"
          />
          @if (quickFilter()) {
            <button type="button" class="ag-search-clear" (click)="quickFilter.set('')" aria-label="Limpiar búsqueda">×</button>
          }
        </div>

        <span class="ag-count">{{ filteredRows().length }} registros</span>

        @if (grouped()) {
          <button type="button" class="ag-icon-btn" title="Expandir todo" (click)="expandAll()">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="6,9 12,15 18,9"></polyline><polyline points="6,15 12,9 18,15" opacity="0"></polyline></svg>
          </button>
          <button type="button" class="ag-icon-btn" title="Colapsar todo" (click)="collapseAll()">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="6,15 12,9 18,15"></polyline></svg>
          </button>
        }

        @if (hasActiveFilters()) {
          <button type="button" class="ag-link-btn" (click)="filters.set({})">Limpiar filtros</button>
        }

        <button
          type="button"
          class="ag-icon-btn"
          [class.ag-icon-btn-active]="showFilters() || hasActiveFilters()"
          (click)="showFilters.set(!showFilters())"
          title="Filtros"
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true">
            <path d="M3 4h18l-7 8v6l-4 2v-8L3 4Z"></path>
          </svg>
        </button>

        @if (copied()) {
          <span class="ag-copied">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            copiado
          </span>
        }

        <button
          type="button"
          class="ag-icon-btn"
          [class.ag-icon-btn-active]="popover()?.kind === 'export'"
          (click)="openExportPopover($event)"
          title="Exportar"
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true">
            <line x1="12" y1="3" x2="12" y2="15"></line>
            <polyline points="7,10 12,15 17,10"></polyline>
            <line x1="4" y1="20" x2="20" y2="20"></line>
          </svg>
        </button>

        <button
          type="button"
          class="ag-icon-btn"
          [class.ag-icon-btn-active]="hidden().length > 0 || popover()?.kind === 'columns'"
          (click)="openColumnsPopover($event)"
          title="Columnas"
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true">
            <rect x="3" y="4" width="5" height="16" rx="1"></rect>
            <rect x="9.5" y="4" width="5" height="16" rx="1"></rect>
            <rect x="16" y="4" width="5" height="16" rx="1"></rect>
          </svg>
        </button>

        <button type="button" class="ag-icon-btn" (click)="resetAll()" title="Restablecer">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true">
            <path d="M4 4v6h6"></path>
            <path d="M20 20v-6h-6"></path>
            <path d="M5.5 15a8 8 0 0 0 13-3"></path>
            <path d="M18.5 9a8 8 0 0 0-13 3"></path>
          </svg>
        </button>
      </div>
    </div>

    <div
      #wrapEl
      class="ag-table-wrap"
      [style.height.px]="virtualized() ? height() : null"
      [style.overflowY]="virtualized() ? 'auto' : null"
      [attr.tabindex]="activeCell() === null ? 0 : -1"
      (keydown)="onGridKeyDown($event)"
      (scroll)="onTableScroll($event)"
      (focus)="onWrapFocus($event)"
      (blur)="onWrapBlur($event)"
    >
      <table
        #tableEl
        class="ag-table"
        [class.ag-virtualized]="virtualized()"
        role="grid"
        [attr.aria-rowcount]="flatItems().length + headerRowCount()"
        [attr.aria-colcount]="colCount()"
        [attr.aria-multiselectable]="selectable() || null"
        [style.tableLayout]="fixedLayout() ? 'fixed' : null"
      >
        @if (fixedLayout()) {
          <colgroup>
            @if (selectable()) {
              <col [style.width.px]="CHECKBOX_W" />
            }
            @for (col of displayCols(); track col.key) {
              <col [style.width.px]="autosizeKey() === col.key ? 40 : (widths()[col.key] ?? DEFAULT_COL_W)" />
            }
          </colgroup>
        }
        <thead>
          @if (headerGroupRuns(); as runs) {
            <tr role="row">
              @if (selectable()) {
                <th class="ag-th-blank" role="columnheader"></th>
              }
              @for (run of runs; track $index) {
                <th [attr.colspan]="run.span" role="columnheader" class="ag-th-group" [class.ag-th-group-labeled]="run.label">{{ run.label }}</th>
              }
            </tr>
          }
          <tr role="row">
            @if (selectable()) {
              <th class="ag-th-checkbox" role="columnheader" [attr.aria-colindex]="1" [class]="checkboxPinClass()" [ngStyle]="checkboxPinStyle('var(--bg)')">
                <input
                  type="checkbox"
                  class="ag-checkbox"
                  [checked]="allFilteredSelected()"
                  [indeterminate]="someFilteredSelected()"
                  (click)="$event.stopPropagation()"
                  (change)="toggleRows(filteredRows())"
                  title="Seleccionar todo"
                  aria-label="Seleccionar todo"
                />
              </th>
            }
            @for (col of displayCols(); track col.key; let ci = $index) {
              <th
                [attr.data-colkey]="col.key"
                role="columnheader"
                [attr.aria-sort]="ariaSortFor(col)"
                [attr.aria-colindex]="ci + 1 + (selectable() ? 1 : 0)"
                [draggable]="resizing() === null"
                (dragstart)="onHeaderDragStart($event, col.key)"
                (dragover)="onHeaderDragOver($event, col.key)"
                (drop)="onHeaderDrop($event, col.key)"
                (dragend)="onDragEnd()"
                (click)="onHeaderClick($event, col)"
                class="ag-th"
                [class.ag-th-right]="col.align === 'right' || col.numeric"
                [class.ag-th-sortable]="col.sortable !== false"
                [class.ag-th-dragging]="dragCol() === col.key"
                [class]="pinClass(col.key)"
                [ngStyle]="thStyle(col)"
              >
                {{ col.label }}
                @if (col.sortable !== false) {
                  <span class="ag-sort-indicator">
                    @if (sortIndexFor(col.key) >= 0) {
                      {{ sortDirFor(col.key) === 'asc' ? '↑' : '↓' }}
                      @if (sorts().length > 1) {
                        <sup class="ag-sort-order">{{ sortIndexFor(col.key) + 1 }}</sup>
                      }
                    } @else {
                      <span class="ag-sort-idle">↕</span>
                    }
                  </span>
                }
                <button
                  type="button"
                  class="ag-th-menu-btn"
                  [class.ag-th-menu-btn-open]="popover()?.kind === 'menu' && popover()?.key === col.key"
                  (click)="openMenuPopover($event, col.key)"
                  (dragstart)="$event.preventDefault(); $event.stopPropagation()"
                  title="Menú de columna"
                >
                  <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden="true">
                    <circle cx="12" cy="5" r="1.6"></circle>
                    <circle cx="12" cy="12" r="1.6"></circle>
                    <circle cx="12" cy="19" r="1.6"></circle>
                  </svg>
                </button>
                <span
                  class="ag-th-resize"
                  [class.ag-th-resize-active]="resizing() === col.key"
                  (pointerdown)="startResize($event, col.key)"
                  (click)="$event.stopPropagation()"
                  (dblclick)="$event.stopPropagation(); autosizeColumn(col.key)"
                  (dragstart)="$event.preventDefault(); $event.stopPropagation()"
                  title="Ajustar contenido"
                ></span>
              </th>
            }
          </tr>
          @if (showFilters()) {
            <tr role="row">
              @if (selectable()) {
                <th class="ag-th-filter-blank" role="columnheader" [class]="checkboxPinClass()" [ngStyle]="checkboxPinStyle('var(--bg)')"></th>
              }
              @for (col of displayCols(); track col.key) {
                <th class="ag-th-filter" role="columnheader" [class]="pinClass(col.key)" [ngStyle]="pinStyle(col.key, 'var(--bg)')">
                  @if (col.filterable !== false) {
                    @switch (filterTypeOf(col)) {
                      @case ('date') {
                        <div class="ag-filter-date">
                          <input
                            type="date"
                            class="ag-filter-input"
                            [value]="dateRangeValue(col.key).from ?? ''"
                            (change)="setDateFilter(col.key, 'from', $any($event.target).value)"
                            title="Desde"
                          />
                          <input
                            type="date"
                            class="ag-filter-input"
                            [value]="dateRangeValue(col.key).to ?? ''"
                            (change)="setDateFilter(col.key, 'to', $any($event.target).value)"
                            title="Hasta"
                          />
                        </div>
                      }
                      @case ('set') {
                        <button
                          type="button"
                          class="ag-filter-input ag-filter-set-btn"
                          [class.ag-filter-active]="setFilterActive(col.key)"
                          (click)="openSetPopover($event, col.key)"
                        >
                          <span class="ag-truncate">{{ setFilterLabel(col.key) }}</span>
                          <span class="ag-filter-set-total">{{ setFilterTotal(col.key) }}</span>
                        </button>
                      }
                      @default {
                        <input
                          type="text"
                          class="ag-filter-input"
                          [value]="textFilterValue(col.key)"
                          (input)="setTextFilter(col.key, $any($event.target).value)"
                          [placeholder]="filterTypeOf(col) === 'number' ? 'ej. >100' : 'Filtrar'"
                        />
                      }
                    }
                  }
                </th>
              }
            </tr>
          }
        </thead>
        <tbody (mouseover)="handleCellMouseOver($event)" role="rowgroup">
          @if (flatItems().length === 0) {
            <tr role="row">
              <td class="ag-empty" role="gridcell" [attr.colspan]="colCount()">Sin resultados</td>
            </tr>
          }
          @if (virtualized() && topPad() > 0) {
            <tr aria-hidden="true" [style.height.px]="topPad()">
              <td [attr.colspan]="colCount()" style="padding: 0; border: 0"></td>
            </tr>
          }
          @for (item of pageItems(); track flatItemKey(item); let pi = $index) {
            @if (!virtualized() || (pi >= startIdx() && pi < endIdx())) {
              @if (item.type === 'group') {
                <tr
                  [attr.data-ridx]="pi"
                  role="row"
                  [attr.aria-expanded]="expanded().has(item.node.path)"
                  [attr.aria-level]="item.node.depth + 1"
                  [attr.aria-rowindex]="rowIndexOf(pi)"
                  class="ag-group-row"
                  [class.ag-row-focused]="activeCell()?.ri === pi"
                  (click)="onGroupRowClick($event, pi, item.node)"
                >
                  @if (selectable()) {
                    <td
                      role="gridcell"
                      [attr.data-ridx]="pi"
                      [attr.data-cidx]="-1"
                      [attr.aria-colindex]="1"
                      [tabIndex]="cellTabIndex(pi, -1)"
                      class="ag-td-checkbox"
                      [class]="checkboxPinClass()"
                      [ngStyle]="checkboxPinStyle('var(--bg-2)')"
                      [style.outline]="isActiveCell(pi, -1) ? '2px solid var(--primary)' : null"
                      [style.outlineOffset.px]="isActiveCell(pi, -1) ? -2 : null"
                      (click)="$event.stopPropagation()"
                    >
                      <input
                        type="checkbox"
                        class="ag-checkbox"
                        [checked]="groupAllSelected(item.node)"
                        [indeterminate]="groupSomeSelected(item.node)"
                        (change)="toggleRows(item.node.rows)"
                        aria-label="Seleccionar grupo"
                        tabindex="-1"
                      />
                    </td>
                  }
                  @for (col of displayCols(); track col.key; let ci = $index) {
                    @if (ci === 0) {
                      <td
                        role="gridcell"
                        [attr.data-ridx]="pi"
                        [attr.data-cidx]="ci"
                        [attr.aria-colindex]="ci + 1 + (selectable() ? 1 : 0)"
                        [tabIndex]="cellTabIndex(pi, ci)"
                        class="ag-td-group-label"
                        [class]="pinClass(col.key)"
                        [ngStyle]="groupLabelStyle(col.key, item.node.depth)"
                        [style.outline]="isActiveCell(pi, ci) ? '2px solid var(--primary)' : null"
                        [style.outlineOffset.px]="isActiveCell(pi, ci) ? -2 : null"
                      >
                        <span class="ag-group-label-inner">
                          <svg class="ag-chevron" [class.ag-chevron-open]="expanded().has(item.node.path)" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                            <polyline points="9,5 16,12 9,19"></polyline>
                          </svg>
                          <span class="ag-group-col-label">{{ groupColLabel(item.node.colKey) }}</span>
                          <span class="ag-group-value">{{ item.node.value }}</span>
                          <span class="ag-group-count">· {{ item.node.rows.length }}</span>
                        </span>
                      </td>
                    } @else {
                      <td
                        role="gridcell"
                        [attr.data-ridx]="pi"
                        [attr.data-cidx]="ci"
                        [attr.aria-colindex]="ci + 1 + (selectable() ? 1 : 0)"
                        [tabIndex]="cellTabIndex(pi, ci)"
                        class="ag-td-group-agg"
                        [class]="pinClass(col.key)"
                        [ngStyle]="pinStyle(col.key, 'var(--bg-2)')"
                        [style.outline]="isActiveCell(pi, ci) ? '2px solid var(--primary)' : null"
                        [style.outlineOffset.px]="isActiveCell(pi, ci) ? -2 : null"
                      >
                        {{ aggCellText(col, item.node.rows) }}
                      </td>
                    }
                  }
                </tr>
              } @else {
                <tr
                  [attr.data-ridx]="pi"
                  role="row"
                  [attr.aria-rowindex]="rowIndexOf(pi)"
                  [attr.aria-selected]="selectable() ? selected().has(item.row) : null"
                  class="ag-row"
                  [class.ag-row-selected]="selectable() && selected().has(item.row)"
                  [class.ag-row-focused]="activeCell()?.ri === pi"
                  [class]="rowClassName() ? rowClassName()!(item.row) : ''"
                  (click)="onDataRowClick($event, pi, item.row)"
                >
                  @if (selectable()) {
                    <td
                      role="gridcell"
                      [attr.data-ridx]="pi"
                      [attr.data-cidx]="-1"
                      [attr.aria-colindex]="1"
                      [tabIndex]="cellTabIndex(pi, -1)"
                      class="ag-td-checkbox"
                      [class]="checkboxPinClass()"
                      [ngStyle]="checkboxPinStyle('var(--surface)')"
                      [style.outline]="isActiveCell(pi, -1) ? '2px solid var(--primary)' : null"
                      [style.outlineOffset.px]="isActiveCell(pi, -1) ? -2 : null"
                      (click)="$event.stopPropagation()"
                    >
                      <input
                        type="checkbox"
                        class="ag-checkbox"
                        [checked]="selected().has(item.row)"
                        (change)="toggleRow(item.row)"
                        aria-label="Seleccionar fila"
                        tabindex="-1"
                      />
                    </td>
                  }
                  @for (col of displayCols(); track col.key; let ci = $index) {
                    <td
                      [attr.data-label]="col.label"
                      [attr.data-colkey]="col.key"
                      [attr.data-ridx]="pi"
                      [attr.data-cidx]="ci"
                      [attr.aria-colindex]="ci + 1 + (selectable() ? 1 : 0)"
                      role="gridcell"
                      [tabIndex]="cellTabIndex(pi, ci)"
                      [class]="dataTdClasses(col, item.row)"
                      [ngStyle]="editCellStyle(col, item.row, pi, ci, item.depth)"
                      [style.outline]="isActiveCell(pi, ci) && !isEditingThis(pi, ci) ? '2px solid var(--primary)' : null"
                      [style.outlineOffset.px]="isActiveCell(pi, ci) && !isEditingThis(pi, ci) ? -2 : null"
                      (dblclick)="onCellDblClick(col, item.row, pi, ci)"
                    >
                      @if (isEditingThis(pi, ci)) {
                        <at-grid-cell-editor
                          [col]="col"
                          [row]="item.row"
                          [initial]="editValueFor(col, item.row)"
                          [customTpl]="cellEditorTemplateMap().get(col.key) ?? null"
                          (commit)="onCellEditorCommit(pi, ci, $event)"
                          (cancel)="cancelEdit(pi, ci)"
                        ></at-grid-cell-editor>
                      } @else {
                        @if (cellTemplateMap().get(col.key); as tpl) {
                          <ng-container *ngTemplateOutlet="tpl; context: { $implicit: item.row, row: item.row }"></ng-container>
                        } @else {
                          {{ cellRaw(item.row, col) ?? '—' }}
                        }
                      }
                    </td>
                  }
                </tr>
              }
            }
          }
          @if (virtualized() && bottomPad() > 0) {
            <tr aria-hidden="true" [style.height.px]="bottomPad()">
              <td [attr.colspan]="colCount()" style="padding: 0; border: 0"></td>
            </tr>
          }
          @if (hasFooter() && flatItems().length > 0) {
            <tr class="ag-footer-row" role="row">
              @if (selectable()) {
                <td class="ag-td-checkbox" role="gridcell" [class]="checkboxPinClass()" [ngStyle]="checkboxPinStyle('var(--bg-2)')"></td>
              }
              @for (col of displayCols(); track col.key) {
                <td class="ag-td-footer" role="gridcell" [class.ag-td-footer-num]="col.numeric" [class]="pinClass(col.key)" [ngStyle]="pinStyle(col.key, 'var(--bg-2)')">
                  @if (footerTemplateMap().get(col.key); as tpl) {
                    <ng-container *ngTemplateOutlet="tpl; context: { $implicit: filteredRows(), rows: filteredRows() }"></ng-container>
                  }
                </td>
              }
            </tr>
          }
        </tbody>
      </table>
    </div>

    @if (selectable() && selected().size > 0) {
      <div class="ag-selection-bar">
        <span class="ag-selection-count">{{ selected().size }} seleccionados</span>
        <button type="button" class="ag-link-btn" (click)="selected.set(emptySelection())">Limpiar selección</button>
        @if (selectionActionsTpl) {
          <div class="ag-selection-actions">
            <ng-container *ngTemplateOutlet="selectionActionsTpl.tpl; context: { $implicit: selectedRows(), rows: selectedRows() }"></ng-container>
          </div>
        }
        <div class="ag-selection-agg">
          @for (col of aggregateCols(); track col.key) {
            <span class="ag-selection-agg-item">
              <span class="ag-selection-agg-label">{{ col.label }}</span>
              <span class="ag-selection-agg-value">{{ aggCellText(col, selectedRows()) }}</span>
            </span>
          }
        </div>
      </div>
    }

    @if (effPageSize() !== undefined && flatItems().length > minSizeOption()) {
      <at-grid-pagination
        [page]="safePage()"
        [pageCount]="pageCount()"
        [from]="pageFrom()"
        [to]="pageTo()"
        [total]="flatItems().length"
        [pageSize]="effPageSize()!"
        [pageSizeOptions]="sizeOptions()"
        (pageChange)="page.set($event)"
        (pageSizeChange)="pageSizeState.set($event); page.set(1)"
      />
    }

    @if (popover(); as p) {
      <at-grid-popover [anchor]="p.anchor" [width]="popoverWidth(p.kind)" (closed)="closePopover()">
        @switch (p.kind) {
          @case ('menu') {
            @if (colMap().get(p.key!); as col) {
              @if (col.sortable !== false) {
                <button type="button" class="ag-menu-item" [class.ag-menu-item-active]="sortDirFor(col.key) === 'asc'" (click)="sorts.set([{ key: col.key, dir: 'asc' }]); closePopover()">
                  Ordenar ascendente
                </button>
                <button type="button" class="ag-menu-item" [class.ag-menu-item-active]="sortDirFor(col.key) === 'desc'" (click)="sorts.set([{ key: col.key, dir: 'desc' }]); closePopover()">
                  Ordenar descendente
                </button>
                @if (sortIndexFor(col.key) >= 0) {
                  <button type="button" class="ag-menu-item" (click)="removeSort(col.key); closePopover()">Quitar orden</button>
                }
                <div class="ag-menu-sep"></div>
              }
              <button type="button" class="ag-menu-item" [class.ag-menu-item-active]="pinFor(col.key) === 'left'" (click)="setPin(col.key, pinFor(col.key) === 'left' ? null : 'left'); closePopover()">
                Fijar a la izquierda
              </button>
              <button type="button" class="ag-menu-item" [class.ag-menu-item-active]="pinFor(col.key) === 'right'" (click)="setPin(col.key, pinFor(col.key) === 'right' ? null : 'right'); closePopover()">
                Fijar a la derecha
              </button>
              @if (pinFor(col.key)) {
                <button type="button" class="ag-menu-item" (click)="setPin(col.key, null); closePopover()">No fijar</button>
              }
              <div class="ag-menu-sep"></div>
              <button type="button" class="ag-menu-item" (click)="autosizeColumn(col.key); closePopover()">Ajustar al contenido</button>
              @if (col.groupable) {
                <button type="button" class="ag-menu-item" [disabled]="colIsGrouped(col.key)" (click)="addGroup(col.key); closePopover()">
                  Agrupar por esta columna
                </button>
              }
              <button type="button" class="ag-menu-item" [disabled]="visibleCols().length <= 1" (click)="toggleHidden(col.key); closePopover()">
                Ocultar columna
              </button>
            }
          }
          @case ('columns') {
            @for (k of order(); track k) {
              @if (colMap().get(k); as col) {
                <button type="button" class="ag-menu-item" [disabled]="toggleHiddenDisabled(k)" (click)="toggleHidden(k)">
                  <span class="ag-dot" [class.ag-dot-on]="!colIsHidden(k)"></span>
                  <span class="ag-truncate">{{ col.label }}</span>
                  @if (colIsGrouped(k)) {
                    <span class="ag-menu-item-tag">agrupada</span>
                  }
                </button>
              }
            }
            @if (hidden().length > 0) {
              <div class="ag-menu-sep"></div>
              <button type="button" class="ag-menu-item" (click)="hidden.set([])">Mostrar todas</button>
            }
          }
          @case ('set') {
            <div class="ag-set-search">
              <input
                type="text"
                class="ag-filter-input"
                [value]="setSearch()"
                (input)="setSearch.set($any($event.target).value)"
                placeholder="Filtrar"
                autofocus
              />
            </div>
            <div class="ag-set-actions">
              <button type="button" class="ag-set-action" (click)="setAllSetValues(p.key!, 'all')">Todos</button>
              <button type="button" class="ag-set-action ag-set-action-muted" (click)="setAllSetValues(p.key!, 'none')">Ninguno</button>
            </div>
            <div class="ag-set-list">
              @for (row of setFilterRows(p.key!); track row.value) {
                <label class="ag-set-row">
                  <input type="checkbox" [checked]="row.checked" (change)="toggleSetValue(p.key!, row.value, setFilterAllValues(p.key!))" />
                  <span class="ag-truncate">{{ row.value }}</span>
                  <span class="ag-set-row-count">{{ row.count }}</span>
                </label>
              }
              @if (setFilterRows(p.key!).length === 0) {
                <div class="ag-set-empty">Sin resultados</div>
              }
            </div>
          }
          @case ('export') {
            <button type="button" class="ag-menu-item" (click)="exportXlsxRows(sortedRows()); closePopover()">Exportar visibles</button>
            <button type="button" class="ag-menu-item" [disabled]="selected().size === 0" (click)="exportXlsxRows(selectedRows()); closePopover()">
              Exportar selección ({{ selected().size }})
            </button>
            <div class="ag-menu-sep"></div>
            <button type="button" class="ag-menu-item" (click)="copyTSV(sortedRows()); closePopover()">Copiar visibles (TSV)</button>
            <button type="button" class="ag-menu-item" [disabled]="selected().size === 0" (click)="copyTSV(selectedRows()); closePopover()">
              Copiar selección ({{ selected().size }})
            </button>
          }
        }
      </at-grid-popover>
    }
  `,
  styles: [
    `
      :host {
        display: block;
        /* Defaults del tema — sobreescribir en el consumidor (:root o un
           wrapper) para adaptar AtGrid al theme de la app. */
        --bg: var(--bg, #f6f4ef);
        --bg-2: var(--bg-2, #efebe2);
        --surface: var(--surface, #fffefb);
        --border: var(--border, #e0dace);
        --border-2: var(--border-2, #cec6b6);
        --text: var(--text, #1a1714);
        --text-2: var(--text-2, #6b645c);
        --text-3: var(--text-3, #a39b90);
        --primary: var(--primary, #b8553a);
        --primary-dark: var(--primary-dark, #93422c);
        --primary-darker: var(--primary-darker, #7a3624);
        --primary-light: var(--primary-light, #f3e6df);
        --primary-tint: var(--primary-tint, #f3e6df);
        --success: var(--success, #2f6b4f);
        --radius: var(--radius, 4px);
        --radius-sm: var(--radius-sm, 3px);
        --radius-xs: var(--radius-xs, 2px);
        --shadow-md: var(--shadow-md, 0 8px 24px -12px rgba(40, 30, 20, 0.4));
        --ring-primary: var(--ring-primary, rgba(184, 85, 58, 0.25));
      }

      /* ── Toolbar ─────────────────────────────────────────────── */
      .ag-toolbar {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        flex-wrap: wrap;
        padding-bottom: 0.75rem;
      }
      .ag-group-zone {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
        min-height: 32px;
        padding: 4px 10px;
        border: 1px dashed var(--border-2);
        border-radius: var(--radius-sm);
        transition: 0.15s;
      }
      .ag-group-zone-hover {
        border-color: var(--primary);
        background: var(--primary-light);
      }
      .ag-group-zone-icon {
        color: var(--text-3);
        flex-shrink: 0;
      }
      .ag-group-zone-label {
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: var(--text-3);
        font-weight: 700;
      }
      .ag-group-chip {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 2px 8px;
        background: var(--primary-tint);
        color: var(--primary-darker);
        border-radius: var(--radius-xs);
        font-size: 11px;
        font-weight: 600;
      }
      .ag-group-chip-x {
        background: none;
        border: none;
        cursor: pointer;
        color: inherit;
        font-size: 14px;
        line-height: 1;
        padding: 0;
      }
      .ag-group-zone-hint {
        font-size: 12px;
        color: var(--text-3);
        font-style: italic;
      }
      .ag-group-zone-select {
        font-size: 12px;
        background: transparent;
        border: none;
        color: var(--text-3);
        cursor: pointer;
      }
      .ag-toolbar-right {
        margin-left: auto;
        display: flex;
        align-items: center;
        gap: 6px;
        flex-wrap: wrap;
      }
      .ag-search {
        position: relative;
        margin-right: 4px;
      }
      .ag-search-icon {
        position: absolute;
        left: 8px;
        top: 50%;
        transform: translateY(-50%);
        color: var(--text-3);
        pointer-events: none;
      }
      .ag-search-input {
        width: 160px;
        padding: 5px 24px 5px 26px;
        font-size: 12px;
        border: 1px solid var(--border);
        border-radius: var(--radius-xs);
        background: var(--surface);
        color: var(--text);
        transition: 0.15s;
      }
      .ag-search-input:focus {
        outline: none;
        border-color: var(--primary);
        width: 220px;
      }
      .ag-search-clear {
        position: absolute;
        right: 6px;
        top: 50%;
        transform: translateY(-50%);
        background: none;
        border: none;
        color: var(--text-3);
        cursor: pointer;
        font-size: 13px;
        line-height: 1;
      }
      .ag-count {
        font-size: 12px;
        color: var(--text-3);
        margin-right: 4px;
        white-space: nowrap;
      }
      .ag-icon-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 26px;
        height: 26px;
        border: none;
        background: transparent;
        color: var(--text-3);
        border-radius: var(--radius-xs);
        cursor: pointer;
        transition: 0.15s;
      }
      .ag-icon-btn:hover {
        color: var(--text);
        background: var(--bg-2);
      }
      .ag-icon-btn-active {
        color: var(--primary);
      }
      .ag-link-btn {
        background: none;
        border: none;
        cursor: pointer;
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: var(--primary);
        font-weight: 700;
        white-space: nowrap;
      }
      .ag-link-btn:hover {
        color: var(--primary-dark);
      }
      .ag-copied {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: var(--success);
        white-space: nowrap;
      }

      /* ── Tabla ───────────────────────────────────────────────── */
      .ag-table-wrap {
        overflow-x: auto;
      }
      .ag-table-wrap:focus {
        outline: none;
      }
      .ag-table {
        width: 100%;
        border-collapse: separate;
        border-spacing: 0;
        font-variant-numeric: tabular-nums;
      }
      .ag-th {
        position: relative;
        padding: 0.7rem 1rem;
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: var(--text-2);
        border-bottom: 1px solid var(--border);
        text-align: left;
        white-space: nowrap;
        user-select: none;
      }
      .ag-th-right {
        text-align: right;
      }
      .ag-th-sortable {
        cursor: pointer;
      }
      .ag-th-sortable:hover {
        color: var(--text);
      }
      .ag-th-dragging {
        opacity: 0.4;
      }
      .ag-sort-indicator {
        margin-left: 4px;
      }
      .ag-sort-idle {
        color: var(--text-3);
      }
      .ag-sort-order {
        margin-left: 1px;
        font-size: 8px;
      }
      .ag-th-menu-btn {
        position: absolute;
        right: 6px;
        top: 50%;
        transform: translateY(-50%);
        opacity: 0;
        padding: 2px;
        border: none;
        background: none;
        color: var(--text-3);
        cursor: pointer;
        transition: 0.15s;
        border-radius: 3px;
      }
      .ag-th:hover .ag-th-menu-btn,
      .ag-th-menu-btn-open {
        opacity: 1;
      }
      .ag-th-menu-btn:hover {
        color: var(--text);
        background: var(--bg-2);
      }
      .ag-th-menu-btn-open {
        color: var(--primary);
      }
      .ag-th-resize {
        position: absolute;
        right: 0;
        top: 0;
        height: 100%;
        width: 5px;
        cursor: col-resize;
      }
      .ag-th-resize:hover,
      .ag-th-resize-active {
        background: rgba(14, 116, 144, 0.35);
      }
      .ag-th-group {
        padding: 6px 12px 4px;
        text-align: center;
        font-size: 10px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: var(--text-3);
        white-space: nowrap;
      }
      .ag-th-group-labeled {
        border-bottom: 1px solid var(--border-2);
      }
      .ag-th-blank,
      .ag-th-checkbox,
      .ag-th-filter-blank {
        border-bottom: 1px solid var(--border);
      }
      .ag-th-checkbox {
        width: 40px;
        padding: 0.7rem;
        text-align: center;
      }
      .ag-checkbox {
        accent-color: var(--primary);
        cursor: pointer;
      }
      .ag-th-filter {
        padding: 6px 10px;
        border-bottom: 1px solid var(--border);
        background: var(--bg);
        font-weight: 400;
      }
      .ag-filter-date {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .ag-filter-input {
        width: 100%;
        min-width: 60px;
        padding: 4px 8px;
        font-size: 12px;
        border: 1px solid var(--border);
        border-radius: var(--radius-xs);
        background: var(--surface);
        color: var(--text);
      }
      .ag-filter-input:focus {
        outline: none;
        border-color: var(--primary);
      }
      .ag-filter-set-btn {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 4px;
        cursor: pointer;
        text-align: left;
      }
      .ag-filter-active {
        border-color: var(--primary);
        color: var(--primary-darker);
      }
      .ag-filter-set-total {
        font-size: 10px;
        color: var(--text-3);
        flex-shrink: 0;
      }
      .ag-truncate {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      /* ── Filas ───────────────────────────────────────────────── */
      .ag-empty {
        padding: 2.5rem;
        text-align: center;
        font-size: 13px;
        color: var(--text-3);
        border-bottom: 1px solid var(--border);
      }
      .ag-row {
        transition: background 0.1s;
        cursor: pointer;
      }
      .ag-row:hover td {
        background: var(--primary-light);
      }
      .ag-row-selected td {
        background: var(--primary-light);
      }
      .ag-row-focused td:first-child {
        box-shadow: inset 2px 0 0 var(--primary);
      }
      .ag-td {
        padding: 0.85rem 1rem;
        font-size: 13px;
        color: var(--text-2);
        border-bottom: 1px solid var(--border);
        vertical-align: middle;
      }
      .ag-td-strong {
        color: var(--text);
        font-weight: 600;
      }
      .ag-td-right {
        text-align: right;
        white-space: nowrap;
      }
      .ag-td-num {
        padding: 0.85rem 1rem;
        text-align: right;
        font-variant-numeric: tabular-nums;
        font-weight: 500;
        color: var(--text);
        border-bottom: 1px solid var(--border);
        white-space: nowrap;
      }
      .ag-clip {
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .ag-td-checkbox {
        width: 40px;
        padding: 0.85rem;
        text-align: center;
        border-bottom: 1px solid var(--border);
      }
      .ag-group-row {
        cursor: pointer;
        background: var(--bg-2);
        user-select: none;
      }
      .ag-group-row:hover {
        background: var(--bg);
      }
      .ag-td-group-label {
        padding: 0.6rem 1rem;
        border-bottom: 1px solid var(--border);
        white-space: nowrap;
      }
      .ag-group-label-inner {
        display: inline-flex;
        align-items: center;
        gap: 8px;
      }
      .ag-chevron {
        color: var(--text-3);
        transition: transform 0.15s;
        flex-shrink: 0;
      }
      .ag-chevron-open {
        transform: rotate(90deg);
      }
      .ag-group-col-label {
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: var(--text-3);
      }
      .ag-group-value {
        font-size: 13px;
        font-weight: 600;
        color: var(--text);
      }
      .ag-group-count {
        font-size: 12px;
        color: var(--text-3);
      }
      .ag-td-group-agg {
        padding: 0.6rem 1rem;
        text-align: right;
        font-variant-numeric: tabular-nums;
        font-weight: 500;
        color: var(--text);
        border-bottom: 1px solid var(--border);
        white-space: nowrap;
      }
      .ag-footer-row td {
        background: var(--bg-2);
        font-weight: 600;
        color: var(--text);
      }
      .ag-td-footer {
        padding: 0.85rem 1rem;
        border-bottom: 1px solid var(--border);
      }
      .ag-td-footer-num {
        text-align: right;
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
      }

      /* ── Columnas fijadas (sticky, solo desktop) ────────────────── */
      @media (min-width: 1024px) {
        .ag-pin {
          position: sticky;
          z-index: 1;
          background: var(--at-pin-bg, var(--surface));
        }
        thead .ag-pin {
          z-index: 3;
        }
        .ag-pin-edge-l {
          box-shadow: inset -1px 0 0 var(--border-2);
        }
        .ag-pin-edge-r {
          box-shadow: inset 1px 0 0 var(--border-2);
        }

        /* Header pegajoso: solo cuando la tabla tiene height (virtualizada) —
           sin viewport acotado, sticky no tiene ancestro con scroll contra el que pegarse. */
        .ag-table.ag-virtualized thead th {
          position: sticky;
          top: 0;
          z-index: 2;
          background: var(--bg);
        }
        .ag-table.ag-virtualized thead .ag-pin {
          z-index: 4;
        }
      }

      /* ── Edición inline ──────────────────────────────────────────── */
      .ag-td-editable {
        cursor: text;
      }

      /* ── Tabla → tarjetas en móvil ───────────────────────────────── */
      @media (max-width: 1023px) {
        .ag-table {
          display: block;
        }
        .ag-table thead {
          display: none;
        }
        .ag-table tbody {
          display: block;
        }
        .ag-table tbody tr.ag-row,
        .ag-table tbody tr.ag-group-row {
          display: block;
          margin-bottom: 8px;
          border: 1px solid var(--border);
          border-radius: var(--radius);
          background: var(--surface);
          overflow: hidden;
        }
        .ag-table tbody tr:last-child {
          margin-bottom: 0;
        }
        .ag-table tbody td {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          padding: 8px 12px;
          border-bottom: 1px solid var(--border);
          text-align: right !important;
          white-space: normal !important;
          font-size: 12.5px !important;
        }
        .ag-table tbody td:last-child {
          border-bottom: none;
        }
        .ag-table tbody td[data-label]::before {
          content: attr(data-label);
          font-size: 9px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: var(--text-3);
          flex-shrink: 0;
          text-align: left;
        }
        .ag-table tbody td .ag-truncate {
          white-space: normal;
          overflow: visible;
          text-overflow: clip;
          max-width: none;
        }
        .ag-table tbody tr.ag-group-row td {
          border-bottom: none;
          padding-left: 12px !important;
        }
      }

      /* ── Barra de selección ──────────────────────────────────────── */
      .ag-selection-bar {
        display: flex;
        align-items: center;
        gap: 1rem;
        flex-wrap: wrap;
        padding: 0.6rem 1.25rem;
        border-top: 1px solid var(--border);
        background: var(--bg-2);
      }
      .ag-selection-count {
        font-size: 12px;
        font-weight: 600;
        color: var(--text);
      }
      .ag-selection-actions {
        display: flex;
        align-items: center;
        gap: 0.75rem;
      }
      .ag-selection-agg {
        margin-left: auto;
        display: flex;
        align-items: center;
        gap: 1.25rem;
        flex-wrap: wrap;
      }
      .ag-selection-agg-item {
        display: inline-flex;
        align-items: baseline;
        gap: 6px;
      }
      .ag-selection-agg-label {
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: var(--text-3);
      }
      .ag-selection-agg-value {
        font-size: 14px;
        font-weight: 600;
        color: var(--text);
        font-variant-numeric: tabular-nums;
      }

      /* ── Menús / popovers ────────────────────────────────────────── */
      .ag-menu-item {
        display: flex;
        align-items: center;
        gap: 8px;
        width: 100%;
        padding: 6px 12px;
        font-size: 12.5px;
        text-align: left;
        background: none;
        border: none;
        color: var(--text-2);
        cursor: pointer;
        transition: 0.12s;
      }
      .ag-menu-item:hover:not(:disabled) {
        background: var(--bg-2);
        color: var(--text);
      }
      .ag-menu-item:disabled {
        color: var(--text-3);
        opacity: 0.55;
        cursor: default;
      }
      .ag-menu-item-active {
        color: var(--primary);
        background: var(--primary-light);
      }
      .ag-menu-item-tag {
        margin-left: auto;
        font-size: 9px;
        color: var(--text-3);
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }
      .ag-menu-sep {
        margin: 4px 0;
        border-top: 1px solid var(--border);
      }
      .ag-dot {
        display: inline-block;
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: var(--border-2);
        flex-shrink: 0;
      }
      .ag-dot-on {
        background: var(--primary);
      }
      .ag-set-search {
        padding: 4px 10px 6px;
      }
      .ag-set-actions {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 0 12px 6px;
      }
      .ag-set-action {
        background: none;
        border: none;
        cursor: pointer;
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: var(--primary);
        font-weight: 700;
      }
      .ag-set-action-muted {
        color: var(--text-3);
      }
      .ag-set-list {
        max-height: 220px;
        overflow-y: auto;
        border-top: 1px solid var(--border);
      }
      .ag-set-row {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px 12px;
        font-size: 12.5px;
        color: var(--text-2);
        cursor: pointer;
      }
      .ag-set-row:hover {
        background: var(--bg-2);
      }
      .ag-set-row-count {
        margin-left: auto;
        font-size: 10px;
        color: var(--text-3);
      }
      .ag-set-empty {
        padding: 12px;
        font-size: 12px;
        color: var(--text-3);
        font-style: italic;
        text-align: center;
      }
    `,
  ],
})
export class AtGridComponent<T> implements OnInit, AfterContentInit {
  private readonly injector = inject(Injector);

  readonly CHECKBOX_W = CHECKBOX_W;
  readonly DEFAULT_COL_W = DEFAULT_COL_W;

  // -- Inputs / outputs ------------------------------------------------------
  columns = input.required<AtGridColumn<T>[]>();
  rows = input.required<T[]>();
  storageKey = input<string>();
  rowKey = input<(row: T, index: number) => string | number>();
  rowClassName = input<(row: T) => string>();
  pageSize = input<number>();
  selectable = input<boolean>(false);
  exportFileName = input<string>();
  clearSelectionSignal = input<number>();
  /**
   * Alto fijo del cuerpo (px). Si se define: la tabla vuelve scrolleable
   * verticalmente y virtualiza filas (solo renderiza las visibles + colchón),
   * necesario para datasets grandes. Sin esto, la tabla crece con el contenido
   * y renderiza todas las filas (como hasta ahora).
   */
  height = input<number>();

  rowClick = output<T>();
  selectionChange = output<T[]>();
  /**
   * Notifica una edición de celda confirmada (`editable` en la columna). La
   * tabla es controlada — no muta `rows` — el consumidor debe aplicar
   * `newRow` a su estado. También se dispara por undo/redo (Ctrl+Z/Ctrl+Y).
   */
  cellValueChanged = output<AtGridCellValueChanged<T>>();

  @ContentChildren(AtGridCellDirective, { descendants: false }) private cellTpls!: QueryList<AtGridCellDirective<T>>;
  @ContentChildren(AtGridFooterDirective, { descendants: false }) private footerTpls!: QueryList<AtGridFooterDirective<T>>;
  @ContentChildren(AtGridCellEditorDirective, { descendants: false }) private cellEditorTpls!: QueryList<
    AtGridCellEditorDirective<T>
  >;
  @ContentChild(AtGridSelectionActionsDirective) selectionActionsTpl?: AtGridSelectionActionsDirective<T>;

  @ViewChild('tableEl') private tableRef?: ElementRef<HTMLTableElement>;
  @ViewChild('wrapEl') private wrapRef?: ElementRef<HTMLDivElement>;

  // -- Helpers puros expuestos al template ------------------------------------
  readonly cellRaw = cellRaw;
  readonly filterTypeOf = filterTypeOf;

  // -- Estado (inicializado desde localStorage en ngOnInit) --------------------
  order = signal<string[]>([]);
  widths = signal<Record<string, number | undefined>>({});
  sorts = signal<SortState[]>([]);
  groupBy = signal<string[]>([]);
  hidden = signal<string[]>([]);
  pinned = signal<Record<string, PinSide>>({});
  showFilters = signal(false);
  filters = signal<Record<string, ColumnFilterValue>>({});
  quickFilter = signal('');
  expanded = signal<Set<string>>(new Set());
  selected = signal<Set<T>>(new Set());
  pageSizeState = signal<number | undefined>(undefined);
  autosizeKey = signal<string | null>(null);
  /** Celda con foco de teclado (roving tabindex): `ri` = índice en `pageItems()`, `ci` = índice de columna (`-1` = checkbox). */
  activeCell = signal<{ ri: number; ci: number } | null>(null);
  /** Celda en edición (misma indexación que `activeCell`). Nunca es la columna checkbox. */
  editingCell = signal<{ ri: number; ci: number } | null>(null);
  scrollTop = signal(0);
  copied = signal(false);
  popover = signal<PopoverState | null>(null);
  setSearch = signal('');
  dragCol = signal<string | null>(null);
  dropTarget = signal<{ key: string; side: 'left' | 'right' } | null>(null);
  groupZoneHover = signal(false);
  resizing = signal<string | null>(null);
  page = signal(1);

  cellTemplateMap = signal<Map<string, TemplateRef<{ $implicit: T; row: T }>>>(new Map());
  footerTemplateMap = signal<Map<string, TemplateRef<{ $implicit: T[]; rows: T[] }>>>(new Map());
  cellEditorTemplateMap = signal<
    Map<
      string,
      TemplateRef<{ $implicit: unknown; row: T; onCommit: (value: unknown) => void; onCancel: () => void }>
    >
  >(new Map());

  private undoStack: EditHistoryEntry[] = [];
  private redoStack: EditHistoryEntry[] = [];

  // -- Derivados ----------------------------------------------------------
  colMap = computed(() => new Map(this.columns().map((c) => [c.key, c])));
  colKeys = computed(() => this.columns().map((c) => c.key));

  visibleCols = computed(() =>
    this.order()
      .map((k) => this.colMap().get(k))
      .filter((c): c is AtGridColumn<T> => Boolean(c) && !this.groupBy().includes(c!.key) && !this.hidden().includes(c!.key))
  );

  displayCols = computed(() => {
    const cols = this.visibleCols();
    const pinned = this.pinned();
    const left = cols.filter((c) => pinned[c.key] === 'left');
    const mid = cols.filter((c) => !pinned[c.key]);
    const right = cols.filter((c) => pinned[c.key] === 'right');
    return [...left, ...mid, ...right];
  });

  fixedLayout = computed(() => Object.keys(this.widths()).length > 0);
  anyPinnedLeft = computed(() => this.displayCols().some((c) => this.pinned()[c.key] === 'left'));
  checkboxSticky = computed(() => this.selectable() && this.anyPinnedLeft());

  pinOffsets = computed(() => {
    const left = new Map<string, number>();
    const right = new Map<string, number>();
    const pinned = this.pinned();
    const widths = this.widths();
    let acc = this.checkboxSticky() ? CHECKBOX_W : 0;
    for (const c of this.displayCols()) {
      if (pinned[c.key] !== 'left') continue;
      left.set(c.key, acc);
      acc += widths[c.key] ?? DEFAULT_COL_W;
    }
    let accR = 0;
    for (const c of [...this.displayCols()].reverse()) {
      if (pinned[c.key] !== 'right') continue;
      right.set(c.key, accR);
      accR += widths[c.key] ?? DEFAULT_COL_W;
    }
    return { left, right };
  });

  lastLeftPinned = computed(() => [...this.displayCols()].reverse().find((c) => this.pinned()[c.key] === 'left')?.key);
  firstRightPinned = computed(() => this.displayCols().find((c) => this.pinned()[c.key] === 'right')?.key);

  setFilterValues = computed(() => {
    const map = new Map<string, Map<string, number>>();
    const rows = this.rows();
    for (const col of this.columns()) {
      if (col.filterable === false || filterTypeOf(col) !== 'set') continue;
      const counts = new Map<string, number>();
      for (const r of rows) {
        const v = groupVal(r, col);
        counts.set(v, (counts.get(v) ?? 0) + 1);
      }
      map.set(col.key, counts);
    }
    return map;
  });

  filteredRows = computed(() => {
    const q = this.quickFilter().trim().toLowerCase();
    const filters = this.filters();
    const active = Object.entries(filters).filter(([, v]) => filterIsActive(v));
    const cols = this.columns();
    const colMap = this.colMap();
    const rows = this.rows();
    if (!q && !active.length) return rows;
    return rows.filter((r) => {
      if (q && !cols.some((c) => filterVal(r, c).toLowerCase().includes(q))) return false;
      return active.every(([key, f]) => {
        const col = colMap.get(key);
        if (!col) return true;
        return rowPassesFilter(r, col, f);
      });
    });
  });

  sortedRows = computed(() => {
    const sorts = this.sorts();
    const filteredRows = this.filteredRows();
    if (!sorts.length) return filteredRows;
    const colMap = this.colMap();
    const active = sorts
      .map((s) => ({ s, col: colMap.get(s.key) }))
      .filter((x): x is { s: SortState; col: AtGridColumn<T> } => Boolean(x.col));
    if (!active.length) return filteredRows;
    return [...filteredRows].sort((a, b) => {
      for (const { s, col } of active) {
        const c = compareValues(sortVal(a, col), sortVal(b, col));
        if (c) return s.dir === 'asc' ? c : -c;
      }
      return 0;
    });
  });

  primarySort = computed(() => this.sorts()[0] as SortState | undefined);

  groupTree = computed<GroupNode<T>[] | null>(() => {
    const groupBy = this.groupBy();
    if (!groupBy.length) return null;
    const colMap = this.colMap();
    const groupCols = groupBy.map((k) => colMap.get(k)).filter((c): c is AtGridColumn<T> => Boolean(c));
    if (!groupCols.length) return null;
    const primarySort = this.primarySort();
    const sortCol = primarySort ? colMap.get(primarySort.key) : undefined;
    const mul = primarySort?.dir === 'desc' ? -1 : 1;
    const sortedRows = this.sortedRows();

    function build(input: T[], depth: number, parentPath: string): GroupNode<T>[] {
      const col = groupCols[depth];
      const buckets = new Map<string, T[]>();
      for (const r of input) {
        const v = groupVal(r, col);
        const arr = buckets.get(v);
        if (arr) arr.push(r);
        else buckets.set(v, [r]);
      }
      const nodes: GroupNode<T>[] = [...buckets.entries()].map(([value, rs]) => {
        const path = `${parentPath}§${col.key}:${value}`;
        return {
          path,
          colKey: col.key,
          value,
          depth,
          rows: rs,
          children: depth + 1 < groupCols.length ? build(rs, depth + 1, path) : [],
        };
      });
      if (sortCol?.aggregate && sortCol.key !== col.key) {
        nodes.sort((a, b) => (aggNum(sortCol, a.rows) - aggNum(sortCol, b.rows)) * mul);
      } else if (primarySort?.key === col.key) {
        nodes.sort((a, b) => compareValues(a.value, b.value) * mul);
      } else {
        nodes.sort((a, b) => compareValues(a.value, b.value));
      }
      return nodes;
    }
    return build(sortedRows, 0, '');
  });

  flatItems = computed<FlatItem<T>[]>(() => {
    const tree = this.groupTree();
    const sortedRows = this.sortedRows();
    if (!tree) return sortedRows.map((row, index) => ({ type: 'row' as const, row, depth: 0, index }));
    const expanded = this.expanded();
    const out: FlatItem<T>[] = [];
    const counter = { i: 0 };
    const walk = (nodes: GroupNode<T>[]) => {
      for (const n of nodes) {
        out.push({ type: 'group', node: n });
        if (!expanded.has(n.path)) continue;
        if (n.children.length) walk(n.children);
        else for (const row of n.rows) out.push({ type: 'row', row, depth: n.depth + 1, index: counter.i++ });
      }
    };
    walk(tree);
    return out;
  });

  effPageSize = computed(() => (this.pageSize() ? (this.pageSizeState() ?? this.pageSize()) : undefined));
  sizeOptions = computed(() => {
    const s = new Set([25, 50, 100, 250]);
    if (this.pageSize()) s.add(this.pageSize()!);
    return [...s].sort((a, b) => a - b);
  });
  minSizeOption = computed(() => Math.min(...this.sizeOptions()));
  pageCount = computed(() => {
    const eff = this.effPageSize();
    return eff ? Math.max(1, Math.ceil(this.flatItems().length / eff)) : 1;
  });
  safePage = computed(() => Math.min(this.page(), this.pageCount()));
  pageItems = computed(() => {
    const eff = this.effPageSize();
    const items = this.flatItems();
    return eff ? items.slice((this.safePage() - 1) * eff, this.safePage() * eff) : items;
  });
  pageFrom = computed(() => (this.safePage() - 1) * (this.effPageSize() ?? 0) + 1);
  pageTo = computed(() => Math.min(this.safePage() * (this.effPageSize() ?? 0), this.flatItems().length));

  allFilteredSelected = computed(() => {
    const fr = this.filteredRows();
    const sel = this.selected();
    return fr.length > 0 && fr.every((r) => sel.has(r));
  });
  someFilteredSelected = computed(() => !this.allFilteredSelected() && this.filteredRows().some((r) => this.selected().has(r)));
  selectedRows = computed(() => [...this.selected()]);

  groupableCols = computed(() => this.columns().filter((c) => c.groupable));
  pendingGroupables = computed(() => this.groupableCols().filter((c) => !this.groupBy().includes(c.key)));
  hasActiveFilters = computed(() => Object.values(this.filters()).some(filterIsActive));
  grouped = computed(() => this.groupBy().length > 0);
  aggregateCols = computed(() => this.displayCols().filter((c) => c.aggregate));
  hasFooter = computed(() => this.footerTemplateMap().size > 0);
  dragIsGroupable = computed(() => {
    const dc = this.dragCol();
    return dc ? Boolean(this.colMap().get(dc)?.groupable) : false;
  });

  headerGroupRuns = computed(() => {
    const cols = this.displayCols();
    if (!cols.some((c) => c.group)) return null;
    const runs: { label: string; span: number }[] = [];
    for (const c of cols) {
      const label = c.group ?? '';
      const lastRun = runs[runs.length - 1];
      if (lastRun && lastRun.label === label) lastRun.span++;
      else runs.push({ label, span: 1 });
    }
    return runs;
  });

  // -- Virtualización + navegación celda-a-celda ---------------------------------
  virtualized = computed(() => this.height() !== undefined);
  minCi = computed(() => (this.selectable() ? -1 : 0));
  maxCi = computed(() => this.displayCols().length - 1);
  colCount = computed(() => this.displayCols().length + (this.selectable() ? 1 : 0));
  // filas de <thead>: encabezado de columnas + opcional grupo de encabezado (2º nivel) + opcional fila de filtros
  headerRowCount = computed(() => 1 + (this.headerGroupRuns() ? 1 : 0) + (this.showFilters() ? 1 : 0));

  rowOffsets = computed(() => {
    const items = this.pageItems();
    const offsets = new Array<number>(items.length + 1);
    offsets[0] = 0;
    for (let i = 0; i < items.length; i++) offsets[i + 1] = offsets[i] + itemHeightOf(items[i]);
    return offsets;
  });
  totalRowsHeight = computed(() => {
    const o = this.rowOffsets();
    return o[o.length - 1] ?? 0;
  });
  startIdx = computed(() => {
    if (!this.virtualized()) return 0;
    return Math.max(0, offsetIndexAt(this.rowOffsets(), this.scrollTop()) - OVERSCAN);
  });
  endIdx = computed(() => {
    const items = this.pageItems();
    if (!this.virtualized()) return items.length;
    const viewportH = this.height() ?? 0;
    return Math.min(items.length, offsetIndexAt(this.rowOffsets(), this.scrollTop() + viewportH) + OVERSCAN + 1);
  });
  topPad = computed(() => (this.virtualized() ? this.rowOffsets()[this.startIdx()] : 0));
  bottomPad = computed(() => (this.virtualized() ? this.totalRowsHeight() - this.rowOffsets()[this.endIdx()] : 0));

  constructor() {
    // Persistencia en localStorage (todo el layout, por storageKey).
    effect(() => {
      const key = this.storageKey();
      const state: PersistedState = {
        order: this.order(),
        widths: this.widths(),
        sorts: this.sorts(),
        groupBy: this.groupBy(),
        showFilters: this.showFilters(),
        hidden: this.hidden(),
        pinned: this.pinned(),
        pageSize: this.pageSizeState(),
      };
      if (key) savePersisted(key, state);
    });

    // La selección referencia filas por identidad: al cambiar el dataset se limpia.
    effect(
      () => {
        this.rows();
        this.selected.set(new Set());
      },
      { allowSignalWrites: true }
    );

    effect(() => {
      this.selectionChange.emit(this.selectedRows());
    });

    effect(
      () => {
        if (this.clearSelectionSignal() !== undefined) this.selected.set(new Set());
      },
      { allowSignalWrites: true }
    );

    // Volver a la página 1 cuando cambian filtros / orden / agrupación / datos.
    effect(
      () => {
        this.filters();
        this.quickFilter();
        this.sorts();
        this.groupBy();
        this.rows();
        this.page.set(1);
      },
      { allowSignalWrites: true }
    );

    // El foco de teclado (y el scroll virtual) se invalida al cambiar los datos visibles o de página.
    effect(
      () => {
        this.flatItems();
        this.safePage();
        this.activeCell.set(null);
        this.editingCell.set(null);
        if (this.virtualized()) {
          this.scrollTop.set(0);
          if (this.wrapRef) this.wrapRef.nativeElement.scrollTop = 0;
        }
      },
      { allowSignalWrites: true }
    );
  }

  ngOnInit(): void {
    const persisted = loadPersisted(this.storageKey());
    const keys = this.colKeys();
    this.order.set(reconcileOrder(persisted.order, keys));
    this.widths.set(persisted.widths ?? {});
    this.sorts.set((persisted.sorts ?? []).filter((s) => keys.includes(s.key)));
    const cm = this.colMap();
    this.groupBy.set((persisted.groupBy ?? []).filter((k) => cm.get(k)?.groupable));
    this.hidden.set((persisted.hidden ?? []).filter((k) => keys.includes(k)));
    const storedPinned = persisted.pinned ?? {};
    const validPinned: Record<string, PinSide> = {};
    for (const [k, side] of Object.entries(storedPinned)) {
      if (keys.includes(k) && (side === 'left' || side === 'right')) validPinned[k] = side;
    }
    this.pinned.set(validPinned);
    this.showFilters.set(persisted.showFilters ?? false);
    this.pageSizeState.set(persisted.pageSize ?? this.pageSize());
  }

  ngAfterContentInit(): void {
    this.syncCellTemplates();
    this.syncFooterTemplates();
    this.syncCellEditorTemplates();
    this.cellTpls.changes.subscribe(() => this.syncCellTemplates());
    this.footerTpls.changes.subscribe(() => this.syncFooterTemplates());
    this.cellEditorTpls.changes.subscribe(() => this.syncCellEditorTemplates());
  }

  private syncCellTemplates(): void {
    this.cellTemplateMap.set(new Map(this.cellTpls.map((d) => [d.key, d.tpl])));
  }
  private syncFooterTemplates(): void {
    this.footerTemplateMap.set(new Map(this.footerTpls.map((d) => [d.key, d.tpl])));
  }
  private syncCellEditorTemplates(): void {
    this.cellEditorTemplateMap.set(new Map(this.cellEditorTpls.map((d) => [d.key, d.tpl])));
  }

  emptySelection(): Set<T> {
    return new Set<T>();
  }

  // -- Pin / sticky ------------------------------------------------------
  pinStyle(colKey: string, bg: string): Record<string, string> {
    const side = this.pinned()[colKey];
    if (!side) return {};
    const style: Record<string, string> = { ['--at-pin-bg']: bg };
    if (side === 'left') style['left'] = (this.pinOffsets().left.get(colKey) ?? 0) + 'px';
    else style['right'] = (this.pinOffsets().right.get(colKey) ?? 0) + 'px';
    return style;
  }
  pinClass(colKey: string): string {
    const side = this.pinned()[colKey];
    if (!side) return '';
    const last = this.lastLeftPinned();
    const first = this.firstRightPinned();
    return 'ag-pin' + (colKey === last ? ' ag-pin-edge-l' : colKey === first ? ' ag-pin-edge-r' : '');
  }
  checkboxPinStyle(bg: string): Record<string, string> {
    if (!this.checkboxSticky()) return {};
    return { ['--at-pin-bg']: bg, left: '0px' };
  }
  checkboxPinClass(): string {
    return this.checkboxSticky() ? 'ag-pin' : '';
  }
  thStyle(col: AtGridColumn<T>): Record<string, string> {
    const style = this.pinStyle(col.key, 'var(--bg)');
    const dt = this.dropTarget();
    if (dt?.key === col.key) {
      style['box-shadow'] = `inset ${dt.side === 'left' ? '2px' : '-2px'} 0 0 var(--primary)`;
    }
    return style;
  }
  groupLabelStyle(colKey: string, depth: number): Record<string, string> {
    return { ...this.pinStyle(colKey, 'var(--bg-2)'), 'padding-left': 32 + depth * 20 + 'px' };
  }
  dataCellStyle(colKey: string, depth: number): Record<string, string> {
    const style = this.pinStyle(colKey, 'var(--surface)');
    if (depth > 0) style['padding-left'] = 32 + depth * 20 + 'px';
    return style;
  }

  // -- Columnas: orden, ancho, visibilidad, agrupar ------------------------------
  groupColLabel(colKey: string): string {
    return this.colMap().get(colKey)?.label ?? colKey;
  }
  addGroup(key: string): void {
    this.groupBy.update((g) => (g.includes(key) ? g : [...g, key]));
    this.expanded.set(new Set());
  }
  removeGroup(key: string): void {
    this.groupBy.update((g) => g.filter((k) => k !== key));
    this.expanded.set(new Set());
  }
  onAddGroupSelect(e: Event): void {
    const el = e.target as HTMLSelectElement;
    if (el.value) this.addGroup(el.value);
    el.value = '';
  }
  toggleHidden(key: string): void {
    this.hidden.update((h) => (h.includes(key) ? h.filter((k) => k !== key) : [...h, key]));
  }
  colIsHidden(key: string): boolean {
    return this.hidden().includes(key);
  }
  colIsGrouped(key: string): boolean {
    return this.groupBy().includes(key);
  }
  toggleHiddenDisabled(key: string): boolean {
    return this.colIsGrouped(key) || (!this.colIsHidden(key) && this.visibleCols().length <= 1);
  }

  private ensureFixedWidths(): Record<string, number | undefined> {
    if (this.fixedLayout()) return this.widths();
    const base: Record<string, number | undefined> = {};
    const ths = this.tableRef?.nativeElement.querySelectorAll<HTMLElement>('th[data-colkey]');
    ths?.forEach((el) => {
      const key = el.dataset['colkey'];
      if (key) base[key] = el.offsetWidth;
    });
    this.widths.set(base);
    return base;
  }

  setPin(key: string, side: PinSide | null): void {
    if (side) this.ensureFixedWidths();
    this.pinned.update((prev) => {
      const next = { ...prev };
      if (side) next[key] = side;
      else delete next[key];
      return next;
    });
  }

  autosizeColumn(key: string): void {
    this.ensureFixedWidths();
    this.autosizeKey.set(key);
    afterNextRender(
      () => {
        let max = 40;
        const table = this.tableRef?.nativeElement;
        const th = table?.querySelector<HTMLElement>(`th[data-colkey="${key}"]`);
        if (th) max = Math.max(max, th.scrollWidth);
        table?.querySelectorAll<HTMLElement>(`td[data-colkey="${key}"]`).forEach((el) => {
          max = Math.max(max, el.scrollWidth);
        });
        const minW = this.colMap().get(key)?.minWidth ?? 64;
        this.widths.update((w) => ({ ...w, [key]: Math.max(minW, max + 10) }));
        this.autosizeKey.set(null);
      },
      { injector: this.injector }
    );
  }

  // -- Ordenar --------------------------------------------------------------
  sortDirFor(key: string): 'asc' | 'desc' | null {
    return this.sorts().find((s) => s.key === key)?.dir ?? null;
  }
  sortIndexFor(key: string): number {
    return this.sorts().findIndex((s) => s.key === key);
  }
  onHeaderClick(e: MouseEvent, col: AtGridColumn<T>): void {
    if (col.sortable === false) return;
    this.handleSort(col.key, e.shiftKey);
  }
  handleSort(key: string, additive: boolean): void {
    this.sorts.update((prev) => {
      const idx = prev.findIndex((s) => s.key === key);
      if (!additive) {
        if (prev.length === 1 && idx === 0) return [{ key, dir: prev[0].dir === 'asc' ? 'desc' : 'asc' }];
        return [{ key, dir: 'asc' }];
      }
      if (idx === -1) return [...prev, { key, dir: 'asc' }];
      if (prev[idx].dir === 'asc') {
        const next = [...prev];
        next[idx] = { key, dir: 'desc' };
        return next;
      }
      return prev.filter((s) => s.key !== key);
    });
  }
  removeSort(key: string): void {
    this.sorts.update((prev) => prev.filter((s) => s.key !== key));
  }
  pinFor(key: string): PinSide | undefined {
    return this.pinned()[key];
  }

  // -- Selección --------------------------------------------------------------
  toggleRow(row: T): void {
    this.selected.update((prev) => {
      const next = new Set(prev);
      if (next.has(row)) next.delete(row);
      else next.add(row);
      return next;
    });
  }
  toggleRows(rowsIn: T[]): void {
    this.selected.update((prev) => {
      const next = new Set(prev);
      const allIn = rowsIn.every((r) => next.has(r));
      if (allIn) rowsIn.forEach((r) => next.delete(r));
      else rowsIn.forEach((r) => next.add(r));
      return next;
    });
  }
  groupAllSelected(node: GroupNode<T>): boolean {
    return node.rows.length > 0 && node.rows.every((r) => this.selected().has(r));
  }
  groupSomeSelected(node: GroupNode<T>): boolean {
    return !this.groupAllSelected(node) && node.rows.some((r) => this.selected().has(r));
  }

  // -- Agrupación: expandir/colapsar ---------------------------------------
  toggleExpand(path: string): void {
    this.expanded.update((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }
  expandAll(): void {
    const paths = new Set<string>();
    const walk = (nodes: GroupNode<T>[]) => {
      for (const n of nodes) {
        paths.add(n.path);
        walk(n.children);
      }
    };
    const tree = this.groupTree();
    if (tree) walk(tree);
    this.expanded.set(paths);
  }
  collapseAll(): void {
    this.expanded.set(new Set());
  }

  // -- Reset ------------------------------------------------------------------
  resetAll(): void {
    this.order.set(this.colKeys());
    this.widths.set({});
    this.sorts.set([]);
    this.groupBy.set([]);
    this.hidden.set([]);
    this.pinned.set({});
    this.filters.set({});
    this.quickFilter.set('');
    this.showFilters.set(false);
    this.expanded.set(new Set());
    this.selected.set(new Set());
    this.pageSizeState.set(this.pageSize());
    this.activeCell.set(null);
    this.editingCell.set(null);
    this.popover.set(null);
    const key = this.storageKey();
    if (key) clearPersisted(key);
  }

  // -- Export Excel / copiar TSV --------------------------------------------------
  private exportCell(r: T, c: AtGridColumn<T>): string | number {
    const v = c.exportValue ? c.exportValue(r) : c.numeric ? numVal(r, c) : (cellRaw(r, c) ?? '');
    return typeof v === 'number' ? v : String(v);
  }
  exportXlsxRows(rowsToExport: T[]): void {
    const cols = this.displayCols();
    downloadXlsx(
      this.exportFileName() ?? this.storageKey() ?? 'tabla',
      cols.map((c) => c.label),
      rowsToExport.map((r) => cols.map((c) => this.exportCell(r, c)))
    );
  }
  async copyTSV(rowsToCopy: T[]): Promise<void> {
    const cols = this.displayCols();
    const lines = [
      cols.map((c) => c.label).join('\t'),
      ...rowsToCopy.map((r) => cols.map((c) => String(this.exportCell(r, c)).replace(/[\t\n]/g, ' ')).join('\t')),
    ];
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 1800);
    } catch {
      /* portapapeles bloqueado (contexto no seguro): no hay feedback */
    }
  }

  // -- Tooltip automático en celdas con contenido cortado -----------------------------
  handleCellMouseOver(e: MouseEvent): void {
    const td = (e.target as HTMLElement).closest('td');
    if (!td) return;
    const clipped =
      td.scrollWidth > td.clientWidth + 1 ||
      Array.from(td.querySelectorAll<HTMLElement>('.ag-truncate')).some((n) => n.scrollWidth > n.clientWidth + 1);
    if (clipped) {
      td.title = (td.textContent ?? '').trim();
      td.dataset['autoTitle'] = '1';
    } else if (td.dataset['autoTitle']) {
      td.removeAttribute('title');
      delete td.dataset['autoTitle'];
    }
  }

  // -- Virtualización: scroll + spacer ---------------------------------------------
  onTableScroll(e: Event): void {
    if (!this.virtualized()) return;
    this.scrollTop.set((e.target as HTMLElement).scrollTop);
  }

  // -- Roving tabindex: foco de celda, ARIA -----------------------------------------
  onWrapFocus(e: FocusEvent): void {
    if (e.target === e.currentTarget && this.activeCell() === null && this.pageItems().length) {
      this.activeCell.set({ ri: 0, ci: this.minCi() });
    }
  }
  onWrapBlur(e: FocusEvent): void {
    const cur = e.currentTarget as HTMLElement;
    if (!cur.contains(e.relatedTarget as Node)) this.activeCell.set(null);
  }
  cellTabIndex(pi: number, ci: number): number {
    return this.isActiveCell(pi, ci) ? 0 : -1;
  }
  isActiveCell(pi: number, ci: number): boolean {
    const ac = this.activeCell();
    return ac?.ri === pi && ac?.ci === ci;
  }
  isEditingThis(pi: number, ci: number): boolean {
    const ec = this.editingCell();
    return ec?.ri === pi && ec?.ci === ci;
  }
  /** Deriva la columna (`data-cidx`) del elemento clickeado, para setear la celda activa en clicks de mouse. */
  private ciFromTarget(target: EventTarget | null): number {
    const el = (target as HTMLElement)?.closest?.('[data-cidx]') as HTMLElement | null;
    const v = el?.dataset['cidx'];
    return v !== undefined ? Number(v) : this.minCi();
  }
  ariaSortFor(col: AtGridColumn<T>): 'ascending' | 'descending' | 'none' | null {
    if (col.sortable === false) return null;
    const dir = this.sortDirFor(col.key);
    return dir === 'asc' ? 'ascending' : dir === 'desc' ? 'descending' : 'none';
  }
  /** Posición de fila 1-indexada para `aria-rowindex`, contando las filas de <thead>. */
  rowIndexOf(pi: number): number {
    const eff = this.effPageSize();
    const base = eff ? (this.safePage() - 1) * eff : 0;
    return base + pi + this.headerRowCount() + 1;
  }
  onGroupRowClick(e: MouseEvent, pi: number, node: GroupNode<T>): void {
    this.activeCell.set({ ri: pi, ci: this.ciFromTarget(e.target) });
    this.toggleExpand(node.path);
  }
  onDataRowClick(e: MouseEvent, pi: number, row: T): void {
    this.activeCell.set({ ri: pi, ci: this.ciFromTarget(e.target) });
    this.rowClick.emit(row);
  }

  // -- Navegación por teclado -----------------------------------------------------
  private scrollCellIntoView(ri: number, ci: number): void {
    requestAnimationFrame(() => {
      const el = this.tableRef?.nativeElement.querySelector<HTMLElement>(`[data-ridx="${ri}"][data-cidx="${ci}"]`);
      el?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      el?.focus({ preventScroll: true });
    });
  }
  onGridKeyDown(e: KeyboardEvent): void {
    const tag = (e.target as HTMLElement).tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || tag === 'BUTTON') return;
    const items = this.pageItems();
    if (!items.length) return;
    const lastRi = items.length - 1;
    const minCi = this.minCi();
    const maxCi = this.maxCi();
    const ac = this.activeCell();
    const cur = ac ?? { ri: 0, ci: minCi };

    const moveTo = (ri: number, ci: number) => {
      e.preventDefault();
      const next = { ri: Math.max(0, Math.min(lastRi, ri)), ci: Math.max(minCi, Math.min(maxCi, ci)) };
      this.activeCell.set(next);
      this.scrollCellIntoView(next.ri, next.ci);
    };

    switch (e.key) {
      case 'ArrowDown':
        moveTo(ac === null ? 0 : cur.ri + 1, cur.ci);
        break;
      case 'ArrowUp':
        moveTo(ac === null ? lastRi : cur.ri - 1, cur.ci);
        break;
      case 'ArrowRight':
        moveTo(cur.ri, cur.ci + 1);
        break;
      case 'ArrowLeft':
        moveTo(cur.ri, cur.ci - 1);
        break;
      case 'Home':
        moveTo(e.ctrlKey ? 0 : cur.ri, minCi);
        break;
      case 'End':
        moveTo(e.ctrlKey ? lastRi : cur.ri, maxCi);
        break;
      case 'PageDown':
        if (this.effPageSize() !== undefined) {
          e.preventDefault();
          this.page.set(Math.min(this.pageCount(), this.safePage() + 1));
        }
        break;
      case 'PageUp':
        if (this.effPageSize() !== undefined) {
          e.preventDefault();
          this.page.set(Math.max(1, this.safePage() - 1));
        }
        break;
      case 'Enter': {
        if (ac === null) break;
        e.preventDefault();
        const it = items[cur.ri];
        if (it.type === 'group') this.toggleExpand(it.node.path);
        else this.rowClick.emit(it.row);
        break;
      }
      case ' ': {
        if (ac === null || !this.selectable()) break;
        e.preventDefault();
        const it = items[cur.ri];
        if (it.type === 'group') this.toggleRows(it.node.rows);
        else this.toggleRow(it.row);
        break;
      }
      case 'F2':
        if (ac === null) break;
        e.preventDefault();
        this.startEdit(cur.ri, cur.ci);
        break;
      case 'Delete':
      case 'Backspace': {
        if (ac === null) break;
        const it = items[cur.ri];
        const col = this.displayCols()[cur.ci];
        if (it?.type !== 'row' || !col || !this.isEditable(col, it.row)) break;
        e.preventDefault();
        this.commitEdit(cur.ri, cur.ci, '');
        break;
      }
      case 'z':
      case 'Z':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          if (e.shiftKey) this.redo();
          else this.undo();
        }
        break;
      case 'y':
      case 'Y':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          this.redo();
        }
        break;
    }
  }

  // -- Edición inline + undo/redo -------------------------------------------------
  // La tabla es controlada: nunca muta `rows`. Cada commit dispara `cellValueChanged`
  // con `newRow`, y es responsabilidad del consumidor aplicarlo a su estado.
  // Undo/redo re-localiza la fila por `rowIdOf` en los datos ACTUALES (no por referencia
  // stale): confiable solo si se pasa `rowKey` — sin él, cae a la posición dentro de
  // `sortedRows`/grupo aplanado, que puede desalinearse si se reordena/filtra entretanto.
  private rowIdOf(row: T, index: number): string | number {
    const rk = this.rowKey();
    return rk ? rk(row, index) : index;
  }
  isEditable(col: AtGridColumn<T>, row: T): boolean {
    return typeof col.editable === 'function' ? col.editable(row) : Boolean(col.editable);
  }
  editValueFor(col: AtGridColumn<T>, row: T): string {
    return col.editValue ? col.editValue(row) : String(cellRaw(row, col) ?? '');
  }
  editCellStyle(col: AtGridColumn<T>, row: T, pi: number, ci: number, depth: number): Record<string, string> {
    const style = this.dataCellStyle(col.key, this.grouped() && ci === 0 ? depth : 0);
    if (this.isEditingThis(pi, ci)) {
      style['padding'] = '0';
      style['overflow'] = 'visible';
    }
    return style;
  }
  onCellDblClick(col: AtGridColumn<T>, row: T, pi: number, ci: number): void {
    if (this.isEditable(col, row)) this.startEdit(pi, ci);
  }
  onCellEditorCommit(ri: number, ci: number, ev: CellEditorCommit): void {
    this.commitEditAndMove(ri, ci, ev.raw, ev.move);
  }

  private applyValueToRow(entry: EditHistoryEntry, valueToApply: unknown): void {
    for (const item of this.flatItems()) {
      if (item.type !== 'row') continue;
      if (this.rowIdOf(item.row, item.index) !== entry.rowId) continue;
      const col = this.colMap().get(entry.colKey);
      if (!col) return;
      const oldValue = cellRaw(item.row, col);
      const newRow = col.valueSetter
        ? col.valueSetter(item.row, valueToApply)
        : ({ ...item.row, [col.key]: valueToApply } as T);
      this.cellValueChanged.emit({ row: item.row, rowIndex: item.index, col, oldValue, newValue: valueToApply, newRow });
      return;
    }
  }
  undo(): void {
    const entry = this.undoStack.pop();
    if (!entry) return;
    this.applyValueToRow(entry, entry.oldValue);
    this.redoStack.push(entry);
  }
  redo(): void {
    const entry = this.redoStack.pop();
    if (!entry) return;
    this.applyValueToRow(entry, entry.newValue);
    this.undoStack.push(entry);
  }
  commitEdit(ri: number, ci: number, raw: string): void {
    const item = this.pageItems()[ri];
    this.editingCell.set(null);
    if (!item || item.type !== 'row') return;
    const col = this.displayCols()[ci];
    if (!col || !this.isEditable(col, item.row)) return;
    const { row, index } = item;
    const oldValue = cellRaw(row, col);
    const newValue = col.valueParser ? col.valueParser(raw, row) : defaultParseEdit(raw, col);
    if (Object.is(newValue, oldValue)) return;
    const newRow = col.valueSetter ? col.valueSetter(row, newValue) : ({ ...row, [col.key]: newValue } as T);
    this.undoStack.push({ rowId: this.rowIdOf(row, index), colKey: col.key, oldValue, newValue });
    this.redoStack = [];
    this.cellValueChanged.emit({ row, rowIndex: index, col, oldValue, newValue, newRow });
  }
  commitEditAndMove(ri: number, ci: number, raw: string, move: { dr: number; dc: number } | null): void {
    this.commitEdit(ri, ci, raw);
    if (!move) return;
    const items = this.pageItems();
    if (!items.length) return;
    const next = {
      ri: Math.max(0, Math.min(items.length - 1, ri + move.dr)),
      ci: Math.max(this.minCi(), Math.min(this.maxCi(), ci + move.dc)),
    };
    this.activeCell.set(next);
    this.scrollCellIntoView(next.ri, next.ci);
  }
  cancelEdit(ri: number, ci: number): void {
    this.editingCell.set(null);
    this.scrollCellIntoView(ri, ci);
  }
  startEdit(ri: number, ci: number): void {
    const item = this.pageItems()[ri];
    if (!item || item.type !== 'row') return;
    const col = this.displayCols()[ci];
    if (!col || !this.isEditable(col, item.row)) return;
    this.activeCell.set({ ri, ci });
    this.editingCell.set({ ri, ci });
  }

  // -- Filtros por columna ------------------------------------------------------
  textFilterValue(key: string): string {
    const f = this.filters()[key];
    return typeof f === 'string' ? f : '';
  }
  setTextFilter(key: string, v: string): void {
    this.filters.update((f) => ({ ...f, [key]: v }));
  }
  dateRangeValue(key: string): { from?: string; to?: string } {
    const f = this.filters()[key];
    return f && typeof f === 'object' && !Array.isArray(f) && !isMultiFilterValue(f) ? f : {};
  }
  setDateFilter(key: string, which: 'from' | 'to', v: string): void {
    this.filters.update((f) => {
      const cur = f[key];
      const range: { from?: string; to?: string } =
        cur && typeof cur === 'object' && !Array.isArray(cur) && !isMultiFilterValue(cur) ? { ...cur } : {};
      if (v) range[which] = v;
      else delete range[which];
      const next = { ...f };
      if (range.from || range.to) next[key] = range;
      else delete next[key];
      return next;
    });
  }
  setFilterActive(key: string): boolean {
    return Array.isArray(this.filters()[key]);
  }
  setFilterLabel(key: string): string {
    const f = this.filters()[key];
    const sel = Array.isArray(f) ? f : null;
    return sel ? `${sel.length} seleccionados` : 'Todos';
  }
  setFilterTotal(key: string): number {
    return this.setFilterValues().get(key)?.size ?? 0;
  }
  setFilterAllValues(key: string): string[] {
    const counts = this.setFilterValues().get(key);
    return counts ? [...counts.keys()] : [];
  }
  setFilterRows(key: string): { value: string; count: number; checked: boolean }[] {
    const counts = this.setFilterValues().get(key);
    if (!counts) return [];
    const allValues = [...counts.keys()].sort((a, b) => compareValues(a, b));
    const cur = this.filters()[key];
    const sel = new Set(Array.isArray(cur) ? cur : allValues);
    const q = this.setSearch().trim().toLowerCase();
    const shown = q ? allValues.filter((v) => v.toLowerCase().includes(q)) : allValues;
    return shown.map((v) => ({ value: v, count: counts.get(v) ?? 0, checked: sel.has(v) }));
  }
  toggleSetValue(key: string, value: string, allValues: string[]): void {
    this.filters.update((f) => {
      const cur = f[key];
      const sel = new Set(Array.isArray(cur) ? cur : allValues);
      if (sel.has(value)) sel.delete(value);
      else sel.add(value);
      const next = { ...f };
      if (sel.size === allValues.length) delete next[key];
      else next[key] = [...sel];
      return next;
    });
  }
  setAllSetValues(key: string, mode: 'all' | 'none'): void {
    this.filters.update((f) => {
      const next = { ...f };
      if (mode === 'all') delete next[key];
      else next[key] = [];
      return next;
    });
  }

  // -- Redimensionar columnas ---------------------------------------------------
  startResize(e: PointerEvent, key: string): void {
    e.preventDefault();
    e.stopPropagation();
    const col = this.colMap().get(key);
    const minW = col?.minWidth ?? 64;
    const base = this.ensureFixedWidths();
    const startX = e.clientX;
    const startW = base[key] ?? DEFAULT_COL_W;
    this.resizing.set(key);
    const onMove = (ev: PointerEvent) => {
      const w = Math.max(minW, startW + ev.clientX - startX);
      this.widths.update((prev) => ({ ...prev, [key]: w }));
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      this.resizing.set(null);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp, { once: true });
  }

  // -- Reordenar columnas (drag & drop) ------------------------------------------
  onHeaderDragStart(e: DragEvent, key: string): void {
    this.dragCol.set(key);
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', key);
    }
  }
  onHeaderDragOver(e: DragEvent, key: string): void {
    const dc = this.dragCol();
    if (!dc || dc === key) return;
    e.preventDefault();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const side: 'left' | 'right' = e.clientX < rect.left + rect.width / 2 ? 'left' : 'right';
    const cur = this.dropTarget();
    if (!(cur?.key === key && cur.side === side)) this.dropTarget.set({ key, side });
  }
  onHeaderDrop(e: DragEvent, key: string): void {
    e.preventDefault();
    const dc = this.dragCol();
    const dt = this.dropTarget();
    if (dc && dc !== key && dt?.key === key) {
      this.order.update((prev) => {
        const next = prev.filter((k) => k !== dc);
        const idx = next.indexOf(key) + (dt.side === 'right' ? 1 : 0);
        next.splice(idx, 0, dc);
        return next;
      });
    }
    this.dragCol.set(null);
    this.dropTarget.set(null);
  }
  onDragEnd(): void {
    this.dragCol.set(null);
    this.dropTarget.set(null);
    this.groupZoneHover.set(false);
  }
  onGroupZoneDragOver(e: DragEvent): void {
    if (this.dragIsGroupable()) {
      e.preventDefault();
      this.groupZoneHover.set(true);
    }
  }
  onGroupZoneDragLeave(): void {
    this.groupZoneHover.set(false);
  }
  onGroupZoneDrop(e: DragEvent): void {
    e.preventDefault();
    const dc = this.dragCol();
    if (dc && this.dragIsGroupable()) this.addGroup(dc);
    this.dragCol.set(null);
    this.dropTarget.set(null);
    this.groupZoneHover.set(false);
  }

  // -- Clases / valores de celda --------------------------------------------------
  tdClass(col: AtGridColumn<T>): string {
    const clip = this.fixedLayout() ? ' ag-clip' : '';
    if (col.numeric) return `ag-td-num${clip}${col.tdClassName ? ' ' + col.tdClassName : ''}`;
    const align = col.align === 'right' ? ' ag-td-right' : '';
    const strong = col.strong ? ' ag-td-strong' : '';
    return `ag-td${strong}${align}${clip}${col.tdClassName ? ' ' + col.tdClassName : ''}`;
  }
  dataTdClasses(col: AtGridColumn<T>, row: T): string {
    const extra = col.cellClass ? col.cellClass(row) : '';
    const editable = this.isEditable(col, row) ? 'ag-td-editable' : '';
    return [this.tdClass(col), extra || '', this.pinClass(col.key), editable].filter(Boolean).join(' ');
  }
  aggCellText(col: AtGridColumn<T>, rows: T[]): string {
    if (!col.aggregate) return '';
    const v = aggNum(col, rows);
    if (col.aggregateFormat) return col.aggregateFormat(v);
    return v.toLocaleString('es-HN', { maximumFractionDigits: 2 });
  }
  flatItemKey(item: FlatItem<T>): string {
    if (item.type === 'group') return 'g:' + item.node.path;
    const rk = this.rowKey();
    return 'r:' + (rk ? String(rk(item.row, item.index)) : String(item.index));
  }

  // -- Popovers -------------------------------------------------------------------
  popoverWidth(kind: PopoverKind): number {
    switch (kind) {
      case 'menu':
        return 208;
      case 'set':
        return 248;
      default:
        return 232;
    }
  }
  openMenuPopover(e: MouseEvent, key: string): void {
    e.stopPropagation();
    const cur = this.popover();
    this.popover.set(cur?.kind === 'menu' && cur.key === key ? null : { kind: 'menu', key, anchor: e.currentTarget as HTMLElement });
  }
  openSetPopover(e: MouseEvent, key: string): void {
    this.setSearch.set('');
    const cur = this.popover();
    this.popover.set(cur?.kind === 'set' && cur.key === key ? null : { kind: 'set', key, anchor: e.currentTarget as HTMLElement });
  }
  openColumnsPopover(e: MouseEvent): void {
    const cur = this.popover();
    this.popover.set(cur?.kind === 'columns' ? null : { kind: 'columns', anchor: e.currentTarget as HTMLElement });
  }
  openExportPopover(e: MouseEvent): void {
    const cur = this.popover();
    this.popover.set(cur?.kind === 'export' ? null : { kind: 'export', anchor: e.currentTarget as HTMLElement });
  }
  closePopover(): void {
    this.popover.set(null);
  }
}

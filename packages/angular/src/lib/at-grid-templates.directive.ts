import { Directive, Input, TemplateRef } from '@angular/core';

/**
 * Celda personalizada para una columna de AtGrid.
 *
 *   <at-grid [columns]="columns" [rows]="rows">
 *     <ng-template atGridCell="estado" let-row>
 *       <at-status-tag [tone]="tono(row)">{{ row.estado }}</at-status-tag>
 *     </ng-template>
 *   </at-grid>
 *
 * Si una columna no tiene `<ng-template atGridCell="...">` correspondiente, AtGrid
 * muestra el valor crudo de la fila (`row[col.key]`).
 */
@Directive({
  selector: 'ng-template[atGridCell]',
  standalone: true,
})
export class AtGridCellDirective<T = unknown> {
  @Input('atGridCell') key = '';
  constructor(public readonly tpl: TemplateRef<{ $implicit: T; row: T }>) {}
}

/**
 * Celda de la fila de totales al pie para una columna (recibe las filas filtradas).
 *
 *   <ng-template atGridFooter="total_usd" let-rows>
 *     {{ sumar(rows) | currency }}
 *   </ng-template>
 */
@Directive({
  selector: 'ng-template[atGridFooter]',
  standalone: true,
})
export class AtGridFooterDirective<T = unknown> {
  @Input('atGridFooter') key = '';
  constructor(public readonly tpl: TemplateRef<{ $implicit: T[]; rows: T[] }>) {}
}

/**
 * Acciones extra en la barra de selección, junto a "limpiar selección".
 *
 *   <ng-template atGridSelectionActions let-rows>
 *     <button (click)="marcarPagado(rows)">Marcar pagado</button>
 *   </ng-template>
 */
@Directive({
  selector: 'ng-template[atGridSelectionActions]',
  standalone: true,
})
export class AtGridSelectionActionsDirective<T = unknown> {
  constructor(public readonly tpl: TemplateRef<{ $implicit: T[]; rows: T[] }>) {}
}

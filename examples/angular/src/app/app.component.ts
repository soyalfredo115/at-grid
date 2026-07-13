import { Component } from '@angular/core';
import { AtGridComponent, type AtGridColumn } from '@soyalfredo115/at-grid-angular';

type Fila = {
  id: number;
  cliente: string;
  estado: 'pagado' | 'pendiente' | 'vencido';
  fecha: string;
  monto: number;
};

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [AtGridComponent],
  template: `
    <div style="padding: 24px; font-family: sans-serif;">
      <h1>AtGrid — smoke test (Angular)</h1>
      <at-grid [columns]="columns" [rows]="rows" storageKey="smoke-test-ng" [selectable]="true" />
    </div>
  `,
  styles: [],
})
export class AppComponent {
  rows: Fila[] = [
    { id: 1, cliente: 'La Curacao', estado: 'pagado', fecha: '2026-01-05', monto: 18240 },
    { id: 2, cliente: 'Simán', estado: 'pendiente', fecha: '2026-02-11', monto: 9320.5 },
    { id: 3, cliente: 'Súper Selectos', estado: 'vencido', fecha: '2025-12-20', monto: 4110 },
    { id: 4, cliente: 'Walmart CA', estado: 'pagado', fecha: '2026-03-02', monto: 52000 },
    { id: 5, cliente: 'Office Depot', estado: 'pendiente', fecha: '2026-03-18', monto: 1875.25 },
  ];

  columns: AtGridColumn<Fila>[] = [
    { key: 'cliente', label: 'Cliente', strong: true, groupable: true, sortable: true, filterable: true },
    { key: 'estado', label: 'Estado', filterType: 'set', filterable: true, groupable: true },
    { key: 'fecha', label: 'Fecha', filterType: 'date', sortable: true },
    {
      key: 'monto',
      label: 'Monto USD',
      numeric: true,
      sortable: true,
      aggregate: 'sum',
      aggregateFormat: (v) => `$${v.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
    },
  ];
}

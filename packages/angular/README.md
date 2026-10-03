# @soyalfredo115/at-grid-angular

Puerto a Angular (standalone components, signals) del componente `AtGrid` — misma funcionalidad que `@soyalfredo115/at-grid-react`: orden (incl. multi-sort), reordenar/redimensionar/fijar columnas, agrupación con subtotales, búsqueda global, filtros por columna tipados, selección de filas con barra de agregados, export a Excel (`.xlsx` propio, sin librerías) y copia TSV, autosize, tooltips, grupos de encabezado de 2 niveles, y persistencia de estado en `localStorage`.

## Instalación

```
npm install @soyalfredo115/at-grid-angular
```

### Peer dependencies

```
@angular/core ^18.0.0 || ^19.0.0 || ^20.0.0 || ^21.0.0 || ^22.0.0
@angular/common ^18.0.0 || ^19.0.0 || ^20.0.0 || ^21.0.0 || ^22.0.0
```

Se compila con Angular 18 en modo parcial, así que el mismo paquete sirve de la 18 a la 22 (probado con 22.2, sin zone.js).

Sin dependencias de terceros para íconos/overlay: los íconos son `<svg>` inline y el popover usa un `Directive` propio (`AtGridPortalDirective`) para portal a `document.body`, no `@angular/cdk`.

## Uso

```ts
import { AtGridComponent, type AtGridColumn } from '@soyalfredo115/at-grid-angular';

@Component({
  standalone: true,
  imports: [AtGridComponent],
  template: `
    <at-grid [columns]="columns" [rows]="rows" storageKey="cxc" selectable (rowClick)="onRowClick($event)" />
  `,
})
export class MiTablaComponent {
  columns: AtGridColumn<Fila>[] = [
    { key: 'partner', label: 'Cliente', strong: true, groupable: true },
    { key: 'state', label: 'Estado', filterType: 'set' },
    { key: 'amount_usd', label: 'USD', numeric: true, aggregate: 'sum', aggregateFormat: fmtUSD },
  ];
  rows: Fila[] = [];
}
```

### Celdas custom

A diferencia de la versión React (que pasa una función `render` en la columna), acá las celdas/pies/acciones de selección personalizadas se proyectan como contenido dentro de `<at-grid>`:

```html
<at-grid [columns]="columns" [rows]="rows">
  <ng-template atGridCell="state" let-row>
    <span class="badge">{{ row.state }}</span>
  </ng-template>
</at-grid>
```

Ver `AtGridCellDirective`, `AtGridFooterDirective`, `AtGridSelectionActionsDirective`.

## Diferencias conocidas vs. la versión React

- **Sin i18n**: los textos de la UI están hardcodeados en español en el template. La versión React usa `react-i18next` con namespace `grid` (`es`/`en`). Si se necesita i18n en Angular, hay que agregarlo (no viene incluido).
- **Celdas custom**: proyección de contenido (`ng-template`) en vez de props `render`/`footer` (ver arriba).

## Estilos

Los estilos vienen dentro del componente. Los colores se toman de variables CSS del consumidor, con valores por defecto si no existen: `--bg`, `--bg-2`, `--surface`, `--border`, `--border-2`, `--text`, `--text-2`, `--text-3`, `--primary`, `--primary-dark`, `--primary-darker`, `--primary-light`, `--primary-tint`, `--success`, `--radius`, `--radius-sm`, `--radius-xs`, `--shadow-md`, `--ring-primary`. Se definen en `:root` o en un contenedor:

```css
:root {
  --primary: #1f4e79;
  --surface: #fff;
}
```

Los botones internos parten de cero (`padding`, `background`, `border`…), así que las reglas globales de `button` de la app no los deforman.

## Exports

- `AtGridComponent` — componente principal (selector `at-grid`).
- `AtGridPaginationComponent`, `AtGridPopoverComponent`, `AtGridPortalDirective` — usados internamente, también reusables sueltos.
- `AtGridCellDirective`, `AtGridFooterDirective`, `AtGridSelectionActionsDirective` — directivas de proyección de contenido.
- `downloadXlsx`, `makeXlsx` — generador de `.xlsx` sin librerías.
- Tipos: `AtGridColumn`, `AtGridFilterType`, `AtGridAggregate`, `SortState`, `ColumnFilterValue`, `PinSide`, `PersistedState`, `GroupNode`, `FlatItem`, `PopoverKind`, `PopoverState`.

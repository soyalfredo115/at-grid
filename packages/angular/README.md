# @soyalfredo115/at-grid-angular

Puerto a Angular (standalone components, signals) del componente `AtGrid` — misma funcionalidad que `@soyalfredo115/at-grid-react`: orden (incl. multi-sort), reordenar/redimensionar/fijar columnas, agrupación con subtotales, búsqueda global, filtros por columna tipados, selección de filas con barra de agregados, export a Excel (`.xlsx` propio, sin librerías) y copia TSV, autosize, tooltips, grupos de encabezado de 2 niveles, y persistencia de estado en `localStorage`.

## Instalación

```
npm install @soyalfredo115/at-grid-angular
```

### Peer dependencies

```
@angular/core ^18.0.0 || ^19.0.0
@angular/common ^18.0.0 || ^19.0.0
```

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

Igual que la versión React: usa clases Tailwind del sistema de diseño Atelier (`paper`, `card`, `line`, `ink`, `clay`, etc.) y estilos `.at-table` / `.at-pin` / `.at-group`. Sin esos tokens/estilos el componente funciona pero pierde su apariencia — hay que portar los tokens y esas clases al proyecto consumidor.

## Exports

- `AtGridComponent` — componente principal (selector `at-grid`).
- `AtGridPaginationComponent`, `AtGridPopoverComponent`, `AtGridPortalDirective` — usados internamente, también reusables sueltos.
- `AtGridCellDirective`, `AtGridFooterDirective`, `AtGridSelectionActionsDirective` — directivas de proyección de contenido.
- `downloadXlsx`, `makeXlsx` — generador de `.xlsx` sin librerías.
- Tipos: `AtGridColumn`, `AtGridFilterType`, `AtGridAggregate`, `SortState`, `ColumnFilterValue`, `PinSide`, `PersistedState`, `GroupNode`, `FlatItem`, `PopoverKind`, `PopoverState`.

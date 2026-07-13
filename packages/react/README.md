# @soyalfredo115/at-grid-react

Tabla declarativa con superpoderes: orden (incl. multi-sort), reordenar/redimensionar/fijar columnas, agrupación con subtotales, búsqueda global, filtros por columna tipados, selección de filas con barra de agregados, export a Excel (`.xlsx` propio, sin librerías) y copia TSV, autosize, tooltips, grupos de encabezado de 2 niveles, y persistencia de estado en `localStorage`.

## Instalación

```
npm install @soyalfredo115/at-grid-react
```

### Peer dependencies

```
react ^18.3.1
react-dom ^18.3.1
react-i18next ^17.0.8
i18next ^26.3.4
@formkit/auto-animate ^0.9.0
lucide-react ^0.447.0
```

## Uso

```tsx
import '@soyalfredo115/at-grid-react/styles.css' // una sola vez en la app
import { AtGrid } from '@soyalfredo115/at-grid-react'

<AtGrid
  columns={[
    { key: 'partner', label: 'Cliente', strong: true, groupable: true },
    { key: 'state', label: 'Estado', filterType: 'set' },
    { key: 'date', label: 'Fecha', filterType: 'date' },
    { key: 'amount_usd', label: 'USD', numeric: true, aggregate: 'sum', aggregateFormat: fmtUSD },
  ]}
  rows={rows}
  storageKey="cxc"
  selectable
  onRowClick={setSelected}
/>
```

## i18n

Los textos de la UI viven en el namespace i18next `grid`. Registrá los bundles en el `i18next.init({...})` del proyecto destino:

```ts
import gridEs from '@soyalfredo115/at-grid-react/locales/es/grid.json'
import gridEn from '@soyalfredo115/at-grid-react/locales/en/grid.json'

i18next.init({
  resources: {
    es: { grid: gridEs },
    en: { grid: gridEn },
  },
  // ...
})
```

## Estilos

Importá `@soyalfredo115/at-grid-react/styles.css` una vez en la app — es CSS ya compilado, **no hace falta tener Tailwind instalado ni configurado** en el proyecto consumidor.

El look sale de variables CSS, con defaults incluidos (no hay que definir nada para que se vea bien). Para adaptarlo al tema de tu app, sobreescribí cualquiera de estas variables en tu propio CSS (por ejemplo en `:root`):

```css
:root {
  --bg: #ffffff;
  --bg-2: #f4f4f5;
  --surface: #ffffff;
  --border: #e4e4e7;
  --border-2: #d4d4d8;
  --text: #18181b;
  --text-2: #52525b;
  --text-3: #a1a1aa;
  --primary: #2563eb;
  --primary-dark: #1d4ed8;
  --primary-tint: #dbeafe;
  --success: #16a34a;
}
```

No se necesita redefinir todas — cualquier subconjunto que no se toque cae al default (look cálido tipo "Atelier", tonos papel/tinta/terracota).

## Exports

- `AtGrid` — componente principal.
- `AtTable`, `AtTh`, `AtRow`, `AtTd`, `NumCell`, `compareValues`, `useSortTable` — primitivas de tabla usadas internamente por AtGrid, también reusables sueltas.
- `Pagination` — barra de paginación.
- `downloadXlsx` — generador de `.xlsx` sin librerías.
- Tipos: `AtGridColumn`, `AtGridFilterType`, `AtGridAggregate`, `SortState`, `ColumnFilterValue`, `PinSide`, `GroupNode`, `FlatItem`.

# AtGrid — sitio web

Landing page + documentación de AtGrid, con una demo en vivo de `@soyalfredo115/at-grid-react` (64 filas: orden multi-columna, filtros tipados, agrupación con subtotales, selección con agregados, export Excel y persistencia en `localStorage`).

Diseño monocromo (papel / fósforo) con modo claro y oscuro, tipografía de consola (Martian Mono + Spline Sans Mono).

## Desarrollo

Desde la raíz del monorepo (los paquetes deben estar compilados):

```bash
pnpm install
pnpm -r --filter=./packages/* build
pnpm --filter at-grid-website dev
```

## Build de producción

```bash
pnpm --filter at-grid-website build
```

Genera `website/dist` como sitio estático con `base: './'`, así que se puede servir desde cualquier subruta (GitHub Pages, Netlify, etc.).

## Estructura

- `src/App.tsx` — composición de la página (hero, demo, características, inicio rápido, API, footer) y toggle de tema.
- `src/demo/LiveDemo.tsx` + `src/demo/data.ts` — la demo real de `<AtGrid />` con datos determinísticos de facturas.
- `src/sections/Quickstart.tsx` — instalación y uso con tabs React / Angular.
- `src/sections/ApiDocs.tsx` — referencia de API (props del grid, columnas, filtros, teclado, export, theming, persistencia).
- `src/styles.css` — sistema de diseño del sitio: tokens OKLCH por tema y las variables CSS que re-temean el grid a monocromo.

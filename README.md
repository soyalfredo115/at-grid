# AtGrid

Tabla declarativa con superpoderes — orden multi-columna, reordenar/redimensionar/fijar columnas, agrupación con subtotales, búsqueda global, filtros por columna tipados, selección con barra de agregados, export a Excel (`.xlsx` propio, sin librerías) y copia TSV, autosize, tooltips, grupos de encabezado de 2 niveles, persistencia de estado en `localStorage`.

Misma funcionalidad en **React** y **Angular**, con el mismo look, adaptable al tema de tu app vía variables CSS (no viene amarrado a ningún sistema de diseño en particular).

## Paquetes

| Paquete | Framework | npm |
|---|---|---|
| [`@soyalfredo115/at-grid-react`](packages/react) | React 18 | [![npm](https://img.shields.io/npm/v/@soyalfredo115/at-grid-react)](https://www.npmjs.com/package/@soyalfredo115/at-grid-react) |
| [`@soyalfredo115/at-grid-angular`](packages/angular) | Angular 18/19 (standalone, signals) | [![npm](https://img.shields.io/npm/v/@soyalfredo115/at-grid-angular)](https://www.npmjs.com/package/@soyalfredo115/at-grid-angular) |
| [`@soyalfredo115/at-grid-types`](packages/types) | tipos compartidos | [![npm](https://img.shields.io/npm/v/@soyalfredo115/at-grid-types)](https://www.npmjs.com/package/@soyalfredo115/at-grid-types) |

## Instalación

```bash
npm install @soyalfredo115/at-grid-react
# o
npm install @soyalfredo115/at-grid-angular
```

Ver el README de cada paquete para uso, props/inputs y cómo re-temear los colores.

## Desarrollo (este monorepo)

```bash
pnpm install
pnpm -r --filter=./packages/* build
```

`examples/react` y `examples/angular` son apps mínimas de referencia que consumen los paquetes del workspace — útiles para probar cambios en vivo:

```bash
pnpm --filter at-grid-example-react dev
pnpm --filter at-grid-example-angular start
```

## Licencia

MIT

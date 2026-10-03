import { CodeBlock } from '../components/CodeBlock'

type Row = { prop: string; type: string; desc: string }

function ApiTable({ rows, propHeader = 'Prop' }: { rows: Row[]; propHeader?: string }) {
  return (
    <div className="table-scroll">
      <table className="api-table">
        <thead>
          <tr>
            <th>{propHeader}</th>
            <th>Tipo</th>
            <th>Descripción</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.prop}>
              <td>
                <code>{r.prop}</code>
              </td>
              <td className="t-type">{r.type}</td>
              <td className="t-desc">{r.desc}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const GRID_PROPS: Row[] = [
  { prop: 'columns', type: 'AtGridColumn<T>[]', desc: 'Definición de columnas. Única prop obligatoria junto con rows.' },
  { prop: 'rows', type: 'T[]', desc: 'Filas. Cualquier objeto: cada columna lee row[key] salvo que definas accessors.' },
  { prop: 'storageKey', type: 'string', desc: 'Clave de persistencia en localStorage (una por tabla). Guarda orden y ancho de columnas, sort, agrupación, columnas ocultas y fijadas, y tamaño de página.' },
  { prop: 'rowKey', type: '(row, index) => string | number', desc: 'Identidad estable de fila (para selección y render). Default: el índice.' },
  { prop: 'pageSize', type: 'number', desc: 'Filas por página. Sin definir = sin paginación. Las filas de grupo también cuentan.' },
  { prop: 'selectable', type: 'boolean', desc: 'Checkboxes de selección + barra flotante con agregados de lo seleccionado.' },
  { prop: 'onRowClick', type: '(row) => void', desc: 'Click en una fila.' },
  { prop: 'rowClassName', type: '(row) => string', desc: 'Clases extra por fila (p. ej. resaltar la seleccionada).' },
  { prop: 'exportFileName', type: 'string', desc: 'Nombre del archivo del export Excel. Default: storageKey.' },
  { prop: 'onSelectionChange', type: '(rows: T[]) => void', desc: 'Notifica cada cambio de selección (p. ej. habilitar acciones en lote).' },
  { prop: 'selectionActions', type: '(rows: T[]) => ReactNode', desc: 'Acciones extra renderizadas en la barra de selección.' },
  { prop: 'clearSelectionSignal', type: 'number', desc: 'Cambiar este valor limpia la selección actual (p. ej. tras una acción en lote exitosa).' },
]

const COLUMN_PROPS: Row[] = [
  { prop: 'key', type: 'string', desc: 'Clave de la columna; por defecto lee row[key].' },
  { prop: 'label', type: 'string', desc: 'Encabezado visible.' },
  { prop: 'group', type: 'string', desc: 'Grupo de encabezado (2º nivel): columnas contiguas con el mismo grupo comparten cabecera.' },
  { prop: 'numeric', type: 'boolean', desc: 'Monto: alineado a la derecha, sin corte de línea, filtro numérico por defecto.' },
  { prop: 'strong', type: 'boolean', desc: 'Texto con énfasis (columna principal).' },
  { prop: 'align', type: "'left' | 'right'", desc: 'Alineación explícita de la celda.' },
  { prop: 'minWidth', type: 'number', desc: 'Ancho mínimo en px al redimensionar. Default 140.' },
  { prop: 'sortable', type: 'boolean', desc: 'Default true. Click en el header ordena; Shift+click agrega multi-sort.' },
  { prop: 'filterable', type: 'boolean', desc: 'Default true. Muestra el filtro de columna en la fila de filtros.' },
  { prop: 'filterType', type: "'text' | 'number' | 'date' | 'set'", desc: "Tipo de filtro. Default: 'number' si numeric, si no 'text'." },
  { prop: 'groupable', type: 'boolean', desc: 'Permite agrupar por esta columna (arrastrando el header a la barra o desde el menú).' },
  { prop: 'aggregate', type: "'sum' | 'avg' | 'count' | 'min' | 'max' | (rows) => number", desc: 'Agregado mostrado en la fila de grupo y en la barra de selección.' },
  { prop: 'aggregateFormat', type: '(v: number) => ReactNode', desc: 'Formato del agregado (p. ej. moneda).' },
  { prop: 'render', type: '(row) => ReactNode', desc: 'Celda custom (solo React; en Angular se usa ng-template con atGridCell).' },
  { prop: 'footer', type: '(rows: T[]) => ReactNode', desc: 'Celda de la fila de totales al pie; recibe las filas filtradas.' },
  { prop: 'sortValue', type: '(row) => unknown', desc: 'Valor usado para ordenar (default: el valor crudo).' },
  { prop: 'filterValue', type: '(row) => string', desc: 'Texto contra el que filtran búsqueda global y filtro de texto.' },
  { prop: 'numValue', type: '(row) => number', desc: 'Valor numérico para agregados y filtro numérico.' },
  { prop: 'groupValue', type: '(row) => string', desc: 'Etiqueta del grupo al agrupar por esta columna.' },
  { prop: 'exportValue', type: '(row) => string | number', desc: 'Valor crudo para export Excel / copia TSV. Default: numValue si numeric, si no el valor de la celda.' },
  { prop: 'cellClass', type: '(row) => string | false', desc: 'Clases condicionales por celda (p. ej. saldos vencidos en negrita).' },
  { prop: 'tdClassName', type: 'string', desc: 'Clases fijas de la celda.' },
]

const FILTER_ROWS: Row[] = [
  { prop: 'text', type: 'string', desc: 'Contiene (sin distinguir mayúsculas ni acentos según el valor). Es el default.' },
  { prop: 'number', type: 'string', desc: 'Expresiones: >1000, >=5, <0, <=10, !=10, =7, 100..200 (rango) o un número solo (igualdad). Default si la columna es numeric.' },
  { prop: 'date', type: '{ from?, to? }', desc: 'Rango de fechas ISO con inputs Desde / Hasta.' },
  { prop: 'set', type: 'string[]', desc: 'Popover con checkboxes de valores únicos y conteo por valor; botones Todos / Ninguno.' },
]

const KEYS: Row[] = [
  { prop: '↑ / ↓', type: 'navegación', desc: 'Mueve la fila activa.' },
  { prop: 'Enter', type: 'acción', desc: 'Abre la fila (onRowClick) o expande/colapsa el grupo.' },
  { prop: 'Espacio', type: 'selección', desc: 'Selecciona / deselecciona la fila activa (con selectable).' },
  { prop: 'PageUp / PageDown', type: 'paginación', desc: 'Página anterior / siguiente.' },
  { prop: 'Shift + click en header', type: 'orden', desc: 'Agrega la columna al multi-sort en vez de reemplazar el orden.' },
  { prop: 'Doble click en el borde del header', type: 'columnas', desc: 'Autosize: ajusta la columna al contenido.' },
]

const THEME_CSS = `/* El look sale de variables CSS con defaults incluidos.
   Sobreescribí cualquier subconjunto en tu propio :root — lo que
   no toques cae al default (look cálido tipo "Atelier"). */
:root {
  --bg: #ffffff;        --bg-2: #f4f4f5;
  --surface: #ffffff;
  --border: #e4e4e7;    --border-2: #d4d4d8;
  --text: #18181b;      --text-2: #52525b;   --text-3: #a1a1aa;
  --primary: #2563eb;   --primary-dark: #1d4ed8;
  --primary-tint: #dbeafe;
  --success: #16a34a;
}

/* Este mismo sitio re-temea el grid a monocromo así:
   el demo de arriba no usa ni una línea de CSS custom del grid,
   solo estas variables. */`

const EXPORT_CODE = `// El generador .xlsx también se exporta suelto — cero dependencias:
import { downloadXlsx } from '@soyalfredo115/at-grid-react'

downloadXlsx(
  'reporte.xlsx',
  ['Cliente', 'Monto'],
  [['La Curacao', 18240], ['Simán', 9320.5]],
)

// Desde la UI del grid: menú Exportar → Excel (filas visibles o selección)
// y Copiar (TSV al portapapeles, pega directo en Excel / Sheets).`

export function ApiDocs() {
  return (
    <>
      <div className="api-block" id="api-grid">
        <h3>{'<AtGrid />'}</h3>
        <p>
          Componente principal. En Angular el selector es <code>&lt;at-grid&gt;</code> con los mismos inputs (los
          callbacks son outputs: <code>(rowClick)</code>, <code>(selectionChange)</code>).
        </p>
        <ApiTable rows={GRID_PROPS} />
      </div>

      <div className="api-block" id="api-column">
        <h3>AtGridColumn&lt;T&gt;</h3>
        <p>
          Toda la funcionalidad se declara por columna. Solo <code>key</code> y <code>label</code> son obligatorios; el
          resto son opt-in con defaults sensatos.
        </p>
        <ApiTable rows={COLUMN_PROPS} />
      </div>

      <div className="api-block" id="api-filters">
        <h3>Filtros tipados</h3>
        <p>
          Cada columna filtra según su <code>filterType</code>. La búsqueda global de la barra filtra sobre todas las
          columnas a la vez.
        </p>
        <ApiTable rows={FILTER_ROWS} propHeader="filterType" />
      </div>

      <div className="api-block" id="api-keys">
        <h3>Teclado y ratón</h3>
        <ApiTable rows={KEYS} propHeader="Entrada" />
      </div>

      <div className="api-block" id="api-export">
        <h3>Export Excel y copia TSV</h3>
        <p>
          El <code>.xlsx</code> se genera con código propio (ZIP + XML de SpreadsheetML escritos a mano) — no se
          instala SheetJS ni exceljs. Exporta las filas visibles (ya filtradas y ordenadas) o solo la selección.
        </p>
        <CodeBlock label="export.ts" code={EXPORT_CODE} />
      </div>

      <div className="api-block" id="api-theming">
        <h3>Theming por variables CSS</h3>
        <p>
          El CSS viene compilado — no hace falta Tailwind en el proyecto consumidor. Importá{' '}
          <code>@soyalfredo115/at-grid-react/styles.css</code> una vez y sobreescribí variables para adaptarlo a tu
          tema.
        </p>
        <CodeBlock label="tema.css" code={THEME_CSS} />
      </div>

      <div className="api-block" id="api-persistence">
        <h3>Persistencia de estado</h3>
        <p>
          Con <code>storageKey</code>, el grid guarda en <code>localStorage</code>: orden de columnas, anchos, sort
          (incluido multi-sort), agrupación, columnas ocultas, columnas fijadas y tamaño de página. El botón
          «Restablecer tabla» de la barra vuelve todo al estado declarado en el código.
        </p>
      </div>

      <div className="api-block" id="api-exports">
        <h3>Otros exports del paquete</h3>
        <p>
          Las primitivas internas también se exportan sueltas: <code>AtTable</code>, <code>AtTh</code>,{' '}
          <code>AtRow</code>, <code>AtTd</code>, <code>NumCell</code>, <code>compareValues</code>,{' '}
          <code>useSortTable</code> y <code>Pagination</code> en React; <code>AtGridPaginationComponent</code>,{' '}
          <code>AtGridPopoverComponent</code> y <code>AtGridPortalDirective</code> en Angular. Los tipos compartidos (
          <code>SortState</code>, <code>ColumnFilterValue</code>, <code>GroupNode</code>, <code>FlatItem</code>…) viven
          en <code>@soyalfredo115/at-grid-types</code>.
        </p>
      </div>
    </>
  )
}

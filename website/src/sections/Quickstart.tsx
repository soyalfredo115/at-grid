import { useState } from 'react'
import { CodeBlock } from '../components/CodeBlock'

const REACT_INSTALL = `npm install @soyalfredo115/at-grid-react

# peer dependencies
npm install react react-dom react-i18next i18next @formkit/auto-animate lucide-react`

const REACT_USAGE = `import '@soyalfredo115/at-grid-react/styles.css' // una sola vez en la app
import { AtGrid } from '@soyalfredo115/at-grid-react'
import type { AtGridColumn } from '@soyalfredo115/at-grid-react'

const columns: AtGridColumn<Factura>[] = [
  { key: 'cliente', label: 'Cliente', strong: true, groupable: true },
  { key: 'estado',  label: 'Estado', filterType: 'set' },
  { key: 'fecha',   label: 'Fecha',  filterType: 'date' },
  { key: 'monto',   label: 'USD', numeric: true, aggregate: 'sum',
    aggregateFormat: fmtUSD },
]

<AtGrid
  columns={columns}
  rows={rows}
  storageKey="cxc"      // persiste orden, anchos, sort, agrupación...
  pageSize={12}
  selectable
  onRowClick={setSelected}
/>`

const REACT_I18N = `// Los textos de la UI viven en el namespace i18next "grid".
// Registrá los bundles en el init() de tu app:
import gridEs from '@soyalfredo115/at-grid-react/locales/es/grid.json'
import gridEn from '@soyalfredo115/at-grid-react/locales/en/grid.json'

i18next.init({
  resources: {
    es: { grid: gridEs },
    en: { grid: gridEn },
  },
})`

const NG_INSTALL = `npm install @soyalfredo115/at-grid-angular

# peer dependencies: solo Angular — sin @angular/cdk, sin librerías de iconos
# @angular/core ^18 || ^19   ·   @angular/common ^18 || ^19`

const NG_USAGE = `import { AtGridComponent, type AtGridColumn } from '@soyalfredo115/at-grid-angular';

@Component({
  standalone: true,
  imports: [AtGridComponent],
  template: \`
    <at-grid
      [columns]="columns"
      [rows]="rows"
      storageKey="cxc"
      selectable
      (rowClick)="onRowClick($event)"
    />
  \`,
})
export class MiTablaComponent {
  columns: AtGridColumn<Factura>[] = [
    { key: 'cliente', label: 'Cliente', strong: true, groupable: true },
    { key: 'estado',  label: 'Estado', filterType: 'set' },
    { key: 'monto',   label: 'USD', numeric: true, aggregate: 'sum' },
  ];
  rows: Factura[] = [];
}`

const NG_TEMPLATES = `<!-- Celdas custom: proyección de contenido con ng-template,
     en lugar de la prop render de la versión React -->
<at-grid [columns]="columns" [rows]="rows">
  <ng-template atGridCell="estado" let-row>
    <span class="badge">{{ row.estado }}</span>
  </ng-template>
</at-grid>

<!-- También: atGridFooter (fila de totales) y
     atGridSelectionActions (acciones en la barra de selección) -->`

export function Quickstart() {
  const [tab, setTab] = useState<'react' | 'angular'>('react')

  return (
    <>
      <div className="tabs" role="tablist" aria-label="Framework">
        <button className="tab" role="tab" aria-selected={tab === 'react'} onClick={() => setTab('react')}>
          React 18
        </button>
        <button className="tab" role="tab" aria-selected={tab === 'angular'} onClick={() => setTab('angular')}>
          Angular 18 / 19
        </button>
      </div>

      {tab === 'react' ? (
        <div role="tabpanel">
          <CodeBlock label="instalación" code={REACT_INSTALL} />
          <CodeBlock label="uso básico" code={REACT_USAGE} />
          <CodeBlock label="i18n (es / en)" code={REACT_I18N} />
        </div>
      ) : (
        <div role="tabpanel">
          <CodeBlock label="instalación" code={NG_INSTALL} />
          <CodeBlock label="uso básico (standalone + signals)" code={NG_USAGE} />
          <CodeBlock label="celdas custom" code={NG_TEMPLATES} />
          <p className="note">
            <strong>Diferencias vs. React:</strong> los textos de la UI están en español (sin i18n incluido) y las
            celdas custom se proyectan con <code>ng-template</code> en lugar de props <code>render</code> /{' '}
            <code>footer</code>. Todo lo demás — orden, filtros, agrupación, export, persistencia — es idéntico.
          </p>
        </div>
      )}
    </>
  )
}

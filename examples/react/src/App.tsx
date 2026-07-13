import { AtGrid } from '@soyalfredo115/at-grid-react'
import type { AtGridColumn } from '@soyalfredo115/at-grid-react'

type Fila = {
  id: number
  cliente: string
  estado: 'pagado' | 'pendiente' | 'vencido'
  fecha: string
  monto: number
}

const rows: Fila[] = [
  { id: 1, cliente: 'La Curacao', estado: 'pagado', fecha: '2026-01-05', monto: 18240 },
  { id: 2, cliente: 'Simán', estado: 'pendiente', fecha: '2026-02-11', monto: 9320.5 },
  { id: 3, cliente: 'Súper Selectos', estado: 'vencido', fecha: '2025-12-20', monto: 4110 },
  { id: 4, cliente: 'Walmart CA', estado: 'pagado', fecha: '2026-03-02', monto: 52000 },
  { id: 5, cliente: 'Office Depot', estado: 'pendiente', fecha: '2026-03-18', monto: 1875.25 },
]

const columns: AtGridColumn<Fila>[] = [
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
]

export default function App() {
  return (
    <div style={{ padding: 24, fontFamily: 'sans-serif' }}>
      <h1>AtGrid — smoke test (React)</h1>
      <AtGrid columns={columns} rows={rows} storageKey="smoke-test" selectable />
    </div>
  )
}

import { useMemo, useState } from 'react'
import { AtGrid } from '@soyalfredo115/at-grid-react'
import type { AtGridColumn } from '@soyalfredo115/at-grid-react'
import { makeFacturas, fmtUSD } from './data'
import type { Factura } from './data'

const ESTADO_LABEL: Record<Factura['estado'], string> = {
  pagado: 'Pagado',
  pendiente: 'Pendiente',
  vencido: 'Vencido',
  parcial: 'Parcial',
}

export function LiveDemo() {
  const rows = useMemo(() => makeFacturas(64), [])
  const [selectedCount, setSelectedCount] = useState(0)

  const columns = useMemo<AtGridColumn<Factura>[]>(
    () => [
      { key: 'folio', label: 'Folio', group: 'Documento', minWidth: 110 },
      { key: 'cliente', label: 'Cliente', group: 'Documento', strong: true, groupable: true, minWidth: 180 },
      {
        key: 'estado',
        label: 'Estado',
        group: 'Documento',
        filterType: 'set',
        groupable: true,
        render: (r) => ESTADO_LABEL[r.estado],
        filterValue: (r) => ESTADO_LABEL[r.estado],
        groupValue: (r) => ESTADO_LABEL[r.estado],
      },
      { key: 'fecha', label: 'Emisión', group: 'Documento', filterType: 'date', minWidth: 120 },
      {
        key: 'monto',
        label: 'Monto USD',
        group: 'Importes',
        numeric: true,
        aggregate: 'sum',
        aggregateFormat: fmtUSD,
        render: (r) => fmtUSD(r.monto),
        footer: (rs) => fmtUSD(rs.reduce((a, r) => a + r.monto, 0)),
        minWidth: 130,
      },
      {
        key: 'saldo',
        label: 'Saldo USD',
        group: 'Importes',
        numeric: true,
        aggregate: 'sum',
        aggregateFormat: fmtUSD,
        render: (r) => fmtUSD(r.saldo),
        footer: (rs) => fmtUSD(rs.reduce((a, r) => a + r.saldo, 0)),
        cellClass: (r) => r.saldo > 0 && r.estado === 'vencido' && 'font-bold',
        minWidth: 130,
      },
    ],
    [],
  )

  return (
    <div className="demo-frame">
      <div className="demo-titlebar">
        <span>cuentas-por-cobrar.tsx — 64 filas en vivo</span>
        <span aria-live="polite">{selectedCount > 0 ? `${selectedCount} seleccionadas` : 'sin selección'}</span>
      </div>
      <div className="demo-body">
        <AtGrid
          columns={columns}
          rows={rows}
          rowKey={(r) => r.id}
          storageKey="atgrid-site-demo"
          pageSize={12}
          selectable
          exportFileName="cuentas-por-cobrar"
          onSelectionChange={(rs) => setSelectedCount(rs.length)}
        />
      </div>
    </div>
  )
}

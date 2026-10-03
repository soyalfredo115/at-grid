export type Factura = {
  id: number
  folio: string
  cliente: string
  vendedor: string
  estado: 'pagado' | 'pendiente' | 'vencido' | 'parcial'
  fecha: string
  vence: string
  monto: number
  saldo: number
}

const clientes = [
  'La Curacao',
  'Simán',
  'Selectos',
  'Walmart CA',
  'Office Depot',
  'Grupo Q',
  'Farmacias V.',
  'PriceSmart',
  'Alm. Vidrí',
  'Cemaco',
]

const vendedores = ['A. Cardona', 'M. Rivas', 'J. Portillo', 'C. Menjívar']

const estados: Factura['estado'][] = ['pagado', 'pendiente', 'vencido', 'parcial']

// Generador determinístico (LCG) — mismas filas en cada carga, sin Math.random
function lcg(seed: number) {
  let s = seed
  return () => {
    s = (s * 48271) % 2147483647
    return s / 2147483647
  }
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export function makeFacturas(n = 64): Factura[] {
  const rnd = lcg(20260713)
  const base = new Date('2026-01-05T00:00:00Z').getTime()
  const rows: Factura[] = []
  for (let i = 1; i <= n; i++) {
    const estado = estados[Math.floor(rnd() * estados.length)]
    const fecha = new Date(base + Math.floor(rnd() * 160) * 86400000)
    const vence = new Date(fecha.getTime() + (15 + Math.floor(rnd() * 45)) * 86400000)
    const monto = Math.round((200 + rnd() * 58000) * 100) / 100
    const saldo =
      estado === 'pagado'
        ? 0
        : estado === 'parcial'
          ? Math.round(monto * (0.2 + rnd() * 0.6) * 100) / 100
          : monto
    rows.push({
      id: i,
      folio: `F-${String(2600 + i).padStart(5, '0')}`,
      cliente: clientes[Math.floor(rnd() * clientes.length)],
      vendedor: vendedores[Math.floor(rnd() * vendedores.length)],
      estado,
      fecha: iso(fecha),
      vence: iso(vence),
      monto,
      saldo,
    })
  }
  return rows
}

export const fmtUSD = (v: number) =>
  `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

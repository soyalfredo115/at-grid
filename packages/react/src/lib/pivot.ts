import type { AtGridColumn } from '../AtGrid'

/**
 * `pivotRows` — pivot mode "liviano": reestructura filas planas en una tabla
 * pivote (una columna se expande en N columnas dinámicas, una por valor
 * distinto, con un agregado por celda) y devuelve `columns`/`rows` listos
 * para pasarle directo a `<AtGrid>`.
 *
 * No es un pivot mode en vivo con drag-zones (eso es AG-Grid Enterprise):
 * es una función pura que corre antes de renderizar. Si necesitás que el
 * usuario arme el pivote interactivamente, armá tu propio selector de
 * columnas y volvé a llamar `pivotRows` cuando cambie.
 *
 * Las columnas de agrupación de fila salen con `groupable: true` — si querés
 * agrupación jerárquica real (no solo la fila plana por combinación), pasale
 * el resultado a `<AtGrid groupBy=...>` o dejá que el usuario agrupe desde la UI.
 */

export type PivotAggregate = 'sum' | 'avg' | 'count' | 'min' | 'max'

export interface PivotValueSpec<T> {
  /** Prefijo de la clave de columna generada (se combina con el valor del pivote: `${pivotValue}::${key}`). */
  key: string
  label: string
  value: (row: T) => number
  agg?: PivotAggregate
  format?: (v: number) => string
}

export interface PivotRowGroupSpec<T> {
  key: string
  label: string
  value: (row: T) => string
}

export interface PivotColumnSpec<T> {
  value: (row: T) => string
  /** Etiqueta de columna por valor distinto del pivote (default: el valor tal cual). */
  label?: (pivotValue: string) => string
}

export interface PivotConfig<T> {
  rowGroups: PivotRowGroupSpec<T>[]
  pivotColumn: PivotColumnSpec<T>
  values: PivotValueSpec<T>[]
}

/** Fila de salida de `pivotRows`: valores de agrupación + una entrada numérica por columna dinámica generada. */
export type PivotRow = Record<string, unknown>

function aggregate(values: number[], agg: PivotAggregate): number {
  if (agg === 'count') return values.length
  if (!values.length) return 0
  if (agg === 'min') return Math.min(...values)
  if (agg === 'max') return Math.max(...values)
  const sum = values.reduce((a, b) => a + b, 0)
  return agg === 'avg' ? sum / values.length : sum
}

export function pivotRows<T>(
  rows: T[],
  config: PivotConfig<T>
): { columns: AtGridColumn<PivotRow>[]; rows: PivotRow[] } {
  const { rowGroups, pivotColumn, values } = config

  // Valores distintos del pivote, en orden de aparición.
  const pivotValues: string[] = []
  const seenPivot = new Set<string>()
  for (const r of rows) {
    const v = pivotColumn.value(r)
    if (!seenPivot.has(v)) {
      seenPivot.add(v)
      pivotValues.push(v)
    }
  }

  // Buckets por combinación de valores de rowGroups (fila de salida = una combinación).
  const buckets = new Map<string, { groupValues: string[]; rows: T[] }>()
  const bucketOrder: string[] = []
  for (const r of rows) {
    const groupValues = rowGroups.map((g) => g.value(r))
    const bucketKey = groupValues.join('§')
    let bucket = buckets.get(bucketKey)
    if (!bucket) {
      bucket = { groupValues, rows: [] }
      buckets.set(bucketKey, bucket)
      bucketOrder.push(bucketKey)
    }
    bucket.rows.push(r)
  }

  const outRows: PivotRow[] = bucketOrder.map((bucketKey) => {
    const bucket = buckets.get(bucketKey)!
    const out: PivotRow = {}
    rowGroups.forEach((g, i) => {
      out[g.key] = bucket.groupValues[i]
    })
    for (const pv of pivotValues) {
      const rowsForPivot = bucket.rows.filter((r) => pivotColumn.value(r) === pv)
      for (const vs of values) {
        const cellKey = `${pv}::${vs.key}`
        out[cellKey] = aggregate(rowsForPivot.map(vs.value), vs.agg ?? 'sum')
      }
    }
    return out
  })

  const outColumns: AtGridColumn<PivotRow>[] = [
    ...rowGroups.map(
      (g, i): AtGridColumn<PivotRow> => ({
        key: g.key,
        label: g.label,
        strong: i === 0,
        groupable: true,
        sortable: true,
        filterable: true,
      })
    ),
    ...pivotValues.flatMap((pv) =>
      values.map(
        (vs): AtGridColumn<PivotRow> => ({
          key: `${pv}::${vs.key}`,
          label: `${pivotColumn.label ? pivotColumn.label(pv) : pv} · ${vs.label}`,
          group: pivotColumn.label ? pivotColumn.label(pv) : pv,
          numeric: true,
          sortable: true,
          aggregate: 'sum',
          aggregateFormat: vs.format,
          render: vs.format ? (row) => vs.format!(Number(row[`${pv}::${vs.key}`] ?? 0)) : undefined,
        })
      )
    ),
  ]

  return { columns: outColumns, rows: outRows }
}

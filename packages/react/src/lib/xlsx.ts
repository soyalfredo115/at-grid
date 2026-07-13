/**
 * Generador de archivos .xlsx sin dependencias, 100% código propio.
 *
 * Un .xlsx es un ZIP con XMLs adentro (formato Office Open XML). Aquí se
 * genera el ZIP con entradas SIN comprimir (método STORED), que Excel,
 * LibreOffice y Google Sheets aceptan sin problema. Solo cubre lo que el
 * export de AtGrid necesita: una hoja, encabezados en negrita, strings
 * inline y números como números reales.
 *
 *   const blob = makeXlsx('Datos', ['Cliente', 'Monto'], [['ACME', 1200.5]])
 */

export type XlsxCell = string | number | null | undefined

// ---------------------------------------------------------------------------
// XML de la hoja y del libro
// ---------------------------------------------------------------------------

/** Escapa texto para XML y elimina caracteres de control inválidos. */
function esc(s: string): string {
  return s
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Referencia de columna estilo Excel: 0 → A, 25 → Z, 26 → AA… */
function colRef(idx: number): string {
  let n = idx + 1
  let s = ''
  while (n > 0) {
    const m = (n - 1) % 26
    s = String.fromCharCode(65 + m) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}

function cellXml(ref: string, v: XlsxCell, styleId?: number): string {
  const s = styleId ? ` s="${styleId}"` : ''
  if (v === null || v === undefined || v === '') return ''
  if (typeof v === 'number' && Number.isFinite(v)) {
    return `<c r="${ref}"${s}><v>${v}</v></c>`
  }
  const text = esc(String(v))
  const preserve = /^\s|\s$/.test(String(v)) ? ' xml:space="preserve"' : ''
  return `<c r="${ref}"${s} t="inlineStr"><is><t${preserve}>${text}</t></is></c>`
}

function sheetXml(header: string[], rows: XlsxCell[][]): string {
  const cols = header
    .map((h, i) => {
      const w = Math.min(40, Math.max(11, h.length + 6))
      return `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`
    })
    .join('')
  const headerRow =
    `<row r="1">` +
    header.map((h, i) => cellXml(`${colRef(i)}1`, h, 1)).join('') +
    `</row>`
  const dataRows = rows
    .map(
      (row, ri) =>
        `<row r="${ri + 2}">` +
        row.map((v, ci) => cellXml(`${colRef(ci)}${ri + 2}`, v)).join('') +
        `</row>`
    )
    .join('')
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<cols>${cols}</cols>` +
    `<sheetData>${headerRow}${dataRows}</sheetData>` +
    `</worksheet>`
  )
}

const CONTENT_TYPES =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
  `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
  `<Default Extension="xml" ContentType="application/xml"/>` +
  `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
  `<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>` +
  `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
  `</Types>`

const ROOT_RELS =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
  `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
  `</Relationships>`

const WORKBOOK_RELS =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
  `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>` +
  `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
  `</Relationships>`

// Estilos mínimos: fuente normal (0) y negrita (1) para el encabezado.
// Excel exige los dos fills de convención (none + gray125).
const STYLES =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
  `<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>` +
  `<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>` +
  `<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>` +
  `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
  `<cellXfs count="2">` +
  `<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>` +
  `<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>` +
  `</cellXfs>` +
  `</styleSheet>`

function workbookXml(sheetName: string): string {
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
    `<sheets><sheet name="${esc(sheetName)}" sheetId="1" r:id="rId1"/></sheets>` +
    `</workbook>`
  )
}

/** Nombre de hoja válido para Excel: sin []:*?/\ y máximo 31 caracteres. */
function sanitizeSheetName(name: string): string {
  const clean = name.replace(/[[\]:*?/\\]/g, ' ').trim().slice(0, 31)
  return clean || 'Datos'
}

// ---------------------------------------------------------------------------
// ZIP con entradas sin comprimir (STORED)
// ---------------------------------------------------------------------------

function crc32(data: Uint8Array): number {
  let c = ~0
  for (let i = 0; i < data.length; i++) {
    c ^= data[i]
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1))
  }
  return ~c >>> 0
}

type ZipEntry = { name: string; text: string }

function buildZip(entries: ZipEntry[]): Blob {
  const encoder = new TextEncoder()
  const parts: Uint8Array[] = []
  const central: Uint8Array[] = []
  let offset = 0

  for (const entry of entries) {
    const name = encoder.encode(entry.name)
    const data = encoder.encode(entry.text)
    const crc = crc32(data)

    const local = new Uint8Array(30 + name.length)
    const lv = new DataView(local.buffer)
    lv.setUint32(0, 0x04034b50, true) // firma de entrada local
    lv.setUint16(4, 20, true) // versión necesaria
    lv.setUint16(6, 0x0800, true) // flag: nombres en UTF-8
    lv.setUint16(8, 0, true) // método 0 = STORED (sin comprimir)
    lv.setUint16(10, 0, true) // hora DOS
    lv.setUint16(12, 0x21, true) // fecha DOS (1-ene-1980)
    lv.setUint32(14, crc, true)
    lv.setUint32(18, data.length, true)
    lv.setUint32(22, data.length, true)
    lv.setUint16(26, name.length, true)
    lv.setUint16(28, 0, true)
    local.set(name, 30)
    parts.push(local, data)

    const cen = new Uint8Array(46 + name.length)
    const cv = new DataView(cen.buffer)
    cv.setUint32(0, 0x02014b50, true) // firma de directorio central
    cv.setUint16(4, 20, true)
    cv.setUint16(6, 20, true)
    cv.setUint16(8, 0x0800, true)
    cv.setUint16(10, 0, true)
    cv.setUint16(12, 0, true)
    cv.setUint16(14, 0x21, true)
    cv.setUint32(16, crc, true)
    cv.setUint32(20, data.length, true)
    cv.setUint32(24, data.length, true)
    cv.setUint16(28, name.length, true)
    cv.setUint32(42, offset, true)
    cen.set(name, 46)
    central.push(cen)

    offset += local.length + data.length
  }

  const centralSize = central.reduce((a, c) => a + c.length, 0)
  const eocd = new Uint8Array(22)
  const ev = new DataView(eocd.buffer)
  ev.setUint32(0, 0x06054b50, true) // firma de fin de directorio central
  ev.setUint16(8, entries.length, true)
  ev.setUint16(10, entries.length, true)
  ev.setUint32(12, centralSize, true)
  ev.setUint32(16, offset, true)

  return new Blob([...parts, ...central, eocd] as BlobPart[], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

export function makeXlsx(sheetName: string, header: string[], rows: XlsxCell[][]): Blob {
  return buildZip([
    { name: '[Content_Types].xml', text: CONTENT_TYPES },
    { name: '_rels/.rels', text: ROOT_RELS },
    { name: 'xl/workbook.xml', text: workbookXml(sanitizeSheetName(sheetName)) },
    { name: 'xl/_rels/workbook.xml.rels', text: WORKBOOK_RELS },
    { name: 'xl/styles.xml', text: STYLES },
    { name: 'xl/worksheets/sheet1.xml', text: sheetXml(header, rows) },
  ])
}

/** Genera el .xlsx y lanza la descarga en el navegador. */
export function downloadXlsx(fileName: string, header: string[], rows: XlsxCell[][]): void {
  const blob = makeXlsx(fileName, header, rows)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

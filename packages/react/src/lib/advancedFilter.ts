/**
 * Advanced filter — parser de expresiones tipo SQL/Excel sobre columnas por
 * key o label: `[Cliente] contains "Acme" and [Monto] > 1000`, `estado = pagado
 * or estado = pendiente`, `not (region = norte)`.
 *
 * Operadores: `= != > >= < <= contains startswith endswith`, conectores
 * `and`/`or`/`not`, paréntesis para agrupar. Sin diferenciar mayúsculas en
 * palabras clave. Los valores pueden ir entre comillas (`"texto con espacios"`)
 * o sueltos si no tienen espacios/paréntesis.
 *
 * `parseAdvancedFilter` nunca lanza: una expresión inválida o a medio escribir
 * devuelve `null` (= "no filtrar todavía"), igual que el resto de los filtros
 * de AtGrid mientras el usuario tipea.
 */

export type AdvFilterNode =
  | { type: 'and'; left: AdvFilterNode; right: AdvFilterNode }
  | { type: 'or'; left: AdvFilterNode; right: AdvFilterNode }
  | { type: 'not'; node: AdvFilterNode }
  | { type: 'cmp'; key: string; op: string; value: string }

type Token =
  | { type: 'lparen' | 'rparen' | 'and' | 'or' | 'not' }
  | { type: 'ident' | 'string'; value: string }
  | { type: 'op'; value: string }

const MULTI_CHAR_OPS = ['>=', '<=', '!=']
const WORD_OPS = new Set(['contains', 'startswith', 'endswith'])

function tokenize(expr: string): Token[] {
  const tokens: Token[] = []
  const n = expr.length
  let i = 0
  while (i < n) {
    const c = expr[i]
    if (/\s/.test(c)) {
      i++
      continue
    }
    if (c === '(') {
      tokens.push({ type: 'lparen' })
      i++
      continue
    }
    if (c === ')') {
      tokens.push({ type: 'rparen' })
      i++
      continue
    }
    if (c === '[') {
      // [Columna con espacios] — nombre entre corchetes, tratado como ident
      const close = expr.indexOf(']', i + 1)
      if (close === -1) throw new Error('unterminated [')
      tokens.push({ type: 'ident', value: expr.slice(i + 1, close) })
      i = close + 1
      continue
    }
    if (c === '"' || c === "'") {
      const quote = c
      let j = i + 1
      let s = ''
      while (j < n && expr[j] !== quote) {
        s += expr[j]
        j++
      }
      if (j >= n) throw new Error('unterminated string')
      tokens.push({ type: 'string', value: s })
      i = j + 1
      continue
    }
    const multi = MULTI_CHAR_OPS.find((op) => expr.startsWith(op, i))
    if (multi) {
      tokens.push({ type: 'op', value: multi })
      i += multi.length
      continue
    }
    if (c === '=' || c === '>' || c === '<') {
      tokens.push({ type: 'op', value: c })
      i++
      continue
    }
    let j = i
    while (j < n && !/[\s()]/.test(expr[j])) j++
    const word = expr.slice(i, j)
    i = j
    const lower = word.toLowerCase()
    if (lower === 'and') tokens.push({ type: 'and' })
    else if (lower === 'or') tokens.push({ type: 'or' })
    else if (lower === 'not') tokens.push({ type: 'not' })
    else if (WORD_OPS.has(lower)) tokens.push({ type: 'op', value: lower })
    else tokens.push({ type: 'ident', value: word })
  }
  return tokens
}

function parseComparison(tokens: Token[], pos: number): { node: AdvFilterNode; pos: number } {
  const keyTok = tokens[pos]
  if (!keyTok || keyTok.type !== 'ident') throw new Error('expected column')
  const opTok = tokens[pos + 1]
  if (!opTok || opTok.type !== 'op') throw new Error('expected operator')
  const valTok = tokens[pos + 2]
  if (!valTok || (valTok.type !== 'string' && valTok.type !== 'ident')) throw new Error('expected value')
  return { node: { type: 'cmp', key: keyTok.value, op: opTok.value, value: valTok.value }, pos: pos + 3 }
}

function parsePrimary(tokens: Token[], pos: number): { node: AdvFilterNode; pos: number } {
  if (tokens[pos]?.type === 'lparen') {
    const inner = parseOr(tokens, pos + 1)
    if (tokens[inner.pos]?.type !== 'rparen') throw new Error('expected )')
    return { node: inner.node, pos: inner.pos + 1 }
  }
  return parseComparison(tokens, pos)
}

function parseNot(tokens: Token[], pos: number): { node: AdvFilterNode; pos: number } {
  if (tokens[pos]?.type === 'not') {
    const inner = parseNot(tokens, pos + 1)
    return { node: { type: 'not', node: inner.node }, pos: inner.pos }
  }
  return parsePrimary(tokens, pos)
}

function parseAnd(tokens: Token[], pos: number): { node: AdvFilterNode; pos: number } {
  let { node: left, pos: p } = parseNot(tokens, pos)
  while (tokens[p]?.type === 'and') {
    const right = parseNot(tokens, p + 1)
    left = { type: 'and', left, right: right.node }
    p = right.pos
  }
  return { node: left, pos: p }
}

function parseOr(tokens: Token[], pos: number): { node: AdvFilterNode; pos: number } {
  let { node: left, pos: p } = parseAnd(tokens, pos)
  while (tokens[p]?.type === 'or') {
    const right = parseAnd(tokens, p + 1)
    left = { type: 'or', left, right: right.node }
    p = right.pos
  }
  return { node: left, pos: p }
}

export function parseAdvancedFilter(expr: string): AdvFilterNode | null {
  const trimmed = expr.trim()
  if (!trimmed) return null
  try {
    const tokens = tokenize(trimmed)
    if (!tokens.length) return null
    const { node, pos } = parseOr(tokens, 0)
    if (pos !== tokens.length) return null // sobran tokens: expresión incompleta, no filtrar todavía
    return node
  } catch {
    return null
  }
}

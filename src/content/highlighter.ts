// src/content/highlighter.ts
import type {
  Highlight,
  HighlightColor,
  TextContextAnchor,
  XPathAnchor,
} from '../shared/types'

const HIGHLIGHT_CLASS = 'am-highlight'
const COLOR_MAP: Record<HighlightColor, string> = {
  yellow: '#fef08a',
  green:  '#bbf7d0',
  blue:   '#bfdbfe',
  pink:   '#fbcfe8',
}

// ---------------------------------------------------------------------------
// Construcción del anchor
// ---------------------------------------------------------------------------

/**
 * Construye un anchor de localización serializable desde un Range del DOM.
 * Prefiere la estrategia text-context (prefijo + exacto + sufijo) porque
 * sobrevive a mutaciones menores del DOM. Solo usa XPath como fallback cuando
 * la selección abarca varios contenedores hermanos.
 */
export function buildAnchor(range: Range): {
  anchorStrategy: 'text-context' | 'xpath'
  anchor: TextContextAnchor | XPathAnchor
} {
  const exact = range.toString()
  if (!exact.trim()) {
    throw new Error('Selección vacía')
  }

  // Intenta primero el anchor text-context (más robusto para re-pintado)
  try {
    const anchor = buildTextContextAnchor(range, exact)
    return { anchorStrategy: 'text-context', anchor }
  } catch {
    // Fallback a XPath si el contexto de texto no es suficiente
    const anchor = buildXPathAnchor(range)
    return { anchorStrategy: 'xpath', anchor }
  }
}

function buildTextContextAnchor(
  range: Range,
  exact: string,
): TextContextAnchor {
  const CONTEXT_LEN = 50
  const container = range.startContainer
  const fullText = container.textContent ?? ''

  const prefix = fullText.slice(
    Math.max(0, range.startOffset - CONTEXT_LEN),
    range.startOffset,
  )
  const suffix = fullText.slice(
    range.endOffset,
    range.endOffset + CONTEXT_LEN,
  )

  return { type: 'text-context', prefix, exact, suffix }
}

function buildXPathAnchor(range: Range): XPathAnchor {
  const startNode = range.startContainer
  return {
    type:        'xpath',
    xpath:       getXPath(startNode),
    startOffset: range.startOffset,
    endOffset:
      range.startContainer === range.endContainer
        ? range.endOffset
        : (startNode.textContent?.length ?? 0),
  }
}

function getXPath(node: Node): string {
  const parts: string[] = []
  let current: Node | null = node

  // Si el nodo inicial es un texto, sube al elemento padre
  if (current.nodeType === Node.TEXT_NODE) {
    const parent = current.parentNode
    if (!parent) return ''
    // Índice entre los nodos de texto hermanos
    const textNodes = Array.from(parent.childNodes).filter(
      (n) => n.nodeType === Node.TEXT_NODE,
    )
    const idx = textNodes.indexOf(current as ChildNode) + 1
    parts.unshift(`text()[${idx}]`)
    current = parent
  }

  while (current && current !== document.documentElement) {
    if (current.nodeType === Node.ELEMENT_NODE) {
      const el = current as Element
      const sameTag = Array.from(el.parentNode?.children ?? []).filter(
        (s) => s.tagName === el.tagName,
      )
      const idx = sameTag.indexOf(el) + 1
      const qualifier = sameTag.length > 1 ? `[${idx}]` : ''
      parts.unshift(`${el.tagName.toLowerCase()}${qualifier}`)
    }
    current = current.parentNode
  }

  return '//' + parts.join('/')
}

// ---------------------------------------------------------------------------
// Búsqueda del rango desde un anchor
// ---------------------------------------------------------------------------

/**
 * Resuelve un anchor almacenado de vuelta a un Range del DOM activo.
 * Devuelve null si el texto objetivo ya no existe en la página
 * (por ejemplo, el artículo fue actualizado o el DOM aún no ha cargado).
 */
export function findRange(highlight: Highlight): Range | null {
  if (highlight.anchorStrategy === 'text-context') {
    return findRangeByTextContext(highlight.anchor as TextContextAnchor)
  }
  return findRangeByXPath(highlight.anchor as XPathAnchor)
}

/**
 * Localiza el anchor aplanando todos los nodos de texto de la página en una
 * sola cadena, buscando la secuencia prefijo+exacto+sufijo, y mapeando el
 * offset de carácter de vuelta al nodo DOM correspondiente.
 * Si no encuentra el contexto completo, intenta solo con el texto exacto
 * (tolera ediciones menores en el contexto circundante).
 */
function findRangeByTextContext(anchor: TextContextAnchor): Range | null {
  // Construye una lista plana de nodos de texto con sus posiciones relativas al documento
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  const nodes: Array<{ node: Text; start: number }> = []
  let offset = 0
  let node: Node | null

  while ((node = walker.nextNode())) {
    const t = node as Text
    nodes.push({ node: t, start: offset })
    offset += t.length
  }

  // Reconstruye el texto completo para localizar el anchor
  const fullText = nodes.map((n) => n.node.textContent ?? '').join('')

  const search = anchor.prefix + anchor.exact + anchor.suffix
  let pos = fullText.indexOf(search)

  if (pos === -1) {
    // Intenta sin el contexto si la búsqueda completa falla
    pos = fullText.indexOf(anchor.exact)
    if (pos === -1) return null
  } else {
    pos += anchor.prefix.length
  }

  const exactEnd = pos + anchor.exact.length

  // Mapea la posición plana del documento al nodo DOM + offset
  const startInfo = mapPosition(nodes, pos)
  const endInfo   = mapPosition(nodes, exactEnd)
  if (!startInfo || !endInfo) return null

  const range = document.createRange()
  range.setStart(startInfo.node, startInfo.offset)
  range.setEnd(endInfo.node, endInfo.offset)
  return range
}

function mapPosition(
  nodes: Array<{ node: Text; start: number }>,
  pos: number,
): { node: Text; offset: number } | null {
  for (let i = 0; i < nodes.length; i++) {
    const entry = nodes[i]!
    const next  = nodes[i + 1]
    const end   = next ? next.start : entry.start + (entry.node.length ?? 0)
    if (pos >= entry.start && pos <= end) {
      return { node: entry.node, offset: pos - entry.start }
    }
  }
  return null
}

function findRangeByXPath(anchor: XPathAnchor): Range | null {
  try {
    const result = document.evaluate(
      anchor.xpath,
      document,
      null,
      XPathResult.FIRST_ORDERED_NODE_TYPE,
      null,
    )
    const node = result.singleNodeValue
    if (!node) return null

    const range = document.createRange()
    range.setStart(node, anchor.startOffset)
    range.setEnd(node, anchor.endOffset)
    return range
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Pintado
// ---------------------------------------------------------------------------

/**
 * Envuelve el texto del subrayado en elementos <mark> con el color indicado.
 * No hace nada si el subrayado ya está pintado (idempotente).
 */
export function paintHighlight(highlight: Highlight): void {
  if (document.querySelector(`[data-am-id="${highlight.id}"]`)) return

  const range = findRange(highlight)
  if (!range) return

  applyMarkToRange(range, highlight.id, highlight.color)
}

/** Recopila todos los nodos Text que estén (al menos parcialmente) dentro del range. */
function getTextNodesInRange(range: Range): Text[] {
  const root = range.commonAncestorContainer
  if (root.nodeType === Node.TEXT_NODE) return [root as Text]

  const nodes: Text[] = []
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let node: Node | null
  while ((node = walker.nextNode())) {
    if (range.intersectsNode(node)) nodes.push(node as Text)
  }
  return nodes
}

function makeMark(highlightId: string, color: HighlightColor): HTMLElement {
  const mark = document.createElement('mark')
  mark.dataset['amId'] = highlightId
  mark.className       = HIGHLIGHT_CLASS

  // !important sobreescribe reglas CSS de la página como `* { color: white !important }`
  // o `mark { background: transparent }`.
  const bg = COLOR_MAP[color]
  mark.style.setProperty('background-color', bg,         'important')
  mark.style.setProperty('color',            '#111827',   'important')
  mark.style.setProperty('cursor',           'pointer',   'important')
  mark.style.setProperty('border-radius',    '2px',       'important')
  mark.style.setProperty('padding',          '0 2px',     'important')
  mark.style.setProperty('display',          'inline',    'important')
  mark.style.setProperty('transition',
    'background-color .2s ease, box-shadow .2s ease',     'important')
  return mark
}

/**
 * Envuelve cada nodo de texto individualmente para no intentar rodear un range
 * que cruce límites de elementos (lo que corrompería el DOM).
 */
function applyMarkToRange(
  range: Range,
  highlightId: string,
  color: HighlightColor,
): void {
  const textNodes = getTextNodesInRange(range)
  for (const node of textNodes) {
    const nodeRange = document.createRange()

    if (node === range.startContainer && node === range.endContainer) {
      nodeRange.setStart(node, range.startOffset)
      nodeRange.setEnd(node, range.endOffset)
    } else if (node === range.startContainer) {
      nodeRange.setStart(node, range.startOffset)
      nodeRange.setEndAfter(node)
    } else if (node === range.endContainer) {
      nodeRange.setStartBefore(node)
      nodeRange.setEnd(node, range.endOffset)
    } else {
      nodeRange.selectNode(node)
    }

    // Omite sub-ranges vacíos (p.ej. espacios en blanco colapsados)
    if (nodeRange.collapsed) continue

    const mark = makeMark(highlightId, color)
    try {
      nodeRange.surroundContents(mark)
    } catch {
      // Fallback de último recurso; raramente debería activarse.
      const fragment = nodeRange.extractContents()
      mark.appendChild(fragment)
      nodeRange.insertNode(mark)
    }
  }
}

/**
 * Elimina todos los elementos <mark> de un subrayado y restaura
 * los nodos de texto originales en su lugar.
 */
export function removePaintedHighlight(highlightId: string): void {
  // Un subrayado puede abarcar varios <mark> (uno por nodo de texto)
  const els = document.querySelectorAll(`[data-am-id="${highlightId}"]`)
  for (const el of els) {
    const parent = el.parentNode
    if (!parent) continue
    while (el.firstChild) parent.insertBefore(el.firstChild, el)
    parent.removeChild(el)
  }
}

/** Pinta un lote de subrayados en orden. Omite los ya pintados. */
export function repaintHighlights(highlights: Highlight[]): void {
  for (const h of highlights) {
    paintHighlight(h)
  }
}

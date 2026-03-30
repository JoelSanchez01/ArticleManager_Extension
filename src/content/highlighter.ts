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
// Anchor building
// ---------------------------------------------------------------------------
export function buildAnchor(range: Range): {
  anchorStrategy: 'text-context' | 'xpath'
  anchor: TextContextAnchor | XPathAnchor
} {
  const exact = range.toString()
  if (!exact.trim()) {
    throw new Error('Empty selection')
  }

  // Try text-context anchor first (more robust for re-paint)
  try {
    const anchor = buildTextContextAnchor(range, exact)
    return { anchorStrategy: 'text-context', anchor }
  } catch {
    // Fall back to xpath
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

  // Walk to the nearest element if we start on a text node
  if (current.nodeType === Node.TEXT_NODE) {
    const parent = current.parentNode
    if (!parent) return ''
    // Index among text-node siblings
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
// Finding a range from an anchor
// ---------------------------------------------------------------------------
export function findRange(highlight: Highlight): Range | null {
  if (highlight.anchorStrategy === 'text-context') {
    return findRangeByTextContext(highlight.anchor as TextContextAnchor)
  }
  return findRangeByXPath(highlight.anchor as XPathAnchor)
}

function findRangeByTextContext(anchor: TextContextAnchor): Range | null {
  // Build a flat list of text nodes and their document-relative positions
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  const nodes: Array<{ node: Text; start: number }> = []
  let offset = 0
  let node: Node | null

  while ((node = walker.nextNode())) {
    const t = node as Text
    nodes.push({ node: t, start: offset })
    offset += t.length
  }

  // Rebuild the full text so we can locate the anchor
  const fullText = nodes.map((n) => n.node.textContent ?? '').join('')

  const search = anchor.prefix + anchor.exact + anchor.suffix
  let pos = fullText.indexOf(search)

  if (pos === -1) {
    // Try without context
    pos = fullText.indexOf(anchor.exact)
    if (pos === -1) return null
  } else {
    pos += anchor.prefix.length
  }

  const exactEnd = pos + anchor.exact.length

  // Map document-flat position to DOM node + offset
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
// Painting
// ---------------------------------------------------------------------------
export function paintHighlight(highlight: Highlight): void {
  // Avoid double-painting
  if (document.querySelector(`[data-am-id="${highlight.id}"]`)) return

  const range = findRange(highlight)
  if (!range) return

  applyMarkToRange(range, highlight.id, highlight.color)
}

// Collect all Text nodes that are (at least partially) inside the range.
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

  // !important overrides page CSS rules like `* { color: white !important }`
  // or `mark { background: transparent }`.
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

function applyMarkToRange(
  range: Range,
  highlightId: string,
  color: HighlightColor,
): void {
  // Wrap each text node individually so we never try to surround a range
  // that crosses element boundaries (which corrupts the DOM).
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

    // Skip empty sub-ranges (e.g. collapsed whitespace)
    if (nodeRange.collapsed) continue

    const mark = makeMark(highlightId, color)
    try {
      nodeRange.surroundContents(mark)
    } catch {
      // Last-resort fallback; should rarely trigger now.
      const fragment = nodeRange.extractContents()
      mark.appendChild(fragment)
      nodeRange.insertNode(mark)
    }
  }
}

export function removePaintedHighlight(highlightId: string): void {
  // A highlight may span multiple <mark> elements (one per text node),
  // so remove all of them.
  const els = document.querySelectorAll(`[data-am-id="${highlightId}"]`)
  for (const el of els) {
    const parent = el.parentNode
    if (!parent) continue
    while (el.firstChild) parent.insertBefore(el.firstChild, el)
    parent.removeChild(el)
  }
}

export function repaintHighlights(highlights: Highlight[]): void {
  for (const h of highlights) {
    paintHighlight(h)
  }
}

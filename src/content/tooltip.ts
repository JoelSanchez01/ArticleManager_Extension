// src/content/tooltip.ts
import { MessageType } from '../shared/messages'
import type { MessageResponse, Message } from '../shared/messages'
import type { Highlight } from '../shared/types'

const TOOLTIP_HOST_ID = 'am-tooltip-host'

let host: HTMLDivElement | null   = null
let shadow: ShadowRoot | null     = null
let currentHighlightId: string | null = null

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------
/**
 * Creates the Shadow DOM host element and injects the tooltip UI.
 * Using Shadow DOM prevents the page's own CSS from leaking into
 * the tooltip (or the tooltip's styles from breaking the page).
 * Safe to call multiple times — exits early if already initialized.
 */
export function initTooltip(): void {
  if (document.getElementById(TOOLTIP_HOST_ID)) return

  host = document.createElement('div')
  host.id = TOOLTIP_HOST_ID
  host.style.cssText =
    'position:fixed;top:0;left:0;width:0;height:0;z-index:2147483647;'
  document.body.appendChild(host)

  shadow = host.attachShadow({ mode: 'open' })
  shadow.innerHTML = `
    <style>
      :host { all: initial; }
      .tooltip {
        display: none;
        position: fixed;
        background: #1e293b;
        color: #f1f5f9;
        border-radius: 8px;
        padding: 10px 14px;
        font-family: system-ui, sans-serif;
        font-size: 13px;
        line-height: 1.5;
        max-width: 300px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.4);
        z-index: 2147483647;
      }
      .tooltip.visible { display: block; }
      .tooltip-text {
        color: #94a3b8;
        font-size: 12px;
        margin-bottom: 6px;
        white-space: pre-wrap;
        word-break: break-word;
      }
      .note-area {
        margin-top: 6px;
        border-top: 1px solid #334155;
        padding-top: 8px;
      }
      .note-label {
        font-size: 11px;
        color: #64748b;
        margin-bottom: 4px;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }
      .note-view {
        color: #e2e8f0;
        font-size: 13px;
        min-height: 20px;
        cursor: pointer;
      }
      .note-view:empty::before {
        content: 'Añadir nota…';
        color: #475569;
        font-style: italic;
      }
      textarea {
        width: 100%;
        box-sizing: border-box;
        background: #0f172a;
        color: #e2e8f0;
        border: 1px solid #475569;
        border-radius: 4px;
        padding: 6px 8px;
        font-size: 13px;
        font-family: inherit;
        resize: vertical;
        min-height: 70px;
        outline: none;
      }
      textarea:focus { border-color: #6366f1; }
      .actions {
        display: flex;
        gap: 6px;
        margin-top: 6px;
        justify-content: flex-end;
      }
      button {
        padding: 4px 10px;
        border-radius: 4px;
        border: none;
        cursor: pointer;
        font-size: 12px;
        font-family: inherit;
      }
      .btn-save {
        background: #6366f1;
        color: white;
      }
      .btn-save:hover { background: #4f46e5; }
      .btn-cancel {
        background: #334155;
        color: #cbd5e1;
      }
      .btn-cancel:hover { background: #475569; }
      .btn-delete {
        background: #ef4444;
        color: white;
        margin-right: auto;
      }
      .btn-delete:hover { background: #dc2626; }
    </style>
    <div class="tooltip" id="tooltip">
      <div class="tooltip-text" id="selected-text"></div>
      <div class="note-area">
        <div class="note-label">Nota</div>
        <div class="note-view" id="note-view"></div>
        <textarea id="note-textarea" style="display:none"></textarea>
        <div class="actions" id="note-actions" style="display:none">
          <button class="btn-delete" id="btn-delete">Eliminar</button>
          <button class="btn-cancel" id="btn-cancel">Cancelar</button>
          <button class="btn-save" id="btn-save">Guardar</button>
        </div>
      </div>
    </div>
  `

  setupTooltipEvents()
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------
/**
 * Wires up all interactive events inside the Shadow DOM:
 * toggling edit mode, saving / cancelling a note, and deleting
 * the highlight. Also closes the tooltip on outside clicks.
 */
function setupTooltipEvents(): void {
  if (!shadow) return

  const noteView    = shadow.getElementById('note-view')!
  const noteArea    = shadow.getElementById('note-textarea') as HTMLTextAreaElement
  const noteActions = shadow.getElementById('note-actions')!
  const btnSave     = shadow.getElementById('btn-save')!
  const btnCancel   = shadow.getElementById('btn-cancel')!
  const btnDelete   = shadow.getElementById('btn-delete')!

  noteView.addEventListener('click', () => {
    noteArea.value = noteView.textContent ?? ''
    noteView.style.display    = 'none'
    noteArea.style.display    = 'block'
    noteActions.style.display = 'flex'
    noteArea.focus()
  })

  btnCancel.addEventListener('click', () => {
    noteArea.style.display    = 'none'
    noteActions.style.display = 'none'
    noteView.style.display    = 'block'
  })

  btnSave.addEventListener('click', () => {
    if (!currentHighlightId) return
    const articleId = getCurrentArticleId()
    if (!articleId) return

    const note = noteArea.value.trim()
    noteView.textContent      = note
    noteArea.style.display    = 'none'
    noteActions.style.display = 'none'
    noteView.style.display    = 'block'

    const msg: Message<unknown> = {
      type:    MessageType.UPDATE_HIGHLIGHT_NOTE,
      payload: { highlightId: currentHighlightId, articleId, note },
    }
    chrome.runtime.sendMessage(msg, (_resp: MessageResponse<unknown>) => {
      if (chrome.runtime.lastError) {
        console.error('AM tooltip save error:', chrome.runtime.lastError)
      }
    })
  })

  btnDelete.addEventListener('click', () => {
    if (!currentHighlightId) return
    const articleId = getCurrentArticleId()
    if (!articleId) return

    const msg: Message<unknown> = {
      type:    MessageType.DELETE_HIGHLIGHT,
      payload: { highlightId: currentHighlightId, articleId },
    }
    chrome.runtime.sendMessage(msg, (_resp: MessageResponse<unknown>) => {
      if (chrome.runtime.lastError) {
        console.error('AM tooltip delete error:', chrome.runtime.lastError)
      }
    })

    const mark = document.querySelector(
      `[data-am-id="${currentHighlightId}"]`,
    ) as HTMLElement | null
    if (mark) {
      const parent = mark.parentNode!
      while (mark.firstChild) parent.insertBefore(mark.firstChild, mark)
      parent.removeChild(mark)
    }

    hideTooltip()
  })

  document.addEventListener('click', (e) => {
    if (!host || host.contains(e.target as Node)) return
    if ((e.target as HTMLElement).closest?.(`[data-am-id]`)) return
    hideTooltip()
  })
}

/**
 * Reads the article ID from the data attribute on the active highlight's
 * <mark> element. The attribute is set by the content script when
 * highlights are painted, so it's always in sync with storage.
 */
function getCurrentArticleId(): string | null {
  const mark = currentHighlightId
    ? (document.querySelector(`[data-am-id="${currentHighlightId}"]`) as
        | HTMLElement
        | null)
    : null
  return mark?.dataset['amArticleId'] ?? null
}

// ---------------------------------------------------------------------------
// Show / hide
// ---------------------------------------------------------------------------
/**
 * Positions and displays the tooltip near the cursor (x, y).
 * Clamps position to keep the tooltip within the viewport.
 */
export function showTooltip(
  x: number,
  y: number,
  highlight: Highlight,
): void {
  if (!shadow) return

  currentHighlightId = highlight.id

  const tooltip     = shadow.getElementById('tooltip')!
  const selectedEl  = shadow.getElementById('selected-text')!
  const noteView    = shadow.getElementById('note-view')!
  const noteArea    = shadow.getElementById(
    'note-textarea',
  ) as HTMLTextAreaElement
  const noteActions = shadow.getElementById('note-actions')!

  noteArea.style.display    = 'none'
  noteActions.style.display = 'none'
  noteView.style.display    = 'block'

  selectedEl.textContent = `"${highlight.selectedText.slice(0, 80)}${highlight.selectedText.length > 80 ? '…' : ''}"`
  noteView.textContent   = highlight.note ?? ''

  tooltip.style.left = `${Math.min(x, window.innerWidth - 320)}px`
  tooltip.style.top  = `${Math.min(y + 10, window.innerHeight - 200)}px`
  tooltip.classList.add('visible')
}

/** Hides the tooltip and clears the active highlight reference. */
export function hideTooltip(): void {
  if (!shadow) return
  shadow.getElementById('tooltip')?.classList.remove('visible')
  currentHighlightId = null
}

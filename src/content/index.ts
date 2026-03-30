// src/content/index.ts
import { MessageType } from '../shared/messages'
import type { Message, MessageResponse } from '../shared/messages'
import type { Highlight, HighlightColor } from '../shared/types'
import {
  buildAnchor,
  paintHighlight,
  repaintHighlights,
} from './highlighter'
import { initTooltip, showTooltip, hideTooltip } from './tooltip'

// ---------------------------------------------------------------------------
// Inicialización
// ---------------------------------------------------------------------------
initTooltip()
setupHighlightListeners()
watchSpaNavigation()
void repaintPageHighlights()

// ---------------------------------------------------------------------------
// Subrayados pendientes + MutationObserver para páginas dinámicas / SPAs
// ---------------------------------------------------------------------------
let pendingHighlights: Highlight[] = []
let pendingArticleId = ''
let paintObserver:   MutationObserver | null = null
let observerTimeout: ReturnType<typeof setTimeout> | null = null

/**
 * Inicia un MutationObserver que reintenta pintar los subrayados cuyos
 * nodos del DOM aún no han aparecido (p.ej. contenido cargado de forma lazy).
 * Se detiene automáticamente tras 30 segundos para no dejar observers
 * activos en páginas que nunca renderizan el texto objetivo.
 */
function startPaintObserver(): void {
  if (paintObserver) return

  paintObserver = new MutationObserver(() => {
    if (!pendingHighlights.length) {
      stopPaintObserver()
      return
    }
    tryPaintPending()
  })

  paintObserver.observe(document.body ?? document.documentElement, {
    childList: true,
    subtree:   true,
  })

  observerTimeout = setTimeout(stopPaintObserver, 30_000)
}

/** Desconecta el observer, cancela su timeout y reinicia la lista de pendientes. */
function stopPaintObserver(): void {
  paintObserver?.disconnect()
  paintObserver = null
  if (observerTimeout) {
    clearTimeout(observerTimeout)
    observerTimeout = null
  }
  pendingHighlights = []
}

/**
 * Intenta pintar los subrayados que no pudieron resolverse en el paso anterior.
 * Los que siguen sin resolver se mantienen en la lista para el próximo callback
 * del observer.
 */
function tryPaintPending(): void {
  const stillPending: Highlight[] = []
  for (const h of pendingHighlights) {
    if (document.querySelector(`[data-am-id="${h.id}"]`)) continue
    paintHighlight(h)
    const mark = document.querySelector(
      `[data-am-id="${h.id}"]`,
    ) as HTMLElement | null
    if (mark) {
      mark.dataset['amArticleId'] = pendingArticleId
    } else {
      stillPending.push(h)
    }
  }
  pendingHighlights = stillPending
  if (!pendingHighlights.length) stopPaintObserver()
}

// ---------------------------------------------------------------------------
// Re-pintado de subrayados al cargar la página (y en navegación SPA)
// ---------------------------------------------------------------------------

/**
 * Carga todos los subrayados de la URL actual desde el storage y los pinta.
 * Los que no se resuelven de inmediato se encolan para el MutationObserver
 * (gestiona contenido de página cargado de forma asíncrona / lazy).
 */
async function repaintPageHighlights(): Promise<void> {
  stopPaintObserver()

  const data = await chrome.storage.local.get(null) as Record<string, unknown>
  const articles = (data['articles'] as
    | Record<string, { url: string; id: string; highlights: Highlight[] }>
    | undefined) ?? {}

  const pageUrl = location.href
  const article = Object.values(articles).find((a) => a.url === pageUrl)
  if (!article) return

  repaintHighlights(article.highlights)

  for (const h of article.highlights) {
    const mark = document.querySelector(
      `[data-am-id="${h.id}"]`,
    ) as HTMLElement | null
    if (mark) mark.dataset['amArticleId'] = article.id
  }

  pendingHighlights = article.highlights.filter(
    (h) => !document.querySelector(`[data-am-id="${h.id}"]`),
  )
  pendingArticleId = article.id

  if (pendingHighlights.length > 0) startPaintObserver()
}

// ---------------------------------------------------------------------------
// Detección de navegación SPA (X.com, YouTube, etc.)
// ---------------------------------------------------------------------------

/**
 * Intercepta history.pushState / replaceState y el evento popstate para
 * detectar la navegación del lado del cliente en SPAs. Re-pinta los
 * subrayados cada vez que cambia la URL.
 */
function watchSpaNavigation(): void {
  let lastUrl = location.href

  function onPossibleNavigate(): void {
    if (location.href !== lastUrl) {
      lastUrl = location.href
      void repaintPageHighlights()
    }
  }

  const origPush    = history.pushState.bind(history)
  const origReplace = history.replaceState.bind(history)

  history.pushState = (...args: Parameters<typeof history.pushState>) => {
    origPush(...args)
    onPossibleNavigate()
  }
  history.replaceState = (...args: Parameters<typeof history.replaceState>) => {
    origReplace(...args)
    onPossibleNavigate()
  }

  window.addEventListener('popstate', onPossibleNavigate)
}

// ---------------------------------------------------------------------------
// Listeners del tooltip (hover / clic sobre subrayados)
// ---------------------------------------------------------------------------

/**
 * Añade listeners delegados de mouseover / mouseout al documento para
 * mostrar u ocultar el tooltip cuando el usuario pasa sobre un <mark>.
 * El retardo de 200 ms al ocultar evita que el tooltip parpadee cuando
 * el ratón pasa brevemente del <mark> al propio tooltip.
 */
function setupHighlightListeners(): void {
  document.addEventListener('mouseover', (e) => {
    const mark = (e.target as HTMLElement).closest?.(
      '[data-am-id]',
    ) as HTMLElement | null
    if (!mark) return

    const highlightId = mark.dataset['amId']
    if (!highlightId) return

    loadHighlightAndShow(highlightId, e.clientX, e.clientY)
  })

  document.addEventListener('mouseout', (e) => {
    const from = e.target as HTMLElement
    const to   = e.relatedTarget as HTMLElement | null
    if (from.closest?.('[data-am-id]') && !to?.closest?.('[data-am-id]')) {
      setTimeout(() => {
        const tooltipHost = document.getElementById('am-tooltip-host')
        if (tooltipHost && tooltipHost.matches(':hover')) return
        hideTooltip()
      }, 200)
    }
  })
}

/**
 * Busca el subrayado en el storage y llama a showTooltip.
 * Lee del storage en cada hover para que el tooltip refleje siempre
 * la nota guardada más reciente sin necesitar una caché local.
 */
async function loadHighlightAndShow(
  highlightId: string,
  x: number,
  y: number,
): Promise<void> {
  const data = await chrome.storage.local.get(null) as Record<string, unknown>
  const articles = (data['articles'] as
    | Record<string, { id: string; highlights: Highlight[] }>
    | undefined) ?? {}

  for (const article of Object.values(articles)) {
    const h = article.highlights.find((hl) => hl.id === highlightId)
    if (h) {
      showTooltip(x, y, h)
      return
    }
  }
}

// ---------------------------------------------------------------------------
// Listener de mensajes (desde el Background)
// ---------------------------------------------------------------------------
chrome.runtime.onMessage.addListener(
  (
    rawMessage: unknown,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (r: MessageResponse<unknown>) => void,
  ) => {
    const message = rawMessage as Message<unknown>
    if (message.type === MessageType.CAPTURE_SELECTION) {
      const payload = message.payload as { color: HighlightColor }
      handleCaptureSelection(payload.color)
        .then((resp) => sendResponse(resp))
        .catch((err: unknown) =>
          sendResponse({
            success: false,
            error: err instanceof Error ? err.message : String(err),
          }),
        )
      return true
    }
    return false
  },
)

// ---------------------------------------------------------------------------
// Captura de selección y guardado del subrayado
// ---------------------------------------------------------------------------

/**
 * Captura la selección actual de la ventana, construye un anchor del DOM,
 * y envía SAVE_HIGHLIGHT al background. Si tiene éxito, pinta el nuevo
 * subrayado de inmediato para dar feedback instantáneo al usuario.
 */
async function handleCaptureSelection(
  color: HighlightColor,
): Promise<MessageResponse<unknown>> {
  const selection = window.getSelection()
  if (!selection || selection.isCollapsed) {
    return { success: false, error: 'No hay texto seleccionado' }
  }

  const range = selection.getRangeAt(0)
  const selectedText = range.toString().trim()
  if (!selectedText) {
    return { success: false, error: 'Selección vacía' }
  }

  const { anchorStrategy, anchor } = buildAnchor(range)

  const url    = location.href
  const title  = document.title || url
  const domain = location.hostname

  const saveMsg: Message<unknown> = {
    type:    MessageType.SAVE_HIGHLIGHT,
    payload: {
      url,
      title,
      domain,
      color,
      selectedText,
      anchorStrategy,
      anchor,
    },
  }

  return new Promise<MessageResponse<unknown>>((resolve) => {
    chrome.runtime.sendMessage(
      saveMsg,
      (resp: MessageResponse<Highlight>) => {
        if (chrome.runtime.lastError) {
          resolve({
            success: false,
            error: chrome.runtime.lastError.message,
          })
          return
        }

        if (resp.success && resp.data) {
          const highlight = resp.data
          paintHighlight(highlight)

          const mark = document.querySelector(
            `[data-am-id="${highlight.id}"]`,
          ) as HTMLElement | null
          if (mark) mark.dataset['amArticleId'] = highlight.articleId
        }

        resolve(resp)
      },
    )
  })
}

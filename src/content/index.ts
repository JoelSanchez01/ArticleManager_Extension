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
// Bootstrap
// ---------------------------------------------------------------------------
initTooltip()
setupHighlightListeners()
watchSpaNavigation()
void repaintPageHighlights()

// ---------------------------------------------------------------------------
// Pending highlights + MutationObserver for dynamic / SPA pages
// ---------------------------------------------------------------------------
let pendingHighlights: Highlight[] = []
let pendingArticleId = ''
let paintObserver:   MutationObserver | null = null
let observerTimeout: ReturnType<typeof setTimeout> | null = null

/**
 * Starts a MutationObserver that retries painting highlights whose
 * DOM targets haven't appeared yet (e.g. lazily-rendered content).
 * Auto-stops after 30 seconds to avoid leaking observers on pages
 * that never fully render the target text.
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

/** Disconnects the observer, clears its timeout, and resets the pending list. */
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
 * Attempts to paint any highlights that couldn't be matched on the
 * previous pass. Highlights that are still unresolved are kept in
 * the pending list for the next observer callback.
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
// Re-paint highlights for this page on load (and on SPA navigation)
// ---------------------------------------------------------------------------
/**
 * Loads all highlights for the current URL from storage and paints them.
 * Highlights that can't be resolved immediately are queued for the
 * MutationObserver (handles async / lazy-loaded page content).
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
// SPA navigation detection (X.com, YouTube, etc.)
// ---------------------------------------------------------------------------
/**
 * Intercepts history.pushState / replaceState and the popstate event
 * to detect client-side navigation on SPAs (e.g. X.com, YouTube).
 * Re-paints highlights whenever the URL changes.
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
// Tooltip listeners (hover / click on highlights)
// ---------------------------------------------------------------------------
/**
 * Attaches delegated mouseover / mouseout listeners on the document
 * to show or hide the tooltip when the user hovers over a <mark>.
 * The 200 ms hide delay prevents the tooltip from flickering when
 * the mouse briefly leaves the mark to reach the tooltip itself.
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
 * Looks up the highlight data in storage and calls showTooltip.
 * Reads from storage on every hover so the tooltip always reflects
 * the latest saved note without needing a local cache.
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
// Message listener (from Background)
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
// Selection capture and highlight save
// ---------------------------------------------------------------------------
/**
 * Captures the current window selection, builds a DOM anchor,
 * and sends SAVE_HIGHLIGHT to the background. On success, paints
 * the new highlight immediately so the user gets instant feedback.
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

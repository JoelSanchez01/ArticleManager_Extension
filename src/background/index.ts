// src/background/index.ts
import { MessageType } from '../shared/messages'
import type { Message, MessageResponse } from '../shared/messages'
import type {
  IStorageSchema,
  Article,
  Highlight,
  Folder,
  HighlightColor,
  ReadStatus,
  TextContextAnchor,
  XPathAnchor,
} from '../shared/types'
import { DEFAULT_SCHEMA, readStorage } from '../shared/storage'

// ---------------------------------------------------------------------------
// Context menu IDs
// ---------------------------------------------------------------------------
const MENU = {
  PARENT:           'am-parent',
  HIGHLIGHT_YELLOW: 'am-yellow',
  HIGHLIGHT_GREEN:  'am-green',
  HIGHLIGHT_BLUE:   'am-blue',
  HIGHLIGHT_PINK:   'am-pink',
} as const

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------
chrome.runtime.onInstalled.addListener(async () => {
  const existing = await chrome.storage.local.get(null) as Record<
    string,
    unknown
  >
  if (!existing['articles']) {
    await chrome.storage.local.set(DEFAULT_SCHEMA)
  }

  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU.PARENT,
      title: 'Gestor de Artículos',
      contexts: ['selection'],
    })
    chrome.contextMenus.create({
      id: MENU.HIGHLIGHT_YELLOW,
      parentId: MENU.PARENT,
      title: '🟡 Subrayar en Amarillo',
      contexts: ['selection'],
    })
    chrome.contextMenus.create({
      id: MENU.HIGHLIGHT_GREEN,
      parentId: MENU.PARENT,
      title: '🟢 Subrayar en Verde',
      contexts: ['selection'],
    })
    chrome.contextMenus.create({
      id: MENU.HIGHLIGHT_BLUE,
      parentId: MENU.PARENT,
      title: '🔵 Subrayar en Azul',
      contexts: ['selection'],
    })
    chrome.contextMenus.create({
      id: MENU.HIGHLIGHT_PINK,
      parentId: MENU.PARENT,
      title: '🩷 Subrayar en Rosa',
      contexts: ['selection'],
    })
  })
})

// ---------------------------------------------------------------------------
// Icon click → open dashboard
// ---------------------------------------------------------------------------
chrome.action.onClicked.addListener(() => {
  void chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') })
})

// ---------------------------------------------------------------------------
// Context menu handler
// ---------------------------------------------------------------------------
chrome.contextMenus.onClicked.addListener(
  (info: chrome.contextMenus.OnClickData, tab?: chrome.tabs.Tab) => {
    if (!tab?.id) return

    const menuId = info.menuItemId as string
    const colorMap: Record<string, HighlightColor> = {
      [MENU.HIGHLIGHT_YELLOW]: 'yellow',
      [MENU.HIGHLIGHT_GREEN]:  'green',
      [MENU.HIGHLIGHT_BLUE]:   'blue',
      [MENU.HIGHLIGHT_PINK]:   'pink',
    }

    const color = colorMap[menuId]
    if (color) {
      void chrome.tabs.sendMessage(tab.id, {
        type:    MessageType.CAPTURE_SELECTION,
        payload: { color },
      })
    }
  },
)

// ---------------------------------------------------------------------------
// Message handler
// ---------------------------------------------------------------------------
chrome.runtime.onMessage.addListener(
  (
    rawMessage: unknown,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (r: MessageResponse<unknown>) => void,
  ) => {
    const message = rawMessage as Message<unknown>
    handleMessage(message)
      .then(sendResponse)
      .catch((err: unknown) =>
        sendResponse({
          success: false,
          error: err instanceof Error ? err.message : String(err),
        }),
      )
    return true
  },
)

// ---------------------------------------------------------------------------
// Message routing
// ---------------------------------------------------------------------------
async function handleMessage(
  message: Message<unknown>,
): Promise<MessageResponse<unknown>> {
  switch (message.type) {
    case MessageType.SAVE_ARTICLE:
      return handleSaveArticle(
        message.payload as {
          url: string
          title: string
          domain: string
        },
      )

    case MessageType.SAVE_HIGHLIGHT:
      return handleSaveHighlight(
        message.payload as {
          url: string
          title: string
          domain: string
          color: HighlightColor
          selectedText: string
          anchorStrategy: 'text-context' | 'xpath'
          anchor: TextContextAnchor | XPathAnchor
        },
      )

    case MessageType.UPDATE_HIGHLIGHT_NOTE:
      return handleUpdateHighlightNote(
        message.payload as {
          highlightId: string
          articleId: string
          note: string
        },
      )

    case MessageType.DELETE_HIGHLIGHT:
      return handleDeleteHighlight(
        message.payload as {
          highlightId: string
          articleId: string
        },
      )

    case MessageType.CREATE_FOLDER:
      return handleCreateFolder(
        message.payload as { name: string; color: string },
      )

    case MessageType.DELETE_FOLDER:
      return handleDeleteFolder(
        message.payload as { folderId: string },
      )

    case MessageType.MOVE_ARTICLE:
      return handleMoveArticle(
        message.payload as {
          articleId: string
          folderId: string | null
        },
      )

    case MessageType.UPDATE_ARTICLE_STATUS:
      return handleUpdateArticleStatus(
        message.payload as {
          articleId: string
          status: ReadStatus
        },
      )

    case MessageType.DELETE_ARTICLE:
      return handleDeleteArticle(
        message.payload as { articleId: string },
      )

    default:
      return { success: false, error: `Unknown message type: ${message.type}` }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

async function writeStorage(
  updater: (schema: IStorageSchema) => IStorageSchema,
): Promise<void> {
  const schema = await readStorage()
  const updated = updater(schema)
  await chrome.storage.local.set({
    articles: updated.articles,
    folders:  updated.folders,
    settings: updated.settings,
  })
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------
async function handleSaveArticle(payload: {
  url: string
  title: string
  domain: string
}): Promise<MessageResponse<Article>> {
  const schema = await readStorage()
  const existing = Object.values(schema.articles).find(
    (a) => a.url === payload.url,
  )
  if (existing) return { success: true, data: existing }

  const article: Article = {
    id:         generateId(),
    url:        payload.url,
    title:      payload.title,
    domain:     payload.domain,
    savedAt:    Date.now(),
    status:     'unread',
    folderId:   null,
    highlights: [],
  }
  await writeStorage((s) => ({
    ...s,
    articles: { ...s.articles, [article.id]: article },
  }))
  return { success: true, data: article }
}

async function handleSaveHighlight(payload: {
  url: string
  title: string
  domain: string
  color: HighlightColor
  selectedText: string
  anchorStrategy: 'text-context' | 'xpath'
  anchor: TextContextAnchor | XPathAnchor
}): Promise<MessageResponse<Highlight>> {
  const schema = await readStorage()
  let article = Object.values(schema.articles).find(
    (a) => a.url === payload.url,
  )

  if (!article) {
    const saveResult = await handleSaveArticle({
      url:    payload.url,
      title:  payload.title,
      domain: payload.domain,
    })
    if (!saveResult.success || !saveResult.data) {
      return { success: false, error: 'Failed to create article' }
    }
    article = saveResult.data
  }

  const highlight: Highlight = {
    id:             generateId(),
    articleId:      article.id,
    color:          payload.color,
    selectedText:   payload.selectedText,
    anchorStrategy: payload.anchorStrategy,
    anchor:         payload.anchor,
    note:           null,
    createdAt:      Date.now(),
  }

  await writeStorage((s) => {
    const art = s.articles[article!.id]
    if (!art) return s
    return {
      ...s,
      articles: {
        ...s.articles,
        [art.id]: {
          ...art,
          highlights: [...art.highlights, highlight],
        },
      },
    }
  })
  return { success: true, data: highlight }
}

async function handleUpdateHighlightNote(payload: {
  highlightId: string
  articleId: string
  note: string
}): Promise<MessageResponse<Highlight>> {
  let updated: Highlight | undefined
  await writeStorage((s) => {
    const art = s.articles[payload.articleId]
    if (!art) return s
    const highlights = art.highlights.map((h) => {
      if (h.id !== payload.highlightId) return h
      const hl: Highlight = { ...h, note: payload.note }
      updated = hl
      return hl
    })
    return {
      ...s,
      articles: { ...s.articles, [art.id]: { ...art, highlights } },
    }
  })
  if (!updated) return { success: false, error: 'Highlight not found' }
  return { success: true, data: updated }
}

async function handleDeleteHighlight(payload: {
  highlightId: string
  articleId: string
}): Promise<MessageResponse<null>> {
  await writeStorage((s) => {
    const art = s.articles[payload.articleId]
    if (!art) return s
    return {
      ...s,
      articles: {
        ...s.articles,
        [art.id]: {
          ...art,
          highlights: art.highlights.filter(
            (h) => h.id !== payload.highlightId,
          ),
        },
      },
    }
  })
  return { success: true, data: null }
}

async function handleCreateFolder(payload: {
  name: string
  color: string
}): Promise<MessageResponse<Folder>> {
  const folder: Folder = {
    id:        generateId(),
    name:      payload.name,
    color:     payload.color,
    createdAt: Date.now(),
  }
  await writeStorage((s) => ({
    ...s,
    folders: { ...s.folders, [folder.id]: folder },
  }))
  return { success: true, data: folder }
}

async function handleDeleteFolder(payload: {
  folderId: string
}): Promise<MessageResponse<null>> {
  await writeStorage((s) => {
    const folders = { ...s.folders }
    delete folders[payload.folderId]
    const articles: IStorageSchema['articles'] = {}
    for (const [id, art] of Object.entries(s.articles)) {
      articles[id] =
        art.folderId === payload.folderId
          ? { ...art, folderId: null }
          : art
    }
    return { ...s, folders, articles }
  })
  return { success: true, data: null }
}

async function handleMoveArticle(payload: {
  articleId: string
  folderId: string | null
}): Promise<MessageResponse<null>> {
  await writeStorage((s) => {
    const art = s.articles[payload.articleId]
    if (!art) return s
    return {
      ...s,
      articles: {
        ...s.articles,
        [art.id]: { ...art, folderId: payload.folderId },
      },
    }
  })
  return { success: true, data: null }
}

async function handleUpdateArticleStatus(payload: {
  articleId: string
  status: ReadStatus
}): Promise<MessageResponse<null>> {
  await writeStorage((s) => {
    const art = s.articles[payload.articleId]
    if (!art) return s
    return {
      ...s,
      articles: {
        ...s.articles,
        [art.id]: { ...art, status: payload.status },
      },
    }
  })
  return { success: true, data: null }
}

async function handleDeleteArticle(payload: {
  articleId: string
}): Promise<MessageResponse<null>> {
  await writeStorage((s) => {
    const articles = { ...s.articles }
    delete articles[payload.articleId]
    return { ...s, articles }
  })
  return { success: true, data: null }
}

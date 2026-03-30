// src/dashboard/App.tsx
import { useState, useEffect, useCallback } from 'react'
import type { Article, Folder, ReadStatus } from '../shared/types'
import { MessageType } from '../shared/messages'
import type { Message, MessageResponse } from '../shared/messages'
import { readStorage } from '../shared/storage'
import FolderPanel from './components/FolderPanel'
import ArticleList from './components/ArticleList'
import NoteViewer from './components/NoteViewer'

export default function App() {
  const [articles, setArticles]     = useState<Record<string, Article>>({})
  const [folders, setFolders]       = useState<Record<string, Folder>>({})
  const [selectedFolderId, setSelectedFolderId]   = useState<string | null>(null)
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null)

  // -------------------------------------------------------------------------
  // Almacenamiento
  // -------------------------------------------------------------------------

  /** Lee el esquema completo del storage y lo sincroniza con el estado React local. */
  const loadData = useCallback(async () => {
    const schema = await readStorage()
    setArticles(schema.articles)
    setFolders(schema.folders)
  }, [])

  useEffect(() => {
    void loadData()
    const onChange = () => { void loadData() }
    chrome.storage.onChanged.addListener(onChange)
    return () => chrome.storage.onChanged.removeListener(onChange)
  }, [loadData])

  // -------------------------------------------------------------------------
  // Helper de mensajes
  // -------------------------------------------------------------------------

  /**
   * Wrapper basado en promesas para chrome.runtime.sendMessage.
   * Resuelve con una respuesta de fallo en lugar de lanzar una excepción
   * ante chrome.runtime.lastError, para que los llamadores usen async/await uniformemente.
   */
  function sendMsg<T>(payload: Message<unknown>): Promise<MessageResponse<T>> {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(payload, (resp: MessageResponse<T>) => {
        if (chrome.runtime.lastError) {
          resolve({ success: false, error: chrome.runtime.lastError.message })
        } else {
          resolve(resp)
        }
      })
    })
  }

  // -------------------------------------------------------------------------
  // Acciones
  // -------------------------------------------------------------------------
  async function handleCreateFolder(name: string, color: string) {
    await sendMsg({ type: MessageType.CREATE_FOLDER, payload: { name, color } })
  }

  async function handleDeleteFolder(folderId: string) {
    await sendMsg({ type: MessageType.DELETE_FOLDER, payload: { folderId } })
    if (selectedFolderId === folderId) setSelectedFolderId(null)
  }

  async function handleUpdateStatus(articleId: string, status: ReadStatus) {
    await sendMsg({
      type: MessageType.UPDATE_ARTICLE_STATUS,
      payload: { articleId, status },
    })
  }

  async function handleMoveArticle(articleId: string, folderId: string | null) {
    await sendMsg({
      type: MessageType.MOVE_ARTICLE,
      payload: { articleId, folderId },
    })
  }

  async function handleDeleteArticle(articleId: string) {
    await sendMsg({ type: MessageType.DELETE_ARTICLE, payload: { articleId } })
    if (selectedArticleId === articleId) setSelectedArticleId(null)
  }

  async function handleUpdateNote(
    articleId: string,
    highlightId: string,
    note: string,
  ) {
    await sendMsg({
      type: MessageType.UPDATE_HIGHLIGHT_NOTE,
      payload: { articleId, highlightId, note },
    })
  }

  async function handleDeleteHighlight(articleId: string, highlightId: string) {
    await sendMsg({
      type: MessageType.DELETE_HIGHLIGHT,
      payload: { articleId, highlightId },
    })
  }

  // -------------------------------------------------------------------------
  // Datos derivados
  // -------------------------------------------------------------------------
  const selectedArticle = selectedArticleId
    ? (articles[selectedArticleId] ?? null)
    : null

  const articleList = Object.values(articles).sort(
    (a, b) => b.savedAt - a.savedAt,
  )

  // -------------------------------------------------------------------------
  // Renderizado
  // -------------------------------------------------------------------------
  return (
    <div
      className="flex h-screen overflow-hidden font-sans"
      style={{ backgroundColor: '#0f1117', color: '#e2e8f0' }}
    >
      <FolderPanel
        folders={Object.values(folders)}
        selectedFolderId={selectedFolderId}
        onSelectFolder={setSelectedFolderId}
        onCreateFolder={handleCreateFolder}
        onDeleteFolder={handleDeleteFolder}
      />

      <div className="flex flex-col flex-1 min-w-0">
        {/* Encabezado */}
        <header
          className="flex items-center justify-between px-6 py-4 flex-shrink-0"
          style={{
            borderBottom: '1px solid #252d3d',
            background: 'linear-gradient(180deg, #141824 0%, #0f1117 100%)',
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center
                         text-base font-bold"
              style={{ background: '#8CC7C4', color: '#0f1117' }}
            >
              A
            </div>
            <div>
              <h1
                className="text-base font-semibold leading-none"
                style={{ color: '#e2e8f0' }}
              >
                Gestor de Artículos
              </h1>
              <p className="text-xs mt-0.5" style={{ color: '#556070' }}>
                {Object.keys(articles).length} artículos guardados
              </p>
            </div>
          </div>
        </header>

        <div className="flex flex-1 min-h-0">
          <ArticleList
            articles={articleList}
            folders={Object.values(folders)}
            selectedFolderId={selectedFolderId}
            selectedArticleId={selectedArticleId}
            onSelectArticle={setSelectedArticleId}
            onUpdateStatus={handleUpdateStatus}
            onMoveArticle={handleMoveArticle}
            onDeleteArticle={handleDeleteArticle}
          />

          {selectedArticle && (
            <NoteViewer
              article={selectedArticle}
              onClose={() => setSelectedArticleId(null)}
              onUpdateNote={handleUpdateNote}
              onDeleteHighlight={handleDeleteHighlight}
            />
          )}
        </div>
      </div>
    </div>
  )
}

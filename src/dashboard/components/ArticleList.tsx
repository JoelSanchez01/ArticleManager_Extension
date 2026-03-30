// src/dashboard/components/ArticleList.tsx
import { useState } from 'react'
import type { Article, Folder, ReadStatus } from '../../shared/types'

const STATUS_LABELS: Record<ReadStatus, string> = {
  unread:  'Sin leer',
  reading: 'Leyendo',
  read:    'Leído',
}

const STATUS_COLORS: Record<ReadStatus, string> = {
  unread:  '#556070',
  reading: '#f59e0b',
  read:    '#8CC7C4',
}

const STATUS_CYCLE: Record<ReadStatus, ReadStatus> = {
  unread:  'reading',
  reading: 'read',
  read:    'unread',
}

const STATUS_DOTS: Record<ReadStatus, string> = {
  unread:  '○',
  reading: '◑',
  read:    '●',
}

interface Props {
  articles: Article[]
  folders: Folder[]
  selectedFolderId: string | null
  selectedArticleId: string | null
  onSelectArticle: (id: string | null) => void
  onUpdateStatus: (articleId: string, status: ReadStatus) => Promise<void>
  onMoveArticle: (articleId: string, folderId: string | null) => Promise<void>
  onDeleteArticle: (articleId: string) => Promise<void>
}

export function ArticleList({
  articles,
  folders,
  selectedFolderId,
  selectedArticleId,
  onSelectArticle,
  onUpdateStatus,
  onMoveArticle,
  onDeleteArticle,
}: Props) {
  const [filterStatus, setFilterStatus] = useState<ReadStatus | 'all'>('all')
  const [moveMenuId, setMoveMenuId]     = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [hoveredId, setHoveredId]       = useState<string | null>(null)

  const filtered = articles.filter((a) => {
    const folderMatch =
      selectedFolderId === null || a.folderId === selectedFolderId
    const statusMatch =
      filterStatus === 'all' || a.status === filterStatus
    return folderMatch && statusMatch
  })

  function folderName(folderId: string | null): string {
    if (!folderId) return ''
    return folders.find((f) => f.id === folderId)?.name ?? ''
  }

  function folderColor(folderId: string | null): string {
    if (!folderId) return '#8CC7C4'
    return folders.find((f) => f.id === folderId)?.color ?? '#8CC7C4'
  }

  function formatDate(ts: number): string {
    const d = new Date(ts)
    const now = Date.now()
    const diff = now - ts
    if (diff < 86400000) return 'Hoy'
    if (diff < 172800000) return 'Ayer'
    return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })
  }

  const filters: Array<{ key: ReadStatus | 'all'; label: string }> = [
    { key: 'all',     label: 'Todos' },
    { key: 'unread',  label: 'Sin leer' },
    { key: 'reading', label: 'Leyendo' },
    { key: 'read',    label: 'Leídos' },
  ]

  return (
    <div
      className="flex flex-col flex-1 min-w-0 min-h-0"
      style={{ background: '#0f1117' }}
    >
      {/* Barra de filtros */}
      <div
        className="flex items-center gap-2 px-5 py-3 flex-shrink-0"
        style={{ borderBottom: '1px solid #1e2535' }}
      >
        <div className="flex gap-1.5">
          {filters.map(({ key, label }) => (
            <button
              key={key}
              className="px-3 py-1 rounded-full text-xs font-medium
                         transition-all duration-150"
              style={{
                background:
                  filterStatus === key
                    ? 'rgba(140,199,196,0.15)'
                    : 'transparent',
                color:
                  filterStatus === key ? '#8CC7C4' : '#556070',
                border:
                  filterStatus === key
                    ? '1px solid rgba(140,199,196,0.3)'
                    : '1px solid transparent',
              }}
              onClick={() => setFilterStatus(key)}
            >
              {label}
            </button>
          ))}
        </div>

        <span className="ml-auto text-xs" style={{ color: '#3d4a5c' }}>
          {filtered.length} artículo{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center
                         text-2xl"
              style={{ background: '#141824' }}
            >
              📭
            </div>
            <p className="text-sm" style={{ color: '#3d4a5c' }}>
              No hay artículos aquí todavía
            </p>
            <p className="text-xs" style={{ color: '#2a3444' }}>
              Selecciona texto en cualquier página y usa el menú contextual
            </p>
          </div>
        ) : (
          <ul>
            {filtered.map((article, i) => {
              const isSelected = selectedArticleId === article.id
              const isHovered  = hoveredId === article.id

              return (
                <li
                  key={article.id}
                  className="cursor-pointer transition-all duration-150
                             animate-fade-in"
                  style={{
                    borderBottom: '1px solid #141824',
                    background: isSelected
                      ? 'rgba(140,199,196,0.06)'
                      : isHovered
                        ? '#141824'
                        : 'transparent',
                    borderLeft: isSelected
                      ? '2px solid #8CC7C4'
                      : '2px solid transparent',
                    animationDelay: `${i * 20}ms`,
                  }}
                  onMouseEnter={() => setHoveredId(article.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  onClick={() =>
                    onSelectArticle(isSelected ? null : article.id)
                  }
                >
                  <div className="px-5 py-3.5 flex items-start gap-3">
                    {/* Indicador de estado */}
                    <button
                      className="mt-0.5 flex-shrink-0 text-lg leading-none
                                 transition-transform duration-150 hover:scale-125"
                      style={{ color: STATUS_COLORS[article.status] }}
                      title={`Estado: ${STATUS_LABELS[article.status]}`}
                      onClick={(e) => {
                        e.stopPropagation()
                        void onUpdateStatus(
                          article.id,
                          STATUS_CYCLE[article.status],
                        )
                      }}
                    >
                      {STATUS_DOTS[article.status]}
                    </button>

                    {/* Información del artículo */}
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-sm font-medium truncate"
                        style={{ color: isSelected ? '#e2e8f0' : '#c8d4e0' }}
                      >
                        {article.title || article.url}
                      </p>
                      <div
                        className="flex items-center gap-2 mt-0.5 text-xs"
                        style={{ color: '#3d4a5c' }}
                      >
                        <span>{article.domain}</span>
                        <span>·</span>
                        <span>{formatDate(article.savedAt)}</span>
                        {article.folderId && (
                          <>
                            <span>·</span>
                            <span
                              className="flex items-center gap-1"
                              style={{ color: folderColor(article.folderId) }}
                            >
                              <span
                                className="inline-block w-1.5 h-1.5 rounded-full"
                                style={{
                                  background: folderColor(article.folderId),
                                }}
                              />
                              {folderName(article.folderId)}
                            </span>
                          </>
                        )}
                        {article.highlights.length > 0 && (
                          <>
                            <span>·</span>
                            <span style={{ color: '#8CC7C4' }}>
                              ✦ {article.highlights.length}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Botones de acción (visibles al hover o selección) */}
                    {(isHovered || isSelected) && (
                      <div
                        className="flex items-center gap-1 flex-shrink-0
                                   animate-fade-in"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {/* Mover a carpeta */}
                        <div className="relative">
                          <ActionBtn
                            label="📁"
                            title="Mover a carpeta"
                            onClick={() =>
                              setMoveMenuId(
                                moveMenuId === article.id ? null : article.id,
                              )
                            }
                          />
                          {moveMenuId === article.id && (
                            <div
                              className="absolute right-0 top-8 z-20
                                         rounded-xl shadow-2xl py-1 min-w-36
                                         animate-scale-in"
                              style={{
                                background: '#1c2130',
                                border: '1px solid #252d3d',
                              }}
                            >
                              <DropdownItem
                                label="Sin carpeta"
                                onClick={() => {
                                  void onMoveArticle(article.id, null)
                                  setMoveMenuId(null)
                                }}
                              />
                              {folders.map((f) => (
                                <DropdownItem
                                  key={f.id}
                                  label={f.name}
                                  color={f.color}
                                  onClick={() => {
                                    void onMoveArticle(article.id, f.id)
                                    setMoveMenuId(null)
                                  }}
                                />
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Abrir URL */}
                        <a
                          href={article.url}
                          target="_blank"
                          rel="noreferrer"
                          className="w-7 h-7 rounded-lg flex items-center
                                     justify-center text-sm transition-all"
                          style={{
                            background: '#252d3d',
                            color: '#8892a4',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.color = '#8CC7C4'
                            e.currentTarget.style.background = 'rgba(140,199,196,0.12)'
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.color = '#8892a4'
                            e.currentTarget.style.background = '#252d3d'
                          }}
                          title="Abrir artículo"
                          onClick={(e) => e.stopPropagation()}
                        >
                          ↗
                        </a>

                        {/* Eliminar */}
                        <ActionBtn
                          label="✕"
                          title="Eliminar"
                          danger
                          onClick={() => setConfirmDeleteId(article.id)}
                        />
                      </div>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* Confirmación de eliminación */}
      {confirmDeleteId && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50
                     animate-fade-in"
          style={{ backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
          onClick={() => setConfirmDeleteId(null)}
        >
          <div
            className="w-80 rounded-2xl p-5 shadow-2xl animate-scale-in"
            style={{ background: '#141824', border: '1px solid #252d3d' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center
                         text-xl mb-4 mx-auto"
              style={{
                background: 'rgba(239,68,68,0.12)',
                color: '#ef4444',
              }}
            >
              🗑
            </div>
            <p
              className="text-sm text-center font-medium mb-1"
              style={{ color: '#e2e8f0' }}
            >
              Eliminar artículo
            </p>
            <p
              className="text-xs text-center mb-5"
              style={{ color: '#556070' }}
            >
              Se eliminarán también todos sus subrayados. Esta acción no se
              puede deshacer.
            </p>
            <div className="flex gap-2">
              <button
                className="flex-1 py-2 text-sm rounded-xl transition-all"
                style={{
                  background: '#1c2130',
                  color: '#8892a4',
                  border: '1px solid #252d3d',
                }}
                onClick={() => setConfirmDeleteId(null)}
              >
                Cancelar
              </button>
              <button
                className="flex-1 py-2 text-sm rounded-xl font-medium
                           transition-all"
                style={{ background: '#ef4444', color: 'white' }}
                onClick={() => {
                  void onDeleteArticle(confirmDeleteId)
                  setConfirmDeleteId(null)
                }}
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-componentes
// ---------------------------------------------------------------------------
interface ActionBtnProps {
  label: string
  title: string
  danger?: boolean
  onClick: () => void
}

function ActionBtn({ label, title, danger = false, onClick }: ActionBtnProps) {
  return (
    <button
      className="w-7 h-7 rounded-lg flex items-center justify-center
                 text-sm transition-all duration-150"
      style={{ background: '#252d3d', color: '#8892a4' }}
      title={title}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = danger
          ? 'rgba(239,68,68,0.12)'
          : 'rgba(140,199,196,0.12)'
        e.currentTarget.style.color = danger ? '#ef4444' : '#8CC7C4'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = '#252d3d'
        e.currentTarget.style.color = '#8892a4'
      }}
      onClick={onClick}
    >
      {label}
    </button>
  )
}

interface DropdownItemProps {
  label: string
  color?: string
  onClick: () => void
}

function DropdownItem({ label, color, onClick }: DropdownItemProps) {
  return (
    <button
      className="w-full text-left px-3 py-2 text-xs flex items-center gap-2
                 transition-colors duration-100"
      style={{ color: '#8892a4' }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = '#252d3d'
        e.currentTarget.style.color = '#e2e8f0'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent'
        e.currentTarget.style.color = '#8892a4'
      }}
      onClick={onClick}
    >
      {color && (
        <span
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ background: color }}
        />
      )}
      {label}
    </button>
  )
}

export default ArticleList

// src/dashboard/components/NoteViewer.tsx
import { useState } from 'react'
import type { Article, Highlight } from '../../shared/types'

const COLOR_STYLE: Record<string, { bg: string; border: string }> = {
  yellow: { bg: 'rgba(254,240,138,0.08)', border: '#fef08a' },
  green:  { bg: 'rgba(187,247,208,0.08)', border: '#bbf7d0' },
  blue:   { bg: 'rgba(191,219,254,0.08)', border: '#bfdbfe' },
  pink:   { bg: 'rgba(251,207,232,0.08)', border: '#fbcfe8' },
}

interface Props {
  article: Article
  onClose: () => void
  onUpdateNote: (
    articleId: string,
    highlightId: string,
    note: string,
  ) => Promise<void>
  onDeleteHighlight: (
    articleId: string,
    highlightId: string,
  ) => Promise<void>
}

export function NoteViewer({
  article,
  onClose,
  onUpdateNote,
  onDeleteHighlight,
}: Props) {
  const [editingId, setEditingId]     = useState<string | null>(null)
  const [editingNote, setEditingNote] = useState('')

  function startEdit(h: Highlight) {
    setEditingId(h.id)
    setEditingNote(h.note ?? '')
  }

  async function saveNote(h: Highlight) {
    await onUpdateNote(article.id, h.id, editingNote)
    setEditingId(null)
  }

  function formatDate(ts: number): string {
    return new Date(ts).toLocaleDateString('es-ES', {
      day: '2-digit', month: 'short', year: 'numeric',
    })
  }

  const sortedHighlights = article.highlights
    .slice()
    .sort((a, b) => a.createdAt - b.createdAt)

  return (
    <aside
      className="w-80 flex-shrink-0 flex flex-col animate-slide-in-right"
      style={{
        background: '#0d1119',
        borderLeft: '1px solid #1e2535',
      }}
    >
      {/* Header */}
      <div
        className="px-4 py-4 flex-shrink-0"
        style={{ borderBottom: '1px solid #1e2535' }}
      >
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <p
              className="text-[10px] uppercase tracking-widest font-semibold
                         mb-1"
              style={{ color: '#3d4a5c' }}
            >
              {article.domain}
            </p>
            <h2
              className="text-sm font-medium leading-snug line-clamp-2"
              style={{ color: '#c8d4e0' }}
            >
              {article.title || article.url}
            </h2>
          </div>
          <button
            className="w-6 h-6 rounded-md flex items-center justify-center
                       flex-shrink-0 mt-0.5 text-sm transition-all"
            style={{ color: '#3d4a5c', background: 'transparent' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#1c2130'
              e.currentTarget.style.color = '#8892a4'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.color = '#3d4a5c'
            }}
            onClick={onClose}
            title="Cerrar"
          >
            ✕
          </button>
        </div>

        {/* Stats */}
        <div className="flex gap-3 mt-3">
          <Stat
            value={article.highlights.length}
            label="subrayados"
            color="#8CC7C4"
          />
          <Stat
            value={
              article.highlights.filter((h) => h.note).length
            }
            label="notas"
            color="#a78bfa"
          />
        </div>
      </div>

      {/* Highlights list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {sortedHighlights.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2">
            <span className="text-3xl">✦</span>
            <p className="text-sm" style={{ color: '#3d4a5c' }}>
              Sin subrayados todavía
            </p>
          </div>
        ) : (
          sortedHighlights.map((h) => (
            <HighlightCard
              key={h.id}
              highlight={h}
              isEditing={editingId === h.id}
              editingNote={editingNote}
              onStartEdit={() => startEdit(h)}
              onSaveNote={() => { void saveNote(h) }}
              onCancelEdit={() => setEditingId(null)}
              onNoteChange={setEditingNote}
              onDelete={() => {
                void onDeleteHighlight(article.id, h.id)
              }}
              formatDate={formatDate}
            />
          ))
        )}
      </div>

      {/* Footer */}
      <div
        className="px-4 py-3 flex-shrink-0 flex items-center justify-between"
        style={{ borderTop: '1px solid #1e2535' }}
      >
        <span className="text-xs" style={{ color: '#2a3444' }}>
          Guardado el {formatDate(article.savedAt)}
        </span>
        <a
          href={article.url}
          target="_blank"
          rel="noreferrer"
          className="text-xs flex items-center gap-1 transition-colors"
          style={{ color: '#3d4a5c' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = '#8CC7C4'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = '#3d4a5c'
          }}
        >
          Abrir artículo ↗
        </a>
      </div>
    </aside>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------
function Stat({
  value,
  label,
  color,
}: {
  value: number
  label: string
  color: string
}) {
  return (
    <div
      className="flex-1 rounded-lg py-1.5 px-2 text-center"
      style={{ background: '#141824' }}
    >
      <p className="text-base font-semibold leading-none" style={{ color }}>
        {value}
      </p>
      <p className="text-[10px] mt-0.5" style={{ color: '#3d4a5c' }}>
        {label}
      </p>
    </div>
  )
}

interface CardProps {
  highlight: Highlight
  isEditing: boolean
  editingNote: string
  onStartEdit: () => void
  onSaveNote: () => void
  onCancelEdit: () => void
  onNoteChange: (v: string) => void
  onDelete: () => void
  formatDate: (ts: number) => string
}

function HighlightCard({
  highlight,
  isEditing,
  editingNote,
  onStartEdit,
  onSaveNote,
  onCancelEdit,
  onNoteChange,
  onDelete,
  formatDate,
}: CardProps) {
  const [confirmDel, setConfirmDel] = useState(false)
  const style = COLOR_STYLE[highlight.color] ?? COLOR_STYLE['yellow']!

  return (
    <div
      className="rounded-xl p-3 space-y-2.5 transition-all duration-150
                 animate-fade-in"
      style={{
        background: '#141824',
        border: '1px solid #1e2535',
      }}
    >
      {/* Quoted text */}
      <blockquote
        className="rounded-lg px-3 py-2.5 text-sm leading-relaxed relative"
        style={{
          background: style.bg,
          borderLeft: `3px solid ${style.border}`,
        }}
      >
        <span style={{ color: '#c8d4e0' }}>
          "{highlight.selectedText}"
        </span>
      </blockquote>

      <p className="text-[10px]" style={{ color: '#2a3444' }}>
        {formatDate(highlight.createdAt)}
      </p>

      {/* Note section */}
      <div>
        <div className="flex items-center gap-1 mb-1.5">
          <span
            className="text-[10px] uppercase tracking-widest font-semibold"
            style={{ color: '#3d4a5c' }}
          >
            Nota
          </span>
        </div>

        {isEditing ? (
          <div className="space-y-2">
            <textarea
              autoFocus
              className="w-full rounded-lg px-2.5 py-2 text-sm resize-none
                         outline-none transition-all duration-200"
              style={{
                background: '#0f1117',
                border: '1px solid #252d3d',
                color: '#e2e8f0',
                minHeight: '80px',
              }}
              rows={3}
              value={editingNote}
              onChange={(e) => onNoteChange(e.target.value)}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = '#8CC7C4'
                e.currentTarget.style.boxShadow =
                  '0 0 0 3px rgba(140,199,196,0.1)'
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = '#252d3d'
                e.currentTarget.style.boxShadow = 'none'
              }}
              onKeyDown={(e) => {
                if (e.key === 'Escape') onCancelEdit()
                if (e.key === 'Enter' && e.metaKey) onSaveNote()
              }}
            />
            <div className="flex gap-2 justify-end">
              <button
                className="px-3 py-1 text-xs rounded-lg transition-all"
                style={{
                  background: '#1c2130',
                  color: '#8892a4',
                  border: '1px solid #252d3d',
                }}
                onClick={onCancelEdit}
              >
                Cancelar
              </button>
              <button
                className="px-3 py-1 text-xs rounded-lg font-medium
                           transition-all"
                style={{ background: '#8CC7C4', color: '#0f1117' }}
                onClick={onSaveNote}
              >
                Guardar ⌘↵
              </button>
            </div>
          </div>
        ) : (
          <p
            className="text-sm leading-relaxed cursor-pointer rounded-lg px-2
                       py-1.5 transition-all duration-150"
            style={{
              color: highlight.note ? '#8892a4' : '#2a3444',
              fontStyle: highlight.note ? 'normal' : 'italic',
              background: 'transparent',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#1c2130'
              e.currentTarget.style.color = highlight.note ? '#c8d4e0' : '#556070'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.color = highlight.note ? '#8892a4' : '#2a3444'
            }}
            onClick={onStartEdit}
            title="Clic para editar"
          >
            {highlight.note || 'Añadir nota…'}
          </p>
        )}
      </div>

      {/* Delete */}
      <div className="flex justify-end pt-0.5">
        {confirmDel ? (
          <div className="flex items-center gap-2 text-xs">
            <span style={{ color: '#3d4a5c' }}>¿Eliminar?</span>
            <button
              className="px-2 py-0.5 rounded-md font-medium"
              style={{ background: '#ef4444', color: 'white' }}
              onClick={() => {
                setConfirmDel(false)
                onDelete()
              }}
            >
              Sí
            </button>
            <button
              className="px-2 py-0.5 rounded-md"
              style={{ background: '#1c2130', color: '#8892a4' }}
              onClick={() => setConfirmDel(false)}
            >
              No
            </button>
          </div>
        ) : (
          <button
            className="text-[11px] transition-colors duration-150"
            style={{ color: '#2a3444' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#ef4444'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = '#2a3444'
            }}
            onClick={() => setConfirmDel(true)}
          >
            Eliminar subrayado
          </button>
        )}
      </div>
    </div>
  )
}

export default NoteViewer

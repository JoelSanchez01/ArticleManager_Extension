// src/dashboard/components/FolderPanel.tsx
import { useState } from 'react'
import type { Folder } from '../../shared/types'

const FOLDER_COLORS = [
  '#8CC7C4', '#6aada9', '#f59e0b',
  '#ef4444', '#a78bfa', '#ec4899',
] as const

interface Props {
  folders: Folder[]
  selectedFolderId: string | null
  onSelectFolder: (id: string | null) => void
  onCreateFolder: (name: string, color: string) => Promise<void>
  onDeleteFolder: (id: string) => Promise<void>
}

export function FolderPanel({
  folders,
  selectedFolderId,
  onSelectFolder,
  onCreateFolder,
  onDeleteFolder,
}: Props) {
  const [creating, setCreating]   = useState(false)
  const [newName, setNewName]     = useState('')
  const [newColor, setNewColor]   = useState<string>(FOLDER_COLORS[0])
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  async function handleCreate() {
    const name = newName.trim()
    if (!name) return
    await onCreateFolder(name, newColor)
    setNewName('')
    setNewColor(FOLDER_COLORS[0])
    setCreating(false)
  }

  return (
    <aside
      className="w-56 flex-shrink-0 flex flex-col"
      style={{
        background: '#0d1119',
        borderRight: '1px solid #1e2535',
      }}
    >
      {/* Encabezado */}
      <div className="px-4 pt-5 pb-3">
        <p
          className="text-[10px] font-semibold uppercase tracking-[0.12em]"
          style={{ color: '#3d4a5c' }}
        >
          Carpetas
        </p>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 pb-2 space-y-0.5">
        {/* Todos los artículos */}
        <FolderItem
          label="📚 Todos los artículos"
          color="#8CC7C4"
          isSelected={selectedFolderId === null}
          onClick={() => onSelectFolder(null)}
        />

        {folders.map((folder) => (
          <div
            key={folder.id}
            className="group relative"
            onMouseEnter={() => setHoveredId(folder.id)}
            onMouseLeave={() => setHoveredId(null)}
          >
            <FolderItem
              label={folder.name}
              color={folder.color}
              isSelected={selectedFolderId === folder.id}
              onClick={() => onSelectFolder(folder.id)}
            />
            {hoveredId === folder.id && (
              <button
                className="absolute right-1.5 top-1/2 -translate-y-1/2
                           w-5 h-5 rounded flex items-center justify-center
                           text-[10px] transition-all duration-150"
                style={{ color: '#556070', background: '#1c2130' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = '#ef4444'
                  e.currentTarget.style.background = 'rgba(239,68,68,0.12)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = '#556070'
                  e.currentTarget.style.background = '#1c2130'
                }}
                onClick={() => setConfirmDelete(folder.id)}
              >
                ✕
              </button>
            )}
          </div>
        ))}
      </nav>

      {/* Separador */}
      <div style={{ height: '1px', background: '#1e2535', margin: '0 16px' }} />

      {/* Nueva carpeta */}
      <div className="p-3">
        {creating ? (
          <div className="animate-fade-in space-y-2">
            <input
              autoFocus
              type="text"
              className="w-full rounded-lg px-3 py-2 text-sm
                         outline-none transition-all duration-200"
              style={{
                background: '#1c2130',
                border: '1px solid #252d3d',
                color: '#e2e8f0',
              }}
              placeholder="Nombre de carpeta"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
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
                if (e.key === 'Enter') void handleCreate()
                if (e.key === 'Escape') setCreating(false)
              }}
            />
            {/* Selector de color */}
            <div className="flex gap-1.5 justify-center">
              {FOLDER_COLORS.map((c) => (
                <button
                  key={c}
                  title={c}
                  className="w-5 h-5 rounded-full transition-all duration-150"
                  style={{
                    backgroundColor: c,
                    transform: newColor === c ? 'scale(1.25)' : 'scale(1)',
                    boxShadow:
                      newColor === c ? `0 0 0 2px #0f1117, 0 0 0 4px ${c}` : 'none',
                  }}
                  onClick={() => setNewColor(c)}
                />
              ))}
            </div>
            <div className="flex gap-2">
              <button
                className="flex-1 py-1.5 text-xs rounded-lg font-medium
                           transition-all duration-150"
                style={{ background: '#8CC7C4', color: '#0f1117' }}
                onClick={() => { void handleCreate() }}
              >
                Crear
              </button>
              <button
                className="flex-1 py-1.5 text-xs rounded-lg
                           transition-all duration-150"
                style={{
                  background: '#1c2130',
                  color: '#8892a4',
                  border: '1px solid #252d3d',
                }}
                onClick={() => setCreating(false)}
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <button
            className="w-full py-2 text-xs rounded-lg transition-all
                       duration-150 flex items-center justify-center gap-1"
            style={{
              background: 'transparent',
              border: '1px dashed #252d3d',
              color: '#3d4a5c',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#8CC7C4'
              e.currentTarget.style.color = '#8CC7C4'
              e.currentTarget.style.background = 'rgba(140,199,196,0.05)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#252d3d'
              e.currentTarget.style.color = '#3d4a5c'
              e.currentTarget.style.background = 'transparent'
            }}
            onClick={() => setCreating(true)}
          >
            <span>+</span>
            <span>Nueva carpeta</span>
          </button>
        )}
      </div>

      {/* Modal de confirmación de eliminación */}
      {confirmDelete && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50
                     animate-fade-in"
          style={{ backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
          onClick={() => setConfirmDelete(null)}
        >
          <div
            className="w-72 rounded-2xl p-5 shadow-2xl animate-scale-in"
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
              className="text-sm text-center mb-1 font-medium"
              style={{ color: '#e2e8f0' }}
            >
              Eliminar carpeta
            </p>
            <p
              className="text-xs text-center mb-5"
              style={{ color: '#556070' }}
            >
              Los artículos no se borrarán, solo se desasignarán.
            </p>
            <div className="flex gap-2">
              <button
                className="flex-1 py-2 text-sm rounded-xl transition-all"
                style={{
                  background: '#1c2130',
                  color: '#8892a4',
                  border: '1px solid #252d3d',
                }}
                onClick={() => setConfirmDelete(null)}
              >
                Cancelar
              </button>
              <button
                className="flex-1 py-2 text-sm rounded-xl font-medium
                           transition-all"
                style={{ background: '#ef4444', color: 'white' }}
                onClick={() => {
                  void onDeleteFolder(confirmDelete)
                  setConfirmDelete(null)
                }}
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  )
}

// ---------------------------------------------------------------------------
// Sub-componente
// ---------------------------------------------------------------------------
interface FolderItemProps {
  label: string
  color: string
  isSelected: boolean
  onClick: () => void
}

function FolderItem({ label, color, isSelected, onClick }: FolderItemProps) {
  return (
    <button
      className="w-full text-left px-3 py-2 rounded-lg text-sm
                 transition-all duration-150 flex items-center gap-2"
      style={{
        background: isSelected ? 'rgba(140,199,196,0.12)' : 'transparent',
        color: isSelected ? '#8CC7C4' : '#8892a4',
        fontWeight: isSelected ? 500 : 400,
      }}
      onMouseEnter={(e) => {
        if (!isSelected) {
          e.currentTarget.style.background = '#1c2130'
          e.currentTarget.style.color = '#b8c4d0'
        }
      }}
      onMouseLeave={(e) => {
        if (!isSelected) {
          e.currentTarget.style.background = 'transparent'
          e.currentTarget.style.color = '#8892a4'
        }
      }}
      onClick={onClick}
    >
      <span
        className="w-2 h-2 rounded-full flex-shrink-0"
        style={{ background: color }}
      />
      <span className="truncate">{label}</span>
      {isSelected && (
        <span
          className="ml-auto w-1.5 h-1.5 rounded-full flex-shrink-0"
          style={{ background: '#8CC7C4' }}
        />
      )}
    </button>
  )
}

export default FolderPanel

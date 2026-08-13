import { useEffect } from 'react'
import { Toolbar } from './toolbar/Toolbar'
import { Sidebar } from './sidebar/Sidebar'
import { Workspace } from './workspace/Workspace'
import { Inspector } from './inspector/Inspector'
import { useEditorStore } from '@/store/editor-store'
import { loadDocument } from '@/persistence'
import './chrome/editor.css'

export function EditorShell() {
  const hydrate = useEditorStore((s) => s.hydrate)
  const hydrated = useEditorStore((s) => s.hydrated)

  useEffect(() => {
    void (async () => {
      const saved = await loadDocument()
      hydrate(saved)
    })()
  }, [hydrate])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey
      if (meta && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault()
        useEditorStore.getState().undo()
      }
      if (meta && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) {
        e.preventDefault()
        useEditorStore.getState().redo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (!hydrated) {
    return (
      <div className="forge-editor" style={{ placeItems: 'center', display: 'grid' }}>
        <div className="fe-muted">Loading design system…</div>
      </div>
    )
  }

  return (
    <div className="forge-editor">
      <Toolbar />
      <div className="fe-body">
        <Sidebar />
        <Workspace />
        <Inspector />
      </div>
    </div>
  )
}

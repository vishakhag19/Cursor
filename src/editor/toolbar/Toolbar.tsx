import {
  Undo2,
  Redo2,
  Download,
  Moon,
  Sun,
  Sparkles,
  Layers,
} from 'lucide-react'
import { useEditorStore } from '@/store/editor-store'
import { downloadDesignSystemZip } from '@/export/generate'

export function Toolbar() {
  const doc = useEditorStore((s) => s.doc)
  const undo = useEditorStore((s) => s.undo)
  const redo = useEditorStore((s) => s.redo)
  const history = useEditorStore((s) => s.history)
  const future = useEditorStore((s) => s.future)
  const previewTheme = useEditorStore((s) => s.previewTheme)
  const setPreviewTheme = useEditorStore((s) => s.setPreviewTheme)
  const setSelection = useEditorStore((s) => s.setSelection)
  const loadDefault = useEditorStore((s) => s.loadDefault)
  const loadBlank = useEditorStore((s) => s.loadBlank)

  return (
    <header className="fe-toolbar">
      <div className="fe-brand">
        <div className="fe-brand-mark">F</div>
        <div>
          <div className="fe-brand-name">Forge</div>
          <div className="fe-brand-sub">{doc.metadata.name}</div>
        </div>
      </div>

      <div className="fe-toolbar-group">
        <button type="button" className="fe-btn fe-btn-ghost" onClick={loadDefault} title="Load default system">
          <Layers size={14} />
          Default
        </button>
        <button
          type="button"
          className="fe-btn fe-btn-ghost"
          onClick={() => setSelection({ section: 'themes' })}
        >
          Presets
        </button>
        <button type="button" className="fe-btn fe-btn-ghost" onClick={loadBlank}>
          Scratch
        </button>
      </div>

      <div className="fe-toolbar-spacer" />

      <div className="fe-toolbar-group">
        <button type="button" className="fe-btn fe-btn-icon" disabled={history.length === 0} onClick={undo} aria-label="Undo">
          <Undo2 size={15} />
        </button>
        <button type="button" className="fe-btn fe-btn-icon" disabled={future.length === 0} onClick={redo} aria-label="Redo">
          <Redo2 size={15} />
        </button>
      </div>

      <div className="fe-seg" role="group" aria-label="Preview theme">
        <button
          type="button"
          data-active={previewTheme === 'light'}
          onClick={() => setPreviewTheme('light')}
          aria-label="Light preview"
        >
          <Sun size={13} />
        </button>
        <button
          type="button"
          data-active={previewTheme === 'dark'}
          onClick={() => setPreviewTheme('dark')}
          aria-label="Dark preview"
        >
          <Moon size={13} />
        </button>
      </div>

      <button
        type="button"
        className="fe-btn fe-btn-ghost"
        onClick={() => setSelection({ section: 'ai' })}
      >
        <Sparkles size={14} />
        AI
      </button>

      <button
        type="button"
        className="fe-btn fe-btn-primary"
        onClick={() => {
          void downloadDesignSystemZip(doc)
          setSelection({ section: 'export' })
        }}
      >
        <Download size={14} />
        Export
      </button>
    </header>
  )
}

import { useState } from 'react'
import { useEditorStore } from '@/store/editor-store'
import { downloadDesignSystemZip } from '@/export/generate'
import { emitTokenCss, emitReadme } from '@/export/codegen'

export function ExportInspector() {
  const doc = useEditorStore((s) => s.doc)
  const inspectorTab = useEditorStore((s) => s.inspectorTab)
  const [status, setStatus] = useState<string | null>(null)

  if (inspectorTab === 'code') {
    return <pre className="fe-code">{emitReadme(doc)}</pre>
  }

  return (
    <div className="fe-stack">
      <div className="fe-impact">
        Export generates a real React + TypeScript + CSS variables project from the current system
        document. Only selected components are included where implemented.
      </div>

      <div className="fe-field">
        <label>System name</label>
        <input
          className="fe-input"
          value={doc.metadata.name}
          onChange={(e) => {
            useEditorStore.getState().updateDocument((d) => {
              d.metadata.name = e.target.value
            }, 'Rename system')
          }}
        />
      </div>

      <div className="fe-field">
        <label>Description</label>
        <textarea
          className="fe-textarea"
          value={doc.metadata.description}
          onChange={(e) => {
            useEditorStore.getState().updateDocument((d) => {
              d.metadata.description = e.target.value
            })
          }}
        />
      </div>

      <button
        type="button"
        className="fe-btn fe-btn-primary"
        onClick={async () => {
          setStatus('Generating zip…')
          await downloadDesignSystemZip(doc)
          setStatus('Download started.')
        }}
      >
        Download design-system.zip
      </button>
      {status && <div className="fe-muted">{status}</div>}

      <div className="fe-divider" />
      <div className="fe-field"><label>Token preview</label></div>
      <pre className="fe-code" style={{ maxHeight: 240 }}>
        {emitTokenCss(doc, 'colors')}
      </pre>
    </div>
  )
}

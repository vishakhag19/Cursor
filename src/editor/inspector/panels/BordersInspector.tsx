import { useEditorStore } from '@/store/editor-store'
import { emitTokenCss } from '@/export/codegen'

export function BordersInspector() {
  const doc = useEditorStore((s) => s.doc)
  const updateDocument = useEditorStore((s) => s.updateDocument)
  const inspectorTab = useEditorStore((s) => s.inspectorTab)

  if (inspectorTab === 'code') {
    return <pre className="fe-code">{emitTokenCss(doc, 'borders')}</pre>
  }

  return (
    <div className="fe-stack">
      <div className="fe-field"><label>Widths</label></div>
      {doc.foundations.borders.widths.map((token) => (
        <div key={token.id} className="fe-field">
          <label>{token.name}</label>
          <input
            className="fe-input"
            value={token.value}
            onChange={(e) => {
              updateDocument((d) => {
                const t = d.foundations.borders.widths.find((x) => x.id === token.id)
                if (t) t.value = e.target.value
              })
            }}
          />
        </div>
      ))}
      <div className="fe-field"><label>Styles</label></div>
      {doc.foundations.borders.styles.map((token) => (
        <div key={token.id} className="fe-field">
          <label>{token.name}</label>
          <input
            className="fe-input"
            value={token.value}
            onChange={(e) => {
              updateDocument((d) => {
                const t = d.foundations.borders.styles.find((x) => x.id === token.id)
                if (t) t.value = e.target.value
              })
            }}
          />
        </div>
      ))}
    </div>
  )
}

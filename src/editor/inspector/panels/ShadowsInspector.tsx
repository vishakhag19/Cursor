import { useEditorStore } from '@/store/editor-store'
import { emitTokenCss } from '@/export/codegen'
import { shadowToCss } from '@/token-engine'

export function ShadowsInspector() {
  const doc = useEditorStore((s) => s.doc)
  const updateDocument = useEditorStore((s) => s.updateDocument)
  const inspectorTab = useEditorStore((s) => s.inspectorTab)

  if (inspectorTab === 'code') {
    return <pre className="fe-code">{emitTokenCss(doc, 'shadows')}</pre>
  }

  return (
    <div className="fe-stack">
      {doc.foundations.shadows.map((shadow) => (
        <div key={shadow.id} style={{ marginBottom: 14 }}>
          <div className="fe-inline" style={{ marginBottom: 8 }}>
            <strong className="fe-grow">{shadow.name}</strong>
            <div
              style={{
                width: 48,
                height: 32,
                borderRadius: 6,
                background: '#fff',
                boxShadow: shadowToCss(shadow),
                border: '1px solid var(--fe-border)',
              }}
            />
          </div>
          {shadow.layers.map((layer, index) => (
            <div key={index} className="fe-stack" style={{ gap: 4, marginBottom: 8 }}>
              <div className="fe-inline">
                {(['x', 'y', 'blur', 'spread'] as const).map((key) => (
                  <input
                    key={key}
                    className="fe-input"
                    aria-label={`${shadow.name} ${key}`}
                    value={layer[key]}
                    onChange={(e) => {
                      updateDocument((d) => {
                        const s = d.foundations.shadows.find((x) => x.id === shadow.id)
                        if (s) s.layers[index]![key] = e.target.value
                      })
                    }}
                  />
                ))}
              </div>
              <div className="fe-inline">
                <input
                  className="fe-input"
                  value={layer.color}
                  onChange={(e) => {
                    updateDocument((d) => {
                      const s = d.foundations.shadows.find((x) => x.id === shadow.id)
                      if (s) s.layers[index]!.color = e.target.value
                    })
                  }}
                />
                <input
                  className="fe-input"
                  type="number"
                  step={0.01}
                  min={0}
                  max={1}
                  value={layer.opacity}
                  onChange={(e) => {
                    updateDocument((d) => {
                      const s = d.foundations.shadows.find((x) => x.id === shadow.id)
                      if (s) s.layers[index]!.opacity = Number(e.target.value)
                    })
                  }}
                  style={{ width: 70 }}
                />
              </div>
            </div>
          ))}
        </div>
      ))}
      <button
        type="button"
        className="fe-btn"
        onClick={() => {
          updateDocument((d) => {
            d.foundations.shadows.push({
              id: `elev-${d.foundations.shadows.length + 1}`,
              name: `Custom ${d.foundations.shadows.length + 1}`,
              layers: [{ x: '0', y: '8px', blur: '24px', spread: '0', color: '#1A1A18', opacity: 0.12 }],
            })
          }, 'Add shadow')
        }}
      >
        Add elevation
      </button>
    </div>
  )
}

import { useEditorStore } from '@/store/editor-store'

export function OpacityInspector() {
  const doc = useEditorStore((s) => s.doc)
  const updateDocument = useEditorStore((s) => s.updateDocument)
  const inspectorTab = useEditorStore((s) => s.inspectorTab)
  const tokens = doc.foundations.opacity ?? []

  if (inspectorTab === 'code') {
    return (
      <pre className="fe-code">
        {`:root {\n${tokens.map((t) => `  --opacity-${t.id}: ${t.value};`).join('\n')}\n}`}
      </pre>
    )
  }

  return (
    <div className="fe-stack">
      <div className="fe-impact">
        Opacity tokens drive disabled states, overlays, and hover washes across components.
      </div>
      {tokens.map((token) => (
        <div key={token.id} className="fe-field">
          <label>{token.name}</label>
          <div className="fe-inline">
            <input
              className="fe-input"
              value={token.name}
              onChange={(e) => {
                updateDocument((d) => {
                  const t = d.foundations.opacity.find((x) => x.id === token.id)
                  if (t) t.name = e.target.value
                })
              }}
            />
            <input
              className="fe-input"
              value={token.value}
              onChange={(e) => {
                updateDocument((d) => {
                  const t = d.foundations.opacity.find((x) => x.id === token.id)
                  if (t) t.value = e.target.value
                })
              }}
            />
            <span
              style={{
                width: 28,
                height: 28,
                borderRadius: 4,
                background: `color-mix(in srgb, var(--fe-accent) ${Number(token.value) * 100 || 40}%, transparent)`,
                border: '1px solid var(--fe-border)',
                flexShrink: 0,
              }}
            />
            <button
              type="button"
              className="fe-btn fe-btn-ghost"
              onClick={() => {
                updateDocument((d) => {
                  d.foundations.opacity = d.foundations.opacity.filter((x) => x.id !== token.id)
                })
              }}
            >
              Delete
            </button>
          </div>
        </div>
      ))}
      <button
        type="button"
        className="fe-btn"
        onClick={() => {
          updateDocument((d) => {
            d.foundations.opacity ??= []
            d.foundations.opacity.push({
              id: `opacity-${Date.now()}`,
              name: 'Custom',
              value: '0.5',
            })
          })
        }}
      >
        Add opacity token
      </button>
    </div>
  )
}

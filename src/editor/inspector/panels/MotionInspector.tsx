import { useState } from 'react'
import { useEditorStore } from '@/store/editor-store'
import { emitTokenCss } from '@/export/codegen'

export function MotionInspector() {
  const doc = useEditorStore((s) => s.doc)
  const updateDocument = useEditorStore((s) => s.updateDocument)
  const inspectorTab = useEditorStore((s) => s.inspectorTab)
  const [pulse, setPulse] = useState(0)

  if (inspectorTab === 'code') {
    return <pre className="fe-code">{emitTokenCss(doc, 'motion')}</pre>
  }

  const fast = doc.foundations.motion.durations.find((d) => d.id === 'fast')?.value ?? '120ms'
  const ease = doc.foundations.motion.easings.find((e) => e.id === 'standard')?.value ?? 'ease'

  return (
    <div className="fe-stack">
      <button
        type="button"
        className="fe-btn"
        onClick={() => setPulse((p) => p + 1)}
      >
        Preview motion
      </button>
      <div
        key={pulse}
        style={{
          width: 40,
          height: 40,
          borderRadius: 8,
          background: 'var(--fe-accent)',
          animation: pulse ? `fe-motion-demo ${fast} ${ease}` : undefined,
        }}
      />
      <style>{`
        @keyframes fe-motion-demo {
          0% { transform: translateX(0); opacity: 0.4; }
          100% { transform: translateX(120px); opacity: 1; }
        }
      `}</style>

      <div className="fe-field"><label>Durations</label></div>
      {doc.foundations.motion.durations.map((token) => (
        <div key={token.id} className="fe-field">
          <label>{token.name}</label>
          <input
            className="fe-input"
            value={token.value}
            onChange={(e) => {
              updateDocument((d) => {
                const t = d.foundations.motion.durations.find((x) => x.id === token.id)
                if (t) t.value = e.target.value
              })
            }}
          />
        </div>
      ))}

      <div className="fe-field"><label>Easings</label></div>
      {doc.foundations.motion.easings.map((token) => (
        <div key={token.id} className="fe-field">
          <label>{token.name}</label>
          <input
            className="fe-input"
            value={token.value}
            onChange={(e) => {
              updateDocument((d) => {
                const t = d.foundations.motion.easings.find((x) => x.id === token.id)
                if (t) t.value = e.target.value
              })
            }}
          />
        </div>
      ))}
    </div>
  )
}

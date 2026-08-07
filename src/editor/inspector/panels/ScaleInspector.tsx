import { useEditorStore } from '@/store/editor-store'
import { emitTokenCss } from '@/export/codegen'
import { estimateComponentImpact } from '@/token-engine'

export function ScaleInspector({ kind }: { kind: 'spacing' | 'sizing' | 'radius' }) {
  const doc = useEditorStore((s) => s.doc)
  const updateDocument = useEditorStore((s) => s.updateDocument)
  const inspectorTab = useEditorStore((s) => s.inspectorTab)

  const tokens =
    kind === 'spacing'
      ? doc.foundations.spacing.tokens
      : kind === 'sizing'
        ? doc.foundations.sizing.tokens
        : doc.foundations.radius.tokens

  const impact = estimateComponentImpact(
    doc,
    kind === 'spacing' ? 'spacing.4' : kind === 'radius' ? 'radius.md' : 'sizing.control-md',
  )

  if (inspectorTab === 'code') {
    return <pre className="fe-code">{emitTokenCss(doc, kind)}</pre>
  }

  return (
    <div className="fe-stack">
      <div className="fe-impact">
        Edits to {kind} affect {impact.count} components.
      </div>

      {kind === 'spacing' && (
        <div className="fe-field">
          <label htmlFor="base">Base unit (px)</label>
          <input
            id="base"
            className="fe-input"
            type="number"
            value={doc.foundations.spacing.baseUnit}
            onChange={(e) => {
              const base = Number(e.target.value) || 4
              updateDocument((d) => {
                d.foundations.spacing.baseUnit = base
                for (const token of d.foundations.spacing.tokens) {
                  const n = Number(token.id)
                  if (!Number.isNaN(n) && n > 0) token.value = `${n * base}px`
                }
              }, 'Spacing base unit')
            }}
          />
        </div>
      )}

      {tokens.map((token) => (
        <div key={token.id} className="fe-field">
          <label htmlFor={`${kind}-${token.id}`}>{token.name}</label>
          <div className="fe-inline">
            <input
              id={`${kind}-${token.id}`}
              className="fe-input"
              value={token.value}
              onChange={(e) => {
                updateDocument((d) => {
                  const list =
                    kind === 'spacing'
                      ? d.foundations.spacing.tokens
                      : kind === 'sizing'
                        ? d.foundations.sizing.tokens
                        : d.foundations.radius.tokens
                  const t = list.find((x) => x.id === token.id)
                  if (t) t.value = e.target.value
                }, `Edit ${kind}.${token.id}`)
              }}
            />
            {kind === 'radius' && (
              <span
                style={{
                  width: 28,
                  height: 28,
                  border: '1px solid var(--fe-border-strong)',
                  borderRadius: token.value,
                  background: 'var(--fe-accent-soft)',
                  flexShrink: 0,
                }}
              />
            )}
            {kind === 'spacing' && (
              <span
                style={{
                  width: token.value,
                  height: 8,
                  background: 'var(--fe-accent)',
                  borderRadius: 2,
                  maxWidth: 80,
                  flexShrink: 0,
                }}
              />
            )}
          </div>
        </div>
      ))}

      <button
        type="button"
        className="fe-btn"
        onClick={() => {
          updateDocument((d) => {
            const list =
              kind === 'spacing'
                ? d.foundations.spacing.tokens
                : kind === 'sizing'
                  ? d.foundations.sizing.tokens
                  : d.foundations.radius.tokens
            const id = `custom-${list.length + 1}`
            list.push({ id, name: `Custom ${list.length + 1}`, value: kind === 'radius' ? '10px' : '16px' })
          }, `Add ${kind} token`)
        }}
      >
        Add token
      </button>
    </div>
  )
}

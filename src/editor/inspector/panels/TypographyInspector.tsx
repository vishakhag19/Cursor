import { useEditorStore } from '@/store/editor-store'
import { emitTokenCss } from '@/export/codegen'
import { estimateComponentImpact } from '@/token-engine'

const GOOGLE_FONTS = [
  'Source Sans 3',
  'Fraunces',
  'IBM Plex Sans',
  'IBM Plex Mono',
  'Inter',
  'Roboto Flex',
  'DM Sans',
  'Space Grotesk',
  'Libre Baskerville',
  'Newsreader',
  'JetBrains Mono',
  'Manrope',
  'Outfit',
  'Sora',
  'Work Sans',
  'Lora',
  'Source Serif 4',
  'Noto Sans',
  'Public Sans',
  'Geist',
]

export function TypographyInspector() {
  const doc = useEditorStore((s) => s.doc)
  const updateDocument = useEditorStore((s) => s.updateDocument)
  const inspectorTab = useEditorStore((s) => s.inspectorTab)
  const styles = doc.foundations.typography.styles
  const families = doc.foundations.typography.families
  const impact = estimateComponentImpact(doc, 'typography')

  if (inspectorTab === 'code') {
    return <pre className="fe-code">{emitTokenCss(doc, 'typography')}</pre>
  }

  return (
    <div className="fe-stack">
      <div className="fe-impact">Typography changes affect {impact.count} components.</div>

      <div className="fe-field">
        <label>Font families</label>
      </div>
      {families.map((family) => (
        <div key={family.id} className="fe-field">
          <label htmlFor={`font-${family.id}`}>{family.name}</label>
          <select
            id={`font-${family.id}`}
            className="fe-select"
            value={family.family}
            onChange={(e) => {
              updateDocument((d) => {
                const f = d.foundations.typography.families.find((x) => x.id === family.id)
                if (f) {
                  f.family = e.target.value
                  f.source = 'google'
                }
              }, `Font ${family.name}`)
            }}
          >
            {GOOGLE_FONTS.map((font) => (
              <option key={font} value={font}>
                {font}
              </option>
            ))}
          </select>
        </div>
      ))}

      <div className="fe-divider" />
      <div className="fe-field">
        <label>Styles</label>
      </div>
      {styles.map((style) => (
        <div key={style.id} style={{ marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid var(--fe-border)' }}>
          <div className="fe-inline" style={{ marginBottom: 6 }}>
            <strong className="fe-grow">{style.name}</strong>
            <button
              type="button"
              className="fe-btn fe-btn-ghost"
              style={{ height: 22, fontSize: 11 }}
              onClick={() => {
                updateDocument((d) => {
                  const copy = structuredClone(style)
                  copy.id = `${style.id}-copy`
                  copy.name = `${style.name} Copy`
                  d.foundations.typography.styles.push(copy)
                }, 'Duplicate type style')
              }}
            >
              Duplicate
            </button>
          </div>
          <div className="fe-field">
            <label>Family</label>
            <select
              className="fe-select"
              value={style.fontFamilyId}
              onChange={(e) => {
                updateDocument((d) => {
                  const s = d.foundations.typography.styles.find((x) => x.id === style.id)
                  if (s) s.fontFamilyId = e.target.value
                })
              }}
            >
              {families.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>
          <div className="fe-inline">
            <div className="fe-field fe-grow">
              <label>Size</label>
              <input
                className="fe-input"
                value={style.fontSize}
                onChange={(e) => {
                  updateDocument((d) => {
                    const s = d.foundations.typography.styles.find((x) => x.id === style.id)
                    if (s) s.fontSize = e.target.value
                  })
                }}
              />
            </div>
            <div className="fe-field" style={{ width: 80 }}>
              <label>Weight</label>
              <input
                className="fe-input"
                type="number"
                value={style.fontWeight}
                onChange={(e) => {
                  updateDocument((d) => {
                    const s = d.foundations.typography.styles.find((x) => x.id === style.id)
                    if (s) s.fontWeight = Number(e.target.value)
                  })
                }}
              />
            </div>
          </div>
          <div className="fe-inline">
            <div className="fe-field fe-grow">
              <label>Line height</label>
              <input
                className="fe-input"
                value={style.lineHeight}
                onChange={(e) => {
                  updateDocument((d) => {
                    const s = d.foundations.typography.styles.find((x) => x.id === style.id)
                    if (s) s.lineHeight = e.target.value
                  })
                }}
              />
            </div>
            <div className="fe-field fe-grow">
              <label>Tracking</label>
              <input
                className="fe-input"
                value={style.letterSpacing}
                onChange={(e) => {
                  updateDocument((d) => {
                    const s = d.foundations.typography.styles.find((x) => x.id === style.id)
                    if (s) s.letterSpacing = e.target.value
                  })
                }}
              />
            </div>
          </div>
        </div>
      ))}

      <button
        type="button"
        className="fe-btn"
        onClick={() => {
          updateDocument((d) => {
            d.foundations.typography.styles.push({
              id: `custom-${Date.now()}`,
              name: 'Custom style',
              role: 'custom',
              fontFamilyId: 'sans',
              fontSize: '1rem',
              fontWeight: 500,
              lineHeight: '1.5',
              letterSpacing: '0',
              textTransform: 'none',
            })
          }, 'Add type style')
        }}
      >
        Add style
      </button>
    </div>
  )
}

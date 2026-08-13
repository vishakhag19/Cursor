import { useMemo, useState } from 'react'
import { useEditorStore } from '@/store/editor-store'
import { emitTokenCss } from '@/export/codegen'
import { estimateComponentImpact } from '@/token-engine'
import { FONT_ROLE_OPTIONS, searchGoogleFonts } from '@/schema/google-fonts'
import type { FontSemanticRole } from '@/schema/types'

export function TypographyInspector() {
  const doc = useEditorStore((s) => s.doc)
  const updateDocument = useEditorStore((s) => s.updateDocument)
  const inspectorTab = useEditorStore((s) => s.inspectorTab)
  const styles = doc.foundations.typography.styles
  const families = doc.foundations.typography.families
  const impact = estimateComponentImpact(doc, 'typography')
  const [fontQuery, setFontQuery] = useState('')
  const [editingStyleId, setEditingStyleId] = useState<string | null>(styles[0]?.id ?? null)
  const catalog = useMemo(() => searchGoogleFonts(fontQuery), [fontQuery])

  if (inspectorTab === 'code') {
    return <pre className="fe-code">{emitTokenCss(doc, 'typography')}</pre>
  }

  const editing = styles.find((s) => s.id === editingStyleId) ?? styles[0]

  return (
    <div className="fe-stack">
      <div className="fe-impact">
        Typography changes affect {impact.count} components. Assign families to semantic roles,
        then bind text styles to those families.
      </div>

      <div className="fe-field">
        <label>Font families ({families.length})</label>
      </div>

      {families.map((family) => (
        <div
          key={family.id}
          style={{
            border: '1px solid var(--fe-border)',
            borderRadius: 6,
            padding: 8,
            marginBottom: 6,
            background: 'var(--fe-panel-2)',
          }}
        >
          <div className="fe-inline" style={{ marginBottom: 6 }}>
            <input
              className="fe-input fe-grow"
              value={family.name}
              onChange={(e) => {
                updateDocument((d) => {
                  const f = d.foundations.typography.families.find((x) => x.id === family.id)
                  if (f) f.name = e.target.value
                }, 'Rename font family')
              }}
              aria-label="Family name"
            />
            <button
              type="button"
              className="fe-btn fe-btn-ghost"
              disabled={families.length <= 1}
              onClick={() => {
                updateDocument((d) => {
                  d.foundations.typography.families = d.foundations.typography.families.filter(
                    (x) => x.id !== family.id,
                  )
                  const fallback = d.foundations.typography.families[0]?.id
                  for (const style of d.foundations.typography.styles) {
                    if (style.fontFamilyId === family.id && fallback) {
                      style.fontFamilyId = fallback
                    }
                  }
                }, 'Delete font family')
              }}
            >
              Delete
            </button>
          </div>
          <div className="fe-field">
            <label>Semantic role</label>
            <select
              className="fe-select"
              value={family.role ?? 'custom'}
              onChange={(e) => {
                updateDocument((d) => {
                  const f = d.foundations.typography.families.find((x) => x.id === family.id)
                  if (f) f.role = e.target.value as FontSemanticRole
                })
              }}
            >
              {FONT_ROLE_OPTIONS.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          <div className="fe-field">
            <label>Google Font</label>
            <select
              className="fe-select"
              value={family.family}
              onChange={(e) => {
                const entry = catalog.find((c) => c.family === e.target.value)
                  ?? searchGoogleFonts('').find((c) => c.family === e.target.value)
                updateDocument((d) => {
                  const f = d.foundations.typography.families.find((x) => x.id === family.id)
                  if (f) {
                    f.family = e.target.value
                    f.source = 'google'
                    if (entry) f.weights = entry.weights
                  }
                }, `Font ${family.name}`)
              }}
            >
              {!catalog.some((c) => c.family === family.family) && (
                <option value={family.family}>{family.family}</option>
              )}
              {catalog.map((font) => (
                <option key={font.family} value={font.family}>
                  {font.family} ({font.category})
                </option>
              ))}
            </select>
          </div>
          <div
            style={{
              fontFamily: `"${family.family}", ${family.fallback}`,
              fontSize: 18,
              padding: '6px 0',
            }}
          >
            The quick brown fox jumps over the lazy dog
          </div>
        </div>
      ))}

      <div className="fe-field">
        <label htmlFor="font-search">Browse Google Fonts</label>
        <input
          id="font-search"
          className="fe-input"
          placeholder="Search 60+ open-source fonts…"
          value={fontQuery}
          onChange={(e) => setFontQuery(e.target.value)}
        />
      </div>
      <div style={{ maxHeight: 120, overflow: 'auto', border: '1px solid var(--fe-border)', borderRadius: 6 }}>
        {catalog.slice(0, 40).map((font) => (
          <button
            key={font.family}
            type="button"
            className="fe-row"
            style={{ width: '100%', border: 'none', background: 'transparent', textAlign: 'left' }}
            onClick={() => {
              updateDocument((d) => {
                const id = `font-${Date.now()}`
                d.foundations.typography.families.push({
                  id,
                  name: font.family,
                  family: font.family,
                  fallback:
                    font.category === 'monospace'
                      ? 'ui-monospace, monospace'
                      : font.category === 'serif'
                        ? 'Georgia, serif'
                        : 'system-ui, sans-serif',
                  source: 'google',
                  weights: font.weights,
                  role: font.category === 'monospace' ? 'monospace' : font.category === 'serif' || font.category === 'display' ? 'display' : 'custom',
                })
              }, `Add font ${font.family}`)
            }}
          >
            <span className="fe-grow" style={{ fontFamily: `"${font.family}", sans-serif` }}>
              {font.family}
            </span>
            <span className="fe-badge">{font.category}</span>
          </button>
        ))}
      </div>

      <button
        type="button"
        className="fe-btn"
        onClick={() => {
          updateDocument((d) => {
            d.foundations.typography.families.push({
              id: `font-${Date.now()}`,
              name: 'Custom family',
              family: 'Inter',
              fallback: 'system-ui, sans-serif',
              source: 'google',
              weights: [400, 500, 600, 700],
              role: 'custom',
            })
          }, 'Add font family')
        }}
      >
        Add font family
      </button>

      <div className="fe-divider" />
      <div className="fe-field">
        <label>Text styles ({styles.length})</label>
      </div>

      {styles.map((style) => (
        <button
          key={style.id}
          type="button"
          className="fe-row"
          data-active={editing?.id === style.id}
          style={{ width: '100%', border: 'none', background: editing?.id === style.id ? 'var(--fe-selected)' : 'transparent', textAlign: 'left' }}
          onClick={() => setEditingStyleId(style.id)}
        >
          <span
            className="fe-grow"
            style={{
              fontFamily: `var(--type-${style.id}-family, inherit)`,
              fontSize: Math.min(parseFloat(style.fontSize) * (style.fontSize.includes('rem') ? 14 : 1), 22),
              fontWeight: style.fontWeight,
            }}
          >
            {style.name}
          </span>
          <span className="fe-tertiary" style={{ fontSize: 11 }}>
            {style.fontSize}
          </span>
        </button>
      ))}

      {editing && (
        <div
          style={{
            border: '1px solid var(--fe-border)',
            borderRadius: 6,
            padding: 10,
            background: 'var(--fe-panel-2)',
          }}
        >
          <div className="fe-inline" style={{ marginBottom: 8 }}>
            <input
              className="fe-input fe-grow"
              value={editing.name}
              onChange={(e) => {
                updateDocument((d) => {
                  const s = d.foundations.typography.styles.find((x) => x.id === editing.id)
                  if (s) s.name = e.target.value
                }, 'Rename type style')
              }}
            />
            <button
              type="button"
              className="fe-btn fe-btn-ghost"
              onClick={() => {
                updateDocument((d) => {
                  const copy = structuredClone(editing)
                  copy.id = `${editing.id}-${Date.now()}`
                  copy.name = `${editing.name} Copy`
                  d.foundations.typography.styles.push(copy)
                  setEditingStyleId(copy.id)
                }, 'Duplicate type style')
              }}
            >
              Duplicate
            </button>
            <button
              type="button"
              className="fe-btn fe-btn-ghost"
              disabled={styles.length <= 1}
              onClick={() => {
                updateDocument((d) => {
                  d.foundations.typography.styles = d.foundations.typography.styles.filter(
                    (x) => x.id !== editing.id,
                  )
                }, 'Delete type style')
                setEditingStyleId(styles.find((s) => s.id !== editing.id)?.id ?? null)
              }}
            >
              Delete
            </button>
          </div>
          <div className="fe-field">
            <label>Role</label>
            <input
              className="fe-input"
              value={editing.role}
              onChange={(e) => {
                updateDocument((d) => {
                  const s = d.foundations.typography.styles.find((x) => x.id === editing.id)
                  if (s) s.role = e.target.value
                })
              }}
            />
          </div>
          <div className="fe-field">
            <label>Family</label>
            <select
              className="fe-select"
              value={editing.fontFamilyId}
              onChange={(e) => {
                updateDocument((d) => {
                  const s = d.foundations.typography.styles.find((x) => x.id === editing.id)
                  if (s) s.fontFamilyId = e.target.value
                })
              }}
            >
              {families.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name} ({f.role})
                </option>
              ))}
            </select>
          </div>
          <div className="fe-inline">
            <div className="fe-field fe-grow">
              <label>Size</label>
              <input
                className="fe-input"
                value={editing.fontSize}
                onChange={(e) => {
                  updateDocument((d) => {
                    const s = d.foundations.typography.styles.find((x) => x.id === editing.id)
                    if (s) s.fontSize = e.target.value
                  })
                }}
              />
            </div>
            <div className="fe-field" style={{ width: 90 }}>
              <label>Weight</label>
              <input
                className="fe-input"
                type="number"
                step={50}
                value={editing.fontWeight}
                onChange={(e) => {
                  updateDocument((d) => {
                    const s = d.foundations.typography.styles.find((x) => x.id === editing.id)
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
                value={editing.lineHeight}
                onChange={(e) => {
                  updateDocument((d) => {
                    const s = d.foundations.typography.styles.find((x) => x.id === editing.id)
                    if (s) s.lineHeight = e.target.value
                  })
                }}
              />
            </div>
            <div className="fe-field fe-grow">
              <label>Letter spacing</label>
              <input
                className="fe-input"
                value={editing.letterSpacing}
                onChange={(e) => {
                  updateDocument((d) => {
                    const s = d.foundations.typography.styles.find((x) => x.id === editing.id)
                    if (s) s.letterSpacing = e.target.value
                  })
                }}
              />
            </div>
          </div>
          <div className="fe-field">
            <label>Transform</label>
            <select
              className="fe-select"
              value={editing.textTransform}
              onChange={(e) => {
                updateDocument((d) => {
                  const s = d.foundations.typography.styles.find((x) => x.id === editing.id)
                  if (s) {
                    s.textTransform = e.target.value as typeof s.textTransform
                  }
                })
              }}
            >
              <option value="none">None</option>
              <option value="uppercase">Uppercase</option>
              <option value="lowercase">Lowercase</option>
              <option value="capitalize">Capitalize</option>
            </select>
          </div>
        </div>
      )}

      <button
        type="button"
        className="fe-btn"
        onClick={() => {
          const id = `style-${Date.now()}`
          updateDocument((d) => {
            d.foundations.typography.styles.push({
              id,
              name: 'Custom style',
              role: 'custom',
              fontFamilyId: d.foundations.typography.families[0]?.id ?? 'sans',
              fontSize: '1rem',
              fontWeight: 500,
              lineHeight: '1.5',
              letterSpacing: '0',
              textTransform: 'none',
            })
          }, 'Add type style')
          setEditingStyleId(id)
        }}
      >
        Add text style
      </button>
    </div>
  )
}

import { PRESETS } from '@/presets'
import { useEditorStore } from '@/store/editor-store'
import { createDefaultDesignSystem, createBlankDesignSystem } from '@/schema/defaults'

export function ThemesInspector() {
  const doc = useEditorStore((s) => s.doc)
  const replaceDocument = useEditorStore((s) => s.replaceDocument)
  const updateDocument = useEditorStore((s) => s.updateDocument)
  const setPreviewTheme = useEditorStore((s) => s.setPreviewTheme)

  return (
    <div className="fe-stack">
      <div className="fe-impact">
        Themes switch semantic resolution. Presets replace foundations with attributed starting points —
        not official vendor implementations.
      </div>

      <div className="fe-field">
        <label>Active themes</label>
      </div>
      {doc.themes.map((theme) => (
        <button
          key={theme.id}
          type="button"
          className="fe-row"
          style={{ width: '100%', border: 'none', background: 'transparent', textAlign: 'left' }}
          onClick={() => {
            if (theme.mode === 'light' || theme.mode === 'dark') setPreviewTheme(theme.mode)
          }}
        >
          <span className="fe-grow">{theme.name}</span>
          <span className="fe-badge">{theme.mode}</span>
        </button>
      ))}

      <button
        type="button"
        className="fe-btn"
        onClick={() => {
          updateDocument((d) => {
            d.themes.push({
              id: `custom-${Date.now()}`,
              name: 'Custom theme',
              mode: 'custom',
              overrides: {},
            })
          }, 'Add theme')
        }}
      >
        Add custom theme
      </button>

      <div className="fe-divider" />
      <div className="fe-field"><label>Starting points</label></div>

      <button
        type="button"
        className="fe-btn"
        onClick={() => replaceDocument(createDefaultDesignSystem(), 'Load Forge Default')}
      >
        Forge Default
      </button>
      <button
        type="button"
        className="fe-btn"
        onClick={() => replaceDocument(createBlankDesignSystem(), 'Start from scratch')}
      >
        Start from scratch
      </button>

      {PRESETS.map((preset) => (
        <button
          key={preset.id}
          type="button"
          className="fe-btn"
          style={{ height: 'auto', padding: '8px 10px', textAlign: 'left', display: 'block' }}
          onClick={() => replaceDocument(preset.create(), `Load preset ${preset.name}`)}
        >
          <div style={{ fontWeight: 600 }}>{preset.name}</div>
          <div className="fe-tertiary" style={{ fontSize: 11, marginTop: 2 }}>
            {preset.attribution} · {preset.license}
          </div>
          <div className="fe-muted" style={{ fontSize: 11.5, marginTop: 4 }}>
            {preset.description}
          </div>
        </button>
      ))}
    </div>
  )
}

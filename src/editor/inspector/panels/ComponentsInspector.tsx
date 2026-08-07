import { useMemo, useState } from 'react'
import { useEditorStore } from '@/store/editor-store'
import { COMPONENT_REGISTRY } from '@/components/registry'
import { emitComponentCode } from '@/export/codegen'

export function ComponentsInspector() {
  const doc = useEditorStore((s) => s.doc)
  const updateDocument = useEditorStore((s) => s.updateDocument)
  const selection = useEditorStore((s) => s.selection)
  const inspectorTab = useEditorStore((s) => s.inspectorTab)
  const setPreviewComponentId = useEditorStore((s) => s.setPreviewComponentId)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('All')

  const categories = useMemo(
    () => ['All', ...new Set(COMPONENT_REGISTRY.map((c) => c.category))],
    [],
  )

  const filtered = COMPONENT_REGISTRY.filter((c) => {
    const matchesQuery =
      !query ||
      c.name.toLowerCase().includes(query.toLowerCase()) ||
      c.id.includes(query.toLowerCase())
    const matchesCat = category === 'All' || c.category === category
    return matchesQuery && matchesCat
  })

  const selected = new Set(doc.components.selectedIds)
  const activeId = selection.componentId
  const active = COMPONENT_REGISTRY.find((c) => c.id === activeId)

  if (inspectorTab === 'code' && active?.available) {
    return <pre className="fe-code">{emitComponentCode(active.id)}</pre>
  }

  return (
    <div className="fe-stack">
      <div className="fe-impact">
        {selected.size} of {COMPONENT_REGISTRY.length} components selected
      </div>

      <input
        className="fe-input"
        placeholder="Search components…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <select className="fe-select" value={category} onChange={(e) => setCategory(e.target.value)}>
        {categories.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>

      <div className="fe-inline">
        <button
          type="button"
          className="fe-btn"
          onClick={() => {
            updateDocument((d) => {
              d.components.selectedIds = COMPONENT_REGISTRY.filter((c) => c.available).map((c) => c.id)
            }, 'Select available')
          }}
        >
          Select core
        </button>
        <button
          type="button"
          className="fe-btn"
          onClick={() => {
            updateDocument((d) => {
              d.components.selectedIds = []
            }, 'Clear selection')
          }}
        >
          Clear
        </button>
      </div>

      <div className="fe-divider" />

      {filtered.map((item) => {
        const isOn = selected.has(item.id)
        return (
          <div
            key={item.id}
            className="fe-row"
            data-active={activeId === item.id}
            style={{ alignItems: 'flex-start', paddingTop: 8, paddingBottom: 8 }}
          >
            <input
              type="checkbox"
              checked={isOn}
              onChange={() => {
                updateDocument((d) => {
                  if (isOn) {
                    d.components.selectedIds = d.components.selectedIds.filter((id) => id !== item.id)
                  } else {
                    d.components.selectedIds.push(item.id)
                  }
                }, isOn ? `Remove ${item.name}` : `Add ${item.name}`)
              }}
              aria-label={`Include ${item.name}`}
            />
            <button
              type="button"
              className="fe-grow"
              style={{
                border: 'none',
                background: 'transparent',
                textAlign: 'left',
                padding: 0,
                cursor: 'pointer',
              }}
              onClick={() => {
                useEditorStore.getState().setSelection({
                  section: 'components',
                  componentId: item.id,
                })
                setPreviewComponentId(item.id)
              }}
            >
              <div style={{ fontWeight: 500 }}>{item.name}</div>
              <div className="fe-tertiary" style={{ fontSize: 11 }}>
                {item.description}
              </div>
            </button>
            {!item.available && <span className="fe-badge">soon</span>}
          </div>
        )
      })}

      {active?.available && inspectorTab === 'visual' && (
        <>
          <div className="fe-divider" />
          <div className="fe-field">
            <label>Component tokens</label>
            <p className="fe-muted" style={{ margin: 0, fontSize: 12 }}>
              {active.name} consumes semantic color, radius, spacing, type, and motion tokens.
              Prefer token references; overrides are stored per component when set.
            </p>
          </div>
          <div className="fe-field">
            <label>Override radius (optional)</label>
            <input
              className="fe-input"
              placeholder="e.g. var(--radius-lg) or 12px"
              value={
                (doc.components.overrides[active.id]?.props?.radius as { value?: string } | undefined)
                  ?.value ?? ''
              }
              onChange={(e) => {
                const value = e.target.value
                updateDocument((d) => {
                  d.components.overrides[active.id] ??= { props: {} }
                  d.components.overrides[active.id]!.props ??= {}
                  if (!value) {
                    delete d.components.overrides[active.id]!.props!.radius
                  } else if (value.startsWith('var(') || value.includes('--')) {
                    d.components.overrides[active.id]!.props!.radius = {
                      type: 'literal',
                      value,
                    }
                  } else {
                    d.components.overrides[active.id]!.props!.radius = {
                      type: 'literal',
                      value,
                    }
                  }
                }, `${active.name} radius override`)
              }}
            />
          </div>
        </>
      )}
    </div>
  )
}

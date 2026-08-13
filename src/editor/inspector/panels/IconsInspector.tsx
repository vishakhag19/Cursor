import { useMemo, useState } from 'react'
import type { IconLibraryId, IconStyleVariant, IconsSubPanel } from '@/schema/types'
import { useEditorStore } from '@/store/editor-store'
import { remapSemanticIcons } from '@/icons/remap'
import { AVAILABLE_LUCIDE_ICONS, resolveLucideIcon } from '@/components/semantic-icon/SemanticIcon'

const PANELS: Array<{ id: IconsSubPanel; label: string }> = [
  { id: 'library', label: 'Library' },
  { id: 'browser', label: 'Browser' },
  { id: 'sizes', label: 'Sizes' },
  { id: 'stroke', label: 'Stroke & Style' },
  { id: 'colors', label: 'Colors' },
  { id: 'semantic', label: 'Semantic' },
  { id: 'custom', label: 'Custom' },
]

const LIBRARIES: Array<{ id: IconLibraryId; label: string; note: string }> = [
  { id: 'lucide', label: 'Lucide', note: 'Default — tree-shakeable React icons (MIT)' },
  { id: 'phosphor', label: 'Phosphor', note: 'Export adds @phosphor-icons/react (MIT)' },
  { id: 'tabler', label: 'Tabler Icons', note: 'Export adds @tabler/icons-react (MIT)' },
  { id: 'heroicons', label: 'Heroicons', note: 'Export adds @heroicons/react (MIT)' },
  { id: 'material', label: 'Material Symbols', note: 'Export notes Material Symbols usage (Apache-2.0)' },
]

const STYLES: IconStyleVariant[] = ['outline', 'filled', 'duotone', 'rounded', 'sharp']

export function IconsInspector() {
  const doc = useEditorStore((s) => s.doc)
  const updateDocument = useEditorStore((s) => s.updateDocument)
  const [panel, setPanel] = useState<IconsSubPanel>('library')
  const [query, setQuery] = useState('')

  const icons = useMemo(() => {
    const q = query.trim().toLowerCase()
    return AVAILABLE_LUCIDE_ICONS.filter((id) => !q || id.toLowerCase().includes(q))
  }, [query])

  return (
    <div className="fe-stack">
      <div className="fe-seg" style={{ flexWrap: 'wrap', height: 'auto' }}>
        {PANELS.map((p) => (
          <button
            key={p.id}
            type="button"
            data-active={panel === p.id}
            onClick={() => setPanel(p.id)}
          >
            {p.label}
          </button>
        ))}
      </div>

      {panel === 'library' && (
        <>
          <div className="fe-impact">
            Components reference semantic icon roles. Switching libraries remaps equivalents and flags
            anything that needs review.
          </div>
          <div className="fe-field">
            <label htmlFor="icon-lib">Default icon library</label>
            <select
              id="icon-lib"
              className="fe-select"
              value={doc.icons.libraryId}
              onChange={(e) => {
                const next = e.target.value as IconLibraryId
                updateDocument((d) => {
                  const previous = d.icons.libraryId
                  const { map, reviewFlags } = remapSemanticIcons(d.icons.semanticMap, previous, next)
                  d.icons.libraryId = next
                  d.icons.semanticMap = map
                  d.icons.reviewFlags = reviewFlags
                }, 'Switch icon library')
              }}
            >
              {LIBRARIES.map((lib) => (
                <option key={lib.id} value={lib.id}>
                  {lib.label}
                </option>
              ))}
            </select>
            <span className="fe-tertiary" style={{ fontSize: 11 }}>
              {LIBRARIES.find((l) => l.id === doc.icons.libraryId)?.note}
            </span>
          </div>
          {(doc.icons.reviewFlags?.length ?? 0) > 0 && (
            <div className="fe-warn">
              {doc.icons.reviewFlags.length} semantic mapping
              {doc.icons.reviewFlags.length === 1 ? '' : 's'} need review after library switch:{' '}
              {doc.icons.reviewFlags.join(', ')}
            </div>
          )}
        </>
      )}

      {panel === 'browser' && (
        <>
          <input
            className="fe-input"
            placeholder="Search icons…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 6,
              maxHeight: 280,
              overflow: 'auto',
            }}
          >
            {icons.map((id) => {
              const Icon = resolveLucideIcon(id)
              const included = doc.icons.includedIds.includes(id)
              return (
                <button
                  key={id}
                  type="button"
                  className="fe-btn"
                  style={{
                    height: 'auto',
                    flexDirection: 'column',
                    padding: 8,
                    gap: 4,
                    background: included ? 'var(--fe-selected)' : undefined,
                  }}
                  onClick={() => {
                    updateDocument((d) => {
                      if (included) {
                        d.icons.includedIds = d.icons.includedIds.filter((x) => x !== id)
                      } else {
                        d.icons.includedIds.push(id)
                      }
                    }, included ? `Exclude icon ${id}` : `Include icon ${id}`)
                  }}
                  title={id}
                >
                  <Icon size={18} strokeWidth={doc.icons.strokeWidth} />
                  <span style={{ fontSize: 9, overflow: 'hidden', textOverflow: 'ellipsis', width: '100%' }}>
                    {id}
                  </span>
                </button>
              )
            })}
          </div>
          <div className="fe-muted" style={{ fontSize: 11 }}>
            {doc.icons.includedIds.length} icons selected for export
          </div>
        </>
      )}

      {panel === 'sizes' && (
        <>
          {doc.icons.sizes.map((size) => (
            <div key={size.id} className="fe-field">
              <label>{size.name}</label>
              <div className="fe-inline">
                <input
                  className="fe-input"
                  value={size.value}
                  onChange={(e) => {
                    updateDocument((d) => {
                      const t = d.icons.sizes.find((x) => x.id === size.id)
                      if (t) t.value = e.target.value
                    })
                  }}
                />
                <input
                  className="fe-input"
                  value={size.name}
                  onChange={(e) => {
                    updateDocument((d) => {
                      const t = d.icons.sizes.find((x) => x.id === size.id)
                      if (t) t.name = e.target.value
                    })
                  }}
                  style={{ width: 80 }}
                />
              </div>
            </div>
          ))}
          <button
            type="button"
            className="fe-btn"
            onClick={() => {
              updateDocument((d) => {
                d.icons.sizes.push({
                  id: `size-${d.icons.sizes.length + 1}`,
                  name: 'Custom',
                  value: '18px',
                })
              })
            }}
          >
            Add size token
          </button>
        </>
      )}

      {panel === 'stroke' && (
        <>
          <div className="fe-field">
            <label htmlFor="stroke">Stroke width</label>
            <input
              id="stroke"
              className="fe-input"
              type="number"
              step={0.25}
              value={doc.icons.strokeWidth}
              onChange={(e) => {
                updateDocument((d) => {
                  d.icons.strokeWidth = Number(e.target.value)
                })
              }}
            />
          </div>
          <div className="fe-field">
            <label>Style variant</label>
            <select
              className="fe-select"
              value={doc.icons.styleVariant ?? 'outline'}
              onChange={(e) => {
                updateDocument((d) => {
                  d.icons.styleVariant = e.target.value as IconStyleVariant
                })
              }}
            >
              {STYLES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <span className="fe-tertiary" style={{ fontSize: 11 }}>
              Applied where the selected library supports the variant.
            </span>
          </div>
        </>
      )}

      {panel === 'colors' && (
        <div className="fe-field">
          <label>Default icon color (semantic)</label>
          <select
            className="fe-select"
            value={doc.icons.defaultColorSemanticId ?? 'text'}
            onChange={(e) => {
              updateDocument((d) => {
                d.icons.defaultColorSemanticId = e.target.value
              })
            }}
          >
            {doc.foundations.colors.semantics.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {panel === 'semantic' && (
        <>
          <div className="fe-impact">
            Components bind to these roles. Changing a mapping updates dialogs, drawers, alerts, and
            actions in real time.
          </div>
          {Object.entries(doc.icons.semanticMap).map(([role, iconId]) => {
            const Icon = resolveLucideIcon(iconId)
            const needsReview = doc.icons.reviewFlags?.includes(role as never)
            return (
              <div key={role} className="fe-field">
                <label>
                  {role} {needsReview ? '⚠' : ''}
                </label>
                <div className="fe-inline">
                  <Icon size={16} strokeWidth={doc.icons.strokeWidth} />
                  <select
                    className="fe-select"
                    value={iconId}
                    onChange={(e) => {
                      updateDocument((d) => {
                        d.icons.semanticMap[role] = e.target.value
                        d.icons.reviewFlags = (d.icons.reviewFlags ?? []).filter((r) => r !== role)
                      }, `Map ${role}`)
                    }}
                  >
                    {AVAILABLE_LUCIDE_ICONS.map((id) => (
                      <option key={id} value={id}>
                        {id}
                      </option>
                    ))}
                    {!AVAILABLE_LUCIDE_ICONS.includes(iconId) && (
                      <option value={iconId}>{iconId}</option>
                    )}
                  </select>
                </div>
              </div>
            )
          })}
          <button
            type="button"
            className="fe-btn"
            onClick={() => {
              updateDocument((d) => {
                d.icons.semanticMap[`custom.${Date.now()}`] = 'Plus'
              }, 'Add semantic icon')
            }}
          >
            Add semantic role
          </button>
        </>
      )}

      {panel === 'custom' && (
        <>
          <div className="fe-field">
            <label htmlFor="custom-svg">Upload custom SVG</label>
            <input
              id="custom-svg"
              type="file"
              accept=".svg,image/svg+xml"
              onChange={async (e) => {
                const file = e.target.files?.[0]
                if (!file) return
                const svg = await file.text()
                updateDocument((d) => {
                  d.icons.customSvgs.push({
                    id: `custom-${Date.now()}`,
                    name: file.name.replace(/\.svg$/i, ''),
                    svg,
                  })
                }, 'Upload custom icon')
              }}
            />
          </div>
          {doc.icons.customSvgs.map((icon) => (
            <div key={icon.id} className="fe-row">
              <span
                dangerouslySetInnerHTML={{ __html: icon.svg }}
                style={{ width: 20, height: 20, display: 'grid', placeItems: 'center' }}
              />
              <span className="fe-grow">{icon.name}</span>
              <button
                type="button"
                className="fe-btn fe-btn-ghost"
                onClick={() => {
                  updateDocument((d) => {
                    d.icons.customSvgs = d.icons.customSvgs.filter((x) => x.id !== icon.id)
                  })
                }}
              >
                Remove
              </button>
            </div>
          ))}
        </>
      )}
    </div>
  )
}

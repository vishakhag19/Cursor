import {
  Palette,
  Type,
  MoveHorizontal,
  BoxSelect,
  Circle,
  Square,
  Eclipse,
  Wind,
  Columns,
  Smile,
  Component,
  SwatchBook,
  Droplets,
} from 'lucide-react'
import { useEditorStore } from '@/store/editor-store'
import { getComponentsByCategory } from '@/components/registry'
import type { EditorSection } from '@/schema/types'

const foundations: Array<{ id: EditorSection; label: string; icon: typeof Palette }> = [
  { id: 'colors', label: 'Colors', icon: Palette },
  { id: 'typography', label: 'Typography', icon: Type },
  { id: 'spacing', label: 'Spacing', icon: MoveHorizontal },
  { id: 'sizing', label: 'Sizing', icon: BoxSelect },
  { id: 'radius', label: 'Radius', icon: Circle },
  { id: 'borders', label: 'Borders', icon: Square },
  { id: 'shadows', label: 'Shadows', icon: Eclipse },
  { id: 'motion', label: 'Motion', icon: Wind },
  { id: 'opacity', label: 'Opacity', icon: Droplets },
  { id: 'breakpoints', label: 'Breakpoints', icon: Columns },
  { id: 'icons', label: 'Icons', icon: Smile },
]

export function Sidebar() {
  const selection = useEditorStore((s) => s.selection)
  const setSelection = useEditorStore((s) => s.setSelection)
  const setPreviewComponentId = useEditorStore((s) => s.setPreviewComponentId)
  const doc = useEditorStore((s) => s.doc)
  const byCategory = getComponentsByCategory()
  const selectedCount = doc.components.selectedIds.length

  return (
    <aside className="fe-sidebar">
      <div className="fe-panel-header">
        <span>System</span>
        <span className="fe-badge">{selectedCount} comps</span>
      </div>
      <div className="fe-panel-scroll">
        <div className="fe-nav-section">
          <div className="fe-nav-label">Foundations</div>
          {foundations.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.id}
                type="button"
                className="fe-nav-item"
                data-active={selection.section === item.id}
                onClick={() => setSelection({ section: item.id, componentId: undefined })}
              >
                <Icon />
                {item.label}
              </button>
            )
          })}
        </div>

        <div className="fe-nav-section">
          <div className="fe-nav-label">
            Components
            <button
              type="button"
              className="fe-btn fe-btn-ghost"
              style={{ height: 20, padding: '0 4px', marginLeft: 6, fontSize: 10 }}
              onClick={() => setSelection({ section: 'components' })}
            >
              Manage
            </button>
          </div>
          {Object.entries(byCategory).map(([category, items]) => {
            const selectedInCat = items.filter((i) => doc.components.selectedIds.includes(i.id))
            if (selectedInCat.length === 0) return null
            return (
              <div key={category} style={{ marginBottom: 6 }}>
                <div className="fe-tertiary" style={{ padding: '4px 8px', fontSize: 10.5 }}>
                  {category}
                </div>
                {selectedInCat.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="fe-nav-item"
                    data-active={
                      selection.section === 'components' && selection.componentId === item.id
                    }
                    onClick={() => {
                      setSelection({ section: 'components', componentId: item.id })
                      setPreviewComponentId(item.id)
                    }}
                  >
                    <Component />
                    <span className="fe-grow">{item.name}</span>
                    {!item.available && <span className="fe-badge">soon</span>}
                  </button>
                ))}
              </div>
            )
          })}
        </div>

        <div className="fe-nav-section">
          <div className="fe-nav-label">Themes</div>
          <button
            type="button"
            className="fe-nav-item"
            data-active={selection.section === 'themes'}
            onClick={() => setSelection({ section: 'themes' })}
          >
            <SwatchBook />
            Themes & Presets
          </button>
        </div>
      </div>
    </aside>
  )
}

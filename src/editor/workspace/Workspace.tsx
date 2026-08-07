import { useEditorStore } from '@/store/editor-store'
import type { PreviewMode } from '@/schema/types'
import { WorkspacePreview } from '@/preview/WorkspacePreview'

const modes: Array<{ id: PreviewMode; label: string }> = [
  { id: 'individual', label: 'Component' },
  { id: 'states', label: 'States' },
  { id: 'gallery', label: 'Gallery' },
  { id: 'compare', label: 'Compare' },
  { id: 'responsive', label: 'Responsive' },
  { id: 'example', label: 'Example app' },
]

export function Workspace() {
  const previewMode = useEditorStore((s) => s.previewMode)
  const setPreviewMode = useEditorStore((s) => s.setPreviewMode)
  const responsiveWidth = useEditorStore((s) => s.responsiveWidth)
  const setResponsiveWidth = useEditorStore((s) => s.setResponsiveWidth)
  const previewComponentId = useEditorStore((s) => s.previewComponentId)

  return (
    <main className="fe-workspace">
      <div className="fe-workspace-toolbar">
        <div className="fe-seg" role="tablist" aria-label="Preview mode">
          {modes.map((mode) => (
            <button
              key={mode.id}
              type="button"
              role="tab"
              aria-selected={previewMode === mode.id}
              data-active={previewMode === mode.id}
              onClick={() => setPreviewMode(mode.id)}
            >
              {mode.label}
            </button>
          ))}
        </div>
        <div className="fe-toolbar-spacer" />
        {previewMode === 'responsive' && (
          <div className="fe-inline">
            <span className="fe-tertiary" style={{ fontSize: 11 }}>Width</span>
            <input
              className="fe-input"
              type="range"
              min={320}
              max={1100}
              value={responsiveWidth}
              onChange={(e) => setResponsiveWidth(Number(e.target.value))}
              style={{ width: 120 }}
            />
            <span className="fe-mono fe-muted" style={{ fontSize: 11, fontFamily: 'var(--fe-mono)' }}>
              {responsiveWidth}px
            </span>
          </div>
        )}
        <span className="fe-muted" style={{ fontSize: 12 }}>
          {previewComponentId}
        </span>
      </div>
      <div className="fe-workspace-canvas">
        <WorkspacePreview />
      </div>
    </main>
  )
}

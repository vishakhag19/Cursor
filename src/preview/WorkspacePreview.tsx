import { useEditorStore } from '@/store/editor-store'
import { PreviewRoot } from './PreviewRoot'
import { COMPONENT_REGISTRY } from '@/components/registry'

export function WorkspacePreview() {
  const doc = useEditorStore((s) => s.doc)
  const previewTheme = useEditorStore((s) => s.previewTheme)
  const selectedIds = doc.components.selectedIds

  const items = COMPONENT_REGISTRY.filter((c) => selectedIds.includes(c.id))

  return (
    <PreviewRoot doc={doc} mode={previewTheme} className="ds-preview ds-preview--catalog">
      <div className="ds-catalog">
        {items.map((item) => (
          <section key={item.id} className="ds-catalog-section" id={`component-${item.id}`}>
            <header className="ds-catalog-header">
              <h3>{item.name}</h3>
              <p>{item.description}</p>
            </header>
            <div className="ds-catalog-body">
              {item.available ? item.renderPreview() : <Unavailable name={item.name} />}
            </div>
          </section>
        ))}
      </div>
    </PreviewRoot>
  )
}

function Unavailable({ name }: { name: string }) {
  return (
    <div style={{ color: 'var(--muted)' }}>
      {name} is in your catalog selection but not implemented yet.
    </div>
  )
}

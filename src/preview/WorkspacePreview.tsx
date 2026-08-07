import { useEditorStore } from '@/store/editor-store'
import { PreviewRoot } from './PreviewRoot'
import { getComponent, getAvailableComponents, COMPONENT_REGISTRY } from '@/components/registry'
import { Button } from '@/components/button/Button'
import { Input } from '@/components/input/Input'
import { Card } from '@/components/card/Card'
import { Badge } from '@/components/badge/Badge'
import { Switch } from '@/components/switch/Switch'
import { Tabs } from '@/components/tabs/Tabs'

export function WorkspacePreview() {
  const doc = useEditorStore((s) => s.doc)
  const previewMode = useEditorStore((s) => s.previewMode)
  const previewTheme = useEditorStore((s) => s.previewTheme)
  const previewComponentId = useEditorStore((s) => s.previewComponentId)
  const responsiveWidth = useEditorStore((s) => s.responsiveWidth)
  const selectedIds = doc.components.selectedIds

  const component = getComponent(previewComponentId)

  if (previewMode === 'compare') {
    return (
      <div className="ds-preview" data-mode="compare" style={{ background: 'transparent', border: 'none', boxShadow: 'none', padding: 0 }}>
        {(['light', 'dark'] as const).map((mode) => (
          <PreviewRoot key={mode} doc={doc} mode={mode} className="ds-preview-pane">
            <div className="ds-preview-label">{mode}</div>
            {component?.available ? component.renderPreview() : <Unavailable />}
          </PreviewRoot>
        ))}
      </div>
    )
  }

  if (previewMode === 'gallery') {
    const items = getAvailableComponents().filter((c) => selectedIds.includes(c.id))
    return (
      <PreviewRoot doc={doc} mode={previewTheme}>
        <div className="ds-gallery">
          {items.map((item) => (
            <div key={item.id} className="ds-gallery-item">
              <h4>{item.name}</h4>
              {item.renderPreview()}
            </div>
          ))}
        </div>
      </PreviewRoot>
    )
  }

  if (previewMode === 'example') {
    return (
      <PreviewRoot doc={doc} mode={previewTheme}>
        <div className="ds-example-app">
          <div className="ds-example-header">
            <h2 className="ds-example-title">Team settings</h2>
            <div className="ds-preview-row">
              <Badge variant="primary">Pro</Badge>
              <Button size="sm">Save changes</Button>
            </div>
          </div>
          <Card title="Profile" description="Update how your team appears across the product.">
            <Input label="Team name" defaultValue="Aurora Design" />
            <Input label="Support email" defaultValue="hello@aurora.example" />
            <Switch label="Allow public workspace" defaultChecked />
          </Card>
          <Tabs
            items={[
              {
                value: 'members',
                label: 'Members',
                content: (
                  <Card title="12 members" description="Manage roles and invitations.">
                    <div className="ds-preview-row">
                      <Badge>Admin</Badge>
                      <Badge variant="success">Active</Badge>
                      <Button variant="outline" size="sm">
                        Invite
                      </Button>
                    </div>
                  </Card>
                ),
              },
              {
                value: 'billing',
                label: 'Billing',
                content: <p style={{ color: 'var(--muted)', margin: 0 }}>Billing overview uses your system tokens.</p>,
              },
            ]}
          />
        </div>
      </PreviewRoot>
    )
  }

  const width = previewMode === 'responsive' ? responsiveWidth : undefined

  return (
    <PreviewRoot doc={doc} mode={previewTheme} width={width} style={width ? { maxWidth: width } : undefined}>
      {previewMode === 'states' && component?.renderStates
        ? component.renderStates()
        : component?.available
          ? component.renderPreview()
          : selectedIds.includes(previewComponentId)
            ? <Unavailable name={component?.name} />
            : (
              <div>
                <p style={{ color: 'var(--muted)', marginTop: 0 }}>
                  Select a component from the sidebar, or browse the gallery.
                </p>
                <div className="ds-preview-row">
                  {COMPONENT_REGISTRY.filter((c) => c.available && selectedIds.includes(c.id))
                    .slice(0, 4)
                    .map((c) => (
                      <Button key={c.id} variant="outline" onClick={() => useEditorStore.getState().setPreviewComponentId(c.id)}>
                        {c.name}
                      </Button>
                    ))}
                </div>
              </div>
            )}
    </PreviewRoot>
  )
}

function Unavailable({ name }: { name?: string }) {
  return (
    <div style={{ color: 'var(--muted)' }}>
      {name ?? 'This component'} is in your catalog selection but not implemented yet. Core components are fully interactive.
    </div>
  )
}

import type { ReactNode } from 'react'
import { Button } from './button/Button'
import { IconButton } from './icon-button/IconButton'
import { Input } from './input/Input'
import { Select } from './select/Select'
import { Checkbox } from './checkbox/Checkbox'
import { RadioGroup } from './radio-group/RadioGroup'
import { Switch } from './switch/Switch'
import { Tabs } from './tabs/Tabs'
import { Card } from './card/Card'
import { Badge } from './badge/Badge'
import { Dialog } from './dialog/Dialog'
import { Tooltip } from './tooltip/Tooltip'
import { Plus, Settings, Search } from 'lucide-react'

export type ComponentCategory =
  | 'Actions'
  | 'Forms'
  | 'Navigation'
  | 'Data Display'
  | 'Overlays'
  | 'Feedback'
  | 'Disclosure'
  | 'Date and Time'

export interface ComponentDefinition {
  id: string
  name: string
  category: ComponentCategory
  description: string
  available: boolean
  renderPreview: () => ReactNode
  renderStates?: () => ReactNode
}

const upcoming = (
  id: string,
  name: string,
  category: ComponentCategory,
  description: string,
): ComponentDefinition => ({
  id,
  name,
  category,
  description,
  available: false,
  renderPreview: () => (
    <div className="fe-empty" style={{ color: 'var(--muted)' }}>
      {name} is registered for selection but not yet implemented in this build.
    </div>
  ),
})

export const COMPONENT_REGISTRY: ComponentDefinition[] = [
  {
    id: 'button',
    name: 'Button',
    category: 'Actions',
    description: 'Primary action control with variants, sizes, and loading state.',
    available: true,
    renderPreview: () => (
      <div className="ds-preview-stack">
        <div>
          <div className="ds-preview-label">Variants</div>
          <div className="ds-preview-row">
            <Button variant="primary">Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="destructive">Destructive</Button>
          </div>
        </div>
        <div>
          <div className="ds-preview-label">Sizes</div>
          <div className="ds-preview-row">
            <Button size="sm">Small</Button>
            <Button size="md">Medium</Button>
            <Button size="lg">Large</Button>
            <Button loading>Loading</Button>
            <Button disabled>Disabled</Button>
          </div>
        </div>
      </div>
    ),
    renderStates: () => (
      <div className="ds-state-grid">
        {(['Default', 'Hover', 'Focus', 'Disabled', 'Loading'] as const).map((state) => (
          <div className="ds-state-cell" key={state}>
            <div className="ds-preview-label">{state}</div>
            <Button
              disabled={state === 'Disabled'}
              loading={state === 'Loading'}
              autoFocus={state === 'Focus'}
            >
              Button
            </Button>
          </div>
        ))}
      </div>
    ),
  },
  {
    id: 'icon-button',
    name: 'Icon Button',
    category: 'Actions',
    description: 'Compact icon-only action with accessible label.',
    available: true,
    renderPreview: () => (
      <div className="ds-preview-row">
        <IconButton label="Add">
          <Plus size={16} strokeWidth={1.75} />
        </IconButton>
        <IconButton label="Search" variant="primary">
          <Search size={16} strokeWidth={1.75} />
        </IconButton>
        <IconButton label="Settings" size="lg">
          <Settings size={18} strokeWidth={1.75} />
        </IconButton>
      </div>
    ),
  },
  {
    id: 'input',
    name: 'Input',
    category: 'Forms',
    description: 'Text field with label, hint, and focus states.',
    available: true,
    renderPreview: () => (
      <div style={{ maxWidth: 360, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Input label="Email" placeholder="you@company.com" hint="We'll never share your email." />
        <Input label="Disabled" placeholder="Unavailable" disabled />
      </div>
    ),
  },
  {
    id: 'select',
    name: 'Select',
    category: 'Forms',
    description: 'Accessible dropdown select menu.',
    available: true,
    renderPreview: () => (
      <div style={{ maxWidth: 280 }}>
        <Select
          label="Role"
          placeholder="Choose a role"
          defaultValue="designer"
          options={[
            { value: 'designer', label: 'Designer' },
            { value: 'engineer', label: 'Engineer' },
            { value: 'pm', label: 'Product Manager' },
          ]}
        />
      </div>
    ),
  },
  {
    id: 'checkbox',
    name: 'Checkbox',
    category: 'Forms',
    description: 'Binary choice control.',
    available: true,
    renderPreview: () => (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Checkbox label="Accept terms" defaultChecked />
        <Checkbox label="Subscribe to updates" />
        <Checkbox label="Disabled option" disabled />
      </div>
    ),
  },
  {
    id: 'radio-group',
    name: 'Radio Group',
    category: 'Forms',
    description: 'Single-choice selection among options.',
    available: true,
    renderPreview: () => (
      <RadioGroup
        label="Plan"
        defaultValue="pro"
        options={[
          { value: 'free', label: 'Free' },
          { value: 'pro', label: 'Pro' },
          { value: 'enterprise', label: 'Enterprise' },
        ]}
      />
    ),
  },
  {
    id: 'switch',
    name: 'Switch',
    category: 'Forms',
    description: 'Immediate on/off toggle.',
    available: true,
    renderPreview: () => (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Switch label="Dark mode" defaultChecked />
        <Switch label="Email notifications" />
      </div>
    ),
  },
  {
    id: 'tabs',
    name: 'Tabs',
    category: 'Navigation',
    description: 'Segmented content navigation.',
    available: true,
    renderPreview: () => (
      <Tabs
        items={[
          {
            value: 'overview',
            label: 'Overview',
            content: <p style={{ margin: 0, color: 'var(--muted)' }}>System overview and usage.</p>,
          },
          {
            value: 'tokens',
            label: 'Tokens',
            content: <p style={{ margin: 0, color: 'var(--muted)' }}>Foundations powering components.</p>,
          },
          {
            value: 'export',
            label: 'Export',
            content: <p style={{ margin: 0, color: 'var(--muted)' }}>Generate production code.</p>,
          },
        ]}
      />
    ),
  },
  {
    id: 'card',
    name: 'Card',
    category: 'Data Display',
    description: 'Content container with title and actions.',
    available: true,
    renderPreview: () => (
      <Card
        title="Project Aurora"
        description="A design system for consumer wellness experiences."
        footer={
          <div className="ds-preview-row">
            <Badge variant="primary">Active</Badge>
            <Button size="sm" variant="outline">
              Open
            </Button>
          </div>
        }
      />
    ),
  },
  {
    id: 'badge',
    name: 'Badge',
    category: 'Data Display',
    description: 'Compact status and metadata labels.',
    available: true,
    renderPreview: () => (
      <div className="ds-preview-row">
        <Badge>Neutral</Badge>
        <Badge variant="primary">Primary</Badge>
        <Badge variant="success">Success</Badge>
        <Badge variant="warning">Warning</Badge>
        <Badge variant="error">Error</Badge>
      </div>
    ),
  },
  {
    id: 'dialog',
    name: 'Dialog',
    category: 'Overlays',
    description: 'Modal dialog with focus management.',
    available: true,
    renderPreview: () => (
      <Dialog
        title="Archive project?"
        description="This will move the project to archive. You can restore it later."
        trigger={<Button variant="outline">Open dialog</Button>}
      />
    ),
  },
  {
    id: 'tooltip',
    name: 'Tooltip',
    category: 'Overlays',
    description: 'Contextual hover/focus hint.',
    available: true,
    renderPreview: () => (
      <Tooltip content="Keyboard shortcut: ⌘K">
        <Button variant="secondary">Hover me</Button>
      </Tooltip>
    ),
  },
  // Catalog placeholders — selectable for export planning, clearly marked unavailable
  upcoming('button-group', 'Button Group', 'Actions', 'Grouped related actions.'),
  upcoming('textarea', 'Textarea', 'Forms', 'Multi-line text input.'),
  upcoming('combobox', 'Combobox', 'Forms', 'Searchable select.'),
  upcoming('slider', 'Slider', 'Forms', 'Continuous value control.'),
  upcoming('search', 'Search', 'Forms', 'Search field pattern.'),
  upcoming('form-field', 'Form Field', 'Forms', 'Label + control + message composition.'),
  upcoming('breadcrumbs', 'Breadcrumbs', 'Navigation', 'Hierarchical path navigation.'),
  upcoming('pagination', 'Pagination', 'Navigation', 'Paged navigation.'),
  upcoming('nav-menu', 'Navigation Menu', 'Navigation', 'Site or app navigation.'),
  upcoming('sidebar-nav', 'Sidebar Navigation', 'Navigation', 'Persistent side navigation.'),
  upcoming('segmented-control', 'Segmented Control', 'Navigation', 'Compact mutually exclusive options.'),
  upcoming('avatar', 'Avatar', 'Data Display', 'User or entity image.'),
  upcoming('chip', 'Chip', 'Data Display', 'Dismissible filter chip.'),
  upcoming('table', 'Table', 'Data Display', 'Tabular data.'),
  upcoming('list', 'List', 'Data Display', 'Stacked content rows.'),
  upcoming('drawer', 'Drawer', 'Overlays', 'Side panel overlay.'),
  upcoming('sheet', 'Sheet', 'Overlays', 'Bottom or side sheet.'),
  upcoming('popover', 'Popover', 'Overlays', 'Anchored floating content.'),
  upcoming('dropdown-menu', 'Dropdown Menu', 'Overlays', 'Action menu.'),
  upcoming('alert', 'Alert', 'Feedback', 'Inline status message.'),
  upcoming('toast', 'Toast', 'Feedback', 'Transient notification.'),
  upcoming('progress', 'Progress', 'Feedback', 'Determinate progress.'),
  upcoming('spinner', 'Spinner', 'Feedback', 'Indeterminate loading.'),
  upcoming('skeleton', 'Skeleton', 'Feedback', 'Loading placeholder.'),
  upcoming('accordion', 'Accordion', 'Disclosure', 'Expandable sections.'),
  upcoming('calendar', 'Calendar', 'Date and Time', 'Date grid.'),
  upcoming('date-picker', 'Date Picker', 'Date and Time', 'Date selection field.'),
]

export function getComponent(id: string): ComponentDefinition | undefined {
  return COMPONENT_REGISTRY.find((c) => c.id === id)
}

export function getAvailableComponents(): ComponentDefinition[] {
  return COMPONENT_REGISTRY.filter((c) => c.available)
}

export function getComponentsByCategory(): Record<string, ComponentDefinition[]> {
  return COMPONENT_REGISTRY.reduce<Record<string, ComponentDefinition[]>>((acc, item) => {
    ;(acc[item.category] ??= []).push(item)
    return acc
  }, {})
}

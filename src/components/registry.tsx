import { useState, type ReactNode } from 'react'
import {
  Plus,
  Search,
  Settings,
  CircleCheck,
  AlertTriangle,
  Info,
  MoreHorizontal,
} from 'lucide-react'
import { Button } from './button/Button'
import { IconButton } from './icon-button/IconButton'
import { Input } from './input/Input'
import { Textarea } from './textarea/Textarea'
import { Select } from './select/Select'
import { Combobox } from './combobox/Combobox'
import { Checkbox } from './checkbox/Checkbox'
import { RadioGroup } from './radio-group/RadioGroup'
import { Switch } from './switch/Switch'
import { Slider } from './slider/Slider'
import { Search as SearchField } from './search/Search'
import { Tabs } from './tabs/Tabs'
import { SegmentedControl } from './segmented-control/SegmentedControl'
import { Breadcrumbs } from './breadcrumbs/Breadcrumbs'
import { Pagination } from './pagination/Pagination'
import { Avatar } from './avatar/Avatar'
import { Badge } from './badge/Badge'
import { Chip } from './chip/Chip'
import { Card } from './card/Card'
import { Table } from './table/Table'
import { Tooltip } from './tooltip/Tooltip'
import { Popover } from './popover/Popover'
import { DropdownMenu } from './dropdown-menu/DropdownMenu'
import { Dialog } from './dialog/Dialog'
import { Drawer } from './drawer/Drawer'
import { Alert } from './alert/Alert'
import { Toast } from './toast/Toast'
import { Progress } from './progress/Progress'
import { Skeleton } from './skeleton/Skeleton'
import { Accordion } from './accordion/Accordion'
import { Calendar } from './calendar/Calendar'

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

function SegmentedControlPreview() {
  const [value, setValue] = useState('week')
  return (
    <SegmentedControl
      options={[
        { value: 'day', label: 'Day' },
        { value: 'week', label: 'Week' },
        { value: 'month', label: 'Month' },
      ]}
      value={value}
      onChange={setValue}
    />
  )
}

function PaginationPreview() {
  const [page, setPage] = useState(2)
  return <Pagination page={page} totalPages={5} onChange={setPage} />
}

function CalendarPreview() {
  const [selected, setSelected] = useState<Date | undefined>(new Date())
  return <Calendar selected={selected} onSelect={setSelected} />
}

function SliderPreview() {
  const [value, setValue] = useState([40])
  return (
    <div style={{ maxWidth: 320 }}>
      <Slider label="Volume" value={value} onValueChange={setValue} />
    </div>
  )
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
      {name} — coming soon.
    </div>
  ),
})

export const COMPONENT_REGISTRY: ComponentDefinition[] = [
  // Actions
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
        {(
          [
            { label: 'Default', props: {} },
            { label: 'Hover', props: { 'data-force': 'hover' as const } },
            { label: 'Focus', props: { 'data-force': 'focus' as const } },
            { label: 'Active', props: { 'data-force': 'active' as const } },
            { label: 'Disabled', props: { disabled: true } },
            { label: 'Loading', props: { loading: true } },
          ] as const
        ).map((state) => (
          <div className="ds-state-cell" key={state.label}>
            <div className="ds-preview-label">{state.label}</div>
            <Button {...state.props}>Button</Button>
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
  upcoming('button-group', 'Button Group', 'Actions', 'Grouped related actions.'),

  // Forms
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
    id: 'textarea',
    name: 'Textarea',
    category: 'Forms',
    description: 'Multi-line text input with label and hint.',
    available: true,
    renderPreview: () => (
      <div style={{ maxWidth: 360 }}>
        <Textarea
          label="Description"
          placeholder="Tell us about your project…"
          hint="Markdown is supported."
          rows={4}
        />
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
    id: 'combobox',
    name: 'Combobox',
    category: 'Forms',
    description: 'Searchable select with typeahead filtering.',
    available: true,
    renderPreview: () => (
      <div style={{ maxWidth: 280 }}>
        <Combobox
          label="Framework"
          placeholder="Search frameworks…"
          defaultValue="react"
          options={[
            { value: 'react', label: 'React' },
            { value: 'vue', label: 'Vue' },
            { value: 'svelte', label: 'Svelte' },
            { value: 'solid', label: 'Solid' },
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
    id: 'slider',
    name: 'Slider',
    category: 'Forms',
    description: 'Continuous value control.',
    available: true,
    renderPreview: () => <SliderPreview />,
  },
  {
    id: 'search',
    name: 'Search',
    category: 'Forms',
    description: 'Search field with icon affordance.',
    available: true,
    renderPreview: () => (
      <div style={{ maxWidth: 320 }}>
        <SearchField label="Search" placeholder="Search components…" />
      </div>
    ),
  },
  upcoming('form-field', 'Form Field', 'Forms', 'Label + control + message composition.'),

  // Navigation
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
    id: 'segmented-control',
    name: 'Segmented Control',
    category: 'Navigation',
    description: 'Compact mutually exclusive options.',
    available: true,
    renderPreview: () => <SegmentedControlPreview />,
  },
  {
    id: 'breadcrumbs',
    name: 'Breadcrumbs',
    category: 'Navigation',
    description: 'Hierarchical path navigation.',
    available: true,
    renderPreview: () => (
      <Breadcrumbs
        items={[
          { label: 'Home', href: '#' },
          { label: 'Components', href: '#' },
          { label: 'Button' },
        ]}
      />
    ),
  },
  {
    id: 'pagination',
    name: 'Pagination',
    category: 'Navigation',
    description: 'Paged navigation control.',
    available: true,
    renderPreview: () => <PaginationPreview />,
  },
  upcoming('navigation-menu', 'Navigation Menu', 'Navigation', 'Site or app navigation.'),
  upcoming('sidebar-nav', 'Sidebar Navigation', 'Navigation', 'Persistent side navigation.'),

  // Data Display
  {
    id: 'avatar',
    name: 'Avatar',
    category: 'Data Display',
    description: 'User or entity image with fallback initials.',
    available: true,
    renderPreview: () => (
      <div className="ds-preview-row">
        <Avatar initials="AC" size="sm" />
        <Avatar initials="JD" size="md" />
        <Avatar initials="MK" size="lg" />
      </div>
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
    id: 'chip',
    name: 'Chip',
    category: 'Data Display',
    description: 'Toggleable filter chip.',
    available: true,
    renderPreview: () => (
      <div className="ds-preview-row">
        <Chip>Design</Chip>
        <Chip defaultSelected>Engineering</Chip>
        <Chip disabled>Disabled</Chip>
      </div>
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
    id: 'table',
    name: 'Table',
    category: 'Data Display',
    description: 'Tabular data presentation.',
    available: true,
    renderPreview: () => (
      <Table
        columns={[
          { key: 'name', header: 'Name' },
          { key: 'role', header: 'Role' },
          { key: 'status', header: 'Status' },
        ]}
        rows={[
          {
            name: 'Alex Chen',
            role: 'Designer',
            status: <Badge variant="success">Active</Badge>,
          },
          {
            name: 'Jordan Lee',
            role: 'Engineer',
            status: <Badge variant="warning">Away</Badge>,
          },
          {
            name: 'Sam Rivera',
            role: 'PM',
            status: <Badge>Invited</Badge>,
          },
        ]}
      />
    ),
  },
  upcoming('list', 'List', 'Data Display', 'Stacked content rows.'),

  // Overlays
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
  {
    id: 'popover',
    name: 'Popover',
    category: 'Overlays',
    description: 'Anchored floating content panel.',
    available: true,
    renderPreview: () => (
      <Popover trigger={<Button variant="secondary">Open popover</Button>}>
        <div style={{ fontSize: '0.875rem', lineHeight: 1.5 }}>
          <strong style={{ display: 'block', marginBottom: 4 }}>Quick tip</strong>
          <span style={{ color: 'var(--muted)' }}>Popovers anchor to their trigger element.</span>
        </div>
      </Popover>
    ),
  },
  {
    id: 'dropdown-menu',
    name: 'Dropdown Menu',
    category: 'Overlays',
    description: 'Action menu triggered from a button.',
    available: true,
    renderPreview: () => (
      <DropdownMenu
        trigger={
          <Button variant="outline" rightIcon={<MoreHorizontal size={16} strokeWidth={1.75} />}>
            Actions
          </Button>
        }
        items={[
          { label: 'Edit' },
          { label: 'Duplicate' },
          { label: 'Archive', disabled: true },
        ]}
      />
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
    id: 'drawer',
    name: 'Drawer',
    category: 'Overlays',
    description: 'Side panel overlay for secondary workflows.',
    available: true,
    renderPreview: () => (
      <Drawer
        title="Project settings"
        trigger={<Button variant="outline">Open drawer</Button>}
      >
        <p style={{ margin: '16px 0 0', color: 'var(--muted)', fontSize: '0.875rem' }}>
          Configure notifications, members, and integrations from this panel.
        </p>
      </Drawer>
    ),
  },
  upcoming('context-menu', 'Context Menu', 'Overlays', 'Right-click action menu.'),
  upcoming('sheet', 'Sheet', 'Overlays', 'Bottom or side sheet.'),
  upcoming('command-menu', 'Command Menu', 'Overlays', 'Keyboard-driven command palette.'),

  // Feedback
  {
    id: 'alert',
    name: 'Alert',
    category: 'Feedback',
    description: 'Inline status message.',
    available: true,
    renderPreview: () => (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 420 }}>
        <Alert variant="success" icon={<CircleCheck size={16} strokeWidth={1.75} />} title="Success">
          Your changes have been saved.
        </Alert>
        <Alert variant="warning" icon={<AlertTriangle size={16} strokeWidth={1.75} />} title="Warning">
          Your trial ends in 3 days.
        </Alert>
        <Alert variant="info" icon={<Info size={16} strokeWidth={1.75} />}>
          New components are available in the catalog.
        </Alert>
      </div>
    ),
  },
  {
    id: 'toast',
    name: 'Toast',
    category: 'Feedback',
    description: 'Transient notification.',
    available: true,
    renderPreview: () => <Toast />,
  },
  {
    id: 'progress',
    name: 'Progress',
    category: 'Feedback',
    description: 'Determinate progress indicator.',
    available: true,
    renderPreview: () => (
      <div style={{ maxWidth: 320 }}>
        <Progress label="Upload progress" value={65} />
      </div>
    ),
  },
  {
    id: 'skeleton',
    name: 'Skeleton',
    category: 'Feedback',
    description: 'Loading placeholder shapes.',
    available: true,
    renderPreview: () => (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 280 }}>
        <Skeleton width="100%" height={12} />
        <Skeleton width="85%" height={12} />
        <Skeleton width="60%" height={12} />
      </div>
    ),
  },

  // Disclosure
  {
    id: 'accordion',
    name: 'Accordion',
    category: 'Disclosure',
    description: 'Expandable content sections.',
    available: true,
    renderPreview: () => (
      <Accordion
        defaultValue="getting-started"
        items={[
          {
            value: 'getting-started',
            title: 'Getting started',
            content: (
              <p style={{ margin: 0, color: 'var(--muted)' }}>
                Install Forge and configure your first theme tokens.
              </p>
            ),
          },
          {
            value: 'components',
            title: 'Components',
            content: (
              <p style={{ margin: 0, color: 'var(--muted)' }}>
                Browse the catalog and preview interactive examples.
              </p>
            ),
          },
          {
            value: 'export',
            title: 'Export',
            content: (
              <p style={{ margin: 0, color: 'var(--muted)' }}>
                Generate production-ready code for your stack.
              </p>
            ),
          },
        ]}
      />
    ),
  },

  // Date and Time
  {
    id: 'calendar',
    name: 'Calendar',
    category: 'Date and Time',
    description: 'Date grid for month navigation and selection.',
    available: true,
    renderPreview: () => <CalendarPreview />,
  },
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

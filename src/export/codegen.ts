import type { DesignSystemDocument } from '@/schema/types'
import { emitCssVariables, shadowToCss } from '@/token-engine'
import { getIconPackage } from '@/icons/remap'
import { COMPONENT_REGISTRY } from '@/components/registry'

export function emitTokenCss(
  doc: DesignSystemDocument,
  kind:
    | 'colors'
    | 'typography'
    | 'spacing'
    | 'sizing'
    | 'radius'
    | 'borders'
    | 'shadows'
    | 'motion'
    | 'all',
): string {
  const lines: string[] = [':root {']

  if (kind === 'colors' || kind === 'all') {
    for (const scale of doc.foundations.colors.primitives) {
      for (const stop of scale.stops) {
        lines.push(`  --color-${scale.id}-${stop.step}: ${stop.value};`)
      }
    }
    for (const semantic of doc.foundations.colors.semantics) {
      const light =
        semantic.light.type === 'ref' ? `var(--${cssVarFromPath(semantic.light.path)})` : semantic.light.value
      lines.push(`  --color-${semantic.id}: ${light};`)
    }
  }

  if (kind === 'typography' || kind === 'all') {
    for (const family of doc.foundations.typography.families) {
      lines.push(`  --font-${family.id}: "${family.family}", ${family.fallback};`)
    }
    for (const style of doc.foundations.typography.styles) {
      lines.push(`  --type-${style.id}-size: ${style.fontSize};`)
      lines.push(`  --type-${style.id}-weight: ${style.fontWeight};`)
      lines.push(`  --type-${style.id}-line-height: ${style.lineHeight};`)
      lines.push(`  --type-${style.id}-letter-spacing: ${style.letterSpacing};`)
    }
  }

  if (kind === 'spacing' || kind === 'all') {
    for (const token of doc.foundations.spacing.tokens) {
      lines.push(`  --space-${token.id}: ${token.value};`)
    }
  }
  if (kind === 'sizing' || kind === 'all') {
    for (const token of doc.foundations.sizing.tokens) {
      lines.push(`  --size-${token.id}: ${token.value};`)
    }
  }
  if (kind === 'radius' || kind === 'all') {
    for (const token of doc.foundations.radius.tokens) {
      lines.push(`  --radius-${token.id}: ${token.value};`)
    }
  }
  if (kind === 'borders' || kind === 'all') {
    for (const token of doc.foundations.borders.widths) {
      lines.push(`  --border-width-${token.id}: ${token.value};`)
    }
  }
  if (kind === 'shadows' || kind === 'all') {
    for (const shadow of doc.foundations.shadows) {
      lines.push(`  --shadow-${shadow.id}: ${shadowToCss(shadow)};`)
    }
  }
  if (kind === 'motion' || kind === 'all') {
    for (const token of doc.foundations.motion.durations) {
      lines.push(`  --duration-${token.id}: ${token.value};`)
    }
    for (const token of doc.foundations.motion.easings) {
      lines.push(`  --easing-${token.id}: ${token.value};`)
    }
  }

  lines.push('}')
  return lines.join('\n')
}

function cssVarFromPath(path: string): string {
  // color.primitive.brand.600 -> color-brand-600
  const parts = path.split('.')
  if (parts[0] === 'color' && parts[1] === 'primitive') {
    return `color-${parts[2]}-${parts[3]}`
  }
  if (parts[0] === 'color' && parts[1] === 'semantic') {
    return `color-${parts[2]}`
  }
  return parts.join('-')
}

export function emitThemeCss(doc: DesignSystemDocument, mode: 'light' | 'dark'): string {
  const vars = emitCssVariables(doc, mode)
  const lines = [`[data-theme="${mode}"] {`]
  for (const [key, value] of Object.entries(vars)) {
    if (key.startsWith('--color-') || ['--bg', '--fg', '--primary', '--surface', '--border', '--muted', '--focus'].includes(key)) {
      lines.push(`  ${key}: ${value};`)
    }
  }
  lines.push('}')
  return lines.join('\n')
}

const COMPONENT_SOURCES: Record<string, string> = {
  button: `import { clsx } from 'clsx'
import type { ButtonHTMLAttributes, ReactNode } from 'react'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  leftIcon?: ReactNode
  rightIcon?: ReactNode
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  leftIcon,
  rightIcon,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      type="button"
      className={clsx('ds-btn', className)}
      data-variant={variant}
      data-size={size}
      data-loading={loading || undefined}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <span className="ds-spinner" aria-hidden /> : leftIcon}
      {children}
      {!loading && rightIcon}
    </button>
  )
}
`,
  'icon-button': `import { clsx } from 'clsx'
import type { ButtonHTMLAttributes, ReactNode } from 'react'

export function IconButton({
  label,
  variant = 'ghost',
  size = 'md',
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string
  variant?: 'ghost' | 'primary' | 'outline'
  size?: 'sm' | 'md' | 'lg'
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      className={clsx('ds-icon-btn', className)}
      data-variant={variant}
      data-size={size}
      {...props}
    >
      {children}
    </button>
  )
}
`,
  input: `import { clsx } from 'clsx'
import type { InputHTMLAttributes } from 'react'

export function Input({ label, hint, id, className, ...props }: InputHTMLAttributes<HTMLInputElement> & { label?: string; hint?: string }) {
  const inputId = id ?? props.name
  return (
    <div className="ds-field">
      {label && <label className="ds-field-label" htmlFor={inputId}>{label}</label>}
      <input id={inputId} className={clsx('ds-input', className)} {...props} />
      {hint && <span className="ds-field-hint">{hint}</span>}
    </div>
  )
}
`,
}

export function emitComponentCode(componentId: string): string {
  if (COMPONENT_SOURCES[componentId]) return COMPONENT_SOURCES[componentId]!
  const def = COMPONENT_REGISTRY.find((c) => c.id === componentId)
  return `// ${def?.name ?? componentId}
// This component is selected in your system.
// Full source is included for implemented core components in the zip export.

export function ${toPascal(componentId)}() {
  return null
}
`
}

function toPascal(id: string): string {
  return id
    .split('-')
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join('')
}

export function emitReadme(doc: DesignSystemDocument): string {
  const icon = getIconPackage(doc.icons.libraryId)
  const selected = doc.components.selectedIds
    .map((id) => COMPONENT_REGISTRY.find((c) => c.id === id)?.name ?? id)
    .join(', ')

  return `# ${doc.metadata.name}

${doc.metadata.description}

Generated by **Forge** — a code-native design system creator.

## Contents

- \`tokens/\` — CSS custom properties for foundations
- \`themes/\` — light and dark semantic themes
- \`components/\` — selected React + TypeScript components
- \`icons/\` — semantic icon map for \`${icon.name}\`
- \`design-system.json\` — serializable system document

## Selected components

${selected}

## Icons

Default library: **${doc.icons.libraryId}** (\`${icon.name}\`)

\`\`\`ts
${icon.importHint}
\`\`\`

Semantic roles map to icon identifiers in \`icons/semantic-map.json\`.

## Attribution

${doc.metadata.sourcePresetId ? `Started from preset \`${doc.metadata.sourcePresetId}\`. Presets are informed approximations of published open-source foundations — not official vendor implementations.` : 'Started from Forge Default or a blank system.'}

## Usage

1. Copy into your React + TypeScript project.
2. Import \`styles/globals.css\` once at the app root.
3. Set \`data-theme="light"\` or \`data-theme="dark"\` on a root element.
4. Import components from \`components/\`.

## Accessibility

Components follow accessible patterns (keyboard, focus-visible, ARIA where required).
Validate contrast when customizing brand colors.
`
}

export function emitPackageJson(doc: DesignSystemDocument): string {
  const icon = getIconPackage(doc.icons.libraryId)
  const deps: Record<string, string> = {
    react: '^19.0.0',
    'react-dom': '^19.0.0',
    clsx: '^2.1.1',
  }
  if (doc.icons.libraryId === 'lucide') deps['lucide-react'] = '^0.468.0'
  else deps[icon.name] = '*'

  // Radix peers for interactive components
  const selected = new Set(doc.components.selectedIds)
  if (selected.has('select')) deps['@radix-ui/react-select'] = '^2.1.0'
  if (selected.has('checkbox')) deps['@radix-ui/react-checkbox'] = '^1.1.0'
  if (selected.has('radio-group')) deps['@radix-ui/react-radio-group'] = '^1.2.0'
  if (selected.has('switch')) deps['@radix-ui/react-switch'] = '^1.1.0'
  if (selected.has('tabs')) deps['@radix-ui/react-tabs'] = '^1.1.0'
  if (selected.has('dialog')) deps['@radix-ui/react-dialog'] = '^1.1.0'
  if (selected.has('tooltip')) deps['@radix-ui/react-tooltip'] = '^1.1.0'

  return JSON.stringify(
    {
      name: slugify(doc.metadata.name),
      version: '0.1.0',
      private: true,
      peerDependencies: deps,
    },
    null,
    2,
  )
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'design-system'
}

import { formatCss, parse } from 'culori'
import type {
  DesignSystemDocument,
  ShadowToken,
  TokenValue,
} from '@/schema/types'

export type ThemeMode = 'light' | 'dark'

export function resolveTokenValue(
  doc: DesignSystemDocument,
  value: TokenValue,
  mode: ThemeMode = 'light',
  seen = new Set<string>(),
): string {
  if (value.type === 'literal') return value.value
  if (seen.has(value.path)) return '#FF00FF'
  seen.add(value.path)
  const resolved = lookupPath(doc, value.path, mode)
  if (!resolved) return value.path
  if (typeof resolved === 'string') return resolved
  return resolveTokenValue(doc, resolved, mode, seen)
}

function lookupPath(
  doc: DesignSystemDocument,
  path: string,
  mode: ThemeMode,
): string | TokenValue | undefined {
  const parts = path.split('.')

  if (parts[0] === 'color' && parts[1] === 'primitive' && parts[2] && parts[3]) {
    const scale = doc.foundations.colors.primitives.find((p) => p.id === parts[2])
    return scale?.stops.find((s) => s.step === parts[3])?.value
  }

  if (parts[0] === 'color' && parts[1] === 'semantic' && parts[2]) {
    const semantic = doc.foundations.colors.semantics.find((s) => s.id === parts[2])
    if (!semantic) return undefined
    const theme = doc.themes.find((t) => t.mode === mode) ?? doc.themes[0]
    const override = theme?.overrides[semantic.id]
    if (override) return override
    return mode === 'dark' ? semantic.dark : semantic.light
  }

  if (parts[0] === 'spacing' && parts[1]) {
    return doc.foundations.spacing.tokens.find((t) => t.id === parts[1])?.value
  }
  if (parts[0] === 'radius' && parts[1]) {
    return doc.foundations.radius.tokens.find((t) => t.id === parts[1])?.value
  }
  if (parts[0] === 'sizing' && parts[1]) {
    return doc.foundations.sizing.tokens.find((t) => t.id === parts[1])?.value
  }
  if (parts[0] === 'border' && parts[1] === 'width' && parts[2]) {
    return doc.foundations.borders.widths.find((t) => t.id === parts[2])?.value
  }
  if (parts[0] === 'duration' && parts[1]) {
    return doc.foundations.motion.durations.find((t) => t.id === parts[1])?.value
  }
  if (parts[0] === 'easing' && parts[1]) {
    return doc.foundations.motion.easings.find((t) => t.id === parts[1])?.value
  }

  return undefined
}

export function shadowToCss(shadow: ShadowToken): string {
  return shadow.layers
    .map((layer) => {
      const color = hexToRgba(layer.color, layer.opacity)
      return `${layer.x} ${layer.y} ${layer.blur} ${layer.spread} ${color}`
    })
    .join(', ')
}

export function hexToRgba(hex: string, opacity: number): string {
  const color = parse(hex)
  if (!color) return `rgba(0,0,0,${opacity})`
  const rgb = formatCss({ ...color, alpha: opacity })
  return rgb
}

export function emitCssVariables(
  doc: DesignSystemDocument,
  mode: ThemeMode = 'light',
): Record<string, string> {
  const vars: Record<string, string> = {}

  for (const scale of doc.foundations.colors.primitives) {
    for (const stop of scale.stops) {
      vars[`--color-${scale.id}-${stop.step}`] = stop.value
    }
  }

  for (const semantic of doc.foundations.colors.semantics) {
    const theme = doc.themes.find((t) => t.mode === mode)
    const value = theme?.overrides[semantic.id]
      ?? (mode === 'dark' ? semantic.dark : semantic.light)
    vars[`--color-${semantic.id}`] = resolveTokenValue(doc, value, mode)
  }

  for (const family of doc.foundations.typography.families) {
    vars[`--font-${family.id}`] = `"${family.family}", ${family.fallback}`
  }

  for (const style of doc.foundations.typography.styles) {
    const family = doc.foundations.typography.families.find((f) => f.id === style.fontFamilyId)
    vars[`--type-${style.id}-family`] = family
      ? `"${family.family}", ${family.fallback}`
      : 'inherit'
    vars[`--type-${style.id}-size`] = style.fontSize
    vars[`--type-${style.id}-weight`] = String(style.fontWeight)
    vars[`--type-${style.id}-line-height`] = style.lineHeight
    vars[`--type-${style.id}-letter-spacing`] = style.letterSpacing
    vars[`--type-${style.id}-transform`] = style.textTransform
  }

  for (const token of doc.foundations.spacing.tokens) {
    vars[`--space-${token.id}`] = token.value
  }
  for (const token of doc.foundations.sizing.tokens) {
    vars[`--size-${token.id}`] = token.value
  }
  for (const token of doc.foundations.radius.tokens) {
    vars[`--radius-${token.id}`] = token.value
  }
  for (const token of doc.foundations.borders.widths) {
    vars[`--border-width-${token.id}`] = token.value
  }
  for (const shadow of doc.foundations.shadows) {
    vars[`--shadow-${shadow.id}`] = shadowToCss(shadow)
  }
  for (const duration of doc.foundations.motion.durations) {
    vars[`--duration-${duration.id}`] = duration.value
  }
  for (const easing of doc.foundations.motion.easings) {
    vars[`--easing-${easing.id}`] = easing.value
  }
  for (const size of doc.icons.sizes) {
    vars[`--icon-size-${size.id}`] = size.value
  }
  vars['--icon-stroke'] = String(doc.icons.strokeWidth)

  vars['--bg'] = vars['--color-bg'] ?? '#fff'
  vars['--fg'] = vars['--color-text'] ?? '#111'
  vars['--muted'] = vars['--color-text-muted'] ?? '#666'
  vars['--border'] = vars['--color-border'] ?? '#ddd'
  vars['--primary'] = vars['--color-primary'] ?? '#246557'
  vars['--primary-fg'] = vars['--color-primary-fg'] ?? '#fff'
  vars['--surface'] = vars['--color-surface'] ?? '#f7f7f5'
  vars['--focus'] = vars['--color-focus'] ?? vars['--primary']
  vars['--error'] = vars['--color-error'] ?? '#c03434'
  vars['--success'] = vars['--color-success'] ?? '#2a8a54'
  vars['--warning'] = vars['--color-warning'] ?? '#d9890b'
  vars['--radius'] = vars['--radius-md'] ?? '8px'
  vars['--font-body'] = vars['--font-sans'] ?? 'system-ui, sans-serif'
  vars['--duration'] = vars['--duration-fast'] ?? '120ms'
  vars['--ease'] = vars['--easing-standard'] ?? 'ease'

  return vars
}

export function cssVarsToStyle(vars: Record<string, string>): Record<string, string> {
  return vars
}

export function ensureGoogleFonts(doc: DesignSystemDocument): void {
  const families = doc.foundations.typography.families.filter((f) => f.source === 'google')
  if (families.length === 0) return
  const id = 'forge-google-fonts'
  let link = document.getElementById(id) as HTMLLinkElement | null
  const query = families
    .map((f) => {
      const weights = f.weights.join(';')
      return `family=${encodeURIComponent(f.family)}:wght@${weights}`
    })
    .join('&')
  const href = `https://fonts.googleapis.com/css2?${query}&display=swap`
  if (!link) {
    link = document.createElement('link')
    link.id = id
    link.rel = 'stylesheet'
    document.head.appendChild(link)
  }
  if (link.href !== href) link.href = href
}

/** Paths that reference a given token path (direct refs in semantics). */
export function findSemanticDependents(
  doc: DesignSystemDocument,
  primitivePath: string,
): string[] {
  const dependents: string[] = []
  for (const semantic of doc.foundations.colors.semantics) {
    for (const mode of ['light', 'dark'] as const) {
      const value = mode === 'light' ? semantic.light : semantic.dark
      if (value.type === 'ref' && value.path === primitivePath) {
        dependents.push(`color.semantic.${semantic.id}`)
      }
    }
  }
  return [...new Set(dependents)]
}

export function estimateComponentImpact(
  doc: DesignSystemDocument,
  tokenPath: string,
): { components: string[]; count: number } {
  const selected = doc.components.selectedIds
  const colorRelated =
    tokenPath.startsWith('color.') ||
    tokenPath.includes('primary') ||
    tokenPath.includes('neutral') ||
    tokenPath.includes('brand')
  const radiusRelated = tokenPath.startsWith('radius.')
  const typeRelated = tokenPath.startsWith('type.') || tokenPath.includes('typography')
  const spaceRelated = tokenPath.startsWith('spacing.')
  const motionRelated = tokenPath.startsWith('duration.') || tokenPath.startsWith('easing.')
  const iconRelated = tokenPath.startsWith('icon.')

  const affected = selected.filter((id) => {
    if (colorRelated) return true
    if (radiusRelated) return ['button', 'icon-button', 'input', 'select', 'card', 'badge', 'dialog', 'tabs'].includes(id)
    if (typeRelated) return true
    if (spaceRelated) return true
    if (motionRelated) return ['button', 'switch', 'dialog', 'tabs', 'tooltip'].includes(id)
    if (iconRelated) return ['icon-button', 'button', 'checkbox', 'dialog'].includes(id)
    return false
  })

  return { components: affected, count: affected.length }
}

export function contrastRatio(fg: string, bg: string): number | null {
  const a = parse(fg)
  const b = parse(bg)
  if (!a || !b) return null
  const l1 = relativeLuminance(formatCss(a))
  const l2 = relativeLuminance(formatCss(b))
  if (l1 == null || l2 == null) return null
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}

function relativeLuminance(cssColor: string): number | null {
  const rgb = parse(cssColor)
  if (!rgb) return null
  // Convert via formatCss round-trip to get rgb channels when possible
  const asRgb = parse(formatCss(rgb))
  if (!asRgb || asRgb.mode !== 'rgb') return null
  const toLinear = (c: number) => {
    const s = c
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  const r = toLinear(asRgb.r ?? 0)
  const g = toLinear(asRgb.g ?? 0)
  const b = toLinear(asRgb.b ?? 0)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function formatContrastWarning(ratio: number | null): string | null {
  if (ratio == null) return null
  if (ratio >= 4.5) return null
  return `Contrast: ${ratio.toFixed(1)}:1 — does not meet WCAG AA for normal text.`
}

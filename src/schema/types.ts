/** Serializable design-system document — single source of truth for Forge. */

export type TokenValue =
  | { type: 'literal'; value: string }
  | { type: 'ref'; path: string }

export interface SystemMetadata {
  id: string
  name: string
  description: string
  createdAt: string
  updatedAt: string
  sourcePresetId?: string
}

export interface ColorStop {
  step: string
  value: string
}

export interface ColorScale {
  id: string
  name: string
  stops: ColorStop[]
}

export interface SemanticColor {
  id: string
  name: string
  description?: string
  light: TokenValue
  dark: TokenValue
}

export type FontSemanticRole =
  | 'primary'
  | 'body'
  | 'display'
  | 'heading'
  | 'ui'
  | 'monospace'
  | 'custom'

export interface FontFamily {
  id: string
  name: string
  family: string
  fallback: string
  source: 'google' | 'system' | 'custom'
  weights: number[]
  /** Semantic role this family fills in the system */
  role: FontSemanticRole
}

export interface TypographyStyle {
  id: string
  name: string
  role: string
  fontFamilyId: string
  fontSize: string
  fontWeight: number
  lineHeight: string
  letterSpacing: string
  textTransform: 'none' | 'uppercase' | 'lowercase' | 'capitalize'
}

export interface NamedToken {
  id: string
  name: string
  value: string
  semantic?: string
}

export interface SpacingScale {
  baseUnit: number
  tokens: NamedToken[]
}

export interface SizingScale {
  tokens: NamedToken[]
}

export interface RadiusScale {
  tokens: NamedToken[]
}

export interface BorderTokens {
  widths: NamedToken[]
  styles: NamedToken[]
}

export interface ShadowLayer {
  x: string
  y: string
  blur: string
  spread: string
  color: string
  opacity: number
}

export interface ShadowToken {
  id: string
  name: string
  layers: ShadowLayer[]
}

export interface MotionTokens {
  durations: NamedToken[]
  easings: NamedToken[]
  presets: Array<{
    id: string
    name: string
    durationId: string
    easingId: string
  }>
}

export interface BreakpointToken {
  id: string
  name: string
  minWidth: string
}

export type IconLibraryId =
  | 'lucide'
  | 'phosphor'
  | 'tabler'
  | 'heroicons'
  | 'material'

export type SemanticIconRole =
  | 'navigation.back'
  | 'navigation.forward'
  | 'navigation.menu'
  | 'navigation.close'
  | 'action.search'
  | 'action.add'
  | 'action.edit'
  | 'action.delete'
  | 'action.settings'
  | 'feedback.success'
  | 'feedback.warning'
  | 'feedback.error'
  | 'feedback.info'
  | 'feedback.loading'

export interface CustomIcon {
  id: string
  name: string
  svg: string
}

export type IconStyleVariant = 'outline' | 'filled' | 'duotone' | 'rounded' | 'sharp'

export interface IconSystem {
  libraryId: IconLibraryId
  sizes: NamedToken[]
  strokeWidth: number
  styleVariant: IconStyleVariant
  /** Semantic color token id used for default icon color */
  defaultColorSemanticId: string
  includedIds: string[]
  /** Mappings that need review after a library switch */
  reviewFlags: SemanticIconRole[]
  customSvgs: CustomIcon[]
  semanticMap: Record<string, string>
}

export interface ThemeDefinition {
  id: string
  name: string
  mode: 'light' | 'dark' | 'custom'
  /** Semantic color id → override value (literal or ref) */
  overrides: Record<string, TokenValue>
}

export type ComponentState =
  | 'default'
  | 'hover'
  | 'focus'
  | 'focusVisible'
  | 'active'
  | 'disabled'
  | 'loading'

export interface ComponentTokenOverrides {
  variants?: Record<string, Record<string, TokenValue>>
  sizes?: Record<string, Record<string, TokenValue>>
  states?: Partial<Record<ComponentState, Record<string, TokenValue>>>
  props?: Record<string, TokenValue>
}

export interface ComponentSelection {
  selectedIds: string[]
  overrides: Record<string, ComponentTokenOverrides>
}

export interface Foundations {
  colors: {
    primitives: ColorScale[]
    semantics: SemanticColor[]
  }
  typography: {
    families: FontFamily[]
    styles: TypographyStyle[]
  }
  spacing: SpacingScale
  sizing: SizingScale
  radius: RadiusScale
  borders: BorderTokens
  shadows: ShadowToken[]
  motion: MotionTokens
  opacity: NamedToken[]
  breakpoints: BreakpointToken[]
}

export interface DesignSystemDocument {
  version: number
  metadata: SystemMetadata
  foundations: Foundations
  icons: IconSystem
  themes: ThemeDefinition[]
  components: ComponentSelection
}

export const SCHEMA_VERSION = 2

export type EditorSection =
  | 'colors'
  | 'typography'
  | 'spacing'
  | 'sizing'
  | 'radius'
  | 'borders'
  | 'shadows'
  | 'motion'
  | 'opacity'
  | 'breakpoints'
  | 'icons'
  | 'components'
  | 'themes'
  | 'ai'
  | 'export'

export type IconsSubPanel =
  | 'library'
  | 'browser'
  | 'sizes'
  | 'stroke'
  | 'colors'
  | 'semantic'
  | 'custom'

export type PreviewMode =
  | 'individual'
  | 'states'
  | 'gallery'
  | 'compare'
  | 'responsive'
  | 'example'

export type InspectorTab = 'visual' | 'tokens' | 'code'

export interface EditorSelection {
  section: EditorSection
  foundationId?: string
  componentId?: string
  tokenPath?: string
  themeId?: string
}

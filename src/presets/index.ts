import type { DesignSystemDocument, IconLibraryId } from '@/schema/types'
import { createDefaultDesignSystem } from '@/schema/defaults'

export interface PresetDefinition {
  id: string
  name: string
  description: string
  license: string
  attribution: string
  docsUrl: string
  philosophy: string
  create: () => DesignSystemDocument
}

function base(presetId: string, name: string, description: string): DesignSystemDocument {
  const doc = createDefaultDesignSystem({
    metadata: {
      id: crypto.randomUUID(),
      name,
      description,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      sourcePresetId: presetId,
    },
  })
  return doc
}

function setScale(doc: DesignSystemDocument, id: string, name: string, stops: Record<string, string>) {
  let scale = doc.foundations.colors.primitives.find((p) => p.id === id)
  if (!scale) {
    scale = { id, name, stops: [] }
    doc.foundations.colors.primitives.push(scale)
  }
  scale.name = name
  scale.stops = Object.entries(stops).map(([step, value]) => ({ step, value }))
}

function setRadius(doc: DesignSystemDocument, values: Record<string, string>) {
  for (const token of doc.foundations.radius.tokens) {
    if (values[token.id]) token.value = values[token.id]!
  }
}

function setType(doc: DesignSystemDocument, body: string, display: string, mono = 'IBM Plex Mono') {
  const map: Record<string, string> = { sans: body, ui: body, display, mono }
  for (const family of doc.foundations.typography.families) {
    if (map[family.id]) {
      family.family = map[family.id]!
      family.source = 'google'
    }
  }
}

function setSpacingBase(doc: DesignSystemDocument, baseUnit: number) {
  doc.foundations.spacing.baseUnit = baseUnit
  for (const token of doc.foundations.spacing.tokens) {
    const n = Number(token.id)
    if (!Number.isNaN(n) && n > 0) token.value = `${n * baseUnit}px`
  }
}

function setControlHeights(doc: DesignSystemDocument, sm: string, md: string, lg: string) {
  const map: Record<string, string> = { 'control-sm': sm, 'control-md': md, 'control-lg': lg }
  for (const t of doc.foundations.sizing.tokens) {
    if (map[t.id]) t.value = map[t.id]!
  }
}

/**
 * Eight starters informed by published open-source design-system foundations.
 * These are schema translations of documented tokens — not official vendor ports.
 */
export const PRESETS: PresetDefinition[] = [
  {
    id: 'material-3',
    name: 'Material Design 3',
    description:
      'Tonal surfaces, 12dp-ish rounded controls, and a primary-container model inspired by Material You.',
    license: 'Apache-2.0 (reference)',
    attribution: 'Inspired by Google Material Design 3 — not affiliated with Google',
    docsUrl: 'https://m3.material.io/styles/color/system/overview',
    philosophy: 'Dynamic color roles, expressive shapes, accessible contrast on tonal surfaces.',
    create: () => {
      const doc = base('material-3', 'Material Design 3 (inspired)', 'Material You tonal foundations.')
      setScale(doc, 'brand', 'Primary', {
        '50': '#F6EDFF', '100': '#EADDFF', '200': '#D0BCFF', '300': '#B69DF8', '400': '#9A82DB',
        '500': '#7F67BE', '600': '#6750A4', '700': '#4F378B', '800': '#381E72', '900': '#21005D',
      })
      setScale(doc, 'neutral', 'Neutral', {
        '0': '#FFFBFE', '50': '#F7F2FA', '100': '#E7E0EC', '200': '#CAC4D0', '300': '#AEA9B4',
        '400': '#938F99', '500': '#79747E', '600': '#605D66', '700': '#49454F', '800': '#322F37',
        '900': '#1D1B20', '950': '#141218',
      })
      setRadius(doc, { sm: '8px', md: '12px', lg: '16px', xl: '28px', full: '9999px' })
      setType(doc, 'Roboto', 'Roboto')
      setControlHeights(doc, '32px', '40px', '56px')
      setSpacingBase(doc, 4)
      return doc
    },
  },
  {
    id: 'ant-design',
    name: 'Ant Design',
    description: 'Enterprise density with Ant’s blue primary (#1677FF), 6px radius, and compact controls.',
    license: 'MIT (reference)',
    attribution: 'Inspired by Ant Design — not affiliated with Ant Group',
    docsUrl: 'https://ant.design/docs/spec/colors',
    philosophy: 'Certainty, meaningfulness, growth — dense admin tooling with predictable blues.',
    create: () => {
      const doc = base('ant-design', 'Ant Design (inspired)', 'Ant Design enterprise foundations.')
      setScale(doc, 'brand', 'Primary', {
        '50': '#E6F4FF', '100': '#BAE0FF', '200': '#91CAFF', '300': '#69B1FF', '400': '#4096FF',
        '500': '#1677FF', '600': '#0958D9', '700': '#003EB3', '800': '#002C8C', '900': '#001D66',
      })
      setScale(doc, 'neutral', 'Neutral', {
        '0': '#FFFFFF', '50': '#FAFAFA', '100': '#F5F5F5', '200': '#F0F0F0', '300': '#D9D9D9',
        '400': '#BFBFBF', '500': '#8C8C8C', '600': '#595959', '700': '#434343', '800': '#262626',
        '900': '#1F1F1F', '950': '#141414',
      })
      setRadius(doc, { sm: '2px', md: '6px', lg: '8px', xl: '12px' })
      setType(doc, 'Noto Sans', 'Noto Sans')
      setControlHeights(doc, '24px', '32px', '40px')
      setSpacingBase(doc, 4)
      return doc
    },
  },
  {
    id: 'carbon',
    name: 'IBM Carbon',
    description: 'Productive density, IBM Blue (#0F62FE), and sharp 0-radius geometry from Carbon.',
    license: 'Apache-2.0 (reference)',
    attribution: 'Inspired by IBM Carbon — not affiliated with IBM',
    docsUrl: 'https://carbondesignsystem.com/elements/color/overview/',
    philosophy: 'Clarity and efficiency for complex product workflows; accessibility-first.',
    create: () => {
      const doc = base('carbon', 'IBM Carbon (inspired)', 'Carbon productive foundations.')
      setScale(doc, 'brand', 'Blue', {
        '50': '#EDF5FF', '100': '#D0E2FF', '200': '#A6C8FF', '300': '#78A9FF', '400': '#4589FF',
        '500': '#0F62FE', '600': '#0043CE', '700': '#002D9C', '800': '#001D6C', '900': '#001141',
      })
      setScale(doc, 'neutral', 'Gray', {
        '0': '#FFFFFF', '50': '#F4F4F4', '100': '#E0E0E0', '200': '#C6C6C6', '300': '#A8A8A8',
        '400': '#8D8D8D', '500': '#6F6F6F', '600': '#525252', '700': '#393939', '800': '#262626',
        '900': '#161616', '950': '#000000',
      })
      setRadius(doc, { none: '0', sm: '0', md: '0', lg: '0', xl: '0' })
      setType(doc, 'IBM Plex Sans', 'IBM Plex Sans', 'IBM Plex Mono')
      setControlHeights(doc, '32px', '40px', '48px')
      setSpacingBase(doc, 4)
      return doc
    },
  },
  {
    id: 'spectrum',
    name: 'Adobe Spectrum',
    description: 'Spectrum indigo accents, medium density, and precise creative-tool spacing.',
    license: 'Apache-2.0 (reference)',
    attribution: 'Inspired by Adobe Spectrum — not affiliated with Adobe',
    docsUrl: 'https://spectrum.adobe.com/page/color/',
    philosophy: 'Precision for creative professionals; consistent density and clear hierarchy.',
    create: () => {
      const doc = base('spectrum', 'Adobe Spectrum (inspired)', 'Spectrum creative-tool foundations.')
      setScale(doc, 'brand', 'Indigo', {
        '50': '#F5F3FF', '100': '#E7E1FF', '200': '#D0C4FF', '300': '#B39AFA', '400': '#9777ED',
        '500': '#7C5CDE', '600': '#6E55C8', '700': '#5258CF', '800': '#3F2180', '900': '#2C1660',
      })
      setScale(doc, 'neutral', 'Gray', {
        '0': '#FFFFFF', '50': '#F8F8F8', '100': '#E6E6E6', '200': '#D3D3D3', '300': '#B3B3B3',
        '400': '#8E8E8E', '500': '#6E6E6E', '600': '#4B4B4B', '700': '#2C2C2C', '800': '#1E1E1E',
        '900': '#141414', '950': '#000000',
      })
      setRadius(doc, { sm: '4px', md: '8px', lg: '12px', xl: '16px' })
      setType(doc, 'Source Sans 3', 'Source Sans 3', 'Source Code Pro')
      setControlHeights(doc, '24px', '32px', '40px')
      return doc
    },
  },
  {
    id: 'fluent-2',
    name: 'Microsoft Fluent 2',
    description: 'Fluent brand blue, soft elevation, and medium corner radii for cross-platform UI.',
    license: 'MIT (reference)',
    attribution: 'Inspired by Microsoft Fluent 2 — not affiliated with Microsoft',
    docsUrl: 'https://fluent2.microsoft.design/color',
    philosophy: 'One system across platforms; calm surfaces with clear interactive emphasis.',
    create: () => {
      const doc = base('fluent-2', 'Microsoft Fluent 2 (inspired)', 'Fluent 2 foundations.')
      setScale(doc, 'brand', 'Brand', {
        '50': '#E8F3FF', '100': '#CFE7FF', '200': '#9ECFFF', '300': '#6CB6FF', '400': '#3A9BFF',
        '500': '#0F7BFF', '600': '#0F6CBD', '700': '#115EA3', '800': '#0E4775', '900': '#0C3B5E',
      })
      setScale(doc, 'neutral', 'Neutral', {
        '0': '#FFFFFF', '50': '#FAFAFA', '100': '#F5F5F5', '200': '#E0E0E0', '300': '#C7C7C7',
        '400': '#ADADAD', '500': '#8A8A8A', '600': '#6E6E6E', '700': '#4A4A4A', '800': '#2D2D2D',
        '900': '#1F1F1F', '950': '#141414',
      })
      setRadius(doc, { sm: '4px', md: '8px', lg: '12px', xl: '16px' })
      setType(doc, 'Public Sans', 'Public Sans')
      setControlHeights(doc, '24px', '32px', '40px')
      return doc
    },
  },
  {
    id: 'primer',
    name: 'GitHub Primer',
    description: 'Primer’s functional blue (#0969DA), restrained radii, and product-engineering clarity.',
    license: 'MIT (reference)',
    attribution: 'Inspired by GitHub Primer — not affiliated with GitHub',
    docsUrl: 'https://primer.style/foundations/color',
    philosophy: 'Functional, accessible product UI with strong semantic color roles.',
    create: () => {
      const doc = base('primer', 'GitHub Primer (inspired)', 'Primer foundations.')
      setScale(doc, 'brand', 'Accent', {
        '50': '#DDF4FF', '100': '#B6E3FF', '200': '#80CCFF', '300': '#54AEFF', '400': '#218BFF',
        '500': '#0969DA', '600': '#0550AE', '700': '#033D8B', '800': '#0A3069', '900': '#002155',
      })
      setScale(doc, 'neutral', 'Neutral', {
        '0': '#FFFFFF', '50': '#F6F8FA', '100': '#EFF2F5', '200': '#D0D7DE', '300': '#AFB8C1',
        '400': '#8C959F', '500': '#6E7781', '600': '#57606A', '700': '#424A53', '800': '#32383F',
        '900': '#24292F', '950': '#1B1F24',
      })
      setRadius(doc, { sm: '3px', md: '6px', lg: '12px', xl: '16px' })
      setType(doc, 'IBM Plex Sans', 'IBM Plex Sans', 'IBM Plex Mono')
      setControlHeights(doc, '28px', '32px', '40px')
      return doc
    },
  },
  {
    id: 'polaris',
    name: 'Shopify Polaris',
    description: 'Polaris green (#108043), soft cards, and commerce-admin pragmatism.',
    license: 'MIT (reference)',
    attribution: 'Inspired by Shopify Polaris — not affiliated with Shopify',
    docsUrl: 'https://polaris.shopify.com/design/colors',
    philosophy: 'Merchant-first admin UI; approachable greens and clear content hierarchy.',
    create: () => {
      const doc = base('polaris', 'Shopify Polaris (inspired)', 'Polaris commerce foundations.')
      setScale(doc, 'brand', 'Green', {
        '50': '#EAFBF5', '100': '#C7F0E1', '200': '#8FE0C3', '300': '#4EBF97', '400': '#2A9D73',
        '500': '#1A7F5A', '600': '#108043', '700': '#0B6B38', '800': '#08542C', '900': '#053B1F',
      })
      setScale(doc, 'neutral', 'Surface', {
        '0': '#FFFFFF', '50': '#F6F6F7', '100': '#EBEBEB', '200': '#E1E3E5', '300': '#C9CCCF',
        '400': '#8C9196', '500': '#6D7175', '600': '#5C5F62', '700': '#443F38', '800': '#2C2A25',
        '900': '#1A1A1A', '950': '#0D0D0D',
      })
      setRadius(doc, { sm: '4px', md: '8px', lg: '12px', xl: '16px' })
      setType(doc, 'Inter', 'Inter')
      setControlHeights(doc, '28px', '36px', '44px')
      return doc
    },
  },
  {
    id: 'figma-sds',
    name: 'Figma SDS',
    description: 'Contemporary community defaults from Figma’s Simple Design System (MIT).',
    license: 'MIT (reference)',
    attribution: 'Inspired by Figma SDS — not affiliated with Figma',
    docsUrl: 'https://github.com/figma/sds',
    philosophy: 'Modern product UI defaults intended to be remixed and owned.',
    create: () => {
      const doc = base('figma-sds', 'Figma SDS (inspired)', 'SDS contemporary defaults.')
      setScale(doc, 'brand', 'Brand', {
        '50': '#F5F5FF', '100': '#EBEBFF', '200': '#D6D6FF', '300': '#B4B4FF', '400': '#8C8CFF',
        '500': '#6A6AFE', '600': '#4A4AE8', '700': '#3939C4', '800': '#2E2E9B', '900': '#24247A',
      })
      setRadius(doc, { sm: '6px', md: '10px', lg: '14px', xl: '20px' })
      setType(doc, 'Inter', 'Fraunces')
      setControlHeights(doc, '28px', '36px', '44px')
      return doc
    },
  },
]

void (null as unknown as IconLibraryId)

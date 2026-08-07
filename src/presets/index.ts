import { createDefaultDesignSystem } from '@/schema/defaults'
import type { DesignSystemDocument } from '@/schema/types'

export interface PresetDefinition {
  id: string
  name: string
  description: string
  license: string
  attribution: string
  docsUrl: string
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

function setScale(doc: DesignSystemDocument, id: string, stops: Record<string, string>) {
  const scale = doc.foundations.colors.primitives.find((p) => p.id === id)
  if (!scale) return
  scale.stops = Object.entries(stops).map(([step, value]) => ({ step, value }))
}

function setRadius(doc: DesignSystemDocument, values: Record<string, string>) {
  for (const token of doc.foundations.radius.tokens) {
    if (values[token.id]) token.value = values[token.id]!
  }
}

function setType(
  doc: DesignSystemDocument,
  sans: string,
  display?: string,
) {
  const s = doc.foundations.typography.families.find((f) => f.id === 'sans')
  const d = doc.foundations.typography.families.find((f) => f.id === 'display')
  if (s) {
    s.family = sans
    s.source = 'google'
  }
  if (d && display) {
    d.family = display
    d.source = 'google'
  }
}

export const PRESETS: PresetDefinition[] = [
  {
    id: 'material-3',
    name: 'Material-inspired',
    description: 'Tonal surfaces, rounded controls, and a violet primary inspired by Material Design 3 foundations.',
    license: 'Apache-2.0 (reference)',
    attribution: 'Inspired by Google Material Design 3 — not an official implementation',
    docsUrl: 'https://m3.material.io/',
    create: () => {
      const doc = base('material-3', 'Material-inspired', 'Tonal Material-like starter.')
      setScale(doc, 'brand', {
        '50': '#F6EDFF', '100': '#EADDFF', '200': '#D0BCFF', '300': '#B69DF8', '400': '#9A82DB',
        '500': '#7F67BE', '600': '#6750A4', '700': '#4F378B', '800': '#381E72', '900': '#21005D',
      })
      setScale(doc, 'neutral', {
        '0': '#FFFBFE', '50': '#F7F2FA', '100': '#E7E0EC', '200': '#CAC4D0', '300': '#AEA9B4',
        '400': '#938F99', '500': '#79747E', '600': '#605D66', '700': '#49454F', '800': '#322F37',
        '900': '#1D1B20', '950': '#141218',
      })
      setRadius(doc, { sm: '8px', md: '12px', lg: '16px', xl: '28px' })
      setType(doc, 'Roboto Flex', 'Roboto Flex')
      return doc
    },
  },
  {
    id: 'ant-design',
    name: 'Ant-inspired',
    description: 'Compact enterprise density with Ant Design’s characteristic blue and modest radii.',
    license: 'MIT (reference)',
    attribution: 'Inspired by Ant Design — not an official implementation',
    docsUrl: 'https://ant.design/',
    create: () => {
      const doc = base('ant-design', 'Ant-inspired', 'Enterprise admin starter.')
      setScale(doc, 'brand', {
        '50': '#E6F4FF', '100': '#BAE0FF', '200': '#91CAFF', '300': '#69B1FF', '400': '#4096FF',
        '500': '#1677FF', '600': '#0958D9', '700': '#003EB3', '800': '#002C8C', '900': '#001D66',
      })
      setRadius(doc, { sm: '2px', md: '6px', lg: '8px', xl: '12px' })
      doc.foundations.spacing.baseUnit = 4
      setType(doc, 'Noto Sans', 'Noto Sans')
      return doc
    },
  },
  {
    id: 'carbon',
    name: 'Carbon-inspired',
    description: 'Productive density and IBM Carbon-like blue with sharper geometry.',
    license: 'Apache-2.0 (reference)',
    attribution: 'Inspired by IBM Carbon — not an official implementation',
    docsUrl: 'https://carbondesignsystem.com/',
    create: () => {
      const doc = base('carbon', 'Carbon-inspired', 'Accessibility-forward productive UI.')
      setScale(doc, 'brand', {
        '50': '#EDF5FF', '100': '#D0E2FF', '200': '#A6C8FF', '300': '#78A9FF', '400': '#4589FF',
        '500': '#0F62FE', '600': '#0043CE', '700': '#002D9C', '800': '#001D6C', '900': '#001141',
      })
      setRadius(doc, { sm: '0px', md: '0px', lg: '0px', xl: '0px' })
      setType(doc, 'IBM Plex Sans', 'IBM Plex Sans')
      return doc
    },
  },
  {
    id: 'spectrum',
    name: 'Spectrum-inspired',
    description: 'Adobe Spectrum-like precision with indigo accents and medium density.',
    license: 'Apache-2.0 (reference)',
    attribution: 'Inspired by Adobe Spectrum — not an official implementation',
    docsUrl: 'https://spectrum.adobe.com/',
    create: () => {
      const doc = base('spectrum', 'Spectrum-inspired', 'Creative-tool precision starter.')
      setScale(doc, 'brand', {
        '50': '#F5F3FF', '100': '#E7E1FF', '200': '#D0C4FF', '300': '#B39AFA', '400': '#9777ED',
        '500': '#7C5CDE', '600': '#6B46C1', '700': '#5531A0', '800': '#3F2180', '900': '#2C1660',
      })
      setRadius(doc, { sm: '4px', md: '8px', lg: '12px', xl: '16px' })
      setType(doc, 'Source Sans 3', 'Source Sans 3')
      return doc
    },
  },
  {
    id: 'fluent-2',
    name: 'Fluent-inspired',
    description: 'Microsoft Fluent 2-like soft surfaces, medium radii, and teal-blue brand.',
    license: 'MIT (reference)',
    attribution: 'Inspired by Microsoft Fluent 2 — not an official implementation',
    docsUrl: 'https://fluent2.microsoft.design/',
    create: () => {
      const doc = base('fluent-2', 'Fluent-inspired', 'Cross-platform coherence starter.')
      setScale(doc, 'brand', {
        '50': '#E8F3FF', '100': '#CFE7FF', '200': '#9ECFFF', '300': '#6CB6FF', '400': '#3A9BFF',
        '500': '#0F7BFF', '600': '#0F6CBD', '700': '#115EA3', '800': '#0E4775', '900': '#0C3B5E',
      })
      setRadius(doc, { sm: '4px', md: '8px', lg: '12px', xl: '16px' })
      setType(doc, 'Segoe UI', 'Segoe UI')
      const sans = doc.foundations.typography.families.find((f) => f.id === 'sans')
      if (sans) {
        sans.family = 'Public Sans'
        sans.source = 'google'
      }
      return doc
    },
  },
  {
    id: 'primer',
    name: 'Primer-inspired',
    description: 'GitHub Primer-like clarity with blue accents and restrained radii.',
    license: 'MIT (reference)',
    attribution: 'Inspired by GitHub Primer — not an official implementation',
    docsUrl: 'https://primer.style/',
    create: () => {
      const doc = base('primer', 'Primer-inspired', 'Product engineering clarity.')
      setScale(doc, 'brand', {
        '50': '#DDF4FF', '100': '#B6E3FF', '200': '#80CCFF', '300': '#54AEFF', '400': '#218BFF',
        '500': '#0969DA', '600': '#0550AE', '700': '#033D8B', '800': '#0A3069', '900': '#002155',
      })
      setScale(doc, 'neutral', {
        '0': '#FFFFFF', '50': '#F6F8FA', '100': '#EFF2F5', '200': '#D0D7DE', '300': '#AFB8C1',
        '400': '#8C959F', '500': '#6E7781', '600': '#57606A', '700': '#424A53', '800': '#32383F',
        '900': '#24292F', '950': '#1B1F24',
      })
      setRadius(doc, { sm: '3px', md: '6px', lg: '12px', xl: '16px' })
      setType(doc, 'IBM Plex Sans', 'IBM Plex Sans')
      return doc
    },
  },
  {
    id: 'polaris',
    name: 'Polaris-inspired',
    description: 'Shopify Polaris-like commerce UI with green brand and soft cards.',
    license: 'MIT (reference)',
    attribution: 'Inspired by Shopify Polaris — not an official implementation',
    docsUrl: 'https://polaris.shopify.com/',
    create: () => {
      const doc = base('polaris', 'Polaris-inspired', 'Commerce admin pragmatism.')
      setScale(doc, 'brand', {
        '50': '#EAFBF5', '100': '#C7F0E1', '200': '#8FE0C3', '300': '#4EBF97', '400': '#2A9D73',
        '500': '#1A7F5A', '600': '#108043', '700': '#0B6B38', '800': '#08542C', '900': '#053B1F',
      })
      setRadius(doc, { sm: '4px', md: '8px', lg: '12px', xl: '16px' })
      setType(doc, 'Inter', 'Inter')
      return doc
    },
  },
  {
    id: 'figma-sds',
    name: 'SDS-inspired',
    description: 'Contemporary community defaults inspired by Figma’s Simple Design System.',
    license: 'MIT (reference)',
    attribution: 'Inspired by Figma SDS — not an official implementation',
    docsUrl: 'https://github.com/figma/sds',
    create: () => {
      const doc = base('figma-sds', 'SDS-inspired', 'Modern community defaults.')
      setScale(doc, 'brand', {
        '50': '#F5F5FF', '100': '#EBEBFF', '200': '#D6D6FF', '300': '#B4B4FF', '400': '#8C8CFF',
        '500': '#6A6AFE', '600': '#4A4AE8', '700': '#3939C4', '800': '#2E2E9B', '900': '#24247A',
      })
      setRadius(doc, { sm: '6px', md: '10px', lg: '14px', xl: '20px' })
      setType(doc, 'Inter', 'Fraunces')
      return doc
    },
  },
]

import dsCss from '@/components/ds.css?raw'
import JSZip from 'jszip'
import type { DesignSystemDocument } from '@/schema/types'
import {
  emitComponentCode,
  emitPackageJson,
  emitReadme,
  emitThemeCss,
  emitTokenCss,
} from './codegen'
import { getAvailableComponents } from '@/components/registry'

const GLOBALS = `/* Design system globals */
@import '../tokens/colors.css';
@import '../tokens/typography.css';
@import '../tokens/spacing.css';
@import '../tokens/radius.css';
@import '../tokens/shadows.css';
@import '../tokens/motion.css';
@import '../themes/light.css';
@import '../themes/dark.css';
@import './components.css';

:root {
  --bg: var(--color-bg);
  --fg: var(--color-text);
  --muted: var(--color-text-muted);
  --border: var(--color-border);
  --primary: var(--color-primary);
  --primary-fg: var(--color-primary-fg);
  --surface: var(--color-surface);
  --focus: var(--color-focus);
  --error: var(--color-error);
  --success: var(--color-success);
  --warning: var(--color-warning);
  --radius: var(--radius-md);
  --font-body: var(--font-sans);
  --duration: var(--duration-fast);
  --ease: var(--easing-standard);
}

body {
  margin: 0;
  font-family: var(--font-body);
  background: var(--bg);
  color: var(--fg);
}
`

export async function downloadDesignSystemZip(doc: DesignSystemDocument): Promise<void> {
  const zip = new JSZip()
  const root = zip.folder('design-system')!

  root.file('design-system.json', JSON.stringify(doc, null, 2))
  root.file('README.md', emitReadme(doc))
  root.file('package.json', emitPackageJson(doc))

  const tokens = root.folder('tokens')!
  tokens.file('colors.css', emitTokenCss(doc, 'colors'))
  tokens.file('typography.css', emitTokenCss(doc, 'typography'))
  tokens.file('spacing.css', emitTokenCss(doc, 'spacing'))
  tokens.file('radius.css', emitTokenCss(doc, 'radius'))
  tokens.file('shadows.css', emitTokenCss(doc, 'shadows'))
  tokens.file('motion.css', emitTokenCss(doc, 'motion'))
  tokens.file('sizing.css', emitTokenCss(doc, 'sizing'))
  tokens.file('borders.css', emitTokenCss(doc, 'borders'))

  const themes = root.folder('themes')!
  themes.file('light.css', emitThemeCss(doc, 'light'))
  themes.file('dark.css', emitThemeCss(doc, 'dark'))

  const styles = root.folder('styles')!
  styles.file('globals.css', GLOBALS)
  styles.file('components.css', dsCss)

  const components = root.folder('components')!
  const availableIds = new Set(getAvailableComponents().map((c) => c.id))
  for (const id of doc.components.selectedIds) {
    if (!availableIds.has(id)) {
      components.file(
        `${id}.tsx`,
        `// ${id} was selected but is not implemented in this Forge build yet.\nexport {};\n`,
      )
      continue
    }
    components.file(`${id}.tsx`, emitComponentCode(id))
  }
  components.file(
    'index.ts',
    doc.components.selectedIds
      .filter((id) => availableIds.has(id))
      .map((id) => `export * from './${id}'`)
      .join('\n') + '\n',
  )

  const icons = root.folder('icons')!
  icons.file('semantic-map.json', JSON.stringify(doc.icons.semanticMap, null, 2))
  icons.file(
    'README.md',
    `# Icons\n\nLibrary: ${doc.icons.libraryId}\n\nInstall the package listed in package.json and import icons by the identifiers in semantic-map.json.\n`,
  )
  if (doc.icons.customSvgs.length) {
    for (const custom of doc.icons.customSvgs) {
      icons.file(`${custom.id}.svg`, custom.svg)
    }
  }

  const blob = await zip.generateAsync({ type: 'blob' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${slugify(doc.metadata.name) || 'design-system'}.zip`
  a.click()
  URL.revokeObjectURL(url)
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

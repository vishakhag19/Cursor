import type { DesignSystemDocument } from '@/schema/types'
import { createDefaultDesignSystem } from '@/schema/defaults'

/** Migrate older persisted documents to the current schema shape. */
export function migrateDocument(doc: DesignSystemDocument): DesignSystemDocument {
  const fresh = createDefaultDesignSystem()
  const next = structuredClone(doc)

  next.version = Math.max(next.version ?? 1, fresh.version)

  for (const family of next.foundations.typography.families) {
    if (!family.role) {
      if (family.id === 'mono') family.role = 'monospace'
      else if (family.id === 'display') family.role = 'display'
      else if (family.id === 'ui') family.role = 'ui'
      else family.role = 'body'
    }
  }

  if (!next.foundations.opacity?.length) {
    next.foundations.opacity = fresh.foundations.opacity
  }

  next.icons.styleVariant ??= 'outline'
  next.icons.defaultColorSemanticId ??= 'text'
  next.icons.reviewFlags ??= []
  next.icons.includedIds ??= [...fresh.icons.includedIds]
  next.icons.semanticMap ??= { ...fresh.icons.semanticMap }

  return next
}

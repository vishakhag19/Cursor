import type { DesignSystemDocument } from '@/schema/types'
import { SCHEMA_VERSION } from '@/schema/types'
import { createDefaultDesignSystem } from '@/schema/defaults'

/** Migrate older persisted documents to the current schema shape. */
export function migrateDocument(doc: DesignSystemDocument): DesignSystemDocument {
  const fresh = createDefaultDesignSystem()
  const next = structuredClone(doc)
  const fromVersion = next.version ?? 1

  // v2: monochrome OKLCH / Geist theme as the Forge Default foundations.
  if (fromVersion < 2) {
    next.foundations.colors = structuredClone(fresh.foundations.colors)
    next.foundations.typography = structuredClone(fresh.foundations.typography)
    next.foundations.radius = structuredClone(fresh.foundations.radius)
    next.foundations.shadows = structuredClone(fresh.foundations.shadows)
    next.metadata.description = fresh.metadata.description
  }

  next.version = Math.max(fromVersion, SCHEMA_VERSION)

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

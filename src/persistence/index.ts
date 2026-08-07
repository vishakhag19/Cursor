import { get, set } from 'idb-keyval'
import type { DesignSystemDocument } from '@/schema/types'

const KEY = 'forge:design-system:v1'

export async function loadDocument(): Promise<DesignSystemDocument | null> {
  try {
    const doc = await get<DesignSystemDocument>(KEY)
    if (!doc || typeof doc.version !== 'number') return null
    return doc
  } catch {
    return null
  }
}

export async function saveDocument(doc: DesignSystemDocument): Promise<void> {
  try {
    await set(KEY, doc)
  } catch {
    // Persistence failures should not break editing.
  }
}

export async function clearDocument(): Promise<void> {
  try {
    await set(KEY, undefined)
  } catch {
    // ignore
  }
}

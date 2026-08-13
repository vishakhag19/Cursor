import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { createDefaultDesignSystem, createBlankDesignSystem } from '@/schema/defaults'
import type {
  DesignSystemDocument,
  EditorSelection,
  InspectorTab,
  PreviewMode,
} from '@/schema/types'
import type { ThemeMode as TokenThemeMode } from '@/token-engine'
import { saveDocument } from '@/persistence'

export type { ThemeMode as PreviewTheme } from '@/token-engine'

interface HistoryEntry {
  doc: DesignSystemDocument
  label: string
}

interface EditorState {
  doc: DesignSystemDocument
  hydrated: boolean
  selection: EditorSelection
  previewMode: PreviewMode
  previewTheme: TokenThemeMode
  previewComponentId: string
  inspectorTab: InspectorTab
  compareTheme: boolean
  responsiveWidth: number
  history: HistoryEntry[]
  future: HistoryEntry[]
  dirty: boolean

  hydrate: (doc: DesignSystemDocument | null) => void
  setSelection: (selection: Partial<EditorSelection> & { section?: EditorSelection['section'] }) => void
  setPreviewMode: (mode: PreviewMode) => void
  setPreviewTheme: (theme: TokenThemeMode) => void
  setPreviewComponentId: (id: string) => void
  setInspectorTab: (tab: InspectorTab) => void
  setResponsiveWidth: (width: number) => void
  replaceDocument: (doc: DesignSystemDocument, label?: string) => void
  updateDocument: (mutator: (doc: DesignSystemDocument) => void, label?: string) => void
  loadDefault: () => void
  loadBlank: () => void
  undo: () => void
  redo: () => void
  persist: () => void
}

const MAX_HISTORY = 50

function cloneDoc(doc: DesignSystemDocument): DesignSystemDocument {
  return structuredClone(doc)
}

function touch(doc: DesignSystemDocument) {
  doc.metadata.updatedAt = new Date().toISOString()
}

export const useEditorStore = create<EditorState>()(
  immer((set, get) => ({
    doc: createDefaultDesignSystem(),
    hydrated: false,
    selection: { section: 'components', componentId: 'button' },
    previewMode: 'individual',
    previewTheme: 'dark',
    previewComponentId: 'button',
    inspectorTab: 'visual',
    compareTheme: false,
    responsiveWidth: 768,
    history: [],
    future: [],
    dirty: false,

    hydrate: (doc) => {
      set((state) => {
        if (doc) state.doc = doc
        state.hydrated = true
        state.dirty = false
      })
    },

    setSelection: (selection) => {
      set((state) => {
        state.selection = { ...state.selection, ...selection }
        if (selection.componentId) {
          state.previewComponentId = selection.componentId
        }
        if (selection.section === 'components' && selection.componentId) {
          state.previewComponentId = selection.componentId
        }
      })
    },

    setPreviewMode: (mode) => set((s) => { s.previewMode = mode }),
    setPreviewTheme: (theme) => set((s) => { s.previewTheme = theme }),
    setPreviewComponentId: (id) => set((s) => { s.previewComponentId = id }),
    setInspectorTab: (tab) => set((s) => { s.inspectorTab = tab }),
    setResponsiveWidth: (width) => set((s) => { s.responsiveWidth = width }),

    replaceDocument: (doc, label = 'Replace system') => {
      set((state) => {
        state.history.push({ doc: cloneDoc(state.doc), label })
        if (state.history.length > MAX_HISTORY) state.history.shift()
        state.future = []
        state.doc = doc
        state.dirty = true
      })
      get().persist()
    },

    updateDocument: (mutator, label = 'Edit') => {
      set((state) => {
        state.history.push({ doc: cloneDoc(state.doc), label })
        if (state.history.length > MAX_HISTORY) state.history.shift()
        state.future = []
        mutator(state.doc)
        touch(state.doc)
        state.dirty = true
      })
      get().persist()
    },

    loadDefault: () => {
      get().replaceDocument(createDefaultDesignSystem(), 'Load default')
    },

    loadBlank: () => {
      get().replaceDocument(createBlankDesignSystem(), 'Start from scratch')
    },

    undo: () => {
      set((state) => {
        const prev = state.history.pop()
        if (!prev) return
        state.future.push({ doc: cloneDoc(state.doc), label: 'Redo' })
        state.doc = prev.doc
        state.dirty = true
      })
      get().persist()
    },

    redo: () => {
      set((state) => {
        const next = state.future.pop()
        if (!next) return
        state.history.push({ doc: cloneDoc(state.doc), label: 'Undo' })
        state.doc = next.doc
        state.dirty = true
      })
      get().persist()
    },

    persist: () => {
      void saveDocument(cloneDoc(get().doc))
      set((s) => { s.dirty = false })
    },
  })),
)

export type { EditorSelection, PreviewMode, InspectorTab, DesignSystemDocument }

import type { IconLibraryId, SemanticIconRole } from '@/schema/types'
import { useEditorStore } from '@/store/editor-store'
import { remapSemanticIcons } from '@/icons/remap'
import {
  ArrowLeft,
  ArrowRight,
  Menu,
  X,
  Search,
  Plus,
  Pencil,
  Trash2,
  Settings,
  CircleCheck,
  TriangleAlert,
  CircleX,
  Info,
  LoaderCircle,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

const LIBRARIES: Array<{ id: IconLibraryId; label: string; note: string }> = [
  { id: 'lucide', label: 'Lucide', note: 'Default — tree-shakeable React icons' },
  { id: 'phosphor', label: 'Phosphor', note: 'Export will add @phosphor-icons/react' },
  { id: 'tabler', label: 'Tabler Icons', note: 'Export will add @tabler/icons-react' },
  { id: 'heroicons', label: 'Heroicons', note: 'Export will add @heroicons/react' },
  { id: 'material', label: 'Material Symbols', note: 'Export notes Material Symbols usage' },
]

const PREVIEW: Record<string, LucideIcon> = {
  ArrowLeft,
  ArrowRight,
  Menu,
  X,
  Search,
  Plus,
  Pencil,
  Trash2,
  Settings,
  CircleCheck,
  TriangleAlert,
  CircleX,
  Info,
  LoaderCircle,
}

export function IconsInspector() {
  const doc = useEditorStore((s) => s.doc)
  const updateDocument = useEditorStore((s) => s.updateDocument)

  return (
    <div className="fe-stack">
      <div className="fe-field">
        <label htmlFor="icon-lib">Icon library</label>
        <select
          id="icon-lib"
          className="fe-select"
          value={doc.icons.libraryId}
          onChange={(e) => {
            const next = e.target.value as IconLibraryId
            updateDocument((d) => {
              const previous = d.icons.libraryId
              d.icons.libraryId = next
              d.icons.semanticMap = remapSemanticIcons(d.icons.semanticMap, previous, next)
            }, 'Switch icon library')
          }}
        >
          {LIBRARIES.map((lib) => (
            <option key={lib.id} value={lib.id}>
              {lib.label}
            </option>
          ))}
        </select>
        <span className="fe-tertiary" style={{ fontSize: 11 }}>
          {LIBRARIES.find((l) => l.id === doc.icons.libraryId)?.note}
        </span>
      </div>

      <div className="fe-field">
        <label htmlFor="stroke">Stroke width</label>
        <input
          id="stroke"
          className="fe-input"
          type="number"
          step={0.25}
          value={doc.icons.strokeWidth}
          onChange={(e) => {
            updateDocument((d) => {
              d.icons.strokeWidth = Number(e.target.value)
            })
          }}
        />
      </div>

      <div className="fe-field"><label>Sizes</label></div>
      {doc.icons.sizes.map((size) => (
        <div key={size.id} className="fe-field">
          <label>{size.name}</label>
          <input
            className="fe-input"
            value={size.value}
            onChange={(e) => {
              updateDocument((d) => {
                const t = d.icons.sizes.find((x) => x.id === size.id)
                if (t) t.value = e.target.value
              })
            }}
          />
        </div>
      ))}

      <div className="fe-divider" />
      <div className="fe-field"><label>Semantic mappings</label></div>
      {(Object.entries(doc.icons.semanticMap) as Array<[SemanticIconRole, string]>).map(
        ([role, iconId]) => {
          const Icon = PREVIEW[iconId] ?? Info
          return (
            <div key={role} className="fe-row">
              <Icon size={16} strokeWidth={doc.icons.strokeWidth} />
              <span className="fe-grow" style={{ fontSize: 12 }}>
                {role}
              </span>
              <code className="fe-tertiary" style={{ fontSize: 11 }}>
                {iconId}
              </code>
            </div>
          )
        },
      )}

      <div className="fe-divider" />
      <div className="fe-field">
        <label htmlFor="custom-svg">Upload custom SVG</label>
        <input
          id="custom-svg"
          type="file"
          accept=".svg,image/svg+xml"
          onChange={async (e) => {
            const file = e.target.files?.[0]
            if (!file) return
            const svg = await file.text()
            updateDocument((d) => {
              d.icons.customSvgs.push({
                id: `custom-${Date.now()}`,
                name: file.name.replace(/\.svg$/i, ''),
                svg,
              })
            }, 'Upload custom icon')
          }}
        />
      </div>
      {doc.icons.customSvgs.map((icon) => (
        <div key={icon.id} className="fe-row">
          <span
            dangerouslySetInnerHTML={{ __html: icon.svg }}
            style={{ width: 20, height: 20, display: 'grid', placeItems: 'center' }}
          />
          <span className="fe-grow">{icon.name}</span>
          <button
            type="button"
            className="fe-btn fe-btn-ghost"
            onClick={() => {
              updateDocument((d) => {
                d.icons.customSvgs = d.icons.customSvgs.filter((x) => x.id !== icon.id)
              })
            }}
          >
            Remove
          </button>
        </div>
      ))}
    </div>
  )
}

import { useEditorStore } from '@/store/editor-store'
import type { InspectorTab } from '@/schema/types'
import { ColorsInspector } from './panels/ColorsInspector'
import { TypographyInspector } from './panels/TypographyInspector'
import { ScaleInspector } from './panels/ScaleInspector'
import { ShadowsInspector } from './panels/ShadowsInspector'
import { MotionInspector } from './panels/MotionInspector'
import { IconsInspector } from './panels/IconsInspector'
import { ComponentsInspector } from './panels/ComponentsInspector'
import { ThemesInspector } from './panels/ThemesInspector'
import { ExportInspector } from './panels/ExportInspector'
import { AiInspector } from './panels/AiInspector'
import { BreakpointsInspector } from './panels/BreakpointsInspector'
import { BordersInspector } from './panels/BordersInspector'
import { OpacityInspector } from './panels/OpacityInspector'

const tabs: InspectorTab[] = ['visual', 'tokens', 'code']

export function Inspector() {
  const selection = useEditorStore((s) => s.selection)
  const inspectorTab = useEditorStore((s) => s.inspectorTab)
  const setInspectorTab = useEditorStore((s) => s.setInspectorTab)

  return (
    <aside className="fe-inspector">
      <div className="fe-panel-header">
        <span>Inspector</span>
        <span className="fe-badge">{selection.section}</span>
      </div>
      <div className="fe-tabs" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            data-active={inspectorTab === tab}
            onClick={() => setInspectorTab(tab)}
          >
            {tab[0]!.toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>
      <div className="fe-inspector-body">
        <InspectorContent />
      </div>
    </aside>
  )
}

function InspectorContent() {
  const section = useEditorStore((s) => s.selection.section)
  switch (section) {
    case 'colors':
      return <ColorsInspector />
    case 'typography':
      return <TypographyInspector />
    case 'spacing':
      return <ScaleInspector kind="spacing" />
    case 'sizing':
      return <ScaleInspector kind="sizing" />
    case 'radius':
      return <ScaleInspector kind="radius" />
    case 'borders':
      return <BordersInspector />
    case 'shadows':
      return <ShadowsInspector />
    case 'motion':
      return <MotionInspector />
    case 'opacity':
      return <OpacityInspector />
    case 'breakpoints':
      return <BreakpointsInspector />
    case 'icons':
      return <IconsInspector />
    case 'components':
      return <ComponentsInspector />
    case 'themes':
      return <ThemesInspector />
    case 'export':
      return <ExportInspector />
    case 'ai':
      return <AiInspector />
    default:
      return <div className="fe-empty">Select a foundation or component.</div>
  }
}

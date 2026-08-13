import { WorkspacePreview } from '@/preview/WorkspacePreview'

export function Workspace() {
  return (
    <main className="fe-workspace">
      <div className="fe-workspace-canvas">
        <WorkspacePreview />
      </div>
    </main>
  )
}

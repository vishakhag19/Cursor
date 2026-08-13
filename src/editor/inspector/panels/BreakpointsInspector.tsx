import { useEditorStore } from '@/store/editor-store'

export function BreakpointsInspector() {
  const doc = useEditorStore((s) => s.doc)
  const updateDocument = useEditorStore((s) => s.updateDocument)

  return (
    <div className="fe-stack">
      {doc.foundations.breakpoints.map((bp) => (
        <div key={bp.id} className="fe-field">
          <label>{bp.name}</label>
          <input
            className="fe-input"
            value={bp.minWidth}
            onChange={(e) => {
              updateDocument((d) => {
                const t = d.foundations.breakpoints.find((x) => x.id === bp.id)
                if (t) t.minWidth = e.target.value
              })
            }}
          />
        </div>
      ))}
      <button
        type="button"
        className="fe-btn"
        onClick={() => {
          updateDocument((d) => {
            d.foundations.breakpoints.push({
              id: `bp-${d.foundations.breakpoints.length + 1}`,
              name: 'Custom',
              minWidth: '1440px',
            })
          })
        }}
      >
        Add breakpoint
      </button>
    </div>
  )
}

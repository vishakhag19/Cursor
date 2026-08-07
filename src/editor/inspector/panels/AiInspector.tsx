import { useState } from 'react'
import { useEditorStore } from '@/store/editor-store'
import {
  hasAiApiKey,
  proposeLocalEdits,
  proposeRemoteEdits,
  type DesignChange,
  type DesignDiff,
} from '@/ai/propose'
import { estimateComponentImpact } from '@/token-engine'

const SCOPES = [
  { id: 'system', label: 'Entire system' },
  { id: 'colors', label: 'Colors' },
  { id: 'typography', label: 'Typography' },
  { id: 'spacing', label: 'Spacing' },
  { id: 'motion', label: 'Motion' },
  { id: 'component', label: 'Component' },
]

export function AiInspector() {
  const doc = useEditorStore((s) => s.doc)
  const updateDocument = useEditorStore((s) => s.updateDocument)
  const [scope, setScope] = useState('system')
  const [prompt, setPrompt] = useState(
    'Make this design system feel warmer, more approachable, and appropriate for a consumer wellness product.',
  )
  const [diff, setDiff] = useState<DesignDiff | null>(null)
  const [accepted, setAccepted] = useState<Record<string, boolean>>({})
  const [busy, setBusy] = useState(false)
  const remote = hasAiApiKey()

  async function run() {
    setBusy(true)
    try {
      const remoteDiff = await proposeRemoteEdits(doc, prompt, scope)
      const next = remoteDiff ?? proposeLocalEdits(doc, prompt)
      setDiff(next)
      setAccepted(Object.fromEntries(next.changes.map((c) => [c.id, true])))
    } finally {
      setBusy(false)
    }
  }

  function applySelected() {
    if (!diff) return
    const selected = diff.changes.filter((c) => accepted[c.id])
    updateDocument((d) => {
      for (const change of selected) change.apply(d)
    }, `AI apply ${selected.length} changes`)
    setDiff(null)
  }

  return (
    <div className="fe-stack">
      <div className="fe-impact">
        AI manipulates the structured design-system schema and proposes a reviewable diff.
        {remote
          ? ' Remote model connected via VITE_AI_API_KEY.'
          : ' No API key — using built-in schema-aware heuristics (fully usable offline).'}
      </div>

      <div className="fe-field">
        <label htmlFor="scope">Scope</label>
        <select id="scope" className="fe-select" value={scope} onChange={(e) => setScope(e.target.value)}>
          {SCOPES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      <div className="fe-field">
        <label htmlFor="prompt">Instruction</label>
        <textarea
          id="prompt"
          className="fe-textarea"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          style={{ minHeight: 100, fontFamily: 'var(--fe-font)' }}
        />
      </div>

      <button type="button" className="fe-btn fe-btn-primary" disabled={busy || !prompt.trim()} onClick={() => void run()}>
        {busy ? 'Thinking…' : 'Propose changes'}
      </button>

      {diff && (
        <>
          <div className="fe-divider" />
          <div className="fe-impact">{diff.summary}</div>
          <div className="fe-inline">
            <button type="button" className="fe-btn fe-btn-primary" onClick={applySelected}>
              Apply selected
            </button>
            <button
              type="button"
              className="fe-btn"
              onClick={() => {
                setAccepted(Object.fromEntries(diff.changes.map((c) => [c.id, true])))
                updateDocument((d) => {
                  for (const change of diff.changes) change.apply(d)
                }, 'AI apply all')
                setDiff(null)
              }}
            >
              Apply all
            </button>
            <button type="button" className="fe-btn" onClick={() => setDiff(null)}>
              Reject
            </button>
          </div>

          {diff.changes.map((change) => (
            <ChangeCard
              key={change.id}
              change={change}
              checked={Boolean(accepted[change.id])}
              onCheckedChange={(v) => setAccepted((a) => ({ ...a, [change.id]: v }))}
            />
          ))}
        </>
      )}
    </div>
  )
}

function ChangeCard({
  change,
  checked,
  onCheckedChange,
}: {
  change: DesignChange
  checked: boolean
  onCheckedChange: (v: boolean) => void
}) {
  const doc = useEditorStore((s) => s.doc)
  const impact = estimateComponentImpact(doc, change.path)

  return (
    <div
      style={{
        border: '1px solid var(--fe-border)',
        borderRadius: 6,
        padding: 10,
        background: 'var(--fe-panel-2)',
      }}
    >
      <label className="fe-inline" style={{ marginBottom: 6 }}>
        <input type="checkbox" checked={checked} onChange={(e) => onCheckedChange(e.target.checked)} />
        <strong className="fe-grow">{change.label}</strong>
        <span className="fe-badge">{change.category}</span>
      </label>
      <div style={{ fontSize: 11.5, fontFamily: 'var(--fe-mono)' }}>
        <div className="fe-tertiary">{change.path}</div>
        <div>
          <span style={{ color: '#9a3b3b' }}>{change.before}</span>
          {' → '}
          <span style={{ color: '#1f6b4f' }}>{change.after}</span>
        </div>
        <div className="fe-muted" style={{ marginTop: 4 }}>
          Affects ~{impact.count} components
        </div>
      </div>
    </div>
  )
}

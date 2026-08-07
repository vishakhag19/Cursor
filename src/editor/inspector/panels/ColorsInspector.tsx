import { useMemo, useState } from 'react'
import { useEditorStore } from '@/store/editor-store'
import {
  contrastRatio,
  estimateComponentImpact,
  formatContrastWarning,
  findSemanticDependents,
  resolveTokenValue,
} from '@/token-engine'
import { formatHex, parse } from 'culori'
import { emitTokenCss } from '@/export/codegen'

function toHex(value: string): string {
  const c = parse(value)
  if (!c) return value
  return formatHex(c) ?? value
}

export function ColorsInspector() {
  const doc = useEditorStore((s) => s.doc)
  const updateDocument = useEditorStore((s) => s.updateDocument)
  const inspectorTab = useEditorStore((s) => s.inspectorTab)
  const previewTheme = useEditorStore((s) => s.previewTheme)
  const [scaleId, setScaleId] = useState(
    doc.foundations.colors.primitives.find((p) => p.id === 'brand')?.id
      ?? doc.foundations.colors.primitives[0]?.id
      ?? 'brand',
  )
  const [stopStep, setStopStep] = useState('600')
  const [semanticId, setSemanticId] = useState(doc.foundations.colors.semantics.find((s) => s.id === 'primary')?.id ?? 'primary')

  const scale = doc.foundations.colors.primitives.find((p) => p.id === scaleId)
  const stop = scale?.stops.find((s) => s.step === stopStep)
  const semantic = doc.foundations.colors.semantics.find((s) => s.id === semanticId)

  const tokenPath = `color.primitive.${scaleId}.${stopStep}`
  const impact = estimateComponentImpact(doc, tokenPath)
  const dependents = findSemanticDependents(doc, tokenPath)

  const bg = resolveTokenValue(
    doc,
    doc.foundations.colors.semantics.find((s) => s.id === 'bg')?.[previewTheme === 'dark' ? 'dark' : 'light']
      ?? { type: 'literal', value: '#fff' },
    previewTheme,
  )
  const warning = useMemo(() => {
    if (!stop) return null
    const ratio = contrastRatio(stop.value, bg)
    return formatContrastWarning(ratio)
  }, [stop, bg])

  if (inspectorTab === 'code') {
    return <pre className="fe-code">{emitTokenCss(doc, 'colors')}</pre>
  }

  if (inspectorTab === 'tokens') {
    return (
      <div className="fe-stack">
        <div className="fe-impact">
          Path <code>{tokenPath}</code>
          {dependents.length > 0 && (
            <div style={{ marginTop: 6 }}>Used by: {dependents.join(', ')}</div>
          )}
        </div>
        {doc.foundations.colors.semantics.map((s) => (
          <div key={s.id} className="fe-row">
            <span className="fe-grow">{s.name}</span>
            <code className="fe-tertiary" style={{ fontSize: 11 }}>
              color.semantic.{s.id}
            </code>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="fe-stack">
      <div className="fe-impact">
        This change affects <strong>{impact.count}</strong> selected component
        {impact.count === 1 ? '' : 's'}.
        {dependents.length > 0 && (
          <div style={{ marginTop: 4 }}>
            Semantics: {dependents.map((d) => d.replace('color.semantic.', '')).join(', ')}
          </div>
        )}
      </div>

      <div className="fe-field">
        <label htmlFor="scale">Primitive scale</label>
        <select
          id="scale"
          className="fe-select"
          value={scaleId}
          onChange={(e) => {
            setScaleId(e.target.value)
            const next = doc.foundations.colors.primitives.find((p) => p.id === e.target.value)
            if (next?.stops[0]) setStopStep(next.stops[Math.min(5, next.stops.length - 1)]!.step)
          }}
        >
          {doc.foundations.colors.primitives.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {scale && (
        <div className="fe-color-grid">
          {scale.stops.map((s) => (
            <button
              key={s.step}
              type="button"
              className="fe-color-cell"
              data-active={s.step === stopStep}
              style={{ background: s.value }}
              title={`${scale.name}-${s.step}: ${s.value}`}
              onClick={() => setStopStep(s.step)}
              aria-label={`${scale.name} ${s.step}`}
            />
          ))}
        </div>
      )}

      {stop && (
        <>
          <div className="fe-field">
            <label htmlFor="hex">{scale?.name}-{stop.step}</label>
            <div className="fe-inline">
              <span className="fe-swatch" style={{ background: stop.value }} />
              <input
                id="hex"
                className="fe-input"
                value={stop.value}
                onChange={(e) => {
                  const value = e.target.value
                  updateDocument((d) => {
                    const sc = d.foundations.colors.primitives.find((p) => p.id === scaleId)
                    const st = sc?.stops.find((x) => x.step === stopStep)
                    if (st) st.value = value.startsWith('#') ? value : toHex(value) || value
                  }, `Edit ${scaleId}.${stopStep}`)
                }}
              />
              <input
                type="color"
                value={toHex(stop.value).slice(0, 7)}
                onChange={(e) => {
                  const value = e.target.value
                  updateDocument((d) => {
                    const sc = d.foundations.colors.primitives.find((p) => p.id === scaleId)
                    const st = sc?.stops.find((x) => x.step === stopStep)
                    if (st) st.value = value
                  }, `Edit ${scaleId}.${stopStep}`)
                }}
                aria-label="Color picker"
                style={{ width: 36, height: 28, padding: 0, border: 'none', background: 'transparent' }}
              />
            </div>
          </div>
          {warning && <div className="fe-warn">⚠ {warning}</div>}
        </>
      )}

      <div className="fe-divider" />

      <div className="fe-field">
        <label htmlFor="semantic">Semantic role</label>
        <select
          id="semantic"
          className="fe-select"
          value={semanticId}
          onChange={(e) => setSemanticId(e.target.value)}
        >
          {doc.foundations.colors.semantics.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      {semantic && (
        <div className="fe-stack">
          <div className="fe-field">
            <label>Light reference</label>
            <TokenRefEditor
              value={
                semantic.light.type === 'ref'
                  ? semantic.light.path
                  : semantic.light.value
              }
              isRef={semantic.light.type === 'ref'}
              onChange={(next, isRef) => {
                updateDocument((d) => {
                  const s = d.foundations.colors.semantics.find((x) => x.id === semanticId)
                  if (!s) return
                  s.light = isRef ? { type: 'ref', path: next } : { type: 'literal', value: next }
                }, `Semantic ${semanticId} light`)
              }}
            />
          </div>
          <div className="fe-field">
            <label>Dark reference</label>
            <TokenRefEditor
              value={
                semantic.dark.type === 'ref' ? semantic.dark.path : semantic.dark.value
              }
              isRef={semantic.dark.type === 'ref'}
              onChange={(next, isRef) => {
                updateDocument((d) => {
                  const s = d.foundations.colors.semantics.find((x) => x.id === semanticId)
                  if (!s) return
                  s.dark = isRef ? { type: 'ref', path: next } : { type: 'literal', value: next }
                }, `Semantic ${semanticId} dark`)
              }}
            />
          </div>
          <button
            type="button"
            className="fe-btn"
            onClick={() => {
              updateDocument((d) => {
                d.foundations.colors.semantics.push({
                  id: `custom-${d.foundations.colors.semantics.length + 1}`,
                  name: 'Custom role',
                  light: { type: 'ref', path: 'color.primitive.brand.600' },
                  dark: { type: 'ref', path: 'color.primitive.brand.400' },
                })
              }, 'Add semantic color')
            }}
          >
            Add semantic role
          </button>
        </div>
      )}

      <div className="fe-divider" />
      <button
        type="button"
        className="fe-btn"
        onClick={() => {
          updateDocument((d) => {
            const brand = d.foundations.colors.primitives.find((p) => p.id === 'brand')
            if (!brand) return
            const base = brand.stops.find((s) => s.step === '600')?.value ?? '#246557'
            brand.stops = generateScale(base)
          }, 'Generate brand scale')
        }}
      >
        Regenerate brand scale from 600
      </button>
    </div>
  )
}

function TokenRefEditor({
  value,
  isRef,
  onChange,
}: {
  value: string
  isRef: boolean
  onChange: (value: string, isRef: boolean) => void
}) {
  return (
    <div className="fe-inline">
      <select
        className="fe-select"
        style={{ width: 90 }}
        value={isRef ? 'ref' : 'literal'}
        onChange={(e) => onChange(value, e.target.value === 'ref')}
      >
        <option value="ref">Ref</option>
        <option value="literal">Value</option>
      </select>
      <input className="fe-input" value={value} onChange={(e) => onChange(e.target.value, isRef)} />
    </div>
  )
}

function generateScale(baseHex: string) {
  const base = parse(baseHex)
  if (!base || base.mode !== 'rgb') {
    return [
      { step: '50', value: '#EEF6F3' },
      { step: '600', value: baseHex },
      { step: '900', value: '#12332D' },
    ]
  }
  const steps = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900']
  const factors = [0.92, 0.8, 0.65, 0.45, 0.25, 0.1, 0, -0.15, -0.28, -0.4]
  return steps.map((step, i) => {
    const f = factors[i]!
    const mix = (channel: number) => {
      if (f >= 0) return channel + (1 - channel) * f
      return channel * (1 + f)
    }
    const hex = formatHex({
      mode: 'rgb',
      r: mix(base.r ?? 0),
      g: mix(base.g ?? 0),
      b: mix(base.b ?? 0),
    })
    return { step, value: hex ?? baseHex }
  })
}

import type { DesignSystemDocument, TokenValue } from '@/schema/types'

export interface DesignChange {
  id: string
  path: string
  label: string
  before: string
  after: string
  apply: (doc: DesignSystemDocument) => void
  category: 'color' | 'typography' | 'radius' | 'spacing' | 'motion' | 'other'
}

export interface DesignDiff {
  summary: string
  changes: DesignChange[]
}

function lit(value: string): TokenValue {
  return { type: 'literal', value }
}

/** Schema-aware heuristic editor used when no API key is configured, and as a fallback parser. */
export function proposeLocalEdits(doc: DesignSystemDocument, prompt: string): DesignDiff {
  const p = prompt.toLowerCase()
  const changes: DesignChange[] = []

  const warmer =
    p.includes('warm') || p.includes('approachable') || p.includes('wellness') || p.includes('soft')
  const denser = p.includes('dens') || p.includes('compact') || p.includes('15%')
  const faster = p.includes('fast') || p.includes('snappy') || p.includes('responsive')
  const editorial = p.includes('editorial') || p.includes('serif') || p.includes('heading')
  const rounder = p.includes('round') || p.includes('soft') || p.includes('friendly')
  const cooler = p.includes('cool') || p.includes('corporate') || p.includes('blue')

  if (warmer) {
    const neutral100 = doc.foundations.colors.primitives.find((s) => s.id === 'neutral')?.stops.find((s) => s.step === '100')
    if (neutral100) {
      const before = neutral100.value
      const after = '#F7F5F2'
      changes.push({
        id: 'neutral-100-warm',
        path: 'color.primitive.neutral.100',
        label: 'Warm neutral.100',
        before,
        after,
        category: 'color',
        apply: (d) => {
          const stop = d.foundations.colors.primitives.find((s) => s.id === 'neutral')?.stops.find((s) => s.step === '100')
          if (stop) stop.value = after
        },
      })
    }
    const brand600 = doc.foundations.colors.primitives.find((s) => s.id === 'brand')?.stops.find((s) => s.step === '600')
    if (brand600) {
      const before = brand600.value
      const after = '#3D7A68'
      changes.push({
        id: 'brand-600-warm',
        path: 'color.primitive.brand.600',
        label: 'Softer brand.600',
        before,
        after,
        category: 'color',
        apply: (d) => {
          const stop = d.foundations.colors.primitives.find((s) => s.id === 'brand')?.stops.find((s) => s.step === '600')
          if (stop) stop.value = after
        },
      })
    }
  }

  if (cooler) {
    const brand600 = doc.foundations.colors.primitives.find((s) => s.id === 'brand')?.stops.find((s) => s.step === '600')
    if (brand600) {
      const before = brand600.value
      const after = '#2563EB'
      changes.push({
        id: 'brand-cool',
        path: 'color.primitive.brand.600',
        label: 'Cooler primary',
        before,
        after,
        category: 'color',
        apply: (d) => {
          const stop = d.foundations.colors.primitives.find((s) => s.id === 'brand')?.stops.find((s) => s.step === '600')
          if (stop) stop.value = after
        },
      })
    }
  }

  if (editorial) {
    const heading = doc.foundations.typography.styles.find((s) => s.id === 'heading-1')
    if (heading) {
      changes.push({
        id: 'heading-editorial',
        path: 'typography.heading-1.fontFamilyId',
        label: 'Editorial headings',
        before: heading.fontFamilyId,
        after: 'display',
        category: 'typography',
        apply: (d) => {
          for (const style of d.foundations.typography.styles) {
            if (style.role === 'heading' || style.role === 'display') style.fontFamilyId = 'display'
          }
        },
      })
    }
  }

  if (denser) {
    const base = doc.foundations.spacing.baseUnit
    const next = Math.max(2, Math.round(base * 0.85))
    changes.push({
      id: 'spacing-density',
      path: 'spacing.baseUnit',
      label: 'Increase density (~15%)',
      before: `${base}px`,
      after: `${next}px`,
      category: 'spacing',
      apply: (d) => {
        d.foundations.spacing.baseUnit = next
        for (const token of d.foundations.spacing.tokens) {
          const n = Number(token.id)
          if (!Number.isNaN(n) && n > 0) token.value = `${n * next}px`
        }
      },
    })
  }

  if (faster) {
    const fast = doc.foundations.motion.durations.find((d) => d.id === 'fast')
    if (fast) {
      changes.push({
        id: 'motion-fast',
        path: 'duration.fast',
        label: 'Faster interactions',
        before: fast.value,
        after: '100ms',
        category: 'motion',
        apply: (d) => {
          const t = d.foundations.motion.durations.find((x) => x.id === 'fast')
          if (t) t.value = '100ms'
          const normal = d.foundations.motion.durations.find((x) => x.id === 'normal')
          if (normal) normal.value = '160ms'
        },
      })
    }
  }

  if (rounder) {
    const md = doc.foundations.radius.tokens.find((t) => t.id === 'md')
    if (md) {
      changes.push({
        id: 'radius-md',
        path: 'radius.md',
        label: 'Softer radius.md',
        before: md.value,
        after: '12px',
        category: 'radius',
        apply: (d) => {
          const t = d.foundations.radius.tokens.find((x) => x.id === 'md')
          if (t) t.value = '12px'
          const lg = d.foundations.radius.tokens.find((x) => x.id === 'lg')
          if (lg) lg.value = '16px'
        },
      })
    }
  }

  if (changes.length === 0) {
    const md = doc.foundations.radius.tokens.find((t) => t.id === 'md')
    changes.push({
      id: 'gentle-radius',
      path: 'radius.md',
      label: 'Slightly softer corners',
      before: md?.value ?? '8px',
      after: '10px',
      category: 'radius',
      apply: (d) => {
        const t = d.foundations.radius.tokens.find((x) => x.id === 'md')
        if (t) t.value = '10px'
      },
    })
    const primary = doc.foundations.colors.semantics.find((s) => s.id === 'primary')
    if (primary) {
      changes.push({
        id: 'primary-hint',
        path: 'color.semantic.primary',
        label: 'Nudge primary semantic toward brand.500',
        before: primary.light.type === 'ref' ? primary.light.path : primary.light.value,
        after: 'color.primitive.brand.500',
        category: 'color',
        apply: (d) => {
          const s = d.foundations.colors.semantics.find((x) => x.id === 'primary')
          if (s) s.light = { type: 'ref', path: 'color.primitive.brand.500' }
        },
      })
    }
  }

  void lit
  return {
    summary: `AI proposes ${changes.length} change${changes.length === 1 ? '' : 's'} based on your instruction.`,
    changes,
  }
}

export function hasAiApiKey(): boolean {
  return Boolean(import.meta.env.VITE_AI_API_KEY)
}

/** Optional remote AI — expects OpenAI-compatible chat completions returning JSON changes. */
export async function proposeRemoteEdits(
  doc: DesignSystemDocument,
  prompt: string,
  scope: string,
): Promise<DesignDiff | null> {
  const key = import.meta.env.VITE_AI_API_KEY as string | undefined
  const baseUrl = (import.meta.env.VITE_AI_BASE_URL as string | undefined) ?? 'https://api.openai.com/v1'
  if (!key) return null

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: import.meta.env.VITE_AI_MODEL ?? 'gpt-4o-mini',
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              'You edit design-system tokens. Reply JSON: { "summary": string, "changes": [{ "id", "path", "label", "before", "after", "category", "op": "setPrimitiveStop"|"setRadius"|"setSpacingBase"|"setDuration"|"setTypeFamily", "payload": object }] }',
          },
          {
            role: 'user',
            content: JSON.stringify({
              scope,
              prompt,
              foundations: {
                colors: doc.foundations.colors,
                typography: doc.foundations.typography.styles.map((s) => ({
                  id: s.id,
                  fontFamilyId: s.fontFamilyId,
                  fontWeight: s.fontWeight,
                })),
                spacing: doc.foundations.spacing,
                radius: doc.foundations.radius,
                motion: doc.foundations.motion.durations,
              },
            }),
          },
        ],
      }),
    })
    if (!res.ok) return null
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> }
    const content = data.choices?.[0]?.message?.content
    if (!content) return null
    const parsed = JSON.parse(content) as {
      summary: string
      changes: Array<{
        id: string
        path: string
        label: string
        before: string
        after: string
        category: DesignChange['category']
        op: string
        payload: Record<string, string>
      }>
    }
    return {
      summary: parsed.summary,
      changes: parsed.changes.map((c) => ({
        id: c.id,
        path: c.path,
        label: c.label,
        before: c.before,
        after: c.after,
        category: c.category,
        apply: (d) => applyRemoteOp(d, c.op, c.payload),
      })),
    }
  } catch {
    return null
  }
}

function applyRemoteOp(doc: DesignSystemDocument, op: string, payload: Record<string, string>) {
  if (op === 'setPrimitiveStop') {
    const stop = doc.foundations.colors.primitives
      .find((s) => s.id === payload.scaleId)
      ?.stops.find((s) => s.step === payload.step)
    if (stop && payload.value) stop.value = payload.value
  }
  if (op === 'setRadius' && payload.id && payload.value) {
    const t = doc.foundations.radius.tokens.find((x) => x.id === payload.id)
    if (t) t.value = payload.value
  }
  if (op === 'setSpacingBase' && payload.value) {
    const base = Number(payload.value)
    doc.foundations.spacing.baseUnit = base
    for (const token of doc.foundations.spacing.tokens) {
      const n = Number(token.id)
      if (!Number.isNaN(n) && n > 0) token.value = `${n * base}px`
    }
  }
  if (op === 'setDuration' && payload.id && payload.value) {
    const t = doc.foundations.motion.durations.find((x) => x.id === payload.id)
    if (t) t.value = payload.value
  }
  if (op === 'setTypeFamily' && payload.styleId && payload.fontFamilyId) {
    const t = doc.foundations.typography.styles.find((x) => x.id === payload.styleId)
    if (t) t.fontFamilyId = payload.fontFamilyId
  }
}

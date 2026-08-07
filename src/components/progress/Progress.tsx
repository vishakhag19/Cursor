import * as ProgressPrimitive from '@radix-ui/react-progress'

export interface ProgressProps {
  value?: number
  max?: number
  label?: string
}

export function Progress({ value = 0, max = 100, label }: ProgressProps) {
  const clamped = Math.min(max, Math.max(0, value))
  const percent = max > 0 ? (clamped / max) * 100 : 0

  return (
    <div className="ds-field">
      {label && <span className="ds-field-label">{label}</span>}
      <ProgressPrimitive.Root className="ds-progress" value={clamped} max={max}>
        <ProgressPrimitive.Indicator
          className="ds-progress-indicator"
          style={{ transform: `translateX(-${100 - percent}%)` }}
        />
      </ProgressPrimitive.Root>
    </div>
  )
}

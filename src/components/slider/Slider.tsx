import * as SliderPrimitive from '@radix-ui/react-slider'

export interface SliderProps {
  label?: string
  value?: number[]
  defaultValue?: number[]
  onValueChange?: (value: number[]) => void
  min?: number
  max?: number
  step?: number
  disabled?: boolean
}

export function Slider({
  label,
  value,
  defaultValue = [50],
  onValueChange,
  min = 0,
  max = 100,
  step = 1,
  disabled,
}: SliderProps) {
  return (
    <div className="ds-field">
      {label && <span className="ds-field-label">{label}</span>}
      <SliderPrimitive.Root
        className="ds-slider-root"
        value={value}
        defaultValue={defaultValue}
        onValueChange={onValueChange}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
      >
        <SliderPrimitive.Track className="ds-slider-track">
          <SliderPrimitive.Range className="ds-slider-range" />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb className="ds-slider-thumb" aria-label={label ?? 'Slider'} />
      </SliderPrimitive.Root>
    </div>
  )
}

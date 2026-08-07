import * as RadioGroupPrimitive from '@radix-ui/react-radio-group'

export interface RadioOption {
  value: string
  label: string
}

export interface RadioGroupProps {
  label?: string
  options: RadioOption[]
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  disabled?: boolean
  name?: string
}

export function RadioGroup({
  label,
  options,
  value,
  defaultValue,
  onValueChange,
  disabled,
  name,
}: RadioGroupProps) {
  return (
    <div className="ds-field">
      {label && <span className="ds-field-label">{label}</span>}
      <RadioGroupPrimitive.Root
        className="ds-stack"
        style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
        value={value}
        defaultValue={defaultValue}
        onValueChange={onValueChange}
        disabled={disabled}
        name={name}
        aria-label={label}
      >
        {options.map((opt) => (
          <label key={opt.value} className="ds-radio-item">
            <RadioGroupPrimitive.Item value={opt.value} className="ds-radio">
              <RadioGroupPrimitive.Indicator
                style={{
                  display: 'block',
                  width: 8,
                  height: 8,
                  borderRadius: 999,
                  background: 'currentColor',
                }}
              />
            </RadioGroupPrimitive.Item>
            <span>{opt.label}</span>
          </label>
        ))}
      </RadioGroupPrimitive.Root>
    </div>
  )
}

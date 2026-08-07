import * as SwitchPrimitive from '@radix-ui/react-switch'

export interface SwitchProps {
  label?: string
  checked?: boolean
  defaultChecked?: boolean
  onCheckedChange?: (checked: boolean) => void
  disabled?: boolean
  id?: string
}

export function Switch({
  label,
  checked,
  defaultChecked,
  onCheckedChange,
  disabled,
  id,
}: SwitchProps) {
  return (
    <label
      htmlFor={id}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
    >
      <SwitchPrimitive.Root
        id={id}
        className="ds-switch"
        checked={checked}
        defaultChecked={defaultChecked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
      >
        <SwitchPrimitive.Thumb className="ds-switch-thumb" />
      </SwitchPrimitive.Root>
      {label && <span style={{ fontSize: '0.875rem' }}>{label}</span>}
    </label>
  )
}

import * as SelectPrimitive from '@radix-ui/react-select'
import { ChevronDown, Check } from 'lucide-react'
import { clsx } from 'clsx'

export interface SelectOption {
  value: string
  label: string
}

export interface SelectProps {
  label?: string
  placeholder?: string
  options: SelectOption[]
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  disabled?: boolean
}

export function Select({
  label,
  placeholder = 'Select…',
  options,
  value,
  defaultValue,
  onValueChange,
  disabled,
}: SelectProps) {
  return (
    <div className="ds-field">
      {label && <span className="ds-field-label">{label}</span>}
      <SelectPrimitive.Root
        value={value}
        defaultValue={defaultValue}
        onValueChange={onValueChange}
        disabled={disabled}
      >
        <SelectPrimitive.Trigger className={clsx('ds-select-trigger')} aria-label={label ?? placeholder}>
          <SelectPrimitive.Value placeholder={placeholder} />
          <SelectPrimitive.Icon>
            <ChevronDown size={16} strokeWidth={1.75} />
          </SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>
        <SelectPrimitive.Portal>
          <SelectPrimitive.Content className="ds-select-content" position="popper" sideOffset={4}>
            <SelectPrimitive.Viewport>
              {options.map((opt) => (
                <SelectPrimitive.Item key={opt.value} value={opt.value} className="ds-select-item">
                  <SelectPrimitive.ItemText>{opt.label}</SelectPrimitive.ItemText>
                  <SelectPrimitive.ItemIndicator style={{ marginLeft: 'auto' }}>
                    <Check size={14} strokeWidth={2} />
                  </SelectPrimitive.ItemIndicator>
                </SelectPrimitive.Item>
              ))}
            </SelectPrimitive.Viewport>
          </SelectPrimitive.Content>
        </SelectPrimitive.Portal>
      </SelectPrimitive.Root>
    </div>
  )
}

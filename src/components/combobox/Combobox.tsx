import { Check } from 'lucide-react'
import { clsx } from 'clsx'
import { useMemo, useState } from 'react'

export interface ComboboxOption {
  value: string
  label: string
}

export interface ComboboxProps {
  label?: string
  placeholder?: string
  options: ComboboxOption[]
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  disabled?: boolean
}

export function Combobox({
  label,
  placeholder = 'Search…',
  options,
  value,
  defaultValue,
  onValueChange,
  disabled,
}: ComboboxProps) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [internalValue, setInternalValue] = useState(defaultValue ?? '')

  const currentValue = value ?? internalValue
  const selected = options.find((opt) => opt.value === currentValue)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter((opt) => opt.label.toLowerCase().includes(q))
  }, [options, query])

  const select = (next: string) => {
    if (value === undefined) setInternalValue(next)
    onValueChange?.(next)
    const match = options.find((opt) => opt.value === next)
    setQuery(match?.label ?? '')
    setOpen(false)
  }

  return (
    <div className="ds-field">
      {label && <span className="ds-field-label">{label}</span>}
      <div style={{ position: 'relative' }}>
        <input
          className="ds-input"
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          placeholder={placeholder}
          value={open ? query : (selected?.label ?? query)}
          disabled={disabled}
          onFocus={() => {
            setOpen(true)
            setQuery(selected?.label ?? '')
          }}
          onChange={(event) => {
            setQuery(event.target.value)
            setOpen(true)
          }}
          onBlur={() => {
            window.setTimeout(() => setOpen(false), 120)
          }}
        />
        {open && filtered.length > 0 && (
          <div
            className="ds-menu-content"
            role="listbox"
            style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0 }}
          >
            {filtered.map((opt) => (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={opt.value === currentValue}
                className={clsx('ds-menu-item')}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => select(opt.value)}
              >
                <span style={{ flex: 1 }}>{opt.label}</span>
                {opt.value === currentValue && <Check size={14} strokeWidth={2} />}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

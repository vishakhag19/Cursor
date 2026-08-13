import { clsx } from 'clsx'
import { useState } from 'react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'

export interface ChipProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> {
  selected?: boolean
  defaultSelected?: boolean
  onSelectedChange?: (selected: boolean) => void
  children: ReactNode
}

export function Chip({
  selected,
  defaultSelected = false,
  onSelectedChange,
  className,
  children,
  onClick,
  ...props
}: ChipProps) {
  const [uncontrolledSelected, setUncontrolledSelected] = useState(defaultSelected)
  const isControlled = selected !== undefined
  const isSelected = isControlled ? selected : uncontrolledSelected

  return (
    <button
      type="button"
      className={clsx('ds-chip', className)}
      data-selected={isSelected || undefined}
      aria-pressed={isSelected}
      onClick={(event) => {
        onClick?.(event)
        if (event.defaultPrevented) return
        const next = !isSelected
        if (!isControlled) setUncontrolledSelected(next)
        onSelectedChange?.(next)
      }}
      {...props}
    >
      {children}
    </button>
  )
}

import { clsx } from 'clsx'
import type { InputHTMLAttributes } from 'react'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  hint?: string
}

export function Input({ label, hint, id, className, ...props }: InputProps) {
  const inputId = id ?? props.name
  return (
    <div className="ds-field">
      {label && (
        <label className="ds-field-label" htmlFor={inputId}>
          {label}
        </label>
      )}
      <input id={inputId} className={clsx('ds-input', className)} {...props} />
      {hint && <span className="ds-field-hint">{hint}</span>}
    </div>
  )
}

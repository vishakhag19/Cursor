import { clsx } from 'clsx'
import type { TextareaHTMLAttributes } from 'react'

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  hint?: string
}

export function Textarea({ label, hint, id, className, ...props }: TextareaProps) {
  const textareaId = id ?? props.name
  return (
    <div className="ds-field">
      {label && (
        <label className="ds-field-label" htmlFor={textareaId}>
          {label}
        </label>
      )}
      <textarea id={textareaId} className={clsx('ds-textarea', className)} {...props} />
      {hint && <span className="ds-field-hint">{hint}</span>}
    </div>
  )
}

import { Search as SearchIcon } from 'lucide-react'
import { clsx } from 'clsx'
import type { InputHTMLAttributes } from 'react'

export interface SearchProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string
}

export function Search({ label, className, id, ...props }: SearchProps) {
  const inputId = id ?? props.name

  return (
    <div className="ds-field">
      {label && (
        <label className="ds-field-label" htmlFor={inputId}>
          {label}
        </label>
      )}
      <div className="ds-search">
        <SearchIcon className="ds-search-icon" size={16} strokeWidth={1.75} aria-hidden />
        <input
          id={inputId}
          type="search"
          className={clsx('ds-input', className)}
          {...props}
        />
      </div>
    </div>
  )
}

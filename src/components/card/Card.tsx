import type { HTMLAttributes, ReactNode } from 'react'
import { clsx } from 'clsx'

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  title?: string
  description?: string
  children?: ReactNode
  footer?: ReactNode
}

export function Card({ title, description, children, footer, className, ...props }: CardProps) {
  return (
    <div className={clsx('ds-card', className)} {...props}>
      {(title || description) && (
        <div>
          {title && <h3 className="ds-card-title">{title}</h3>}
          {description && <p className="ds-card-desc">{description}</p>}
        </div>
      )}
      {children}
      {footer}
    </div>
  )
}

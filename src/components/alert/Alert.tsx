import { clsx } from 'clsx'
import type { HTMLAttributes, ReactNode } from 'react'

export type AlertVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral'

export interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  variant?: AlertVariant
  icon?: ReactNode
  title?: string
}

export function Alert({
  variant = 'neutral',
  icon,
  title,
  className,
  children,
  ...props
}: AlertProps) {
  return (
    <div
      className={clsx('ds-alert', className)}
      data-variant={variant}
      role="alert"
      {...props}
    >
      {icon && <span aria-hidden>{icon}</span>}
      <div>
        {title && <strong style={{ display: 'block', marginBottom: 4 }}>{title}</strong>}
        {children}
      </div>
    </div>
  )
}

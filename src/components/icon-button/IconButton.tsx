import { clsx } from 'clsx'
import type { ButtonHTMLAttributes, ReactNode } from 'react'

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string
  variant?: 'ghost' | 'primary' | 'outline'
  size?: 'sm' | 'md' | 'lg'
  children: ReactNode
}

export function IconButton({
  label,
  variant = 'ghost',
  size = 'md',
  className,
  children,
  ...props
}: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      className={clsx('ds-icon-btn', className)}
      data-variant={variant}
      data-size={size}
      {...props}
    >
      {children}
    </button>
  )
}

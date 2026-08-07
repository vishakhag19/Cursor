import { ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'

export interface BreadcrumbItem {
  label: string
  href?: string
}

export interface BreadcrumbsProps {
  items: BreadcrumbItem[]
}

export function Breadcrumbs({ items }: BreadcrumbsProps) {
  if (items.length === 0) return null

  return (
    <nav className="ds-breadcrumbs" aria-label="Breadcrumb">
      {items.map((item, index) => {
        const isLast = index === items.length - 1
        const content: ReactNode = isLast ? (
          <span aria-current="page">{item.label}</span>
        ) : item.href ? (
          <a href={item.href}>{item.label}</a>
        ) : (
          <button type="button">{item.label}</button>
        )

        return (
          <span key={`${item.label}-${index}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            {index > 0 && <ChevronRight size={14} strokeWidth={1.75} aria-hidden />}
            {content}
          </span>
        )
      })}
    </nav>
  )
}

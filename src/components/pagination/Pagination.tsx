import { ChevronLeft, ChevronRight } from 'lucide-react'

export interface PaginationProps {
  page: number
  totalPages: number
  onChange: (page: number) => void
}

export function Pagination({ page, totalPages, onChange }: PaginationProps) {
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1)

  return (
    <nav className="ds-pagination" aria-label="Pagination">
      <button
        type="button"
        className="ds-page-btn"
        disabled={page <= 1}
        aria-label="Previous page"
        onClick={() => onChange(page - 1)}
      >
        <ChevronLeft size={14} strokeWidth={1.75} />
      </button>
      {pages.map((p) => (
        <button
          key={p}
          type="button"
          className="ds-page-btn"
          data-active={p === page || undefined}
          aria-current={p === page ? 'page' : undefined}
          onClick={() => onChange(p)}
        >
          {p}
        </button>
      ))}
      <button
        type="button"
        className="ds-page-btn"
        disabled={page >= totalPages}
        aria-label="Next page"
        onClick={() => onChange(page + 1)}
      >
        <ChevronRight size={14} strokeWidth={1.75} />
      </button>
    </nav>
  )
}

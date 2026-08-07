import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useMemo, useState } from 'react'
import { IconButton } from '../icon-button/IconButton'

const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'] as const

export interface CalendarProps {
  selected?: Date
  onSelect?: (date: Date) => void
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function getMonthGrid(year: number, month: number) {
  const firstDay = new Date(year, month, 1)
  const startOffset = firstDay.getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: (Date | null)[] = []

  for (let i = 0; i < startOffset; i++) cells.push(null)
  for (let day = 1; day <= daysInMonth; day++) cells.push(new Date(year, month, day))

  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

export function Calendar({ selected, onSelect }: CalendarProps) {
  const initial = selected ?? new Date()
  const [viewYear, setViewYear] = useState(initial.getFullYear())
  const [viewMonth, setViewMonth] = useState(initial.getMonth())

  const cells = useMemo(() => getMonthGrid(viewYear, viewMonth), [viewYear, viewMonth])

  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleString(undefined, {
    month: 'long',
    year: 'numeric',
  })

  const goMonth = (delta: number) => {
    const next = new Date(viewYear, viewMonth + delta, 1)
    setViewYear(next.getFullYear())
    setViewMonth(next.getMonth())
  }

  return (
    <div className="ds-calendar">
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
        }}
      >
        <IconButton label="Previous month" size="sm" onClick={() => goMonth(-1)}>
          <ChevronLeft size={16} strokeWidth={1.75} />
        </IconButton>
        <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>{monthLabel}</span>
        <IconButton label="Next month" size="sm" onClick={() => goMonth(1)}>
          <ChevronRight size={16} strokeWidth={1.75} />
        </IconButton>
      </div>
      <div className="ds-calendar-grid">
        {DAY_LABELS.map((label) => (
          <div key={label} className="ds-calendar-dow">
            {label}
          </div>
        ))}
        {cells.map((date, index) =>
          date ? (
            <button
              key={date.toISOString()}
              type="button"
              className="ds-calendar-day"
              data-selected={selected && isSameDay(date, selected) ? true : undefined}
              onClick={() => onSelect?.(date)}
            >
              {date.getDate()}
            </button>
          ) : (
            <span key={`empty-${index}`} aria-hidden />
          ),
        )}
      </div>
    </div>
  )
}

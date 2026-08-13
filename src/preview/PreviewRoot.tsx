import type { CSSProperties, ReactNode } from 'react'
import { useMemo } from 'react'
import { emitCssVariables, ensureGoogleFonts } from '@/token-engine'
import type { DesignSystemDocument } from '@/schema/types'
import type { ThemeMode } from '@/token-engine'
import '@/components/ds.css'

interface PreviewRootProps {
  doc: DesignSystemDocument
  mode: ThemeMode
  children: ReactNode
  className?: string
  style?: CSSProperties
  width?: number | string
}

export function PreviewRoot({ doc, mode, children, className, style, width }: PreviewRootProps) {
  const vars = useMemo(() => emitCssVariables(doc, mode), [doc, mode])

  useMemo(() => {
    ensureGoogleFonts(doc)
    return null
  }, [doc.foundations.typography.families])

  return (
    <div
      className={className ?? 'ds-preview'}
      data-theme={mode}
      style={{
        ...(vars as CSSProperties),
        width: width ?? undefined,
        ...style,
      }}
    >
      {children}
    </div>
  )
}

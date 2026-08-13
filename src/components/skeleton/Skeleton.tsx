import { clsx } from 'clsx'
import type { CSSProperties, HTMLAttributes } from 'react'

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  width?: CSSProperties['width']
  height?: CSSProperties['height']
}

export function Skeleton({ width, height, className, style, ...props }: SkeletonProps) {
  return (
    <div
      className={clsx('ds-skeleton', className)}
      style={{ width, height, ...style }}
      aria-hidden
      {...props}
    />
  )
}

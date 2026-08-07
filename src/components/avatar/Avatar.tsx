import * as AvatarPrimitive from '@radix-ui/react-avatar'
import { clsx } from 'clsx'

export type AvatarSize = 'sm' | 'md' | 'lg'

export interface AvatarProps {
  src?: string
  alt?: string
  initials?: string
  size?: AvatarSize
  className?: string
}

export function Avatar({ src, alt, initials, size = 'md', className }: AvatarProps) {
  return (
    <AvatarPrimitive.Root className={clsx('ds-avatar', className)} data-size={size}>
      {src && <AvatarPrimitive.Image src={src} alt={alt ?? initials ?? 'Avatar'} />}
      <AvatarPrimitive.Fallback delayMs={src ? 600 : 0}>
        {initials ?? '?'}
      </AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  )
}

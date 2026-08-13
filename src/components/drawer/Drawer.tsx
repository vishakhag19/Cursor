import * as DialogPrimitive from '@radix-ui/react-dialog'
import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import { IconButton } from '../icon-button/IconButton'

export interface DrawerProps {
  trigger?: ReactNode
  title: string
  children?: ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function Drawer({ trigger, title, children, open, onOpenChange }: DrawerProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogPrimitive.Trigger asChild>{trigger}</DialogPrimitive.Trigger>}
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="ds-drawer-overlay" />
        <DialogPrimitive.Content className="ds-drawer-content">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <DialogPrimitive.Title style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600 }}>
              {title}
            </DialogPrimitive.Title>
            <DialogPrimitive.Close asChild>
              <IconButton label="Close">
                <X size={16} strokeWidth={1.75} />
              </IconButton>
            </DialogPrimitive.Close>
          </div>
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

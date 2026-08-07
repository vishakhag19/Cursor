import * as DialogPrimitive from '@radix-ui/react-dialog'
import type { ReactNode } from 'react'
import { Button } from '../button/Button'
import { X } from 'lucide-react'
import { IconButton } from '../icon-button/IconButton'

export interface DialogProps {
  trigger?: ReactNode
  title: string
  description?: string
  children?: ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function Dialog({
  trigger,
  title,
  description,
  children,
  open,
  onOpenChange,
}: DialogProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogPrimitive.Trigger asChild>{trigger}</DialogPrimitive.Trigger>}
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="ds-dialog-overlay" />
        <DialogPrimitive.Content className="ds-dialog-content">
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <DialogPrimitive.Title className="ds-dialog-title">{title}</DialogPrimitive.Title>
              {description && (
                <DialogPrimitive.Description className="ds-dialog-desc">
                  {description}
                </DialogPrimitive.Description>
              )}
            </div>
            <DialogPrimitive.Close asChild>
              <IconButton label="Close">
                <X size={16} strokeWidth={1.75} />
              </IconButton>
            </DialogPrimitive.Close>
          </div>
          {children}
          <div className="ds-dialog-actions">
            <DialogPrimitive.Close asChild>
              <Button variant="secondary">Cancel</Button>
            </DialogPrimitive.Close>
            <DialogPrimitive.Close asChild>
              <Button variant="primary">Confirm</Button>
            </DialogPrimitive.Close>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

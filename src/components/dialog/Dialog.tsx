import * as DialogPrimitive from '@radix-ui/react-dialog'
import type { ReactNode } from 'react'
import { Button } from '../button/Button'
import { IconButton } from '../icon-button/IconButton'
import { SemanticIcon } from '../semantic-icon/SemanticIcon'
import { useEditorStore } from '@/store/editor-store'

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
  const icons = useEditorStore((s) => s.doc.icons)

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
                <SemanticIcon
                  role="navigation.close"
                  map={icons.semanticMap}
                  strokeWidth={icons.strokeWidth}
                  size={16}
                />
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

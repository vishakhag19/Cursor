import * as ToastPrimitive from '@radix-ui/react-toast'
import { useState } from 'react'
import { Button } from '../button/Button'

export interface ToastProps {
  title?: string
  description?: string
  triggerLabel?: string
}

export function Toast({
  title = 'Changes saved',
  description = 'Your updates have been applied successfully.',
  triggerLabel = 'Show toast',
}: ToastProps) {
  const [open, setOpen] = useState(false)

  return (
    <ToastPrimitive.Provider swipeDirection="right">
      <ToastPrimitive.Root className="ds-toast" open={open} onOpenChange={setOpen}>
        <ToastPrimitive.Title style={{ fontWeight: 600, marginBottom: 4 }}>{title}</ToastPrimitive.Title>
        <ToastPrimitive.Description style={{ color: 'var(--muted)', fontSize: '0.8125rem' }}>
          {description}
        </ToastPrimitive.Description>
      </ToastPrimitive.Root>
      <ToastPrimitive.Viewport className="ds-toast-viewport" />
      <Button variant="secondary" onClick={() => setOpen(true)}>
        {triggerLabel}
      </Button>
    </ToastPrimitive.Provider>
  )
}

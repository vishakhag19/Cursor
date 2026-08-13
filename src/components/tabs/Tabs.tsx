import * as TabsPrimitive from '@radix-ui/react-tabs'
import type { ReactNode } from 'react'

export interface TabItem {
  value: string
  label: string
  content: ReactNode
}

export interface TabsProps {
  items: TabItem[]
  defaultValue?: string
  value?: string
  onValueChange?: (value: string) => void
}

export function Tabs({ items, defaultValue, value, onValueChange }: TabsProps) {
  return (
    <TabsPrimitive.Root
      className="ds-tabs"
      defaultValue={defaultValue ?? items[0]?.value}
      value={value}
      onValueChange={onValueChange}
    >
      <TabsPrimitive.List className="ds-tabs-list">
        {items.map((item) => (
          <TabsPrimitive.Trigger key={item.value} value={item.value} className="ds-tabs-trigger">
            {item.label}
          </TabsPrimitive.Trigger>
        ))}
      </TabsPrimitive.List>
      {items.map((item) => (
        <TabsPrimitive.Content key={item.value} value={item.value}>
          {item.content}
        </TabsPrimitive.Content>
      ))}
    </TabsPrimitive.Root>
  )
}

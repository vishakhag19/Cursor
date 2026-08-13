import * as AccordionPrimitive from '@radix-ui/react-accordion'
import { ChevronDown } from 'lucide-react'
import type { ReactNode } from 'react'

export interface AccordionItem {
  value: string
  title: string
  content: ReactNode
}

export interface AccordionSingleProps {
  items: AccordionItem[]
  type?: 'single'
  defaultValue?: string
  collapsible?: boolean
}

export interface AccordionMultipleProps {
  items: AccordionItem[]
  type: 'multiple'
  defaultValue?: string[]
}

export type AccordionProps = AccordionSingleProps | AccordionMultipleProps

export function Accordion(props: AccordionProps) {
  const { items } = props

  if (props.type === 'multiple') {
    return (
      <AccordionPrimitive.Root
        className="ds-accordion"
        type="multiple"
        defaultValue={props.defaultValue}
      >
        {items.map((item) => (
          <AccordionPrimitive.Item key={item.value} value={item.value} className="ds-accordion-item">
            <AccordionPrimitive.Header>
              <AccordionPrimitive.Trigger className="ds-accordion-trigger">
                {item.title}
                <ChevronDown size={16} strokeWidth={1.75} aria-hidden />
              </AccordionPrimitive.Trigger>
            </AccordionPrimitive.Header>
            <AccordionPrimitive.Content className="ds-accordion-content">
              {item.content}
            </AccordionPrimitive.Content>
          </AccordionPrimitive.Item>
        ))}
      </AccordionPrimitive.Root>
    )
  }

  const collapsible = props.collapsible ?? true

  return (
    <AccordionPrimitive.Root
      className="ds-accordion"
      type="single"
      defaultValue={props.defaultValue}
      collapsible={collapsible}
    >
      {items.map((item) => (
        <AccordionPrimitive.Item key={item.value} value={item.value} className="ds-accordion-item">
          <AccordionPrimitive.Header>
            <AccordionPrimitive.Trigger className="ds-accordion-trigger">
              {item.title}
              <ChevronDown size={16} strokeWidth={1.75} aria-hidden />
            </AccordionPrimitive.Trigger>
          </AccordionPrimitive.Header>
          <AccordionPrimitive.Content className="ds-accordion-content">
            {item.content}
          </AccordionPrimitive.Content>
        </AccordionPrimitive.Item>
      ))}
    </AccordionPrimitive.Root>
  )
}

import type { ReactNode } from 'react'

interface Props {
  children: ReactNode
  politeness?: 'polite' | 'assertive'
  className?: string
  /** Wrapper tag — defaults to <span>. */
  as?: 'span' | 'div'
}

export function LiveRegion({ children, politeness = 'polite', className, as: Tag = 'span' }: Props) {
  const role = politeness === 'assertive' ? 'alert' : 'status'
  return (
    <Tag role={role} aria-live={politeness} aria-atomic="true" className={className}>
      {children}
    </Tag>
  )
}

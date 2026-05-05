interface Props {
  width?: number | string
  height?: number | string
  className?: string
}

export function Skeleton({ width = '100%', height = 32, className }: Props) {
  return (
    <div
      aria-hidden="true"
      className={['bg-bg-2 inline-block', className].filter(Boolean).join(' ')}
      style={{ width, height }}
    />
  )
}

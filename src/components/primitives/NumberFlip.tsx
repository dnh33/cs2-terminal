import { useRef, useEffect, useState, useLayoutEffect } from 'react'
import type React from 'react'

interface Props {
  value: number | null | undefined
  prefix?: string
  suffix?: string
  decimals?: number
  /** Custom formatter overrides prefix/suffix/decimals (P0-3 audit fix for toLocaleString cases). */
  formatter?: (n: number) => string
  flashOnChange?: boolean
  /** Per-digit slide animation on value change. Default true. (P0-2: master § 4 #1 Bloomberg moment.) */
  slideDigits?: boolean
  className?: string
  /** Placeholder shown for nullish/NaN values. Default '—'. */
  placeholder?: string
}

const DIGIT_RE = /[0-9]/

/**
 * Single digit column that animates from `from` → `to` via translateY(-1em) over 80ms (Tick tier).
 */
function DigitColumn({ from, to }: { from: string; to: string }) {
  const [animated, setAnimated] = useState(false)
  useLayoutEffect(() => {
    // Double rAF: a single rAF sometimes fires before the browser has
    // painted the untransformed "from" state, so the transition collapses
    // and the digit snaps instead of sliding. Two frames guarantee a paint
    // happens between mount and the flip.
    let inner = 0
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setAnimated(true))
    })
    return () => {
      cancelAnimationFrame(outer)
      cancelAnimationFrame(inner)
    }
  }, [])
  return (
    <span
      className="inline-block overflow-hidden align-baseline"
      style={{ height: '1em', lineHeight: '1em', verticalAlign: 'baseline' }}
      aria-hidden="true"
    >
      <span
        className="block"
        style={{
          transform: animated ? 'translateY(-1em)' : 'translateY(0)',
          transition: 'transform 80ms linear',
          willChange: 'transform',
        }}
      >
        <span className="block" style={{ lineHeight: '1em' }}>{from}</span>
        <span className="block" style={{ lineHeight: '1em' }}>{to}</span>
      </span>
    </span>
  )
}

export function NumberFlip({
  value,
  prefix = '',
  suffix = '',
  decimals = 2,
  formatter,
  flashOnChange = true,
  slideDigits = true,
  className = '',
  placeholder = '—',
}: Props) {
  const [flash, setFlash] = useState<'up' | 'down' | null>(null)
  // Persisted prior formatted value used for the per-digit slide. Set in the same effect that triggers
  // the flash, cleared when slide completes. Stable across the flash-induced re-render (prevents the
  // bug where setting flash state would re-render with prevFormatted == current and erase the columns).
  const [slideFrom, setSlideFrom] = useState<string | null>(null)
  const prevValueRef = useRef<number | null | undefined>(value)
  const prevFormattedRef = useRef<string | null>(null)

  const isValid = value != null && Number.isFinite(value)

  const formatted = !isValid
    ? placeholder
    : formatter
    ? formatter(value as number)
    : `${prefix}${(value as number).toFixed(decimals)}${suffix}`

  useEffect(() => {
    if (!isValid) {
      prevValueRef.current = value
      prevFormattedRef.current = formatted
      return
    }
    const prev = prevValueRef.current
    const prevFmt = prevFormattedRef.current
    if (prev == null || !Number.isFinite(prev) || prevFmt == null) {
      prevValueRef.current = value
      prevFormattedRef.current = formatted
      return
    }
    if (prev === value) return
    if (flashOnChange) setFlash((value as number) > (prev as number) ? 'up' : 'down')
    if (slideDigits && prevFmt.length === formatted.length && prevFmt !== formatted) {
      setSlideFrom(prevFmt)
    }
    prevValueRef.current = value
    prevFormattedRef.current = formatted
  }, [value, flashOnChange, isValid, slideDigits, formatted])

  // P2-1 audit fix: scope the clear to our own flash keyframes. DigitColumn uses CSS *transition*,
  // not animation, so its events won't bubble here — but filter by name defensively.
  // Use a native listener (React 19 synthetic delegation for animationend has gaps in jsdom).
  //
  // Verified live (rapid ROI-calculator edits driving repeated value changes): under load,
  // animationend can be missed entirely — not just on same-element re-triggers, but seemingly
  // whenever enough re-renders land in one burst — leaving data-flash stuck permanently (tinted
  // background + arrow glyph never clears). This was the reported "borked/lagging" number
  // animation. The setTimeout backstop guarantees cleanup regardless of whether the browser
  // ever fires the event; re-keying the effect on `flash` gives every new flash its own timer.
  const wrapperRef = useRef<HTMLSpanElement | null>(null)
  useEffect(() => {
    if (!flash) return
    const el = wrapperRef.current
    const clear = () => {
      setFlash(null)
      setSlideFrom(null)
    }
    const onEnd = (e: Event) => {
      const name = (e as AnimationEvent).animationName
      if (!name || name === 'flash-up' || name === 'flash-down') clear()
    }
    el?.addEventListener('animationend', onEnd)
    const fallback = setTimeout(clear, 900)
    return () => {
      el?.removeEventListener('animationend', onEnd)
      clearTimeout(fallback)
    }
  }, [flash])

  const shouldSlide = slideDigits && slideFrom !== null && slideFrom.length === formatted.length && slideFrom !== formatted

  const children = shouldSlide
    ? [...formatted].map((ch, i) => {
        const prevCh = slideFrom![i]
        if (ch === prevCh || !DIGIT_RE.test(ch) || !DIGIT_RE.test(prevCh)) {
          return <span key={i}>{ch}</span>
        }
        return <DigitColumn key={`${i}-${prevCh}-${ch}`} from={prevCh} to={ch} />
      })
    : formatted

  return (
    <span
      ref={wrapperRef}
      className={`num-flip tabular-nums relative ${className}`}
      data-flash={flash ?? undefined}
      aria-label={!isValid ? undefined : formatted}
    >
      {children}
      {flash && (
        <span
          aria-hidden="true"
          className="absolute text-[8px] leading-none pointer-events-none"
          style={{
            top: '-2px',
            right: '-10px',
            color: flash === 'up' ? 'var(--delta-up)' : 'var(--delta-dn)',
          }}
        >
          {flash === 'up' ? '▲' : '▼'}
        </span>
      )}
    </span>
  )
}

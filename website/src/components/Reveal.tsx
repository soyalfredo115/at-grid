import { createElement, useEffect, useRef } from 'react'
import type { CSSProperties, ReactNode } from 'react'

/** Revela el contenido al entrar al viewport (una sola vez). `delay` en ms para escalonar. */
export function Reveal({
  children,
  delay = 0,
  as = 'div',
  className = '',
}: {
  children: ReactNode
  delay?: number
  as?: 'div' | 'li' | 'section' | 'span' | 'p'
  className?: string
}) {
  const ref = useRef<HTMLElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add('is-visible')
          io.disconnect()
        }
      },
      { threshold: 0.08 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return createElement(
    as,
    {
      ref,
      className: `reveal ${className}`,
      style: { '--reveal-delay': `${delay}ms` } as CSSProperties,
    },
    children,
  )
}

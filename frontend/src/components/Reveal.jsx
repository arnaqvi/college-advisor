import { useEffect } from 'react'

// Shared scroll/mount-reveal wrapper — extracted from Homepage.jsx so app
// pages can use the same fade+translate-in motion as the marketing site.
// Respects prefers-reduced-motion via the .landing-reveal rules in index.css.
export function Reveal({ children, className = '', delay = '0s', as: Tag = 'div', style, ...props }) {
  return (
    <Tag
      data-reveal
      className={`landing-reveal ${className}`.trim()}
      style={{ '--reveal-delay': delay, ...style }}
      {...props}
    >
      {children}
    </Tag>
  )
}

// Observes every `[data-reveal]` node currently in the DOM and adds `.visible`
// the first time it scrolls into view. Call once per page from a top-level
// effect (mirrors Homepage.jsx's own IntersectionObserver setup).
//
// ROBUSTNESS (2026-08-03): the old `threshold: 0.18` required 18% of the element
// to be in view before revealing. That is UNSATISFIABLE for an element taller
// than ~5.5x the viewport — e.g. the College List table once it grew to 200+
// rows (~13,000px): only ~7% of it is ever visible at once, so it never crossed
// 0.18 and stayed permanently at opacity:0 (invisible). Two fixes:
//   1. threshold: 0 — reveal as soon as ANY pixel enters (correct for
//      arbitrary-height content; the fade-in still plays).
//   2. A short safety-net timer reveals anything still hidden after mount, so
//      content can NEVER get stuck invisible (async loads, reduced-motion, an
//      element that starts fully below the fold and above the observer edge).
export function useRevealOnMount(deps = []) {
  useEffect(() => {
    const reveal = (el) => el.classList.add('visible')
    const elements = document.querySelectorAll('[data-reveal]')

    if (typeof IntersectionObserver === 'undefined') {
      elements.forEach(reveal) // no IO support — just show everything
      return undefined
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            reveal(entry.target)
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0, rootMargin: '0px 0px -64px 0px' }
    )

    elements.forEach((element) => observer.observe(element))

    // Safety net: nothing may stay invisible. Anything not revealed shortly
    // after mount (very tall element, async content, prefers-reduced-motion)
    // is shown unconditionally.
    const failsafe = setTimeout(() => {
      document.querySelectorAll('[data-reveal]:not(.visible)').forEach(reveal)
    }, 400)

    return () => {
      clearTimeout(failsafe)
      observer.disconnect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}

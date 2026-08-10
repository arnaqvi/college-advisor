import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

// This app uses the classic <BrowserRouter>/<Routes> API (not the data
// router), so react-router-dom's built-in <ScrollRestoration> isn't
// available — nothing else resets scroll on navigation. Without this,
// clicking a sidebar link while scrolled halfway down one page lands you
// mid-scroll on the next, which breaks the page-enter fade+lift Reveal.jsx
// already plays on every page root: it's supposed to read as "the new page
// arrives from the top," not land wherever the last page happened to be
// scrolled to. Instant, not smooth — the content's own 0.9s reveal is the
// motion here; animating the scroll too would fight it. `behavior: 'instant'`
// is explicit (not the 2-arg scrollTo(0,0) form) because index.css now sets
// `html { scroll-behavior: smooth }` for in-page anchor links — the 2-arg
// form defaults to `behavior: 'auto'`, which inherits that CSS and would
// make this animate too. The object form's explicit 'instant' overrides it.
export default function ScrollToTop() {
  const { pathname } = useLocation()

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }, [pathname])

  return null
}

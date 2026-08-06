import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

const navItems = [
  { label: 'Product', href: '#product' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'About', href: '/about' },
]

export default function Navbar() {
  const [isCompact, setIsCompact] = useState(false)

  useEffect(() => {
    const onScroll = () => setIsCompact(window.scrollY > 40)

    onScroll()
    window.addEventListener('scroll', onScroll)

    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={`sticky top-0 z-50 transition-all duration-300 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] ${
        isCompact
          ? 'border-b border-[#E4E4DE] bg-[rgba(246,247,243,0.82)] shadow-[0_12px_28px_rgba(16,18,16,0.06)] backdrop-blur-[14px]'
          : 'border-b border-transparent bg-transparent'
      }`}
    >
      <div
        className={`mx-auto flex max-w-[1180px] items-center justify-between px-5 md:px-8 transition-all duration-300 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] ${
          isCompact ? 'py-[14px]' : 'py-[22px]'
        }`}
      >
        <Link to="/" className="flex items-center gap-3 text-[#101210]">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-[9px] bg-[#0E0F0C] text-[11px] font-bold text-[#7CF5C4]">
            CP
          </span>
          <span className="font-display text-[18px] font-extrabold tracking-tight">CollegePath</span>
        </Link>

        <nav className="hidden items-center gap-10 text-[14.5px] font-medium text-[#5B5E58] md:flex">
          {navItems.map((item) => (
            item.href.startsWith('/') ? (
              <Link key={item.label} to={item.href} className="transition-colors duration-300 hover:text-[#101210]">
                {item.label}
              </Link>
            ) : (
              <a key={item.label} href={item.href} className="transition-colors duration-300 hover:text-[#101210]">
                {item.label}
              </a>
            )
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <Link
            to="/login"
            className="text-sm font-medium text-[#5B5E58] transition-colors duration-300 hover:text-[#101210]"
          >
            Log in
          </Link>
          <Link
            to="/login"
            className="landing-button-dark inline-flex items-center justify-center rounded-full bg-[#0E0F0C] px-5 py-2.5 text-sm font-semibold text-white"
          >
            Get Started
          </Link>
        </div>
      </div>
    </header>
  )
}

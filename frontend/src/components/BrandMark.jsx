// The CollegePath pin-and-dot mark, recolored to the app's real theme
// (mint/ink, see src/index.css) — replaces the old plain "CP" text badge
// used in Navbar.jsx/Layout.jsx. Colors are hardcoded (not theme tokens) on
// purpose: this is a fixed brand mark, not adaptive UI chrome, so it stays
// the same dark-badge-plus-mint-pin in both light and dark mode, same as
// most apps keep their logo mark constant across themes.
export default function BrandMark({ size = 28, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={className}
      role="img"
      aria-label="CollegePath"
    >
      <rect width="64" height="64" rx="16" fill="#0E0F0C" />
      <path
        d="M32 12c-8.8 0-16 6.9-16 15.4 0 11.6 16 24.6 16 24.6s16-13 16-24.6C48 18.9 40.8 12 32 12z"
        fill="none"
        stroke="#7CF5C4"
        strokeWidth="4"
        strokeLinejoin="round"
      />
      <circle cx="32" cy="27.6" r="5.6" fill="#7CF5C4" />
    </svg>
  )
}

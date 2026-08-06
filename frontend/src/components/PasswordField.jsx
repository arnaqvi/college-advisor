import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

// Password input with a show/hide eye-icon toggle, styled to match TextField.
export default function PasswordField({ label, error, wrapperClassName, ...inputProps }) {
  const [visible, setVisible] = useState(false)

  return (
    <label className={wrapperClassName}>
      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-text-secondary">{label}</span>
      <div className="relative mt-2">
        <input
          {...inputProps}
          type={visible ? 'text' : 'password'}
          className="w-full rounded-[12px] border border-border bg-surface px-4 py-3 pr-11 text-sm text-text-primary placeholder-text-secondary/50 transition-colors duration-200 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/30"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute inset-y-0 right-0 flex items-center px-3.5 text-text-secondary hover:text-text-primary transition-colors duration-200"
          aria-label={visible ? 'Hide password' : 'Show password'}
        >
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
      {error && <span className="mt-2 block text-xs text-red-600 font-medium">{error}</span>}
    </label>
  )
}

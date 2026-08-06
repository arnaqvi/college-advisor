import { useEffect, useRef, useState } from 'react'
import { ChevronDown, X } from 'lucide-react'

// Checkbox-style multi-select dropdown matching the input styling established
// in TextField.jsx (rounded-md border-border bg-surface text-sm). Selection
// order is preserved in `value` as options are toggled, so callers that treat
// the list as ranked (e.g. Profile.jsx's Intended Majors field) keep working.
export default function MultiSelect({ label, options, value, onChange, placeholder = 'Select...' }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)
  const selected = Array.isArray(value) ? value : []

  useEffect(() => {
    if (!open) return
    function handleClickOutside(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  function toggle(optValue) {
    if (selected.includes(optValue)) {
      onChange(selected.filter((v) => v !== optValue))
    } else {
      onChange([...selected, optValue])
    }
  }

  function remove(optValue, e) {
    e.stopPropagation()
    onChange(selected.filter((v) => v !== optValue))
  }

  function labelFor(optValue) {
    const opt = options.find((o) => (typeof o === 'string' ? o : o.value) === optValue)
    if (!opt) return optValue
    return typeof opt === 'string' ? opt : opt.label
  }

  return (
    <label className="relative block" ref={rootRef}>
      <span className="text-xs font-medium text-text-secondary">{label}</span>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="mt-1 flex min-h-[2.375rem] w-full flex-wrap items-center gap-1.5 rounded-md border border-border bg-surface-raised px-3 py-1.5 text-left text-sm text-text-primary"
      >
        {selected.length === 0 ? (
          <span className="text-text-secondary">{placeholder}</span>
        ) : (
          selected.map((v) => (
            <span
              key={v}
              className="flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-xs font-medium text-accent-contrast"
            >
              {labelFor(v)}
              <X size={12} className="cursor-pointer" onClick={(e) => remove(v, e)} />
            </span>
          ))
        )}
        <ChevronDown size={14} className="ml-auto shrink-0 text-text-secondary" />
      </button>

      {open && (
        <div className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-border bg-surface-raised py-1 shadow-lg">
          {options.map((opt) => {
            const optValue = typeof opt === 'string' ? opt : opt.value
            const optLabel = typeof opt === 'string' ? opt : opt.label
            const checked = selected.includes(optValue)
            return (
              <label
                key={optValue}
                className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-text-primary hover:bg-accent/10"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(optValue)}
                  className="h-3.5 w-3.5 rounded border-border accent-accent-contrast"
                />
                {optLabel}
              </label>
            )
          })}
        </div>
      )}
    </label>
  )
}

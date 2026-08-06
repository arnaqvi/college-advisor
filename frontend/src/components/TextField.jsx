// Labeled text input/textarea matching the input styling already established
// in src/pages/Profile.jsx (rounded-md border-border, text-sm).
export default function TextField({ label, error, wrapperClassName, multiline, rows = 4, ...inputProps }) {
  return (
    <label className={wrapperClassName}>
      <span className="text-xs font-medium text-text-secondary">{label}</span>
      {multiline ? (
        <textarea
          {...inputProps}
          rows={rows}
          className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary"
        />
      ) : (
        <input
          {...inputProps}
          className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary"
        />
      )}
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  )
}

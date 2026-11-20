/** Labeled field pair - labels name their input, errors name the problem. */
export default function Field({ label, id, error, hint, children }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-[13px] font-semibold text-ink">
        {label}
      </label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-ink-soft">{hint}</p>}
      {error && <p className="mt-1 text-xs font-medium text-pin-red-text">{error}</p>}
    </div>
  )
}

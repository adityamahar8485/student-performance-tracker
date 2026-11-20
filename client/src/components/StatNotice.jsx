import Notice from './Notice.jsx'

/** Big-figure stat notice. label in tracked caps; value always tabular. */
export default function StatNotice({ pin, tilt, settleKey, label, value, unit, sub, danger, children }) {
  return (
    <Notice pin={pin} tilt={tilt} settleKey={settleKey}>
      <div className="cap mb-3">{label}</div>
      <div className={`num text-[42px] leading-none font-bold tracking-tight ${danger ? 'text-pin-red-text' : 'text-ink'}`}>
        {value}
        {unit && <span className="text-[22px] font-semibold">{unit}</span>}
      </div>
      {sub && <p className="num mt-2 text-[13px] text-ink-soft">{sub}</p>}
      {children}
    </Notice>
  )
}

export default function ProgressBar({ done, total, label }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 11, color: 'var(--text-2)' }}>{label || 'Processing…'}</span>
        <span className="num" style={{ fontSize: 11, color: 'var(--gold)', fontWeight: 500 }}>{done}/{total}</span>
      </div>
      <div style={{ height: 2, background: 'var(--gold-line)', borderRadius: 1, overflow: 'hidden' }}>
        <div style={{
          height: '100%',
          width: `${pct}%`,
          background: 'var(--gold)',
          borderRadius: 1,
          transition: 'width 0.3s ease',
          boxShadow: '0 0 6px rgba(201,168,76,0.4)',
        }} />
      </div>
      <div style={{ textAlign: 'right', fontSize: 9, color: 'var(--text-3)', marginTop: 3, letterSpacing: '0.06em' }}>
        {pct}%
      </div>
    </div>
  )
}

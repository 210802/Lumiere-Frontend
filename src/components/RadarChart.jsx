// Pure SVG spider/radar chart — no external libraries.
// scores: Record<string, number> where values are 0-100.

export function RadarChart({ scores, size = 140 }) {
  const keys = Object.keys(scores)
  const vals = Object.values(scores)
  const n    = keys.length
  const cx   = size / 2
  const cy   = size / 2
  const r    = size / 2 - 14

  const angle = (i) => (2 * Math.PI * i / n) - Math.PI / 2
  const pt    = (i, scale) => ({
    x: cx + r * scale * Math.cos(angle(i)),
    y: cy + r * scale * Math.sin(angle(i)),
  })

  const rings   = [0.25, 0.5, 0.75, 1.0]
  const polyPts = vals.map((v, i) => pt(i, v / 100))

  const toPoints = (pts) => pts.map(p => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ')

  return (
    <svg width={size} height={size} style={{ overflow: 'visible' }}>
      {/* Background rings */}
      {rings.map((ring, ri) => (
        <polygon
          key={ri}
          points={toPoints(keys.map((_, i) => pt(i, ring)))}
          fill="none"
          stroke={ri === 3 ? 'rgba(201,168,76,0.20)' : 'rgba(201,168,76,0.07)'}
          strokeWidth="0.5"
        />
      ))}

      {/* Axis spokes */}
      {keys.map((_, i) => {
        const outer = pt(i, 1)
        return (
          <line
            key={i}
            x1={cx} y1={cy}
            x2={outer.x.toFixed(2)} y2={outer.y.toFixed(2)}
            stroke="rgba(201,168,76,0.10)"
            strokeWidth="0.5"
          />
        )
      })}

      {/* Score polygon fill */}
      <polygon
        points={toPoints(polyPts)}
        fill="rgba(201,168,76,0.12)"
        stroke="#C9A84C"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />

      {/* Score dots */}
      {polyPts.map((p, i) => (
        <circle key={i} cx={p.x.toFixed(2)} cy={p.y.toFixed(2)} r="2.5" fill="#C9A84C" />
      ))}

      {/* Axis labels */}
      {keys.map((k, i) => {
        const lp = pt(i, 1.30)
        return (
          <text
            key={i}
            x={lp.x.toFixed(2)}
            y={lp.y.toFixed(2)}
            textAnchor="middle"
            dominantBaseline="middle"
            style={{
              fontSize: 6.5,
              fill: 'rgba(240,235,224,0.45)',
              fontFamily: 'Inter, sans-serif',
              userSelect: 'none',
            }}
          >
            {k.slice(0, 4)}
          </text>
        )
      })}
    </svg>
  )
}

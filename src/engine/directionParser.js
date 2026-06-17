// Natural-language direction parser — no API calls, < 5 ms, works offline.
// Converts free-text like "warmer, more film, lift shadows slightly" into
// concrete parameter deltas that are merged on top of the trained style.

// ── Rule table ─────────────────────────────────────────────────────────────
// Each rule has patterns (RegExps), an apply fn (mutates delta, scaled by strength),
// and a human-readable description shown in the "DETECTED CHANGES" card.

const RULES = [
  // EXPOSURE
  {
    patterns: [/more\s+expos/i, /brighter/i, /lift\s+exposure/i, /increase\s+exposure/i, /too\s+dark/i, /underexposed/i],
    apply: (d, s) => { d.exposure = (d.exposure ?? 0) + 0.4 * s },
    description: 'Exposure lifted',
  },
  {
    patterns: [/less\s+expos/i, /darker/i, /reduce\s+exposure/i, /too\s+bright/i, /overexposed/i, /pull\s+down/i],
    apply: (d, s) => { d.exposure = (d.exposure ?? 0) - 0.4 * s },
    description: 'Exposure reduced',
  },
  // CLARITY / SHARPNESS
  {
    patterns: [/more\s+clar/i, /clearer/i, /sharper/i, /more\s+detail/i, /crisp/i, /\bsharp\b/i],
    apply: (d, s) => { d.clarity = (d.clarity ?? 0) + 15 * s; d.sharpness = (d.sharpness ?? 0) + 10 * s },
    description: 'Clarity & sharpness increased',
  },
  {
    patterns: [/softer/i, /less\s+sharp/i, /dreamy/i, /\bsmooth\b/i, /skin\s+soft/i, /\bsoft\b/i],
    apply: (d, s) => { d.clarity = (d.clarity ?? 0) - 10 * s },
    description: 'Clarity softened',
  },
  // WARMTH / TEMPERATURE
  {
    patterns: [/warmer/i, /more\s+warm/i, /golden/i, /amber/i, /\bcozy/i, /sunset/i, /warm\s+up/i],
    apply: (d, s) => { d.temperature = (d.temperature ?? 0) + 300 * s },
    description: 'Temperature pushed warmer',
  },
  {
    patterns: [/cooler/i, /more\s+cool/i, /\bblue\b/i, /\bcold\b/i, /cinematic\s+cool/i, /cool\s+down/i],
    apply: (d, s) => { d.temperature = (d.temperature ?? 0) - 300 * s },
    description: 'Temperature cooled',
  },
  // CONTRAST
  {
    patterns: [/more\s+contrast/i, /punchier/i, /\bbold\b/i, /dramatic/i, /moodier/i, /punchy/i],
    apply: (d, s) => { d.contrast = (d.contrast ?? 0) + 20 * s; d.blacks = (d.blacks ?? 0) - 10 * s },
    description: 'Contrast increased',
  },
  {
    patterns: [/less\s+contrast/i, /flatter/i, /\bmuted\b/i, /\bpastel\b/i, /\bairy\b/i, /\bfade\b/i, /\bfaded\b/i, /low.?contrast/i],
    apply: (d, s) => { d.contrast = (d.contrast ?? 0) - 15 * s; d.blacks = (d.blacks ?? 0) + 15 * s },
    description: 'Contrast reduced, look lifted',
  },
  // FILM / ANALOG
  {
    patterns: [/more\s+film/i, /film\s+look/i, /cinematic/i, /\banalog/i, /\bgrain/i, /\bfilmy\b/i, /film\s+grain/i],
    apply: (d, s) => {
      d.filmGrain  = (d.filmGrain  ?? 0) + 20 * s
      d.saturation = (d.saturation ?? 0) - 8  * s
      d.contrast   = (d.contrast   ?? 0) + 10 * s
      d.blacks     = (d.blacks     ?? 0) + 5  * s
    },
    description: 'Film grain & analog look added',
  },
  // HAZE
  {
    patterns: [/less\s+haze/i, /dehaze/i, /remove\s+haze/i, /cleaner/i, /no\s+haze/i],
    apply: (d, s) => { d.dehaze = (d.dehaze ?? 0) + 20 * s },
    description: 'Haze reduced',
  },
  {
    patterns: [/more\s+haze/i, /\bmisty\b/i, /\bfoggy\b/i, /\bethereal\b/i, /add\s+haze/i],
    apply: (d, s) => { d.dehaze = (d.dehaze ?? 0) - 15 * s },
    description: 'Haze added for mood',
  },
  // SHADOWS
  {
    patterns: [/lift\s+shadows?/i, /open\s+shadows?/i, /detail\s+in\s+(the\s+)?dark/i, /recover\s+shadows?/i, /more\s+shadows?\s+detail/i],
    apply: (d, s) => { d.shadows = (d.shadows ?? 0) + 25 * s },
    description: 'Shadows lifted',
  },
  {
    patterns: [/deep(er)?\s+shadows?/i, /crush\s+shadows?/i, /more\s+black/i, /darker\s+shadows?/i, /richer\s+black/i],
    apply: (d, s) => { d.shadows = (d.shadows ?? 0) - 15 * s; d.blacks = (d.blacks ?? 0) - 15 * s },
    description: 'Shadows deepened',
  },
  // HIGHLIGHTS
  {
    patterns: [/recover\s+highlights?/i, /less\s+blown/i, /protect\s+highlights?/i, /pull\s+highlights?/i],
    apply: (d, s) => { d.highlights = (d.highlights ?? 0) - 20 * s },
    description: 'Highlights recovered',
  },
  {
    patterns: [/lift\s+highlights?/i, /brighter\s+highlights?/i, /more\s+highlights?/i],
    apply: (d, s) => { d.highlights = (d.highlights ?? 0) + 15 * s },
    description: 'Highlights boosted',
  },
  // SKIN / FACES
  {
    patterns: [/lift\s+face/i, /skin\s+tone/i, /protect\s+skin/i, /warmer\s+skin/i, /better\s+skin/i, /face\s+bright/i],
    apply: (d, s) => { d.orangeSat = (d.orangeSat ?? 0) + 15 * s; d.exposure = (d.exposure ?? 0) + 0.15 * s },
    description: 'Skin tones enhanced',
  },
  // SATURATION / COLOUR
  {
    patterns: [/more\s+colou?r/i, /more\s+vivid/i, /\bpop\b/i, /\bvibrant\b/i, /saturate/i, /colou?rful/i],
    apply: (d, s) => { d.saturation = (d.saturation ?? 0) + 20 * s; d.vibrance = (d.vibrance ?? 0) + 15 * s },
    description: 'Colors boosted',
  },
  {
    patterns: [/less\s+colou?r/i, /desaturate/i, /mute\s+reds?/i, /less\s+saturation/i, /dull\s+colou?r/i],
    apply: (d, s) => { d.saturation = (d.saturation ?? 0) - 20 * s },
    description: 'Colors muted',
  },
  // VIGNETTE
  {
    patterns: [/vignette/i, /darker\s+edges?/i, /focus\s+center/i, /darken\s+edges?/i],
    apply: (d, s) => { d.vignette = (d.vignette ?? 0) + 30 * s },
    description: 'Vignette added',
  },
]

// ── Strength modifiers ────────────────────────────────────────────────────

function extractStrength(text, matchIndex) {
  const before = text.slice(Math.max(0, matchIndex - 25), matchIndex).toLowerCase()
  if (/extremely|dramatically/.test(before)) return 2.0
  if (/very\s+much|a\s+lot|much\s+more|signific|heavi/.test(before)) return 1.5
  if (/slightly|a\s+bit|just\s+a|little|subtle/.test(before)) return 0.5
  return 1.0
}

// ── Public API ────────────────────────────────────────────────────────────

/**
 * Parse free-text into a DirectionDelta object.
 * Runs synchronously, < 5 ms, no API calls.
 *
 * @param {string} text  - e.g. "warmer, more film, lift shadows slightly"
 * @returns {{ humanReadable: string[], exposure?: number, ... }}
 */
export function parseDirection(text) {
  const delta = { humanReadable: [] }
  if (!text?.trim()) return delta

  for (const rule of RULES) {
    for (const pattern of rule.patterns) {
      const match = pattern.exec(text)
      if (match) {
        const s = extractStrength(text, match.index)
        rule.apply(delta, s)
        if (!delta.humanReadable.includes(rule.description)) {
          delta.humanReadable.push(rule.description)
        }
        break // one match per rule is enough
      }
    }
  }

  return delta
}

/**
 * Merge a base trained profile with a direction delta.
 * Returns a new profile object — does not mutate either input.
 */
export function mergeProfileWithDelta(baseProfile, delta) {
  if (!delta || delta.humanReadable?.length === 0) return baseProfile
  return {
    ...baseProfile,
    exposure:    clamp((baseProfile.exposure    ?? 0) + (delta.exposure    ?? 0), -3,    3),
    shadows:     clamp((baseProfile.shadows     ?? 0) + (delta.shadows     ?? 0), -100, 100),
    highlights:  clamp((baseProfile.highlights  ?? 0) + (delta.highlights  ?? 0), -100, 100),
    blacks:      clamp((baseProfile.blacks      ?? 0) + (delta.blacks      ?? 0), -100, 100),
    contrast:    clamp((baseProfile.contrast    ?? 0) + (delta.contrast    ?? 0), -100, 100),
    clarity:     clamp((baseProfile.clarity     ?? 0) + (delta.clarity     ?? 0), -100, 100),
    saturation:  clamp((baseProfile.saturation  ?? 0) + (delta.saturation  ?? 0), -100, 100),
    vibrance:    clamp((baseProfile.vibrance    ?? 0) + (delta.vibrance    ?? 0), -100, 100),
    temperature: clamp((baseProfile.temperature ?? 0) + (delta.temperature ?? 0), -2000, 2000),
    dehaze:      clamp((baseProfile.dehaze      ?? 0) + (delta.dehaze      ?? 0), -100, 100),
    filmGrain:   (delta.filmGrain  != null) ? delta.filmGrain  : (baseProfile.filmGrain  ?? 0),
    vignette:    (delta.vignette   != null) ? delta.vignette   : (baseProfile.vignette   ?? 0),
    hsl: {
      ...baseProfile.hsl,
      orange: {
        ...baseProfile.hsl?.orange,
        sat: clamp((baseProfile.hsl?.orange?.sat ?? 0) + (delta.orangeSat ?? 0), -100, 100),
        lum: baseProfile.hsl?.orange?.lum ?? 0,
      },
      blue: {
        ...baseProfile.hsl?.blue,
        sat: clamp((baseProfile.hsl?.blue?.sat ?? 0) + (delta.blueSat ?? 0), -100, 100),
      },
    },
  }
}

function clamp(v, mn, mx) { return Math.max(mn, Math.min(mx, v)) }

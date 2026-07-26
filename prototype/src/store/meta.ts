// Roguelite metaprogression — the only things that outlive a run.
// The world does not reset with Odysseus: the gods keep leaving, and it remembers.

const KEY = 'bgon_meta_v1'

export interface MetaSave {
  dcs: number                       // divine correspondence — never recovers fully
  flags: Record<string, boolean>    // world knowledge carried between runs
  runs: number
  deaths: number
  victories: number
  bestNostos: number
  seenLocations: string[]
}

const DEFAULT: MetaSave = {
  dcs: 85,
  flags: {},
  runs: 0,
  deaths: 0,
  victories: 0,
  bestNostos: 0,
  seenLocations: [],
}

// Flags that describe the world rather than one voyage — these persist.
const WORLD_FLAGS = new Set([
  'knows_curse_details',
  'knows_prophet_cave',
  'poseidon_cursed',
  'lied_about_temple',
])

export function loadMeta(): MetaSave {
  if (typeof localStorage === 'undefined') return { ...DEFAULT }
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...DEFAULT }
    const parsed = JSON.parse(raw) as Partial<MetaSave>
    return {
      ...DEFAULT,
      ...parsed,
      flags: parsed.flags ?? {},
      seenLocations: parsed.seenLocations ?? [],
    }
  } catch {
    return { ...DEFAULT }
  }
}

export function saveMeta(m: MetaSave): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(KEY, JSON.stringify(m))
  } catch {
    // storage full or blocked — metaprogression is a bonus, never a hard dependency
  }
}

/** Keep only the flags that describe the world, drop the per-run ones. */
export function worldFlagsOnly(flags: Record<string, boolean>): Record<string, boolean> {
  const out: Record<string, boolean> = {}
  for (const [k, v] of Object.entries(flags)) if (v && WORLD_FLAGS.has(k)) out[k] = true
  return out
}

export function resetMeta(): void {
  if (typeof localStorage === 'undefined') return
  try { localStorage.removeItem(KEY) } catch { /* ignore */ }
}

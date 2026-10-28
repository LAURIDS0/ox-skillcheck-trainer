// Pure logic, no imports, so `node --test` can run it directly.

export type Mode = 'endless' | 'fixed';
export type Preset = 'easy' | 'medium' | 'hard' | 'custom';

export interface Settings {
  preset: Preset;
  areaSize: number;
  speedMultiplier: number;
  keys: string[];
  mode: Mode;
  count: number;
}

export interface Entry {
  name: string;
  mode: Mode;
  areaSize: number;
  speedMultiplier: number;
  keys: string[];
  count: number | null; // only for fixed mode
  score: number; // successful checks
  total: number; // checks attempted
  avgMs: number; // average reaction time of successful checks, 0 if none
  date: string; // ISO
}

// Same values as ox_lib (web/src/features/skillcheck)
export const PRESETS: Record<Exclude<Preset, 'custom'>, { areaSize: number; speedMultiplier: number }> = {
  easy: { areaSize: 50, speedMultiplier: 1 },
  medium: { areaSize: 40, speedMultiplier: 1.5 },
  hard: { areaSize: 25, speedMultiplier: 1.75 },
};

export const DEFAULT_SETTINGS: Settings = {
  preset: 'easy',
  ...PRESETS.easy,
  keys: ['e'],
  mode: 'endless',
  count: 10,
};

export const KEY_RE = /^[a-z0-9]$/;

export function presetOf(areaSize: number, speedMultiplier: number): Preset {
  for (const [name, p] of Object.entries(PRESETS))
    if (p.areaSize === areaSize && p.speedMultiplier === speedMultiplier) return name as Preset;
  return 'custom';
}

export function configKey(e: Pick<Entry, 'mode' | 'areaSize' | 'speedMultiplier' | 'keys' | 'count'>): string {
  return [e.mode, e.areaSize, e.speedMultiplier, e.mode === 'fixed' ? e.count : '', [...e.keys].sort().join('')].join('|');
}

// <0 when a ranks above b: more hits first, then faster average (0 = no hits, ranks last)
const compare = (a: Entry, b: Entry) => b.score - a.score || (a.avgMs || Infinity) - (b.avgMs || Infinity);

export const isBetter = (a: Entry, b: Entry | undefined) => !b || compare(a, b) < 0;

export function sortEntries(entries: Entry[]): Entry[] {
  return [...entries].sort(compare);
}

const num = (v: unknown, min: number, max: number) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;

// Trust boundary: the shared scoreboard.json and saved bests in localStorage. Invalid entries are dropped.
export function parseEntries(data: unknown): Entry[] {
  const list = Array.isArray(data) ? data : (data as { entries?: unknown })?.entries;
  if (!Array.isArray(list)) return [];
  const out: Entry[] = [];
  for (const e of list) {
    if (!e || typeof e !== 'object') continue;
    const { name, mode, areaSize, speedMultiplier, keys, count, score, total, avgMs, date } = e as Record<string, unknown>;
    if (typeof name !== 'string' || !name.trim()) continue;
    if (mode !== 'endless' && mode !== 'fixed') continue;
    if (!num(areaSize, 1, 360) || !num(speedMultiplier, 0.01, 100)) continue;
    if (!Array.isArray(keys) || !keys.every((k) => typeof k === 'string' && KEY_RE.test(k))) continue;
    if (mode === 'fixed' && !num(count, 1, 10000)) continue;
    if (!num(score, 0, 1e6) || !num(total, 0, 1e6) || (score as number) > (total as number)) continue;
    if (!num(avgMs, 0, 1e6)) continue;
    if (typeof date !== 'string' || Number.isNaN(Date.parse(date))) continue;
    out.push({
      name: name.trim().slice(0, 24),
      mode,
      areaSize: areaSize as number,
      speedMultiplier: speedMultiplier as number,
      keys: keys as string[],
      count: mode === 'fixed' ? (count as number) : null,
      score: score as number,
      total: total as number,
      avgMs: avgMs as number,
      date,
    });
  }
  return out;
}

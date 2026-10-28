import { useEffect, useRef, useState } from 'react';

// Port of ox_lib's skillcheck (web/src/features/skillcheck, LGPL-3.0): same geometry, timing and key rules.
const C = 2 * 50 * Math.PI;
const BASE_DURATION_MS = 2000;

const randomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min)) + min;

// ox_lib maps non-latin layouts back to the physical key
function normalizeKey(e: KeyboardEvent) {
  let k = e.key.toLowerCase();
  if (e.key.charCodeAt(0) >= 880) {
    if (/^Key[A-Z]$/.test(e.code)) k = e.code.charAt(3).toLowerCase();
    if (/^Digit\d$/.test(e.code)) k = e.code.charAt(5);
  }
  return k;
}

interface Props {
  areaSize: number;
  speedMultiplier: number;
  keys: string[];
  onComplete: (success: boolean, ms: number) => void;
}

// Mount with a new `key` for every check.
export default function SkillCheck({ areaSize, speedMultiplier, keys, onComplete }: Props) {
  const [zone] = useState(() => -90 + randomInt(120, 360 - areaSize));
  const [key] = useState(() => (keys.length ? keys[randomInt(0, keys.length)] : 'e'));
  const [angle, setAngle] = useState(-90);
  const done = useRef(onComplete);
  done.current = onComplete;

  useEffect(() => {
    const duration = BASE_DURATION_MS / Math.max(speedMultiplier, 0.0001);
    let start: number | null = null;
    let raf = 0;
    let finished = false;

    const finish = (ok: boolean, ms: number) => {
      finished = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKey);
      done.current(ok, ms);
    };

    const tick = (t: number) => {
      if (finished) return;
      start ??= t;
      const p = Math.min((t - start) / duration, 1);
      setAngle(-90 + p * 360);
      if (p >= 1) finish(false, t - start);
      else raf = requestAnimationFrame(tick);
    };

    const onKey = (e: KeyboardEvent) => {
      if (finished || start === null || e.repeat || e.key === 'Escape' || e.key === ' ') return;
      const k = normalizeKey(e);
      if (keys.length && !keys.includes(k)) return;
      const ms = performance.now() - start;
      const a = -90 + Math.min(ms / duration, 1) * 360;
      finish(k === key && a >= zone && a <= zone + areaSize, ms);
    };

    window.addEventListener('keydown', onKey);
    raf = requestAnimationFrame(tick);
    return () => {
      finished = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKey);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="sc">
      <svg viewBox="190 190 120 120" width={120} height={120}>
        <circle className="sc-track" cx={250} cy={250} r={50} strokeDasharray={C} />
        <circle
          className="sc-area"
          cx={250}
          cy={250}
          r={50}
          strokeDasharray={C}
          strokeDashoffset={C - (Math.PI * 50 * areaSize) / 180}
          transform={`rotate(${zone}, 250, 250)`}
        />
        <circle
          className="sc-indicator"
          cx={250}
          cy={250}
          r={50}
          strokeDasharray={C}
          strokeDashoffset={C - 3}
          transform={`rotate(${angle}, 250, 250)`}
        />
      </svg>
      <div className="sc-key">{key.toUpperCase()}</div>
    </div>
  );
}

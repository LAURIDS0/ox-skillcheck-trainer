import { useEffect, useMemo, useRef, useState } from 'react';
import { NumberInput, Slider, Text, TextInput } from '@mantine/core';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCheck, faCode, faDownload, faEarthEurope, faFilter, faFire, faGauge, faInfinity, faKeyboard, faLanguage,
  faListOl, faPlay, faRepeat, faSliders, faStopwatch, faTrash, faTrophy, faUpload,
} from '@fortawesome/free-solid-svg-icons';
import SkillCheck from './SkillCheck';
import { Dialog, Menu, Option, TextUI } from './ox';
import { dicts, type Dict, type Lang } from './i18n';
import {
  configKey, DEFAULT_SETTINGS, KEY_RE, mergeEntries, parseEntries, presetOf, PRESETS, sortEntries,
  type Entry, type Settings,
} from './scores';

function load<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
}
function store(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode / blocked storage: scores just won't persist */
  }
}

interface Run { round: number; successes: number; times: number[] }
type Result = Omit<Entry, 'name' | 'date'>;
type DialogKind = 'custom' | 'keys' | 'count' | 'clear' | null;

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const fmtMs = (ms: number) => (ms ? `${Math.round(ms)} ms` : '—');
const keysLabel = (keys: string[]) => (keys.join(' ') || 'e').toUpperCase();
const RANK_COLORS = ['#fcc419', '#ced4da', '#e8590c'];

function difficultyLabel(areaSize: number, speedMultiplier: number, t: Dict) {
  const p = presetOf(areaSize, speedMultiplier);
  return p === 'custom' ? `${areaSize}° · ×${speedMultiplier}` : t[p];
}

function setupLabel(e: Pick<Entry, 'areaSize' | 'speedMultiplier' | 'keys' | 'mode' | 'count'>, t: Dict) {
  return `${difficultyLabel(e.areaSize, e.speedMultiplier, t)} · ${keysLabel(e.keys)} · ${e.mode === 'fixed' ? e.count : '∞'}`;
}

function luaSnippet(s: Settings) {
  const diff = s.preset === 'custom' ? `{ areaSize = ${s.areaSize}, speedMultiplier = ${s.speedMultiplier} }` : `'${s.preset}'`;
  const arr = s.mode === 'fixed' && s.count <= 8 ? `{ ${Array(s.count).fill(diff).join(', ')} }` : diff;
  return `lib.skillCheck(${arr}${s.keys.length ? `, { ${s.keys.map((k) => `'${k}'`).join(', ')} }` : ''})`;
}

export default function App() {
  const [lang, setLang] = useState<Lang>(() => load('oxsc.lang', navigator.language.startsWith('da') ? 'da' : 'en'));
  const t = dicts[lang] ?? dicts.en;
  const [s, setS] = useState<Settings>(() => ({ ...DEFAULT_SETTINGS, ...load('oxsc.settings', {}) }));
  const [scores, setScores] = useState<Entry[]>(() => parseEntries(load('oxsc.scores', [])));
  const [name, setName] = useState<string>(() => load('oxsc.name', ''));
  const [run, setRun] = useState<Run | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [view, setView] = useState<'main' | 'difficulty' | 'mode'>('main');
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [draft, setDraft] = useState({ areaSize: 0, speedMultiplier: 0, keys: '', count: 0 });
  const [copied, setCopied] = useState(false);

  useEffect(() => store('oxsc.lang', lang), [lang]);
  useEffect(() => store('oxsc.settings', s), [s]);
  useEffect(() => store('oxsc.scores', scores), [scores]);
  useEffect(() => store('oxsc.name', name), [name]);

  const update = (patch: Partial<Settings>) =>
    setS((prev) => {
      const next = { ...prev, ...patch };
      return { ...next, preset: presetOf(next.areaSize, next.speedMultiplier) };
    });

  const openDialog = (kind: DialogKind) => {
    setDraft({ areaSize: s.areaSize, speedMultiplier: s.speedMultiplier, keys: s.keys.join(', '), count: s.count });
    setDialog(kind);
  };

  const confirmDialog = () => {
    if (dialog === 'custom') update({ areaSize: draft.areaSize, speedMultiplier: draft.speedMultiplier });
    if (dialog === 'keys')
      update({ keys: [...new Set(draft.keys.toLowerCase().split(/[\s,]+/).filter((k) => KEY_RE.test(k)))] });
    if (dialog === 'count') update({ mode: 'fixed', count: Math.min(100, Math.max(1, Math.round(draft.count) || 1)) });
    if (dialog === 'clear') setScores(() => []);
    setDialog(null);
  };

  const start = () => {
    (document.activeElement as HTMLElement | null)?.blur(); // so a focused button doesn't eat keys
    setResult(null);
    setRun({ round: 0, successes: 0, times: [] });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (dialog || result) return;
      if (e.key === ' ' && !run) {
        e.preventDefault();
        start();
      }
      if (e.key === 'Escape' && run) setRun(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const onComplete = (ok: boolean, ms: number) => {
    if (!run) return;
    const next: Run = {
      round: run.round + 1,
      successes: run.successes + (ok ? 1 : 0),
      times: ok ? [...run.times, ms] : run.times,
    };
    const over = s.mode === 'endless' ? !ok : next.round >= s.count;
    if (!over) return setRun(next);
    setRun(null);
    setResult({
      mode: s.mode,
      areaSize: s.areaSize,
      speedMultiplier: s.speedMultiplier,
      keys: s.keys,
      count: s.mode === 'fixed' ? s.count : null,
      score: next.successes,
      total: next.round,
      avgMs: Math.round(avg(next.times)),
    });
  };

  const save = () => {
    if (!result || !name.trim()) return;
    setScores((prev) => [...prev, { ...result, name: name.trim().slice(0, 24), date: new Date().toISOString() }]);
    setResult(null);
  };

  const copyLua = () => {
    navigator.clipboard?.writeText(luaSnippet(s)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const busy = !!run;

  return (
    <div className="layout">
      {view === 'main' && (
        <Menu title="Skillcheck">
          <Option icon={faPlay} title={t.start} description="SPACE" onClick={start} disabled={busy} />
          <Option icon={faGauge} title={t.difficulty} description={difficultyLabel(s.areaSize, s.speedMultiplier, t)}
            arrow onClick={() => setView('difficulty')} disabled={busy} />
          <Option icon={faKeyboard} title={t.keys} description={keysLabel(s.keys)} onClick={() => openDialog('keys')} disabled={busy} />
          <Option icon={faRepeat} title={t.mode} description={s.mode === 'endless' ? t.endless : `${t.fixed} · ${s.count}`}
            arrow onClick={() => setView('mode')} disabled={busy} />
          <Option icon={copied ? faCheck : faCode} title={copied ? t.copied : t.copyLua}
            description={<code className="lua">{luaSnippet(s)}</code>} onClick={copyLua} />
          <Option icon={faLanguage} title={t.language} description={t.langName} onClick={() => setLang(lang === 'da' ? 'en' : 'da')} />
        </Menu>
      )}
      {view === 'difficulty' && (
        <Menu title={t.difficulty} onBack={() => setView('main')}>
          {(['easy', 'medium', 'hard'] as const).map((p) => (
            <Option key={p} title={t[p]} description={`${PRESETS[p].areaSize}° · ×${PRESETS[p].speedMultiplier}`}
              checked={s.preset === p} onClick={() => update(PRESETS[p])} disabled={busy} />
          ))}
          <Option icon={faSliders} title={t.custom}
            description={s.preset === 'custom' ? `${s.areaSize}° · ×${s.speedMultiplier}` : undefined}
            checked={s.preset === 'custom'} onClick={() => openDialog('custom')} disabled={busy} />
        </Menu>
      )}
      {view === 'mode' && (
        <Menu title={t.mode} onBack={() => setView('main')}>
          <Option icon={faInfinity} title={t.endless} checked={s.mode === 'endless'} onClick={() => update({ mode: 'endless' })} disabled={busy} />
          <Option icon={faListOl} title={t.fixed} description={String(s.count)} checked={s.mode === 'fixed'}
            onClick={() => openDialog('count')} disabled={busy} />
        </Menu>
      )}

      <section className="stage">
        {run ? (
          <>
            <TextUI>
              {s.mode === 'endless' ? (
                <span><FontAwesomeIcon icon={faFire} fixedWidth /> {run.successes}</span>
              ) : (
                <>
                  <span><FontAwesomeIcon icon={faListOl} fixedWidth /> {run.round}/{s.count}</span>
                  <span><FontAwesomeIcon icon={faCheck} fixedWidth /> {run.successes}</span>
                </>
              )}
              <span><FontAwesomeIcon icon={faStopwatch} fixedWidth /> {fmtMs(avg(run.times))}</span>
            </TextUI>
            <div className="sc-scale">
              <SkillCheck key={run.round} areaSize={s.areaSize} speedMultiplier={s.speedMultiplier} keys={s.keys} onComplete={onComplete} />
            </div>
          </>
        ) : (
          <TextUI>[SPACE] - {t.start}</TextUI>
        )}
      </section>

      <Scoreboard t={t} scores={scores} setScores={setScores} current={configKey(s)} onClear={() => openDialog('clear')} />

      <Dialog opened={dialog === 'custom'} heading={t.custom} onCancel={() => setDialog(null)} onConfirm={confirmDialog}
        cancelLabel={t.cancel} confirmLabel={t.confirm}>
        <div>
          <Text fz={14} fw={500}>{t.areaSize} · {draft.areaSize}°</Text>
          <Slider mb={10} min={5} max={180} value={draft.areaSize} label={null}
            onChange={(v) => setDraft((d) => ({ ...d, areaSize: v }))} marks={[{ value: 5, label: 5 }, { value: 180, label: 180 }]} />
        </div>
        <div>
          <Text fz={14} fw={500}>{t.speed} · ×{draft.speedMultiplier}</Text>
          <Slider mb={10} min={0.25} max={5} step={0.05} value={draft.speedMultiplier} label={null}
            onChange={(v) => setDraft((d) => ({ ...d, speedMultiplier: Math.round(v * 100) / 100 }))}
            marks={[{ value: 0.25, label: 0.25 }, { value: 5, label: 5 }]} />
        </div>
      </Dialog>

      <Dialog opened={dialog === 'keys'} heading={t.keys} onCancel={() => setDialog(null)} onConfirm={confirmDialog}
        cancelLabel={t.cancel} confirmLabel={t.confirm}>
        <TextInput label={t.keys} placeholder="w, a, s, d" value={draft.keys} data-autofocus
          leftSection={<FontAwesomeIcon icon={faKeyboard} fixedWidth />}
          onChange={(e) => { const keys = e.currentTarget.value; setDraft((d) => ({ ...d, keys })); }} />
      </Dialog>

      <Dialog opened={dialog === 'count'} heading={t.fixed} onCancel={() => setDialog(null)} onConfirm={confirmDialog}
        cancelLabel={t.cancel} confirmLabel={t.confirm}>
        <NumberInput label={t.count} min={1} max={100} hideControls value={draft.count} data-autofocus
          leftSection={<FontAwesomeIcon icon={faListOl} fixedWidth />}
          onChange={(v) => setDraft((d) => ({ ...d, count: Number(v) }))} />
      </Dialog>

      <Dialog opened={dialog === 'clear'} heading={t.clearConfirm} onCancel={() => setDialog(null)} onConfirm={confirmDialog}
        cancelLabel={t.cancel} confirmLabel={t.confirm} />

      <Dialog opened={!!result} heading={t.result} onCancel={() => setResult(null)} onConfirm={save}
        cancelLabel={t.cancel} confirmLabel={t.confirm} confirmDisabled={!name.trim()}>
        {result && (
          <div className="result">
            <span>
              <FontAwesomeIcon icon={result.mode === 'endless' ? faFire : faCheck} fixedWidth />{' '}
              {result.mode === 'endless' ? result.score : `${result.score}/${result.total}`}
            </span>
            <span><FontAwesomeIcon icon={faStopwatch} fixedWidth /> {fmtMs(result.avgMs)}</span>
          </div>
        )}
        <TextInput label={t.name} value={name} maxLength={24} data-autofocus
          onChange={(e) => setName(e.currentTarget.value)} />
      </Dialog>
    </div>
  );
}

function Scoreboard({ t, scores, setScores, current, onClear }: {
  t: Dict; scores: Entry[]; setScores: (fn: (prev: Entry[]) => Entry[]) => void; current: string; onClear: () => void;
}) {
  const [hofView, setHofView] = useState(false);
  const [onlyCurrent, setOnlyCurrent] = useState(true);
  const [hof, setHof] = useState<Entry[] | 'error' | null>(null);
  const [msg, setMsg] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!hofView || hof) return;
    fetch(`${import.meta.env.BASE_URL}scoreboard.json`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setHof(parseEntries(d)))
      .catch(() => setHof('error'));
  }, [hofView, hof]);

  const source = hofView ? (Array.isArray(hof) ? hof : []) : scores;
  const rows = useMemo(
    () => sortEntries(onlyCurrent ? source.filter((e) => configKey(e) === current) : source).slice(0, 100),
    [source, onlyCurrent, current],
  );

  const exportJson = () => {
    const blob = new Blob([JSON.stringify({ version: 1, entries: sortEntries(scores) }, null, 2)], { type: 'application/json' });
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'scoreboard.json' });
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const importJson = async (file: File | undefined) => {
    if (!file) return;
    let parsed: Entry[] = [];
    try {
      parsed = parseEntries(JSON.parse(await file.text()));
    } catch {
      /* invalid JSON → treated as empty */
    }
    setMsg(parsed.length ? t.imported.replace('{n}', String(parsed.length)) : t.importFailed);
    setTimeout(() => setMsg(''), 3000);
    if (parsed.length) setScores((prev) => mergeEntries(prev, parsed));
  };

  return (
    <Menu title={hofView ? t.hallOfFame : t.scoreboard} onBack={hofView ? () => setHofView(false) : undefined}>
      <Option icon={faFilter} title={t.filter} description={onlyCurrent ? t.current : t.all} onClick={() => setOnlyCurrent((v) => !v)} />
      {!hofView && (
        <>
          <Option icon={faEarthEurope} title={t.hallOfFame} arrow onClick={() => setHofView(true)} />
          <Option icon={faDownload} title={t.export} onClick={exportJson} disabled={!scores.length} />
          <Option icon={faUpload} title={t.import} description={msg || undefined} onClick={() => fileRef.current?.click()} />
          <Option icon={faTrash} title={t.clear} onClick={onClear} disabled={!scores.length} />
          <input ref={fileRef} type="file" accept="application/json,.json" hidden
            onChange={(e) => { importJson(e.currentTarget.files?.[0]); e.currentTarget.value = ''; }} />
        </>
      )}
      {hofView && hof === 'error' ? (
        <Option readOnly title={t.loadError} />
      ) : rows.length === 0 ? (
        <Option readOnly title={t.empty} />
      ) : (
        rows.map((e, i) => (
          <Option
            key={`${e.name}${e.date}${i}`}
            readOnly
            icon={faTrophy}
            iconColor={RANK_COLORS[i] ?? 'var(--mantine-color-dark-3)'}
            title={`${i + 1}. ${e.name}`}
            description={`${e.mode === 'endless' ? e.score : `${e.score}/${e.total}`} · ${fmtMs(e.avgMs)}${onlyCurrent ? '' : ` · ${setupLabel(e, t)}`}`}
          />
        ))
      )}
    </Menu>
  );
}

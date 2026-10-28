import { useEffect, useState } from 'react';
import { NumberInput, Slider, Text, TextInput } from '@mantine/core';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCalendar, faCheck, faClone, faCode, faFire, faPaperPlane, faTriangleExclamation, faGauge, faInfinity, faKeyboard, faLanguage, faListOl, faPlay, faRepeat,
  faSliders, faStar, faStopwatch, faTrophy, faUser,
} from '@fortawesome/free-solid-svg-icons';
import SkillCheck from './SkillCheck';
import { Dialog, Menu, Option, TextUI } from './ox';
import { dicts, type Dict, type Lang } from './i18n';
import {
  configKey, DEFAULT_SETTINGS, isBetter, KEY_RE, parseEntries, presetOf, PRESETS, sortEntries,
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
    /* private mode / blocked storage: bests just won't persist */
  }
}

interface Run { round: number; successes: number; times: number[] }
type DialogKind = 'custom' | 'keys' | 'count' | 'name' | null;

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const fmtMs = (ms: number) => (ms ? `${Math.round(ms)} ms` : '—');
const fmtScore = (e: Entry) => (e.mode === 'endless' ? String(e.score) : `${e.score}/${e.total}`);
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

const entrySettings = (e: Entry, fallbackCount: number): Settings => ({
  preset: presetOf(e.areaSize, e.speedMultiplier),
  areaSize: e.areaSize,
  speedMultiplier: e.speedMultiplier,
  keys: e.keys,
  mode: e.mode,
  count: e.count ?? fallbackCount,
});

// Cloudflare Worker (worker/) that holds the Discord webhook as a secret
const SUBMIT_URL = 'https://ox-skillcheck-submit.laur762d.workers.dev';

// Best attempt per setup, keyed by configKey
const loadBests = () =>
  Object.fromEntries(parseEntries(Object.values(load('oxsc.best', {}))).map((e) => [configKey(e), e]));

export default function App() {
  const [lang, setLang] = useState<Lang>(() => load('oxsc.lang', navigator.language.startsWith('da') ? 'da' : 'en'));
  const t = dicts[lang] ?? dicts.en;
  const [s, setS] = useState<Settings>(() => ({ ...DEFAULT_SETTINGS, ...load('oxsc.settings', {}) }));
  const [bests, setBests] = useState<Record<string, Entry>>(loadBests);
  const [name, setName] = useState<string>(() => load('oxsc.name', ''));
  const [run, setRun] = useState<Run | null>(null);
  const [result, setResult] = useState<{ entry: Entry; isBest: boolean } | null>(null);
  const [view, setView] = useState<'main' | 'difficulty' | 'mode'>('main');
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [draft, setDraft] = useState({ areaSize: 0, speedMultiplier: 0, keys: '', count: 0, name: '' });
  const [copied, setCopied] = useState(false);
  const [send, setSend] = useState<'sending' | 'sent' | 'error' | null>(null);

  useEffect(() => store('oxsc.lang', lang), [lang]);
  useEffect(() => store('oxsc.settings', s), [s]);
  useEffect(() => store('oxsc.best', bests), [bests]);
  useEffect(() => store('oxsc.name', name), [name]);

  const update = (patch: Partial<Settings>) =>
    setS((prev) => {
      const next = { ...prev, ...patch };
      return { ...next, preset: presetOf(next.areaSize, next.speedMultiplier) };
    });

  const openDialog = (kind: DialogKind) => {
    setDraft({ areaSize: s.areaSize, speedMultiplier: s.speedMultiplier, keys: s.keys.join(', '), count: s.count, name });
    setDialog(kind);
  };

  const copyLua = () =>
    navigator.clipboard?.writeText(luaSnippet(s)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });

  const sendBests = async (playerName: string) => {
    setSend('sending');
    let ok = false;
    try {
      ok = (await fetch(SUBMIT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: playerName, bests: Object.values(bests) }),
      })).ok;
    } catch {
      /* network/CORS error → shown as failed */
    }
    setSend(ok ? 'sent' : 'error');
    setTimeout(() => setSend(null), 2500);
  };

  const confirmDialog = () => {
    if (dialog === 'custom') update({ areaSize: draft.areaSize, speedMultiplier: draft.speedMultiplier });
    if (dialog === 'keys')
      update({ keys: [...new Set(draft.keys.toLowerCase().split(/[\s,]+/).filter((k) => KEY_RE.test(k)))] });
    if (dialog === 'count') update({ mode: 'fixed', count: Math.min(100, Math.max(1, Math.round(draft.count) || 1)) });
    if (dialog === 'name') {
      const n = draft.name.trim().slice(0, 24);
      setName(n);
      if (n) sendBests(n);
    }
    setDialog(null);
  };

  const start = () => {
    (document.activeElement as HTMLElement | null)?.blur(); // so a focused button doesn't eat keys
    setResult(null);
    setRun({ round: 0, successes: 0, times: [] });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (dialog) return;
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
    const entry: Entry = {
      name: name || '?',
      mode: s.mode,
      areaSize: s.areaSize,
      speedMultiplier: s.speedMultiplier,
      keys: s.keys,
      count: s.mode === 'fixed' ? s.count : null,
      score: next.successes,
      total: next.round,
      avgMs: Math.round(avg(next.times)),
      date: new Date().toISOString(),
    };
    const key = configKey(entry);
    const isBest = entry.score > 0 && isBetter(entry, bests[key]);
    if (isBest) setBests((b) => ({ ...b, [key]: entry }));
    setResult({ entry, isBest });
  };

  const busy = !!run;
  const currentBest = bests[configKey(s)];

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
          <Option icon={faUser} title={t.name} description={name || '—'} onClick={() => openDialog('name')} disabled={busy} />
          <Option
            icon={send === 'sent' ? faCheck : send === 'error' ? faTriangleExclamation : faPaperPlane}
            title={send === 'sent' ? t.sent : send === 'error' ? t.sendFailed : t.sendBest}
            description={currentBest ? `${fmtScore(currentBest)} · ${fmtMs(currentBest.avgMs)}` : t.noBest}
            disabled={busy || send === 'sending' || !Object.keys(bests).length}
            onClick={() => (name ? sendBests(name) : openDialog('name'))} />
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
          !result && <TextUI>[SPACE] - {t.start}</TextUI>
        )}
      </section>

      <Scoreboard t={t} busy={busy} count={s.count} onUse={(e) => { setS(entrySettings(e, s.count)); setView('main'); }} />

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

      <Dialog opened={dialog === 'name'} heading={t.name} onCancel={() => setDialog(null)} onConfirm={confirmDialog}
        cancelLabel={t.cancel} confirmLabel={t.confirm} confirmDisabled={!draft.name.trim()}>
        <TextInput label={t.name} value={draft.name} maxLength={24} data-autofocus
          leftSection={<FontAwesomeIcon icon={faUser} fixedWidth />}
          onChange={(e) => { const n = e.currentTarget.value; setDraft((d) => ({ ...d, name: n })); }} />
      </Dialog>

      <Dialog opened={!!result} heading={result?.isBest ? t.newBest : t.result} onCancel={() => setResult(null)} onConfirm={start}>
        {result && (
          <>
            <div className="result">
              <span>
                <FontAwesomeIcon icon={result.isBest ? faStar : result.entry.mode === 'endless' ? faFire : faCheck} fixedWidth />{' '}
                {fmtScore(result.entry)}
              </span>
              <span><FontAwesomeIcon icon={faStopwatch} fixedWidth /> {fmtMs(result.entry.avgMs)}</span>
            </div>
            <div className="result-hint"><TextUI>[SPACE] - {t.again}</TextUI></div>
          </>
        )}
      </Dialog>
    </div>
  );
}

function Scoreboard({ t, busy, count, onUse }: { t: Dict; busy: boolean; count: number; onUse: (e: Entry) => void }) {
  const [entries, setEntries] = useState<Entry[] | 'error' | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [done, setDone] = useState<'use' | 'lua' | null>(null);

  const flash = (what: 'use' | 'lua') => {
    setDone(what);
    setTimeout(() => setDone(null), 1500);
  };

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}scoreboard.json`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setEntries(sortEntries(parseEntries(d)).slice(0, 100)))
      .catch(() => setEntries('error'));
  }, []);

  const e = Array.isArray(entries) && selected !== null ? entries[selected] : null;
  if (e) {
    const lua = luaSnippet(entrySettings(e, count));
    return (
      <Menu title={`${selected! + 1}. ${e.name}`} onBack={() => setSelected(null)}>
        <Option readOnly icon={faTrophy} iconColor={RANK_COLORS[selected!]} title={fmtScore(e)} description={fmtMs(e.avgMs)} />
        <Option readOnly icon={faGauge} title={t.difficulty} description={difficultyLabel(e.areaSize, e.speedMultiplier, t)} />
        <Option readOnly icon={faKeyboard} title={t.keys} description={keysLabel(e.keys)} />
        <Option readOnly icon={faRepeat} title={t.mode} description={e.mode === 'endless' ? t.endless : `${t.fixed} · ${e.count}`} />
        <Option readOnly icon={faCalendar} title={new Date(e.date).toLocaleDateString()} />
        <Option icon={done === 'use' ? faCheck : faClone} title={done === 'use' ? t.applied : t.useSettings}
          disabled={busy} onClick={() => { onUse(e); flash('use'); }} />
        <Option icon={done === 'lua' ? faCheck : faCode} title={done === 'lua' ? t.copied : t.copyLua}
          description={<code className="lua">{lua}</code>}
          onClick={() => navigator.clipboard?.writeText(lua).then(() => flash('lua'))} />
      </Menu>
    );
  }

  return (
    <Menu title={t.scoreboard}>
      {entries === 'error' ? (
        <Option readOnly title={t.loadError} />
      ) : entries && !entries.length ? (
        <Option readOnly title={t.empty} />
      ) : (
        entries?.map((e, i) => (
          <Option
            key={`${e.name}${e.date}${i}`}
            arrow
            onClick={() => setSelected(i)}
            icon={faTrophy}
            iconColor={RANK_COLORS[i] ?? 'var(--mantine-color-dark-3)'}
            title={`${i + 1}. ${e.name}`}
            description={`${fmtScore(e)} · ${fmtMs(e.avgMs)} · ${setupLabel(e, t)}`}
          />
        ))
      )}
    </Menu>
  );
}

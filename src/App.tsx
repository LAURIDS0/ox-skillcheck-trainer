import { useEffect, useMemo, useState } from 'react';
import {
  Badge, Button, Code, CopyButton, FileButton, Group, Modal, NumberInput, Paper, ScrollArea, SegmentedControl,
  Slider, Stack, Switch, Table, Tabs, TagsInput, Text, TextInput, Title,
} from '@mantine/core';
import SkillCheck from './SkillCheck';
import { dicts, type Dict, type Lang } from './i18n';
import {
  configKey, DEFAULT_SETTINGS, KEY_RE, mergeEntries, parseEntries, presetOf, PRESETS, sortEntries,
  type Entry, type Preset, type Settings,
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

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const fmtMs = (ms: number) => (ms ? `${Math.round(ms)} ms` : '—');

function setupLabel(e: Pick<Entry, 'areaSize' | 'speedMultiplier' | 'keys' | 'mode' | 'count'>, t: Dict) {
  const p = presetOf(e.areaSize, e.speedMultiplier);
  const diff = p === 'custom' ? `${e.areaSize}° ×${e.speedMultiplier}` : t[p];
  return `${diff} · ${(e.keys.join('') || 'e').toUpperCase()} · ${e.mode === 'fixed' ? e.count : '∞'}`;
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
  const [flash, setFlash] = useState<{ ok: boolean; id: number } | null>(null);

  useEffect(() => store('oxsc.lang', lang), [lang]);
  useEffect(() => store('oxsc.settings', s), [s]);
  useEffect(() => store('oxsc.scores', scores), [scores]);
  useEffect(() => store('oxsc.name', name), [name]);

  const update = (patch: Partial<Settings>) =>
    setS((prev) => {
      const next = { ...prev, ...patch };
      return { ...next, preset: presetOf(next.areaSize, next.speedMultiplier) };
    });

  const start = () => {
    (document.activeElement as HTMLElement | null)?.blur(); // so a focused button/slider doesn't eat keys
    setResult(null);
    setFlash(null);
    setRun({ round: 0, successes: 0, times: [] });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      const typing = (el instanceof HTMLInputElement && !['radio', 'checkbox'].includes(el.type))
        || el instanceof HTMLTextAreaElement || el.closest?.('[role="dialog"]');
      if (typing) return;
      if (e.key === ' ' && !run && !result) {
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
    setFlash({ ok, id: next.round });
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

  return (
    <div className="app">
      <header className="header">
        <div>
          <Title order={2} className="brand">
            <span className="brand-ox">ox</span> {t.title}
          </Title>
          <Text c="dimmed" size="sm">{t.subtitle}</Text>
        </div>
        <SegmentedControl
          value={lang}
          onChange={(v) => setLang(v as Lang)}
          data={[{ value: 'da', label: 'DA' }, { value: 'en', label: 'EN' }]}
        />
      </header>

      <main className="grid">
        <Paper className="card" p="md" radius="sm" shadow="sm">
          <fieldset disabled={!!run} className="plain">
            <Stack gap="md">
              <Title order={4}>{t.settings}</Title>
              <div>
                <Text size="sm" fw={500} mb={6}>{t.difficulty}</Text>
                <SegmentedControl
                  fullWidth
                  value={s.preset}
                  onChange={(v) => v !== 'custom' && update(PRESETS[v as Exclude<Preset, 'custom'>])}
                  data={(['easy', 'medium', 'hard', 'custom'] as const).map((p) => ({
                    value: p, label: t[p], disabled: p === 'custom',
                  }))}
                />
              </div>
              <div>
                <Group justify="space-between" mb={6}>
                  <Text size="sm" fw={500}>{t.areaSize}</Text>
                  <Badge variant="light">{s.areaSize}°</Badge>
                </Group>
                <Slider min={5} max={180} value={s.areaSize} onChange={(v) => update({ areaSize: v })} label={null} />
              </div>
              <div>
                <Group justify="space-between" mb={6}>
                  <Text size="sm" fw={500}>{t.speed}</Text>
                  <Badge variant="light">×{s.speedMultiplier}</Badge>
                </Group>
                <Slider
                  min={0.25} max={5} step={0.05} value={s.speedMultiplier} label={null}
                  onChange={(v) => update({ speedMultiplier: Math.round(v * 100) / 100 })}
                />
              </div>
              <TagsInput
                label={t.keys}
                description={t.keysHint}
                value={s.keys}
                onChange={(v) => update({ keys: [...new Set(v.map((k) => k.trim().toLowerCase()).filter((k) => KEY_RE.test(k)))] })}
                splitChars={[',', ' ']}
                clearable
              />
              <div>
                <Text size="sm" fw={500} mb={6}>{t.mode}</Text>
                <SegmentedControl
                  fullWidth
                  value={s.mode}
                  onChange={(v) => update({ mode: v as Settings['mode'] })}
                  data={[{ value: 'endless', label: t.endless }, { value: 'fixed', label: t.fixed }]}
                />
              </div>
              {s.mode === 'fixed' && (
                <NumberInput
                  label={t.count} min={1} max={100} value={s.count}
                  onChange={(v) => typeof v === 'number' && update({ count: Math.min(100, Math.max(1, Math.round(v))) })}
                />
              )}
              <div>
                <Group justify="space-between" mb={6}>
                  <Text size="sm" fw={500}>{t.luaSnippet}</Text>
                  <CopyButton value={luaSnippet(s)}>
                    {({ copied, copy }) => (
                      <Button size="compact-xs" variant="light" onClick={copy}>{copied ? t.copied : t.copy}</Button>
                    )}
                  </CopyButton>
                </Group>
                <Code block className="lua">{luaSnippet(s)}</Code>
              </div>
            </Stack>
          </fieldset>
        </Paper>

        <section className="stage" onClick={() => !run && !result && start()}>
          <div className="stage-hud">
            <Stat label={s.mode === 'endless' ? t.streak : t.progress}
              value={s.mode === 'endless' ? String(run?.successes ?? 0) : `${run?.round ?? 0}/${s.count}`} />
            {s.mode === 'fixed' && <Stat label={t.hits} value={String(run?.successes ?? 0)} />}
            <Stat label={t.avg} value={fmtMs(avg(run?.times ?? []))} />
          </div>
          <div className="stage-center">
            {flash && <div key={flash.id} className={`flash ${flash.ok ? 'ok' : 'bad'}`} />}
            {run ? (
              <div className="sc-scale">
                <SkillCheck key={run.round} areaSize={s.areaSize} speedMultiplier={s.speedMultiplier} keys={s.keys} onComplete={onComplete} />
              </div>
            ) : (
              <div className="prompt">
                <span className="kbd">SPACE</span>
                <Text size="lg" fw={500}>{t.pressStart}</Text>
              </div>
            )}
          </div>
          <Text c="dimmed" size="xs" className="stage-foot">{run ? t.pressCancel : setupLabel(s, t)}</Text>
        </section>

        <Scoreboard t={t} scores={scores} setScores={setScores} current={configKey(s)} />
      </main>

      <Modal opened={!!result} onClose={() => setResult(null)} title={t.result} centered radius="sm">
        {result && (
          <form onSubmit={(e) => { e.preventDefault(); save(); }}>
            <Stack>
              <Group grow>
                <Stat label={t.score} value={result.mode === 'endless' ? String(result.score) : `${result.score}/${result.total}`} big />
                <Stat label={t.avg} value={fmtMs(result.avgMs)} big />
              </Group>
              <Text c="dimmed" size="xs" ta="center">{setupLabel(result, t)}</Text>
              <TextInput label={t.yourName} value={name} onChange={(e) => setName(e.currentTarget.value)} maxLength={24} data-autofocus />
              <Group grow>
                <Button variant="default" onClick={start}>{t.again}</Button>
                <Button type="submit" disabled={!name.trim()}>{t.save}</Button>
              </Group>
            </Stack>
          </form>
        )}
      </Modal>
    </div>
  );
}

function Stat({ label, value, big }: { label: string; value: string; big?: boolean }) {
  return (
    <div className={`stat ${big ? 'big' : ''}`}>
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
    </div>
  );
}

function Scoreboard({ t, scores, setScores, current }: {
  t: Dict; scores: Entry[]; setScores: (fn: (prev: Entry[]) => Entry[]) => void; current: string;
}) {
  const [tab, setTab] = useState<string | null>('local');
  const [onlyCurrent, setOnlyCurrent] = useState(true);
  const [hof, setHof] = useState<Entry[] | 'error' | null>(null);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (tab !== 'hof' || hof) return;
    fetch(`${import.meta.env.BASE_URL}scoreboard.json`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setHof(parseEntries(d)))
      .catch(() => setHof('error'));
  }, [tab, hof]);

  const source = tab === 'hof' ? (Array.isArray(hof) ? hof : []) : scores;
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

  const importJson = async (file: File | null) => {
    if (!file) return;
    let parsed: Entry[] = [];
    try {
      parsed = parseEntries(JSON.parse(await file.text()));
    } catch {
      /* invalid JSON → treated as empty */
    }
    setMsg(parsed.length ? t.imported.replace('{n}', String(parsed.length)) : t.importFailed);
    if (parsed.length) setScores((prev) => mergeEntries(prev, parsed));
  };

  return (
    <Paper className="card" p="md" radius="sm" shadow="sm">
      <Stack gap="sm">
        <Title order={4}>{t.scoreboard}</Title>
        <Tabs value={tab} onChange={setTab}>
          <Tabs.List grow>
            <Tabs.Tab value="local">{t.local}</Tabs.Tab>
            <Tabs.Tab value="hof">{t.hallOfFame}</Tabs.Tab>
          </Tabs.List>
        </Tabs>
        <Switch label={t.onlyCurrent} checked={onlyCurrent} onChange={(e) => setOnlyCurrent(e.currentTarget.checked)} />
        <ScrollArea.Autosize mah={440}>
          {tab === 'hof' && hof === 'error' ? (
            <Text c="red" size="sm">{t.hofError}</Text>
          ) : rows.length === 0 ? (
            <Text c="dimmed" size="sm" ta="center" py="lg">{t.empty}</Text>
          ) : (
            <Table striped highlightOnHover verticalSpacing={6} fz="sm">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>#</Table.Th>
                  <Table.Th>{t.name}</Table.Th>
                  <Table.Th>{t.score}</Table.Th>
                  <Table.Th>{t.avg}</Table.Th>
                  {!onlyCurrent && <Table.Th>{t.setup}</Table.Th>}
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {rows.map((e, i) => (
                  <Table.Tr key={`${e.name}${e.date}${i}`} title={new Date(e.date).toLocaleString()}>
                    <Table.Td className={i < 3 ? `rank rank-${i}` : 'rank'}>{i + 1}</Table.Td>
                    <Table.Td>{e.name}</Table.Td>
                    <Table.Td fw={500}>{e.mode === 'endless' ? e.score : `${e.score}/${e.total}`}</Table.Td>
                    <Table.Td>{fmtMs(e.avgMs)}</Table.Td>
                    {!onlyCurrent && <Table.Td c="dimmed" fz="xs">{setupLabel(e, t)}</Table.Td>}
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </ScrollArea.Autosize>
        {tab === 'local' ? (
          <Group gap="xs" grow>
            <Button size="xs" variant="light" onClick={exportJson} disabled={!scores.length}>{t.export}</Button>
            <FileButton onChange={importJson} accept="application/json,.json">
              {(props) => <Button size="xs" variant="light" {...props}>{t.import}</Button>}
            </FileButton>
            <Button size="xs" variant="subtle" color="red" disabled={!scores.length}
              onClick={() => confirm(t.clearConfirm) && setScores(() => [])}>{t.clear}</Button>
          </Group>
        ) : (
          <Text c="dimmed" size="xs">{t.hofHint}</Text>
        )}
        {msg && tab === 'local' && <Text size="xs" c="blue">{msg}</Text>}
      </Stack>
    </Paper>
  );
}

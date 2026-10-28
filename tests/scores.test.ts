import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseEntries, sortEntries, isBetter, configKey, presetOf, type Entry } from '../src/scores.ts';

const base: Entry = {
  name: 'a', mode: 'endless', areaSize: 50, speedMultiplier: 1, keys: ['e'], count: null,
  score: 5, total: 6, avgMs: 900, date: '2026-10-28T12:00:00.000Z',
};

test('parseEntries keeps valid entries and drops bad ones', () => {
  const parsed = parseEntries({
    entries: [
      base,
      { ...base, keys: ['<script>'] },
      { ...base, score: 10, total: 2 },
      { ...base, mode: 'fixed' }, // fixed without count
      { ...base, name: '   ' },
      null,
      { ...base, name: 'x'.repeat(40) },
    ],
  });
  assert.equal(parsed.length, 2);
  assert.equal(parsed[1].name.length, 24);
  assert.deepEqual(parseEntries('nope'), []);
  assert.deepEqual(parseEntries([base]).length, 1);
});

test('sortEntries: score desc, then faster avg, 0 avg last', () => {
  const s = sortEntries([
    { ...base, name: 'slow', avgMs: 1000 },
    { ...base, name: 'none', avgMs: 0 },
    { ...base, name: 'best', score: 9 },
    { ...base, name: 'fast', avgMs: 500 },
  ]);
  assert.deepEqual(s.map((e) => e.name), ['best', 'fast', 'slow', 'none']);
});

test('isBetter, configKey ignores key order, presetOf', () => {
  assert.ok(isBetter(base, undefined));
  assert.ok(isBetter({ ...base, score: 6 }, base));
  assert.ok(isBetter({ ...base, avgMs: 800 }, base));
  assert.ok(!isBetter(base, base));
  assert.equal(configKey({ ...base, keys: ['w', 'a'] }), configKey({ ...base, keys: ['a', 'w'] }));
  assert.equal(presetOf(40, 1.5), 'medium');
  assert.equal(presetOf(41, 1.5), 'custom');
});

// Receives "Send best" from the site and posts it to Discord. The webhook URL only lives here as a secret.
import { parseEntries, presetOf, sortEntries, type Entry } from '../src/scores';

interface Env {
  DISCORD_WEBHOOK: string;
  LIMITER: { limit(opts: { key: string }): Promise<{ success: boolean }> };
}

const ORIGINS = ['https://laurids0.github.io', 'http://localhost:5173', 'http://localhost:4317'];

const setup = (e: Entry) => {
  const p = presetOf(e.areaSize, e.speedMultiplier);
  return `${p === 'custom' ? `${e.areaSize}° ×${e.speedMultiplier}` : p} · ${(e.keys.join(' ') || 'e').toUpperCase()} · ${e.mode === 'fixed' ? e.count : '∞'}`;
};
const score = (e: Entry) => (e.mode === 'endless' ? String(e.score) : `${e.score}/${e.total}`);

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const origin = req.headers.get('Origin') ?? '';
    const cors = {
      'Access-Control-Allow-Origin': ORIGINS.includes(origin) ? origin : ORIGINS[0],
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };
    const reply = (status: number, msg = '') => new Response(msg, { status, headers: cors });

    if (req.method === 'OPTIONS') return reply(204);
    if (req.method !== 'POST') return reply(405);
    if (!ORIGINS.includes(origin)) return reply(403);

    const ip = req.headers.get('CF-Connecting-IP') ?? '';
    if (!(await env.LIMITER.limit({ key: ip })).success) return reply(429, 'Wait a minute');

    const text = await req.text();
    if (text.length > 20_000) return reply(413);
    let body: { name?: unknown; bests?: unknown };
    try {
      body = JSON.parse(text);
    } catch {
      return reply(400);
    }

    // Backticks would break the code block in the message
    const name = typeof body.name === 'string' ? body.name.replace(/[`\n\r]/g, '').trim().slice(0, 24) : '';
    const bests = sortEntries(parseEntries(body.bests)).slice(0, 15).map((e) => ({ ...e, name }));
    if (!name || !bests.length) return reply(400);

    const res = await fetch(env.DISCORD_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'Skillcheck Trainer',
        allowed_mentions: { parse: [] },
        embeds: [{
          title: name,
          color: 0x1971c2,
          fields: bests.map((e) => ({ name: setup(e), value: `**${score(e)}** · ${e.avgMs ? `${e.avgMs} ms` : '—'}`, inline: true })),
          description: '```json\n' + bests.map((e) => JSON.stringify(e)).join(',\n') + '\n```',
          timestamp: new Date().toISOString(),
        }],
      }),
    });
    return reply(res.ok ? 204 : 502);
  },
};

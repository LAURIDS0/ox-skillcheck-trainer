# ox skillcheck trainer

Practice [ox_lib](https://github.com/overextended/ox_lib) `lib.skillCheck` in the browser, with the same geometry, timing, keys and look as in-game.

**Play:** https://LAURIDS0.github.io/ox-skillcheck-trainer/

- Presets `easy` / `medium` / `hard` (same values as ox_lib) or custom `areaSize` + `speedMultiplier`
- Custom keys (a random one per check, like `inputs` in ox_lib)
- **Endless** mode (streak until you miss) or **Fixed** mode (N checks, hits/total)
- Copyable Lua snippet for the current settings
- Danish / English
- Your best attempt per setup is saved in the browser
- Scoreboard from [`public/scoreboard.json`](public/scoreboard.json)

## Getting on the scoreboard

Set your name and press **Send best**. Your bests are posted to the owner's Discord as ready-to-paste lines for `entries` in `public/scoreboard.json`.

Submissions go through a Cloudflare Worker (`worker/`) that validates them, rate limits per IP and keeps the webhook URL secret:

```sh
cd worker
npx wrangler deploy
npx wrangler secret put DISCORD_WEBHOOK
```

## Development

```sh
npm install
npm run dev     # local dev server
npm test        # score logic tests
npm run build
```

Pushing to `main` deploys to GitHub Pages via `.github/workflows/deploy.yml`.

## License

LGPL-3.0, same as ox_lib. The skill check component is a port of ox_lib's `web/src/features/skillcheck`.

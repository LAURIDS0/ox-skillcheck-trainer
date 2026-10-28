# ox skillcheck trainer

Practice [ox_lib](https://github.com/overextended/ox_lib) `lib.skillCheck` in the browser, with the same geometry, timing, keys and look as in-game.

**Play:** https://LAURIDS0.github.io/ox-skillcheck-trainer/

- Presets `easy` / `medium` / `hard` (same values as ox_lib) or custom `areaSize` + `speedMultiplier`
- Custom keys (a random one per check, like `inputs` in ox_lib)
- **Endless** mode (streak until you miss) or **Fixed** mode (N checks, hits/total)
- Copyable Lua snippet for the current settings
- Danish / English
- Scoreboard: local (browser) with JSON export/import, plus a shared **Hall of Fame** from [`public/scoreboard.json`](public/scoreboard.json)

## Getting on the Hall of Fame

Export your scores (Scoreboard → Export), copy the entries you want into `entries` in `public/scoreboard.json` and open a pull request.

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

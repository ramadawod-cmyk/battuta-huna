# battuta-huna

## Testing

Unit tests run on [Vitest](https://vitest.dev) and live next to the code they test, as
`*.test.ts` files (e.g. `src/lib/categories.ts` → `src/lib/categories.test.ts`).

```
npm test         # run once
npm run test:watch   # re-run on file changes while developing
```

`npm run build` runs the full test suite first — a failing test blocks the build (and
therefore blocks deploy, since Netlify's build command is `npm run build`).

**Adding a test**: create a `<name>.test.ts` next to the file it covers, import from
Vitest (`describe`/`it`/`expect`), and add cases as you touch logic. Best candidates
are pure functions with no network/DOM dependency — see `src/lib/geo.test.ts` and
`src/lib/categories.test.ts` for examples. This intentionally starts scoped to pure
logic; end-to-end/browser tests are a natural next step if we want to cover full user
flows, but need some thought around mocking the real Supabase/Anthropic/Wikipedia calls
this app makes.
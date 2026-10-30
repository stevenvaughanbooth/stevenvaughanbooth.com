# stevenvaughanbooth.com

[![CI](https://github.com/stevenvaughanbooth/stevenvaughanbooth.com/actions/workflows/ci.yml/badge.svg)](https://github.com/stevenvaughanbooth/stevenvaughanbooth.com/actions/workflows/ci.yml)

The personal site of Steven Booth, Principal Software Engineer at Salesforce.
**Live: [stevenvaughanbooth.com](https://stevenvaughanbooth.com)**

A single, statically prerendered page that covers who Steven is, what he builds and how to reach
him. It has **Ask Steven**, a ⌘K palette that answers questions about his work from curated notes
and, when live answers are on, from Claude within a small per-visitor allowance.

The repository is meant to be read as a work sample: typed content, a small client surface,
end-to-end and accessibility tests, a documented security model, and performance floors that fail
the build. The [colophon](https://stevenvaughanbooth.com/colophon) is the reader-friendly tour of
the same material.

## Stack

| Concern      | Choice                                                                               |
| ------------ | ------------------------------------------------------------------------------------ |
| Framework    | Next.js 16 App Router, React 19, React Compiler                                      |
| Rendering    | Static prerendering for every page; React Server Components by default               |
| Language     | TypeScript (`strict`, `noUncheckedIndexedAccess`, `typedRoutes`)                     |
| Styling      | Tailwind CSS v4 over CSS custom properties, each colour set once with `light-dark()` |
| Fonts/images | `next/font` (DM Sans, IBM Plex Mono); `next/image`'s `getImageProps()`               |
| Live answers | Route Handler → Anthropic Messages API (`claude-haiku-5-5`), streaming text          |
| Abuse limits | Upstash Redis (`@upstash/ratelimit`), Vercel BotID                                   |
| Tests        | Vitest + Testing Library, Playwright + axe-core, Lighthouse CI                       |
| Hosting      | Vercel, with Speed Insights (bundled only in builds that run on Vercel)              |

## Architecture

[`docs/architecture.md`](docs/architecture.md) records the decisions, the load order, the security
model and the full `/api/ask` contract. In short:

- **One source of truth.** Every fact lives in [`src/content/profile.ts`](src/content/profile.ts),
  including the list of page sections. The page, the navigation, the palette's curated answers,
  the Claude system prompt, JSON-LD, `/profile.json` and `/llms.txt` all read from it.
- **HTML first.** Sections are Server Components. The diagrams and the film player render on the
  server too; a small `'use client'` shell shows each one and loads its controller only as it nears
  the viewport. The career timeline ships no JavaScript at all. The other client modules are the
  theme toggle, the mobile Sections menu, a copy button, the Ask buttons and the palette loader,
  the "Scene by scene" dialog and the error boundaries.
- **The palette loads on intent.** Ask buttons reach the palette's loader through a small event
  bus ([`ask-events.ts`](src/components/ask/ask-events.ts)), and the loader listens for ⌘K /
  Ctrl+K itself. The palette's code downloads when a visitor points at, focuses or presses an Ask
  button, or presses the shortcut; never at idle. If it fails to load, an error boundary keeps the
  page up and offers Try again and email.
- **Motion in CSS.** Scroll-driven reveals move sections without fading their text, and the theme
  switch uses a View Transition. Everything stands down under `prefers-reduced-motion`.
- **Locked-down headers.** [`next.config.ts`](next.config.ts) sets a Content Security Policy that
  allows only this origin. It permits inline scripts, because Next.js streams its payload through
  them and the site uses no nonce, and blocks inline event handlers with `script-src-attr 'none'`.
  It also sets HSTS, `frame-ancestors 'none'`, `nosniff`, a strict referrer policy and a minimal
  permissions policy.

## Project structure

```
src/
  app/                    Routes and metadata: /, /colophon, /api/ask, /profile.json, /llms.txt,
                          Open Graph and icon images, sitemap, robots, manifest, error and 404 pages
  assets/                 Headshot, Salesforce logo, TTF fonts for the next/og images
  content/
    profile.ts            Single source of truth for every fact on the site
    answers.ts            The palette's curated answers and question matcher
  components/
    sections/             Server Components, one per page section
    visuals/              Server-rendered diagrams; each controller loads as its card nears view
      shared/             The shared visuals system (see its README)
    film/                 The film: server-rendered player and scene list, lazily loaded controller
    ask/                  The ⌘K palette (loaded on intent) and the buttons that open it
    ui/                   Small shared primitives
  lib/
    ask/                  Server-only: system prompt, visitor cookie, rate limits, Anthropic client
    ask-client/           Browser client for /api/ask
    ask-contract.ts       Limits, types and error codes shared by both sides
    tokens.ts             Colour tokens for next/og images, the theme colour and the manifest
    structured-data.ts    JSON-LD for the home page and /profile.json
  test/                   Shared test helpers (browser API fakes)
instrumentation-client.ts Vercel BotID's client setup
tests/e2e/                Playwright specs
docs/architecture.md      Decisions, load order, security model, API contract
scripts/screenshot.mjs    Capture a page for visual review
.github/                  CI workflow, shared setup action, Dependabot
```

## Local development

Requires Node 24 or later and pnpm 10. The pnpm version is pinned in `package.json`, so Corepack
selects it automatically.

```sh
corepack enable
pnpm install
pnpm dev            # http://localhost:3000
```

The site works with no environment variables. Live answers stay off until they are configured,
and the palette answers from its curated notes.

| Script                         | What it does                                          |
| ------------------------------ | ----------------------------------------------------- |
| `pnpm dev`                     | Development server                                    |
| `pnpm build` / `pnpm start`    | Production build / serve it                           |
| `pnpm typecheck`               | Generate route types, then `tsc --noEmit`             |
| `pnpm lint`                    | ESLint (Next.js core-web-vitals + TypeScript rules)   |
| `pnpm format` / `format:check` | Prettier, with Tailwind class sorting                 |
| `pnpm test` / `test:watch`     | Vitest unit tests                                     |
| `pnpm test:e2e`                | Playwright against a production build (see below)     |
| `pnpm check`                   | Typecheck, lint, format check and unit tests together |

## Environment variables

All are server-only. See [`.env.example`](.env.example). For local live answers, copy it to
`.env.local`.

| Variable                               | Purpose                                                                                                                                                                     |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ANTHROPIC_API_KEY`                    | Key for live answers; the visitor-cookie and network-hash keys are derived from it. In Vercel, mark it **Sensitive**. Never prefix it with `NEXT_PUBLIC_`.                  |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | Upstash Redis, added by the Vercel Marketplace integration (`UPSTASH_REDIS_REST_*` also work). Backs the rate limits and the kill switch. Without it, live answers are off. |
| `ASK_ENABLED`                          | Optional. Unset, `true`, `1` or `on` leaves live answers on; any other value turns them off from the next deployment. `SET ask:disabled 1` in Redis works at once.          |

Live answers need both the key and Redis. Without either, the site runs in curated mode.

## Ask Steven: security model

The API key must never be exposed, and the cost of abuse must stay bounded even if every in-app
control fails. The full model and the `/api/ask` contract are in
[`docs/architecture.md`](docs/architecture.md#ask-steven-security-model).

1. **The key is server-only.** It lives in a Sensitive Vercel environment variable and is read by
   modules that import `server-only`, so a client import fails the build. It is never logged or
   sent to the browser.
2. **A spend cap is the backstop.** The key belongs to a dedicated Anthropic Console workspace with
   a low monthly limit.
3. **Bots are filtered.** Vercel BotID verifies each request before any limit is checked or Claude
   is called, and fails closed: an error or a missing verdict gets a 503.
4. **Requests are checked.** Only POST spends anything, from this origin only, as JSON under
   16 KB, validated with zod: a question of up to 400 characters and up to 3 of the visitor's
   earlier questions. Earlier answers are never sent back.
5. **Visitors get a few questions.** 3 per visitor per 24 hours, keyed by a signed, HttpOnly
   first-party cookie, so people behind one network each get their own. A looser cap of 20 per
   network per 24 hours bounds cookie clearing, and a site-wide limit of 10 per minute and 150 per
   UTC day sits behind both. A request that is turned away costs nobody a question, and neither
   does a failure on Claude's side. Limits fail closed.
6. **Kill switches.** `ASK_ENABLED` or a Redis flag turns live answers off; so does spending the
   day's cap. The palette falls back to curated answers.
7. **Output is bounded.** Claude Haiku 5.5 at low effort, `max_tokens` 2048, a 25-second deadline,
   and answers rendered as plain text, never HTML.
8. **The prompt has no secrets.** The system prompt is built from the public profile and lives in
   [`src/lib/ask/prompt.ts`](src/lib/ask/prompt.ts).

**Cookies.** The site's code sets one first-party cookie, `__Host-ask`, and only when live answers
are configured. It holds a random id used only for the Ask allowance, with a signed hint of the
questions left, and lasts 2 days. The theme choice stays in `localStorage`. Vercel BotID's
challenge, which loads only when a question is sent to Claude, may store its own state.

The end-to-end suite guards this. It fails if any file under `.next/static`, or any page's HTML,
contains an Anthropic key, the SDK's API host, or the names of the server secrets. It checks that
`/api/ask` rejects cross-origin and malformed requests, sets no cookie while unconfigured, and that
a follow-up question carries earlier questions only, never answers.

## Testing and CI

**Unit tests** (Vitest, jsdom, Testing Library) live next to the code as `src/**/*.test.ts(x)`.
They run without the React Compiler: the installed `@vitejs/plugin-react` supports it only through
an optional peer that is not a dependency. Production builds use it.

**End-to-end tests** (Playwright, in [`tests/e2e`](tests/e2e)) run against the production server
on desktop Chrome and an emulated Pixel 7. They check that:

- the hero and every section render in the order of `sections`, and every in-page link resolves
- the skip link, the header links and the mobile Sections menu move keyboard focus into the target
- the theme toggle reports its state, and the choice persists across reloads with no flash
- ⌘K or Ctrl+K opens the palette as a dialog, and Escape closes it and returns focus
- the palette's code loads only on intent, and a failed load leaves the page up with a working
  Try again
- the palette's live, used-up, busy and curated states render as designed, against mocked and real
  `/api/ask` responses
- "Scene by scene" is a modal dialog, the film requests no video before Play, the metadata tour
  never moves the selected tab under keyboard focus, and the career roles are exclusive
  disclosures
- pages log no console errors; `/profile.json`, `/llms.txt`, robots, sitemap and the OG image
  respond with the right types; unknown routes return a `noindex` 404
- axe reports no serious or critical violations on `/` and `/colophon` in light and dark, on the
  open palette, and on each section while its scroll reveal is still moving
- the security guards described above hold, and the CSP includes `script-src-attr 'none'`

```sh
pnpm test:e2e                                   # builds, serves on :4328 (or reuses a running server)
PORT=4400 pnpm test:e2e                         # use another port
BASE_URL=https://<preview-url> pnpm test:e2e    # test a deployment instead of a local build
pnpm exec playwright show-report                # open the last HTML report
```

**Lighthouse CI** ([`lighthouserc.json`](lighthouserc.json)) audits `/` and `/colophon` on the
production server, with mobile emulation and simulated throttling, 3 runs per URL, asserting on
the median run. These floors fail the build:

| Assertion                          | Floor    |
| ---------------------------------- | -------- |
| Performance                        | ≥ 0.90   |
| Accessibility                      | 1        |
| Best practices                     | ≥ 0.95   |
| SEO                                | 1        |
| JavaScript transfer                | ≤ 180 KB |
| Total transfer                     | ≤ 600 KB |
| Media requests (video before Play) | 0        |

The performance floor sits below the local result on purpose. GitHub's runners measure the home
page at 0.91–0.93 where a local build measures 0.95: simulated throttling charges the async
framework scripts to LCP when they finish before the first paint, and slower runners pay more
for them. Cutting initial JavaScript is the way to raise it back.

The targets above the floors are 100 in every category, CLS 0 and total blocking time under
100 ms. Last measured on 2026-10-30 with Lighthouse 12.6.1, running `lhci collect` and
`lhci assert` with this config (emulated mobile, simulated throttling, median of 3 runs) against a
local production build. Every assertion passed:

| Page        | Performance | Accessibility | Best practices | SEO | LCP    | TBT   | CLS | JavaScript | Total     |
| ----------- | ----------- | ------------- | -------------- | --- | ------ | ----- | --- | ---------- | --------- |
| `/`         | 95          | 100           | 100            | 100 | 2.93 s | 21 ms | 0   | 162,659 B  | 290,418 B |
| `/colophon` | 98          | 100           | 100            | 100 | 2.48 s | 10 ms | 0   | 155,448 B  | 248,570 B |

The home page's LCP element is the hero's headline paragraph, and its performance score sits on
the floor. On the same day, Lighthouse's desktop preset scored both pages 100 in every category.
To run Lighthouse locally after a build: `pnpm exec lhci collect && pnpm exec lhci assert`.

**GitHub Actions** ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) runs on pushes to
`main` and on every pull request, in two parallel jobs:

- `checks`: typecheck, lint, format check, unit tests
- `browser`: build, Playwright end-to-end tests (the report is uploaded on failure), then
  Lighthouse CI against the same build (reports uploaded to temporary public storage)

Both jobs use Node 24, pnpm from `packageManager` and a frozen lockfile. The workflow has
read-only permissions, does not persist checkout credentials, and cancels superseded runs. Every
action is pinned to a full commit SHA. CI never calls Anthropic: no key is configured and
`ASK_ENABLED` is `false`. Dependabot proposes grouped npm updates weekly and GitHub Actions
updates monthly.

## Deployment

Vercel deploys from Git. `main` is production at
[stevenvaughanbooth.com](https://stevenvaughanbooth.com), and every other branch and pull request
gets a preview deployment. Environment variables are set in the Vercel project settings, with
`ANTHROPIC_API_KEY` marked Sensitive. Pages are prerendered, so serving them takes no server work;
`/api/ask` runs on demand.

## License

The source code is [MIT licensed](LICENSE). The written content, the headshot, the film and the
logos are not covered: they are © Steven Booth, all rights reserved, and the Salesforce logo
belongs to Salesforce, Inc. See [LICENSE](LICENSE) for details.

# Architecture

This document records the decisions behind the site and the constraints every part of it follows.
Where it states a limit, a header or a load order, the code it names is the source of truth.

## Goals

1. **Fast for the first visitor.** Content first, statically prerendered, no gate in front of the
   work. The targets and the floors CI enforces are under [Performance](#performance).
2. **Clear in 30 seconds.** Who Steven is, what he builds, proof of impact, and how to reach him,
   before anything decorative.
3. **The repository is a work sample.** Typed content, a small client surface, tests, CI budgets
   and a documented security model.

## Stack

| Concern      | Choice                                                                  | Why                                                                                    |
| ------------ | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Framework    | Next.js 16 App Router, React 19                                         | Server Components ship no JavaScript for static content.                               |
| Rendering    | Static prerendering for every page; `/api/ask` runs on demand           | The site is content; the CDN serves HTML with no server work.                          |
| Language     | TypeScript, `strict`, `noUncheckedIndexedAccess`, `typedRoutes`         | Content, links between pages and the API contract are type-checked.                    |
| Styling      | Tailwind CSS v4 over CSS custom properties                              | Each colour is defined once with `light-dark()`; utilities are generated from use.     |
| Compiler     | React Compiler (`reactCompiler: true`)                                  | Memoizes client components automatically, with no hand-written `useMemo`.              |
| Fonts        | `next/font` (DM Sans variable, IBM Plex Mono 500)                       | Self-hosted from this origin, subset, preloaded, with metric-matched fallbacks.        |
| Images       | `next/image`'s `getImageProps()` in Server Components                   | AVIF/WebP `srcset` as a plain `<img>`; no image component in client JavaScript.        |
| Live answers | Route Handler → Anthropic Messages API, `claude-haiku-5-5`, streaming   | The key stays server-side; see [Ask Steven](#ask-steven-security-model).               |
| Abuse limits | Upstash Redis (`@upstash/ratelimit`) and Vercel BotID                   | Per-visitor, per-network, per-minute and per-day limits; bot filtering.                |
| Tests        | Vitest + Testing Library; Playwright + axe-core; Lighthouse CI          | Unit logic, end-to-end flows on desktop and mobile, accessibility, performance floors. |
| CI           | GitHub Actions, every action pinned to a commit SHA                     | Typecheck, lint, format, unit, build, end-to-end and Lighthouse on every pull request. |
| Hosting      | Vercel, with Speed Insights (bundled only in builds that run on Vercel) | Preview deployments per branch; production from `main`.                                |

## Structure

```
src/
  app/                    Routes and metadata: /, /colophon, /api/ask, /profile.json, /llms.txt,
                          Open Graph and icon images, sitemap, robots, manifest, error and 404 pages
  assets/                 Headshot, Salesforce logo, TTF fonts for the next/og images
  content/
    profile.ts            Single source of truth for every fact on the site, including `sections`
    answers.ts            The palette's curated answers and question matcher, built from profile.ts
  components/
    sections/             Server Components, one per page section
    visuals/              Server-rendered diagrams; each controller loads as its card nears view
      shared/             The shared visuals system (see its README)
    film/                 The film: server-rendered player and scene list, lazily loaded controller
    ask/                  The ⌘K palette (loaded on intent) and the buttons that open it
    ui/                   Small shared primitives: icons, headings, copy button, error notice
  lib/
    ask/                  Server-only: system prompt, visitor cookie, rate limits, Anthropic client
    ask-client/           Browser client for /api/ask
    ask-contract.ts       Limits, types and error codes shared by both sides
    tokens.ts             Colour tokens for next/og images, the theme colour and the manifest
    structured-data.ts    JSON-LD for the home page and /profile.json
  test/                   Shared test helpers (browser API fakes)
instrumentation-client.ts Vercel BotID's client setup for POST /api/ask
tests/e2e/                Playwright specs
```

**Rules of the road**

- Server Components by default. `'use client'` only on interactive leaves, and the code they need
  later loads later.
- Every fact comes from `src/content/profile.ts`. The page, the curated answers, the Claude system
  prompt, JSON-LD, `/profile.json` and `/llms.txt` all read it; no component hard-codes a career
  claim.
- No new runtime dependency without a clear reason; prefer the platform (CSS, SVG, Web APIs).
- Every interaction works with a keyboard, has a visible focus state, and respects
  `prefers-reduced-motion`. Every visual works at 360 px wide and in both themes.

## Rendering and loading

Every page is prerendered at build time. Sections, the header, the footer and the colophon are
Server Components; the career timeline is server-only too, built on native `<details name>`
disclosures. These modules are the whole `'use client'` surface:

| Module                                                                                     | Its job                                                         | When its code loads                                                                                                 |
| ------------------------------------------------------------------------------------------ | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `theme-toggle.tsx`                                                                         | Switches theme, exposes `aria-pressed`                          | With the page                                                                                                       |
| `mobile-nav.tsx`                                                                           | Sections menu (Popover API); moves focus to the section heading | With the page                                                                                                       |
| `ui/copy-button.tsx`                                                                       | Copies Adage's install command                                  | With the page                                                                                                       |
| `ask/ask-button.tsx`, `ask/ask-shortcut.tsx`                                               | Ask buttons; the ⌘K or Ctrl K hint                              | With the page                                                                                                       |
| `ask/palette-loader.tsx`                                                                   | ⌘K listener, error boundary, the palette's live region          | With the page (root layout)                                                                                         |
| `visuals/{team-multiplier,progressive-disclosure,metadata-platform,reflex-demo}/shell.tsx` | Show the server-rendered card, then swap in its controller      | Shell with the page; controller when the card is within 200 px of the viewport, or on first focus or pointer inside |
| `film/film-shell.tsx`                                                                      | The same for the film player, remembering an early Play         | As for the diagrams                                                                                                 |
| `film/scenes-dialog.tsx`                                                                   | Opens the "Scene by scene" list as a modal `<dialog>`           | With the page                                                                                                       |
| `app/error.tsx`, `app/global-error.tsx`                                                    | Error boundaries (themed, with a retry)                         | With the page                                                                                                       |

The palette itself (`ask-palette.tsx` with `use-ask`, `conversation`, `search` and
`lib/ask-client`) is client code only by reachability: `palette-loader.tsx` imports it
dynamically on intent, meaning a hover, focus or press of any Ask button, or ⌘K / Ctrl+K. Nothing
fetches it at idle. If the chunk fails to load or the palette throws, the loader's boundary keeps
the page up and shows "Ask Steven couldn’t load." with Try again and Email Steven.

The diagrams follow one pattern, documented in
[`src/components/visuals/shared/README.md`](../src/components/visuals/shared/README.md): the SVG,
copy and static controls render on the server, the `'use client'` shell shows them, and a
`React.lazy` controller adds behaviour. If a controller's chunk fails or throws, the static card
stays. The film's `<video>` has no `src` and `preload="none"` until Play.

`instrumentation-client.ts` runs on every page to set up Vercel BotID. It patches `fetch` so that a
POST to `/api/ask` carries BotID's challenge; the challenge script loads with that first request.

## UX

A single page, in the order of `sections` in `profile.ts`, after the hero:

1. **Hero:** name, role, one-line positioning, portrait, primary actions (Email, Ask, GitHub,
   LinkedIn), and a proof strip from `highlights`: Top 1% (FY24 President's Award), Principal,
   MCP tools, Adage.
2. **Open source: Adage.** The flagship side project, with a replay of a reflex in a terminal and
   its evidence quoted with the caveats.
3. **Work:** three themes (team multiplier, agent interfaces, Core Metadata Platform), each with an
   interactive diagram and an "Ask about this" button.
4. **Film:** _Arrival_, inline and click-to-play, with a "Scene by scene" text alternative.
5. **Experience:** career timeline, recognition (anchored at `#recognition`), builder note and
   education.
6. **Contact:** email first, then LinkedIn, GitHub and Ask.

**Ask Steven** is a ⌘K command palette on every page. It searches sections and links and answers
preset topics instantly from curated notes. When live answers are on, other questions go to
Claude, within a small per-visitor allowance; when they are off, or the allowance is used, the
palette answers from the curated notes and points to email.

**Motion.** Sections rise into place with a scroll-driven CSS animation that moves them and never
changes their opacity. The theme switch uses a View Transition. The two guided tours (team
multiplier, metadata platform) play once, count down only while on screen, hold on hover and
focus, and stop for good when a visitor picks a step or focuses a tab. The Adage replay plays once
as the terminal scrolls into view. Under `prefers-reduced-motion` none of these run; the tours and
the replay show their finished state.

## Ask Steven: security model

The Anthropic API key must never be exposed, and the cost of abuse must stay bounded even if every
in-app control fails. Limits, types and error codes live in
[`src/lib/ask-contract.ts`](../src/lib/ask-contract.ts) and
[`src/lib/ask/rate-limit.ts`](../src/lib/ask/rate-limit.ts).

1. **The key is server-only.** It lives in a Vercel environment variable marked Sensitive and is
   read at request time by modules that import `server-only`, so a client import fails the build.
   It is never logged (errors are logged as fixed labels) and never sent to the browser. The
   Anthropic client's base URL is pinned, so no environment variable can send the key elsewhere.
2. **A spend cap is the backstop.** The key belongs to a dedicated Anthropic Console workspace with
   a low monthly spend limit.
3. **Bot filtering.** Vercel BotID verifies each POST before any limit is checked or Claude is
   called. Only a definite verdict passes: if the check errors or returns no `isBot` verdict, the
   request gets a 503 (fail closed); bots and verified bots get a 403.
4. **Request hygiene.** Only POST can spend anything. It must come from this origin (`Origin`
   matches `Host`, and `Sec-Fetch-Site`, when sent, is `same-origin`), be JSON, and stay under
   16 KB, enforced while the body is read. A zod schema built from the shared contract checks the
   question (1–400 characters after trimming) and the history (at most 3 of the visitor's earlier
   questions, each 1–400 characters). Earlier answers are never sent back, because the server
   could not trust them.
5. **Rate limits (Upstash Redis).** Each browser gets a random visitor id in a signed, HttpOnly
   first-party cookie (see [Cookie](#cookie)), and the allowance of 3 questions per 24 hours
   (sliding window) is keyed on it, so people behind one NAT each get their own. A looser cap of
   20 per 24 hours per network (an IPv4 address or an IPv6 /64, keyed by HMAC so Redis never holds
   an address or a reversible hash of one) bounds cookie clearing. Behind those sit a site-wide
   burst limit of 10 per minute and a cap of 150 per UTC day. The kill switch and both site-wide
   limits are checked read-only first; the visitor's and the network's units are spent next; the
   site-wide units are spent last, and anything spent is given back if a later check rejects, so a
   request that does not go ahead costs no one anything. If Claude fails before answering (502),
   the visitor, network and daily units are returned and the burst unit is kept; a visitor who
   disconnects is not refunded. Limits fail closed: without Redis, or on a Redis error or
   timeout, live answers are off.
6. **Kill switches.** `ASK_ENABLED` set to anything but `true`, `1` or `on` turns live answers off
   from the next deployment. `SET ask:disabled 1` in Redis turns them off at once (POST answers
   503); `DEL ask:disabled` turns them back on. Spending the day's 150 questions also turns them off
   until 00:00 UTC. In every case the palette falls back to curated answers.
7. **Bounded output.** `claude-haiku-5-5` with adaptive thinking at low effort, `max_tokens` 2048
   (thinking included), and a 25-second deadline inside the route's 30-second limit. The system
   prompt is cached. The answer streams as plain text and the palette renders it as text, never
   HTML. Haiku 5.5 has no server-side refusal fallback, so when an answer stops with
   `stop_reason: refusal`, the route ends it with a fixed note that points to email.
8. **No secrets in the prompt.** The system prompt
   ([`src/lib/ask/prompt.ts`](../src/lib/ask/prompt.ts)) is built only from `profile.ts` and is
   public. It treats every message as a visitor's question, declines private topics, and says
   where its own source is when asked. Prompt injection can at worst produce an off-topic answer
   in the attacker's own session.

### Cookie

The site's code sets one cookie, and only when live answers are configured: `__Host-ask` (plain
`ask` under `next dev`), from `GET /api/ask` (sent when the palette opens) or `POST /api/ask`. It
is HttpOnly, Secure (except under `next dev`), `SameSite=Lax`, `Path=/`, and lasts 2 days. It holds
a random 16-byte id, a hint of the questions left and the hint's issue time, signed with
HMAC-SHA256. The signing key, and the key for network hashes, are derived from
`ANTHROPIC_API_KEY` with HKDF-SHA256, so there is no extra secret; rotating the API key
invalidates every cookie and network key and gives everyone a fresh allowance. The theme choice is
kept in `localStorage`, not a cookie. Vercel BotID's challenge, which loads only when a question is
sent to Claude, is Vercel's code and may store its own state.

### `/api/ask` contract

`GET /api/ask` returns `{ enabled: boolean, limit: number, remaining: number }` with
`Cache-Control: no-store`. It never touches Redis: `enabled` comes from configuration, and
`remaining` from the signed hint in the visitor cookie, which GET sets or refreshes. A hint older
than 24 hours reads as the full allowance. The number is for display only; POST decides. Without
configuration the response is `{ enabled: false, limit: 3, remaining: 0 }` and sets no cookie.

`POST /api/ask` takes JSON `{ question: string, history?: string[] }` (limits in item 4 above).
Claude receives one user turn: the question, preceded, when there is history, by the earlier
questions under "Earlier questions from this visitor, for context only:".

| Status | Body                                                                         | Meaning                                                                                                     |
| ------ | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| 200    | `text/plain` stream of answer text; headers `X-Ask-Remaining`, `X-Ask-Limit` | Answer streaming. A stream that fails midway ends with a note saying the answer was cut short.              |
| 400    | `{ error: 'invalid_request' }`                                               | Not JSON, over 16 KB, or failed validation                                                                  |
| 403    | `{ error: 'forbidden' }`                                                     | Cross-origin, or BotID reports a bot or a verified bot                                                      |
| 429    | `{ error: 'limit_reached', remaining: 0 }`, header `X-Ask-Remaining: 0`      | The visitor or their network has used its questions; the palette points to email                            |
| 429    | `{ error: 'busy' }` + `Retry-After`                                          | The one-minute site-wide burst limit                                                                        |
| 503    | `{ error: 'unavailable' }`                                                   | Not configured, switched off, BotID unavailable or without a verdict, Redis failure, or the day's cap spent |
| 502    | `{ error: 'upstream' }`                                                      | Claude failed before answering; the question is not counted; the palette offers curated answers             |

## Security headers

[`next.config.ts`](../next.config.ts) sends, on every route: a Content Security Policy,
`Strict-Transport-Security` (two years, subdomains included), `X-Content-Type-Options: nosniff`,
`Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY`,
`Cross-Origin-Opener-Policy: same-origin`, and a Permissions Policy that turns off camera,
microphone, geolocation and Topics.

The CSP allows resources from this origin only (`default-src 'self'`, `connect-src 'self'`,
`object-src 'none'`, `frame-ancestors 'none'`, `base-uri 'self'`, `form-action 'self'`, plus
`upgrade-insecure-requests`). `script-src` includes `'unsafe-inline'`: Next.js streams the RSC
payload through inline scripts, the theme is applied by an inline script before first paint, and
no nonce is used, because a nonce would make every page dynamic. An injected `<script>` element is
therefore not blocked by the CSP. `script-src-attr 'none'` does block inline event-handler
attributes (`onerror=`, `onclick=`); React attaches handlers in JavaScript. `style-src` allows
inline styles for React `style` attributes. Development adds `'unsafe-eval'`; preview deployments
add the Vercel Toolbar's origins. BotID's own header rule lets its challenge path be framed by this
origin.

## Performance

**Targets** (design goals, not enforced): Lighthouse 100 in every category on mobile, CLS 0 and
total blocking time under 100 ms.

**Floors** (enforced: [`lighthouserc.json`](../lighthouserc.json) fails CI). Lighthouse audits `/`
and `/colophon` on the production build, with mobile emulation and simulated throttling, 3 runs per
URL, asserting on the median run:

| Assertion                          | Floor    |
| ---------------------------------- | -------- |
| Performance                        | ≥ 0.95   |
| Accessibility                      | 1        |
| Best practices                     | ≥ 0.95   |
| SEO                                | 1        |
| JavaScript transfer                | ≤ 180 KB |
| Total transfer                     | ≤ 600 KB |
| Media requests (video before Play) | 0        |

**Measured** on 2026-10-30 with Lighthouse 12.6.1, using `lhci collect` and `lhci assert` with the
repository's `lighthouserc.json` (emulated mobile, simulated throttling, 3 runs per page, median
shown) against a local production build. Every assertion passed.

| Page        | Performance | Accessibility | Best practices | SEO | FCP    | LCP    | TBT   | CLS | JavaScript | Total     |
| ----------- | ----------- | ------------- | -------------- | --- | ------ | ------ | ----- | --- | ---------- | --------- |
| `/`         | 95          | 100           | 100            | 100 | 1.21 s | 2.93 s | 21 ms | 0   | 162,659 B  | 290,418 B |
| `/colophon` | 98          | 100           | 100            | 100 | 0.91 s | 2.48 s | 10 ms | 0   | 155,448 B  | 248,570 B |

On both pages the largest contentful paint is a text paragraph (on `/`, the hero's headline), and
most of it is render delay in Lighthouse's simulation: 2.48 s of the home page's 2.93 s. The home
page's performance score sits exactly on its floor. With Lighthouse's desktop preset (same day, 3
runs per page), both pages score 100 in all four categories, with an LCP of 0.63 s on `/` (the
portrait) and 0.55 s on `/colophon`.

**Considered and not enabled:** `experimental.inlineCss`, measured the same way. It doubled the home
page's document transfer (48 KB to 94 KB) and more than doubled the colophon's (23 KB to 61 KB),
since every HTML response then carries its stylesheet inline. Home LCP improved (2.93 s to 2.79 s)
but the colophon's slowed (2.48 s to 2.78 s), and total transfer grew on both pages.

## Content

Copy is drawn from Steven's existing site, his career statements and the Adage README. Numbers keep
their caveats. Diagrams are conceptual, as the footer says.

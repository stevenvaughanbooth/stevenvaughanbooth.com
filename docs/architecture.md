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

| Concern      | Choice                                                                    | Why                                                                                    |
| ------------ | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Framework    | Next.js 16 App Router, React 19                                           | Server Components ship no JavaScript for static content.                               |
| Rendering    | Static prerendering for every page; `/api/ask` runs on demand             | The site is content; the CDN serves HTML with no server work.                          |
| Language     | TypeScript, `strict`, `noUncheckedIndexedAccess`, `typedRoutes`           | Content, links between pages and the API contract are type-checked.                    |
| Styling      | Tailwind CSS v4 over CSS custom properties                                | Each colour is defined once with `light-dark()`; utilities are generated from use.     |
| Compiler     | React Compiler (`reactCompiler: true`)                                    | Memoizes client components automatically, with no hand-written `useMemo`.              |
| Fonts        | `next/font` (DM Sans variable, IBM Plex Mono 500)                         | Self-hosted from this origin, subset, preloaded, with metric-matched fallbacks.        |
| Images       | `next/image`'s `getImageProps()` in Server Components                     | AVIF/WebP `srcset` as a plain `<img>`; no image component in client JavaScript.        |
| Live answers | Route Handler → Anthropic Messages API, `claude-haiku-5-5`, NDJSON stream | The key stays server-side; see [Ask Steven](#ask-steven-security-model).               |
| Abuse limits | Upstash Redis (`@upstash/ratelimit`) and Vercel BotID                     | Per-visitor, per-network, per-minute and per-day limits; bot filtering.                |
| Tests        | Vitest + Testing Library; Playwright + axe-core; Lighthouse CI            | Unit logic, end-to-end flows on desktop and mobile, accessibility, performance floors. |
| CI           | GitHub Actions, every action pinned to a commit SHA                       | Typecheck, lint, format, unit, build, end-to-end and Lighthouse on every pull request. |
| Hosting      | Vercel, with Speed Insights (bundled only in builds that run on Vercel)   | Preview deployments per branch; production from `main`.                                |

## Structure

```
src/
  app/                    Routes and metadata: /, /work/[slug], /colophon, /api/ask, /profile.json,
                          /llms.txt, Open Graph and icon images, sitemap, robots, manifest, error
                          and 404 pages
  assets/                 Headshot, Salesforce logo, TTF fonts for the next/og images
  content/
    profile.ts            Single source of truth for every fact on the site, including `sections`
    answers.ts            The palette's curated answers and question matcher, built from profile.ts
    case-studies.ts       The three case studies, from profile.ts and the diagrams' own step copy
    components.ts         Every component: kind, when its code loads, features and why
  components/
    sections/             Server Components, one per page section
    visuals/              Server-rendered diagrams; each controller loads as its card nears view
      shared/             The shared visuals system (see its README)
    film/                 Arrival: the hero's frame and theater, the 4:5 and 16:9 players, scene list
    ask/                  The ⌘K palette (loaded on intent), the hero's ask bar, the Ask buttons
    case-study/           The case-study page, its shared-element morph and focus helper
    signal/               The signal line and its nodes (CSS only)
    shortcuts/            The / T X ? listener and the shortcuts sheet (loaded on demand)
    xray/                 X-ray mode: the toggle, the peel, the blueprint labels and the stats (on intent)
    story/                Under the hood: the component map, the React ideas, the measured results
    ui/                   Small shared primitives: icons, headings, copy button, error notice
  lib/
    ask/                  Server-only: system prompt, visitor cookie, rate limits, Anthropic client
    ask-client/           Browser client for /api/ask
    ask-contract.ts       Limits, types and error codes shared by both sides
    page-targets.ts       The allowlist of places an answer may show (pure; server and browser)
    page-actions.ts       Scrolls to, focuses and marks a place (browser; loaded with the palette)
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

Every page is prerendered at build time. Sections, the header (with its Sections menu, a Popover API popover), the footer, the case studies and
Under the hood are Server Components; the signal line is CSS only; the career timeline is server-only
too, built on native `<details name>` disclosures. These modules are the whole `'use client'`
surface:

| Module                                                                                     | Its job                                                                         | When its code loads                                                                                                 |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `theme-toggle.tsx`                                                                         | Switches theme, exposes `aria-pressed`                                          | With the page                                                                                                       |
| `mobile-nav.tsx`                                                                           | Moves focus to the section heading from the Sections menu                       | With the page                                                                                                       |
| `ui/copy-button.tsx`                                                                       | Copies Adage's install command                                                  | With the page                                                                                                       |
| `ask/ask-button.tsx`, `ask/ask-shortcut.tsx`                                               | Ask buttons; the ⌘K or Ctrl K hint                                              | With the page                                                                                                       |
| `ask/hero-ask-bar.tsx`                                                                     | The hero's ask bar and its suggestions; hands questions on                      | With the home page; it warms the palette's code on hover or focus                                                   |
| `shortcuts/shortcuts.tsx`                                                                  | The `/`, `T`, `X` and `?` listener, the footer's sheet button, and X-ray's host | With the page; the sheet on `?`, or on hover, focus or press of the footer button; X-ray on intent                  |
| `ask/palette-loader.tsx`                                                                   | ⌘K listener, error boundary, the palette's live region                          | With the page (root layout)                                                                                         |
| `visuals/{team-multiplier,progressive-disclosure,metadata-platform,reflex-demo}/shell.tsx` | Show the server-rendered card, then swap in its controller                      | Shell with the page; controller when the card is within 200 px of the viewport, or on first focus or pointer inside |
| `film/arrival-shell.tsx`                                                                   | The hero's film frame: its chip, autoplay policy and theater                    | With the page                                                                                                       |
| `case-study/focus.tsx`                                                                     | Focus on arrival, and back on the link after Back                               | With the case-study pages only                                                                                      |
| `app/error.tsx`, `app/global-error.tsx`                                                    | Error boundaries (themed, with a retry)                                         | With the page                                                                                                       |

The palette itself (`ask-palette.tsx` with `use-ask`, `conversation`, `search`, `lib/ask-client` and
`lib/page-actions`) is client code only by reachability: `palette-loader.tsx` imports it dynamically
on intent, meaning a hover, focus or use of the hero's ask bar or any Ask button, ⌘K / Ctrl+K, or
`/` once the bar is out of view. Nothing fetches it at idle. If the chunk fails to load or the
palette throws, the loader's boundary keeps the page up and shows "Ask Steven couldn’t load." with
Try again and Email Steven.

**X-ray mode** peels the page back into a blueprint of its components. The header's "Under the
hood" button (a Server Component), the `X` key or any `<button data-xray-toggle>` turns it on; the
always-loaded part is a few listeners in `shortcuts.tsx` and a small INP recorder, and
`xray/xray.tsx` with its stylesheet downloads on hover, focus or press of a toggle, or on `X`. The
peel is one typed view transition: the old page is clipped along a 45° fold that sweeps from the
top-right corner while a shaded flap folds back over it; under reduced motion it switches at once.
Every element with `data-component` is outlined and labelled from `components.ts`, and a HUD shows
this visit's FCP, LCP, CLS and INP, the JavaScript transferred, and the build's measured results.

[`src/content/components.ts`](../src/content/components.ts) describes each of these components and
the server ones around them: its kind, when its code loads, the React and platform features it
relies on, and why it is built that way. Under the hood (`/colophon`) renders it as a map, and a
unit test checks each entry's kind against its file, so the list cannot claim a client component
is server-rendered.

The diagrams follow one pattern, documented in
[`src/components/visuals/shared/README.md`](../src/components/visuals/shared/README.md): the SVG,
copy and static controls render on the server, the `'use client'` shell shows them, and a
`React.lazy` controller adds behaviour. If a controller's chunk fails or throws, the static card
stays.

The film, _Arrival_, opens the hero inside the portrait frame, and is built so it can never delay
the portrait. Its server component renders the frame around the headshot, which paints first and is
the desktop LCP element, and the theater's title, notes and "Scene by scene" text alternative, all
in the HTML. `arrival-shell.tsx` adds two pieces of client code, each by reachability only:

- `frame-film.tsx`, the 4:5 cut (576×720, 451 KB AV1 or 715 KB H.264), loads after the load
  event and an idle period, and only if the frame is at least `md` wide (below it the portrait is
  an 88 px avatar) and 60% on screen, motion is welcome, Save-Data and `prefers-reduced-data` are
  off, the connection is not 2G, and it has not played this visit (`sessionStorage`). It plays
  once, muted, fades in on its first frame, pauses while scrolled away, has a pause control (WCAG
  2.2.2), and fades out onto the portrait. Its pause control hands focus to the chip as it goes.
- `film-controller.tsx`, the theater's player for the full 16:9 film with its end plate, poster
  placeholder and error boundary, downloads when a pointer or focus reaches the chip. Pressing it opens a modal `<dialog>` in a transition: React's
  `<ViewTransition>` pairs the frame (hidden with `<Activity>`) with the theater's screen, so the
  frame morphs into the theater, and Escape, Close or the end plate's last line morph it back and
  return focus to the chip. Under reduced motion the theater opens and closes without the morph.

No video element has a source until one of these asks for it.

The case studies (`/work/[slug]`, prerendered with `generateStaticParams`) repeat their theme's
kicker, title, lede and diagram from the Work section, in identical markup
(`case-study/theme-intro.tsx`, `theme-visual.tsx`). Each sits in a React `<ViewTransition>` with a
shared name (`work-<id>-kicker/title/lede/visual`), so a navigation between the two glides each
part into place while the rest fades through; the pager tags its links with a transition type so
a card title hands over to the next heading. The browser's Back and Forward swap instantly: React
renders history traversals synchronously, and a synchronous update starts no view transition.
`case-study/focus.tsx` moves focus to the h1 on a client navigation and back to the theme's link
on return. The fixed header has a view-transition name of its own (except in the theme reveal and
the film's theater, which animate the page as a whole), so no transition draws over it.

`instrumentation-client.ts` runs on every page to set up Vercel BotID. It patches `fetch` so that a
POST to `/api/ask` carries BotID's challenge; the challenge script loads with that first request.

## UX

The home page, in the order of `sections` in `profile.ts`, after the hero; then a case study per
Work theme at `/work/<theme>`, and Under the hood at `/colophon`:

1. **Hero:** name, role, one-line positioning, the Ask bar with three suggested questions, the
   contact links (Email, GitHub, LinkedIn), the portrait, and a proof strip from `highlights`
   across both columns: Top 1% (FY24 President's Award), Principal, MCP tools, Adage. The portrait
   frame opens with _Arrival_, a 16-second film that lands on the portrait, and its chip replays
   the film in a theater with a "Scene by scene" text alternative.
2. **Open source: Adage.** The flagship side project, with a replay of a reflex in a terminal and
   its evidence quoted with the caveats.
3. **Work:** three themes (team multiplier, agent interfaces, Core Metadata Platform), each with an
   interactive diagram, a "Read the case study" link and an "Ask about this" button.
4. **Experience:** career timeline, recognition (anchored at `#recognition`), builder note and
   education.
5. **Contact:** email first, then LinkedIn, GitHub and Ask.

**Ask Steven** is a ⌘K command palette on every page, which the hero's ask bar also opens. It
searches sections and links and answers preset topics instantly from curated notes. When live
answers are on, other questions go to Claude, within a small per-visitor allowance; when they are
off, or the allowance is used, the palette answers from the curated notes and points to email.
An answer can show its place on the site: a curated answer offers "Show me…" buttons, and a
request like "take me to his awards" moves at once. Places come only from the allowlist in
`lib/page-targets.ts` (sections, Work themes, career roles, `#recognition`, the case studies);
the page scrolls under the header, focus moves to the place's heading (a role's summary, opened),
and an accent ring marks it once.

**Keyboard.** `/` types a question (it focuses the ask bar while the bar is in view, and opens
Ask Steven elsewhere), `T` switches the theme and `?` opens a sheet that lists every shortcut.
None fires while typing, with a modifier held or behind another dialog, and the sheet's switch
turns the single-key ones off (WCAG 2.1.4); the footer's "Keyboard shortcuts" button still opens
it.

**Motion.** Sections rise into place with a scroll-driven CSS animation that moves them and never
changes their opacity. A green signal line, placed with CSS anchor positioning between the hero's
status dot and the email address and drawn by scroll-driven animations, runs down the gutter from
`md` up; a node at each section label lights as the line reaches it, and at Contact it turns into
the envelope and underlines the address (below `md`, each label's node lights on its own). The
header marks the section being read with view timelines, and Adage's figures count up once with a
scroll-triggered animation. The theme switch reveals the new theme in a circle growing from the
toggle (a View Transition of type `theme`), and the Work themes morph into their case studies. The
hero's film plays once in the portrait frame, with a pause control, and its theater morphs from the
frame with React's `<ViewTransition>`. The two guided tours (team multiplier, metadata platform)
play once, count down only while on screen, hold on hover and focus, and stop for good when a
visitor picks a step or focuses a tab. The Adage replay plays once as the terminal scrolls into
view. Under `prefers-reduced-motion` none of these run; the film stays on the portrait until asked,
the theater and the case studies open without the morph, the signal line is drawn in full, the
figures show their value, and the tours and the replay show their finished state. Tours also hold
while a modal dialog covers the page.

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
   prompt is cached. The answer streams as text events and the palette renders it as text, never
   HTML. Haiku 5.5 has no server-side refusal fallback, so when an answer stops with
   `stop_reason: refusal`, the route ends it with a fixed note that points to email. Claude has one
   tool, `show_on_page`, whose only input is an enum of the page-target allowlist
   ([`src/lib/page-targets.ts`](../src/lib/page-targets.ts)): strict, at most one call, and no
   tool_result is sent back, so there is no second request. The route parses the input strictly
   and checks it against the allowlist before forwarding it, only when the turn ended normally;
   the browser checks again. The page moves by itself only when the visitor asked to be shown
   something.
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
invalidates every cookie and network key and gives everyone a fresh allowance. The theme choice and
whether single-key shortcuts are off are kept in `localStorage`, not a cookie, and whether the
hero's film has played this visit in `sessionStorage`. Vercel BotID's challenge, which loads only
when a question is sent to Claude, is Vercel's code and may store its own state.

### `/api/ask` contract

`GET /api/ask` returns `{ enabled: boolean, limit: number, remaining: number }` with
`Cache-Control: no-store`. It never touches Redis: `enabled` comes from configuration, and
`remaining` from the signed hint in the visitor cookie, which GET sets or refreshes. A hint older
than 24 hours reads as the full allowance. The number is for display only; POST decides. Without
configuration the response is `{ enabled: false, limit: 3, remaining: 0 }` and sets no cookie.

`POST /api/ask` takes JSON `{ question: string, history?: string[] }` (limits in item 4 above).
Claude receives one user turn: the question, preceded, when there is history, by the earlier
questions under "Earlier questions from this visitor, for context only:".

| Status | Body                                                                    | Meaning                                                                                                     |
| ------ | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| 200    | `application/x-ndjson` stream; headers `X-Ask-Remaining`, `X-Ask-Limit` | Answer streaming. A stream that fails midway ends with a note saying the answer was cut short.              |
| 400    | `{ error: 'invalid_request' }`                                          | Not JSON, over 16 KB, or failed validation                                                                  |
| 403    | `{ error: 'forbidden' }`                                                | Cross-origin, or BotID reports a bot or a verified bot                                                      |
| 429    | `{ error: 'limit_reached', remaining: 0 }`, header `X-Ask-Remaining: 0` | The visitor or their network has used its questions; the palette points to email                            |
| 429    | `{ error: 'busy' }` + `Retry-After`                                     | The one-minute site-wide burst limit                                                                        |
| 503    | `{ error: 'unavailable' }`                                              | Not configured, switched off, BotID unavailable or without a verdict, Redis failure, or the day's cap spent |
| 502    | `{ error: 'upstream' }`                                                 | Claude failed before answering; the question is not counted; the palette offers curated answers             |

A 200 body carries one JSON event per line (`ANSWER_CONTENT_TYPE` in the contract): any number of `{
"type": "text", "text": "…" }` events, then at most one `{ "type": "action", "target": "<id>" }`
naming a page target. The browser client parses it line by line, skips unknown event types, checks
the target against the allowlist again, and still reads a plain-text body. The route sends NDJSON only
when the request's `Accept` includes `application/x-ndjson`. Any other request gets the answer's text
alone as `text/plain; charset=utf-8`, with no action, for tabs still running the earlier client.

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

**Floors** (enforced: [`lighthouserc.json`](../lighthouserc.json) fails CI). Lighthouse audits `/`,
`/colophon` and `/work/mcp` on the production build, with mobile emulation and simulated throttling,
3 runs per URL, asserting on the median run:

| Assertion               | Floor    |
| ----------------------- | -------- |
| Performance             | ≥ 0.90   |
| Accessibility           | 1        |
| Best practices          | ≥ 0.95   |
| SEO                     | 1        |
| JavaScript transfer     | ≤ 180 KB |
| Total transfer          | ≤ 600 KB |
| Media requests (mobile) | 0        |

The media floor states a design rule: on a phone the portrait is an 88 px avatar, so the film
never plays by itself there, and no video downloads until the visitor presses Play. Mobile
emulation does not see the wider frame, which plays its 451 KB 4:5 cut after the load event and an
idle period (see [Rendering and loading](#rendering-and-loading)). That behaviour is guarded by the
end-to-end suite instead: the film starts after the load event, the portrait is the LCP element,
and nothing plays under reduced motion, with Save-Data or below `md`. With Lighthouse's desktop
preset (2026-10-30, 3 runs) the home page scores 100 in all four categories, with the portrait as
LCP at 0.66 s and the cut counted in its total transfer.

The performance floor sits below the local result on purpose. GitHub's runners measured the home
page at 0.91–0.93 when a local build measured 0.95: simulated throttling charges the async
framework scripts to LCP when they finish before the first paint, and slower runners pay more
for them. Cutting initial JavaScript is the way to raise it back.

**Measured** on 2026-10-30 with Lighthouse 12.6.1, using `lhci collect` and `lhci assert` with the
repository's `lighthouserc.json` (emulated mobile, simulated throttling, 3 runs per page, median
shown) against a local production build. Every assertion passed.

| Page        | Performance | Accessibility | Best practices | SEO | FCP    | LCP    | TBT   | CLS | JavaScript | Total     |
| ----------- | ----------- | ------------- | -------------- | --- | ------ | ------ | ----- | --- | ---------- | --------- |
| `/`         | 94          | 100           | 100            | 100 | 1.21 s | 3.08 s | 22 ms | 0   | 168,263 B  | 300,616 B |
| `/colophon` | 98          | 100           | 100            | 100 | 0.90 s | 2.48 s | 11 ms | 0   | 157,980 B  | 266,691 B |
| `/work/mcp` | 96          | 100           | 100            | 100 | 1.05 s | 2.78 s | 19 ms | 0   | 178,123 B  | 311,536 B |

On every page the largest contentful paint is a text paragraph (on `/`, the hero's tagline), and
most of it is render delay in Lighthouse's simulation. `/work/mcp` loads its diagram's controller
at once, because the diagram is in view, so it carries the most JavaScript. With Lighthouse's
desktop preset (same day), all three pages score 100 in all four categories, with an LCP of
0.68 s on `/` (the portrait), 0.59 s on `/colophon` and 0.58 s on `/work/mcp`.

**Why the home page measures 94, not 95.** Lighthouse's simulation counts a script against LCP
when it finished downloading and started running before the first paint in the unthrottled trace,
and the framework's async scripts always do. Each of the two app chunks (the layout's and the
page's, about 10 KB each) is then worth about 165 ms of simulated LCP: blocking either one in a
diagnostic run cuts LCP to 2.92 s, while blocking a 1–2 KB chunk changes nothing. This round's
hero ask bar, film frame and shortcuts grew those chunks by about 5.6 KB, from 16 KB to 21.6 KB
compressed. Measured and not kept: graph CSS chunking (it split the CSS into three files),
Turbopack's `priorityRoutes` chunking (no change), `content-visibility: auto` on the offscreen
sections (no change, and axe can no longer check contrast inside them), and deferring the ask bar
and film frame behind `lazy()` (95, but the prerendered HTML then holds those islands in
script-swapped templates, which breaks HTML first). What did help: the case-study morph CSS moved
into `globals.css` (one fewer stylesheet), and the signal line moved from the root layout to the
home page, which brought FCP on `/` back from 1.35 s to 1.21 s and the colophon back from 96 to 98.

**Considered and not enabled:** `experimental.inlineCss`, measured the same way. It doubled the home
page's document transfer (48 KB to 94 KB) and more than doubled the colophon's (23 KB to 61 KB),
since every HTML response then carries its stylesheet inline. Home LCP improved (2.93 s to 2.79 s)
but the colophon's slowed (2.48 s to 2.78 s), and total transfer grew on both pages. Re-measured
on 2026-10-30 with this round's features: `/` 95 (LCP 2.93 s), `/colophon` 95 (2.93 s, down from
98), `/work/mcp` 97 (2.63 s), each page about 34 KB heavier; still not enabled.

## Content

Copy is drawn from Steven's existing site, his career statements and the Adage README. Numbers keep
their caveats. Diagrams are conceptual, as the footer says.

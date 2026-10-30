# Visuals: the shared system

Every interactive diagram on the page is built from the pieces in this folder, so they look and
behave as one system and ship as little JavaScript as possible. TeamMultiplier and
ProgressiveDisclosure are the reference implementations; MetadataPlatform shows a visual with sub-steps.

## The pattern

```
team-multiplier.tsx            Server Component. Renders everything that never changes, once:
  ├─ diagram   <Network/>      the SVG, every state at once; CSS shows the current step
  ├─ copy      <StepCopy/>…    each step's text
  ├─ staticTabs, staticFooter  SegmentedTabs and StepControls without handlers
  └─ <TeamMultiplierShell/>    'use client': the only code in the initial page
       └─ <LazyVisual preload fallback={<View … static slots/>}>
            └─ <Controller/>   React.lazy chunk: state, live tabs and footer, the same View
```

- **Content crosses the server/client boundary once**, as props of the shell. Do not also pass a
  server-rendered copy of the whole card: Flight serializes each copy separately, and the HTML
  grows by the size of the card.
- **The View is presentational** (no hooks, no `'use client'`). The shell renders it with the
  static slots; the controller renders it with live tabs and controls. Same markup, so the swap
  is invisible and the card never changes height.
- **LazyVisual** downloads the controller when the card is within 200px of the viewport, or on
  the first focus or pointer inside it, then swaps it in with a transition: one DOM swap, focus
  kept. It adds a Suspense boundary only after the chunk has loaded (a boundary in the server
  render makes the prerender write the card twice). If the chunk fails or the controller throws,
  the static card stays.
- **The static card is meaningful on its own**: tours rest on their end state (the complete
  multiplier loop); steppers show their first step.

## Diagrams

- **One SVG, one geometry, rendered on the server.** No wide/narrow copies.
- **State through CSS.** StepPanel puts `data-step` on the diagram's stage. Each SVG part carries
  `data-at`, the step it appears at (and `data-passed` for siblings that are seen, then left). The
  diagram's CSS module lists, for its step count, which parts are pending and which are current,
  and sets custom properties (`--lit`, `--now`, `--stroke`, `--fill`, `--ink`, …) that the parts
  read. Transitions are Tailwind utilities on the parts. See `team-multiplier.module.css`.
- **Text never renders below 11px** (`--text-micro`). SVG text scales with the drawing, so set the
  font size on the `<svg>` in viewBox units and step it down with container queries as the card
  widens: `size ≥ 11 × viewBoxWidth / renderedWidth` at the narrowest width of each step. The
  stage is the card's content width minus 10px below `@sm` (24rem), minus 34px above it.
- **Tokens only**: `stroke-amber`, `fill-surface`, `var(--line-strong)`; no hex.
- The SVG is `aria-hidden`; the stage is `role="img"` with a per-step text alternative.

## Parts

| File                  | What it is                                                                                                                                                                                       |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `visual-frame.tsx`    | The card: accent dot, title, the one 'Illustrative' tag, body, optional footer row. Also the `@container` every query measures.                                                                  |
| `segmented-tabs.tsx`  | The tablist. Selected tab: accent border (≥3:1 against track and fill in both themes), surface fill, semibold; `Highlight` border under forced colours. Labels wrap; 4+ tabs go 2×2 below 18rem. |
| `step-panel.tsx`      | `StepPanel` (tabpanel and diagram stage), `StepStack` (all steps' content in one grid cell, so height never changes), `StepCopy`.                                                                |
| `step-controls.tsx`   | The footer row: status text left, one pill button right (h-8, text-xs, border-line, 14px icon).                                                                                                  |
| `icons.tsx`           | Play, Pause, Replay, Next (→, in-page only).                                                                                                                                                     |
| `lazy-visual.tsx`     | The loader described above.                                                                                                                                                                      |
| `roving-tabs.ts`      | `rovingIndex` and `onRovingKeyDown`: Left/Up and Right/Down step and wrap, Home/End jump. Every tablist uses it.                                                                                 |
| `hooks.ts`            | `useReducedMotion`, `usePageVisible`, `useInView`.                                                                                                                                               |
| `use-auto-advance.ts` | The guided tour.                                                                                                                                                                                 |
| `accent.ts`, `ids.ts` | Accent classes per theme colour; tab and panel ids.                                                                                                                                              |

## Hooks

**Server-snapshot policy:** on the server and during hydration every hook reports the motionless
state: reduced motion on, page hidden, out of view. Prerendered HTML is always the static state.

`useAutoAdvance({ steps, durationMs })` follows the APG carousel rules:

- plays one pass, from the first step to the last, starting as the card scrolls in;
- counts down only while at least half the card is on screen and the tab is visible;
- holds while a mouse hovers the tabs and panel, or focus is inside them (the play button is
  outside, so pressing Play is never held by its own focus);
- stops for good when the visitor picks a step or focuses a tab, and never moves the selection
  under focus;
- never starts under reduced motion (hide its controls with `footerClassName="motion-reduce:hidden"`).

## Accessibility

- Picking a tab announces nothing extra: focus already announces it. Controls that change the
  step without moving focus (Next, Start again) announce the step name and title only.
- Autoplay is silent.
- Every control has a visible label; fuller names start with it (WCAG 2.5.3).

## Testing

`src/test/browser-mocks.ts` fakes what jsdom lacks: `mockIntersectionObserver()` (`show(ratio)`,
or `show(0, { near: true })` for the loader's margin), `mockReducedMotion()` and
`setPageVisibility()`. Controllers load asynchronously; wait for the static tablist to detach:

```ts
const staticTabs = screen.getByRole('tablist');
page.show(0, { near: true });
await waitFor(() => expect(staticTabs).not.toBeInTheDocument());
```

Advance fake timers in slices (see the tests here), so each step's effect can schedule the next.

## Migrating a visual

1. Move the SVG into a Server Component with one geometry; mark parts with `data-at`; write the
   state CSS module; size text by the rule above.
2. Split the card into `view.tsx` (presentational, takes `tabs` and `footer` slots), `controller.tsx`
   (hooks, live SegmentedTabs/StepControls), `controls.ts` (tab label and footer text, shared by
   the server and the controller) and a `'use client'` `shell.tsx` (LazyVisual + React.lazy).
   Everything the shell imports ships in the initial page; keep it to the view.
3. Use VisualFrame, SegmentedTabs, StepPanel/StepStack and StepControls; delete local copies of
   tabs, icons, observers and timers.
4. Check at 360px (text ≥ 11px, no clipped labels), forced colours, reduced motion, keyboard,
   and that the page's initial JS does not include the controller (grep the initial chunks for
   one of its strings).

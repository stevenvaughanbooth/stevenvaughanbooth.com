# Visuals: the shared system

Every interactive diagram on the page is built from the pieces in this folder, so they look and
behave as one system and ship as little JavaScript as possible. ProgressiveDisclosure is the
reference implementation (the shared tour and a 3D scene); TeamMultiplier draws its network in 3D
on the same engine; MetadataPlatform shows a tour with sub-steps, and one 3D scene that follows
story × phase from outside its per-story diagram; ReflexDemo plays a replay on the same tour, with its pipeline in 3D above the terminal.

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
- **The static card is meaningful on its own**: every tour rests on its end state (the complete
  multiplier loop, the opened record, the last story's outcome, the finished session).
- **3D is a layer, never the content.** A controller may add a `SceneCanvas` over its SVG (see
  [3D scenes](#3d-scenes)). The SVG, the copy and the tabs stay in the DOM and are what assistive
  technology reads; the canvas is `aria-hidden`, and wherever it can't or may not draw, the 2D
  card simply stays.

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
| `tour/`               | `useTour`, `TourControls` and the shared wording (`TOUR_DWELL_MS`, `guidedTour`): the one tour every diagram plays.                                                                              |
| `three/`              | The 3D engine (`engine.ts`, `shapes.ts`), camera math (`pose.ts`), tokens (`tokens.ts`), opt-outs and timing (`support.ts`) and `SceneCanvas`. See [3D scenes](#3d-scenes).                      |
| `accent.ts`, `ids.ts` | Accent classes per theme colour; tab and panel ids.                                                                                                                                              |

## The tour

Every diagram plays the same way, from one hook and one footer: `tour/use-tour.ts` and
`tour/tour-controls.tsx`. Do not write a timer in a controller.

```tsx
const tour = useTour({ steps: content.steps.length }); // dwell: TOUR_DWELL_MS (6 s) a step
<div {...tour.region}>                                 // tabs + panel: what hover/focus/press hold
  <SegmentedTabs selected={tour.step} onSelect={tour.select} progress={tour.progress} … />
  …
</div>
footer={<TourControls accent="green" playback={tour.playback} running={tour.running}
                      wording={guidedTour(rest)} onToggle={tour.toggle} />}
```

`useTour` follows the APG carousel rules:

- plays one pass, from the first step to the last, starting as the card scrolls in, and rests on
  the last step with **Replay** (one behaviour for every diagram; nothing loops);
- counts down only while half the region is on screen (`threshold`) and the page can be seen;
- holds while a mouse hovers the region, focus is inside it, or a pointer is pressed in it (a drag
  to orbit a scene); the play button sits in the footer, outside the region, so pressing Play is
  never held by its own focus;
- stops for good when the visitor picks a step or focuses a tab, and never moves the selection
  under focus;
- never starts under reduced motion (the views hide the footer with `motion-reduce:hidden`).

`start: 'unseen'` is for a replay whose text must not vanish under the reader (ReflexDemo): it
resets to the first step only while out of sight, and rests if it is already on screen. A replay
passes `dwellMs` as a function, one delay per frame.

`TourControls` is the footer for every tour, server-rendered at rest and live in the controller:
the status on the left (`Auto-advancing`, `Paused while you look`, `Paused`, `Ready`, or the
diagram's rest label) and one Play / Pause / Replay button whose accessible name starts with its
label. The words that differ (`TourWording`) live in each diagram's `controls.ts`.

## Hooks

**Server-snapshot policy:** on the server and during hydration every hook reports the motionless
state: reduced motion on, page hidden, out of view. Prerendered HTML is always the static state.

**Off screen, nothing runs.** `usePageVisible` is false while the browser tab is hidden or a modal
dialog (the Ask palette, the shortcuts sheet) covers the page; it listens for `visibilitychange`
and for dialogs' `toggle` events. Timers count down only while their card is on screen and the
page can be seen, and the CSS that animates with them (tab and phase progress bars) is paused by
the same `running` flag, so a held tour resumes exactly where it stopped. The Adage replay follows
the same rules, and its cursor exists only while the terminal is on screen.

React's `<Activity>` was considered for this and not used: hiding a subtree applies
`display: none`, which would collapse the card and shift the page. The shortcuts sheet uses it
instead, where hiding is the point.

## 3D scenes

A diagram can draw its steps as a lit Three.js scene over its SVG. Three things are fixed: the
SVG stays the content and the fallback, three.js never loads with the page, and one engine runs
every scene.

```
controller.tsx                     (already lazy, near the viewport)
  └─ <StepPanel scene={<SceneCanvas load={loadScene} data={content.sceneData} step={tour.step} />}>
       SceneCanvas                 no three.js; checks support, waits for load + idle, imports:
         └─ scene.ts               defineScene({ poses, build }) — imports three and ../shared/three/engine
```

**Loading.** `SceneCanvas` (in the controller's chunk) asks `sceneOptOut()` first: Save-Data,
`prefers-reduced-data`, `navigator.deviceMemory < 4`, or no WebGL 2 keep the 2D card and download
nothing. Otherwise it waits for the load event, an idle period and 200 ms without scrolling
(`whenStill`). Where the card is above the fold (`/work/*`) the scene arrives after LCP and the
page's own work, and is never built under a scrolling reader; on the home page, where controllers
load only near the viewport, three.js is never fetched until the visitor scrolls towards a diagram. Every scene imports `three` and `engine.ts`, so a page shares
one chunk of them. Import named classes from `'three'`; no addons, react-three-fiber or
post-processing.

**Mounting.** The engine appends a canvas, a label layer and a colour probe to `SceneCanvas`'s box,
which covers the stage. It compiles every shader with `compileAsync` before the first frame, then
sets `data-scene="live"`: the box fades in and the SVG after it, its `peer`, fades out (it keeps
its place, so nothing moves). A failed import, a WebGL error or a lost context leaves or puts the
2D card back; a restored context brings the scene back. While the scene is live the diagram also
stops taking the pointer (`peer-data-[scene=live]:pointer-events-none`): its opacity puts it above
the canvas in paint order. On a software renderer (SwiftShader, llvmpipe) the engine draws at 1x
and cuts between steps, as under reduced motion.

**A scene** is `defineScene<Data>({ poses, fov?, framedAspect?, build })`:

- `poses[i]` is the camera for step `i`: `{ target, distance, azimuth, elevation }` (see
  `pose.ts`). Steps fly between poses in `FLIGHT_MS` (900 ms, eased); `framedAspect` is the canvas
  shape the poses were framed for, and narrower canvases pull back to fit.
- `build(context, data)` creates the objects once and returns `{ step(i, instant), theme(theme),
update?(dt, now) }`. `step` sets targets (animate unless `instant`); `theme` stores the colours;
  `update` eases towards the targets every frame and returns true while anything still moves.
- `data` is plain strings from the server (labels, counts), passed through the shell as content.
- `context.label(text, anchor, { align, className })` returns a DOM label that follows a 3D point,
  in whole pixels, at least `text-micro` (11 px). Labels are aria-hidden with the canvas: they
  repeat what the card's copy says. Style them with Tailwind classes and `data-*` attributes.
- `context.own(resource)` disposes a texture or geometry with the scene; meshes in the scene are
  disposed for you.
- `shapes.ts` has rounded slabs, rims, flat panels and a radial texture for glows and contact
  shadows. Light with a `HemisphereLight` and one `DirectionalLight`; glow with additive sprites
  and tubes in the dark theme and normal blending in the light one.

**Theme.** `theme.color` holds the site's tokens (`bg`, `surface`, `elevated`, `line`,
`lineStrong`, `fg`, `muted`, `subtle`, `green`, `amber`, `lilac`, `blue`) and `theme.dark`. The
engine reads each token from `<html>` and picks its `light-dark()` half itself (`tokens.ts`), from
`data-theme` or the system preference: Chromium resolves `light-dark()` for a new scheme only some
frames after a switch. A theme switch recolours the scene at once, inside the theme's reveal. Never
hard-code a colour.

**Runtime.** One renderer per mounted scene, antialiased, transparent over the stage's dot grid,
pixel ratio capped at 2 (1.5 on coarse pointers). It draws only while something moves (a flight,
an orbit, a scene's own easing), pauses off screen and in a hidden tab, and disposes everything,
the WebGL context included, on unmount.

**Motion and input.** Drag orbits the camera around the step's pose, coasts, holds for a moment
and springs home; on touch only a sideways drag orbits (`touch-action: pan-y`), so the page still
scrolls. Pressing in the region holds the tour. Under reduced motion there are no flights, no
inertia and no spring: steps cut, and a drag stays where it is left until the next step.

**Checklist for a new scene:** the poses frame the scene at 390 and 1440 px wide; labels never
overlap or leave their objects at 390, and dim by colour (`text-subtle`), never by opacity, so they
keep their contrast; it reads in light and dark; it is static under reduced motion; and the initial
page and `/` before scrolling do not request three.js (the end-to-end suite checks both). Don't
style anything from the scene's state with `:has()`: in Chromium a `:has()` rule restarts the
evidence figures' scroll-triggered count-up. StepPanel puts the scene before the diagram, so CSS
can follow it as a `peer`.

## Accessibility

- Picking a tab announces nothing extra: focus already announces it. Controls that change the
  step without moving focus (MetadataPlatform's phases) announce that step's copy only.
- Autoplay is silent.
- A 3D scene is `aria-hidden` and takes no focus; the stage's `role="img"` label and the copy
  below it describe every step.
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
jsdom has no WebGL, so `SceneCanvas` stays empty in unit tests; the end-to-end suite checks real
pixels in headless Chromium (SwiftShader) and the 2D fallback with WebGL switched off.

## Migrating a visual

1. Move the SVG into a Server Component with one geometry; mark parts with `data-at`; write the
   state CSS module; size text by the rule above.
2. Split the card into `view.tsx` (presentational, takes `tabs` and `footer` slots), `controller.tsx`
   (hooks, live SegmentedTabs/StepControls), `controls.ts` (tab label and footer text, shared by
   the server and the controller) and a `'use client'` `shell.tsx` (LazyVisual + React.lazy).
   Everything the shell imports ships in the initial page; keep it to the view.
3. Use VisualFrame, SegmentedTabs, StepPanel/StepStack, `useTour` and TourControls; delete local
   copies of tabs, icons, observers and timers.
4. For 3D, add `scene-data.ts` (what the scene draws, built on the server), `scene.ts`
   (`defineScene`), pass `sceneData` through the shell, and render `SceneCanvas` in StepPanel's
   `scene` slot. Follow `progressive-disclosure/scene.ts`.
5. Check at 360px (text ≥ 11px, no clipped labels), forced colours, reduced motion, keyboard,
   and that the page's initial JS does not include the controller (grep the initial chunks for
   one of its strings).

import {
  type ReactNode,
  type RefObject,
  useEffect,
  useEffectEvent,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { flushSync } from 'react-dom';
import type { XrayView } from '@/components/shortcuts/shortcuts';
import { homeMeasurement, measured, measuredOn } from '@/components/story/measured';
import { ArrowUpRight } from '@/components/ui/icons';
import {
  type ComponentKind,
  componentById,
  type SiteComponent,
  siteComponents,
} from '@/content/components';
import {
  type Bounds,
  type Box,
  type LabelRequest,
  placeCard,
  isSmall,
  placeLabels,
  runsDown,
} from './layout';
import {
  formatCount,
  formatKilobytes,
  formatMilliseconds,
  formatSeconds,
  formatShift,
  observeVitals,
  type Rating,
  rate,
  type ResourceSummary,
  summarizeResources,
  type Vitals,
} from './metrics';
import { peel } from './peel';
import styles from './xray.module.css';

/**
 * X-ray mode, loaded on intent by the shortcuts listener (shortcuts/shortcuts.tsx): the blueprint
 * styles, a label on every component the page marks with data-component, a details card for
 * each, and the HUD. The listener renders the overlay right after the header, so a keyboard
 * reaches the HUD and then the labels, in the page's order, before the content.
 */

const toggleId = 'xray-toggle';

const kindName: Record<ComponentKind, string> = {
  server: 'Server',
  client: 'Client',
  css: 'CSS only',
};

const kindLetter: Record<ComponentKind, string> = { server: 'S', client: 'C', css: 'CSS' };

let busy = false;
// Where the overlay goes: the listener's state, handed over on the first toggle.
let shown: (view: XrayView) => void = () => {};

/**
 * Turns X-ray on or off, inside the peel: the document's state (data-xray), the blueprint styles,
 * the overlay (which `show` hands to the listener) and every toggle's aria-pressed change
 * together, between its two snapshots.
 */
export async function toggle(show: (view: XrayView) => void = shown): Promise<void> {
  shown = show;
  if (busy) return;
  busy = true;
  const on = !document.documentElement.hasAttribute('data-xray');
  try {
    await peel({
      lifting: on,
      update() {
        const html = document.documentElement;
        html.toggleAttribute('data-xray', on);
        html.classList.toggle(styles.on ?? '', on);
        flushSync(() => show({ Overlay: XrayOverlay, on }));
        for (const button of document.querySelectorAll('[data-xray-toggle][aria-pressed]')) {
          button.setAttribute('aria-pressed', String(on));
        }
      },
    });
  } finally {
    busy = false;
  }
}

// Outlines take their kind's colour. The ids come from the manifest, so the two cannot drift.
const kindRules = (['client', 'css'] as const)
  .map((kind) => {
    const selector = siteComponents
      .filter((component) => component.kind === kind)
      .map((component) => `:root.${styles.on} [data-component='${component.id}']`)
      .join(',');
    return `${selector}{--xr-kind:var(--xr-${kind})}`;
  })
  .join('');

interface Target {
  key: string;
  element: HTMLElement;
  entry: SiteComponent;
  /** Inside the fixed header, so its label rides the fixed layer. */
  fixed: boolean;
  /** Inside another component. */
  nested: boolean;
  /** Whether it has a box at all: hidden at this width, it gets no label. */
  boxed: boolean;
}

const keys = new WeakMap<Element, string>();
let lastKey = 0;
function keyOf(element: Element): string {
  let key = keys.get(element);
  if (!key) {
    key = `xc${++lastKey}`;
    keys.set(element, key);
  }
  return key;
}

function inFixedLayer(element: Element): boolean {
  for (let node: Element | null = element; node; node = node.parentElement) {
    if (getComputedStyle(node).position === 'fixed') return true;
  }
  return false;
}

const hasBox = (rect: DOMRect) => rect.width > 0 && rect.height > 0;

function scan(): Target[] {
  return marked().map((element) => ({
    key: keyOf(element),
    element,
    entry: componentById(element.dataset.component ?? '')!,
    fixed: inFixedLayer(element),
    nested: element.parentElement?.closest('[data-component]') != null,
    boxed: hasBox(element.getBoundingClientRect()),
  }));
}

const marked = () =>
  [...document.querySelectorAll<HTMLElement>('[data-component]')].filter((element) =>
    componentById(element.dataset.component ?? ''),
  );

/** Whether the page's components, or which of them have a box, differ from `targets`. */
function stale(targets: readonly Target[], rects: readonly DOMRect[]): boolean {
  const elements = marked();
  return (
    elements.length !== targets.length ||
    targets.some(
      (target, i) => elements[i] !== target.element || target.boxed !== hasBox(rects[i]!),
    )
  );
}

/** The parts of one label that the layout pass moves. */
interface LabelParts {
  item: HTMLLIElement;
  label: HTMLButtonElement;
  leader: HTMLSpanElement;
  card?: HTMLDivElement | null;
  size?: HTMLSpanElement | null;
}

function XrayOverlay() {
  const overlay = useRef<HTMLDivElement>(null);
  const [targets, setTargets] = useState(scan);
  const [active, setActive] = useState<string | null>(null);
  const parts = useRef(new Map<string, LabelParts>());
  const focusBox = useRef<HTMLDivElement>(null);
  const rail = useRef<HTMLDivElement>(null);
  const focusSize = useRef<HTMLSpanElement>(null);
  // Why a card is open: pinned by a press, held by focus, or by the mouse over its label or card.
  const pinned = useRef<string | null>(null);
  const focused = useRef<string | null>(null);
  const hovered = useRef<string | null>(null);
  const closing = useRef<number | undefined>(undefined);

  function sync(delay = 0) {
    window.clearTimeout(closing.current);
    const apply = () => setActive(pinned.current ?? focused.current ?? hovered.current);
    if (delay) closing.current = window.setTimeout(apply, delay);
    else apply();
  }

  function closeCard() {
    const open = active ? parts.current.get(active) : undefined;
    pinned.current = focused.current = hovered.current = null;
    if (open?.card?.contains(document.activeElement)) open.label.focus();
    sync();
  }

  // Escape closes an open card first, then X-ray itself; a press elsewhere closes a pinned card.
  const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (event.key !== 'Escape' || event.defaultPrevented) return;
    if (document.querySelector('dialog:modal, :popover-open')) return;
    event.preventDefault();
    if (active) return closeCard();
    // Leaving from a label or the HUD: the labels go, so focus goes back to the toggle.
    if (overlay.current?.contains(document.activeElement)) {
      document.getElementById(toggleId)?.focus();
    }
    void toggle();
  });
  const onPointerDown = useEffectEvent((event: PointerEvent) => {
    if (!pinned.current) return;
    const open = parts.current.get(pinned.current);
    if (event.target instanceof Node && open?.item.contains(event.target)) return;
    pinned.current = null;
    sync();
  });
  useEffect(() => {
    const keyDown = (event: KeyboardEvent) => onKeyDown(event);
    const pointerDown = (event: PointerEvent) => onPointerDown(event);
    document.addEventListener('keydown', keyDown);
    document.addEventListener('pointerdown', pointerDown);
    return () => {
      document.removeEventListener('keydown', keyDown);
      document.removeEventListener('pointerdown', pointerDown);
    };
  }, []);

  // Places the labels before the first paint, then follows the page frame by frame: client
  // navigations, controllers swapping in, menus opening, the viewport changing. Most labels live
  // in page coordinates, so they only move when the layout does.
  useLayoutEffect(() => {
    let last = '';
    let frame = 0;

    function layout(): boolean {
      const rects = targets.map((target) => target.element.getBoundingClientRect());
      if (stale(targets, rects)) {
        setTargets(scan());
        return false;
      }
      const width = document.documentElement.clientWidth;
      const height = innerHeight;
      const { scrollX, scrollY } = window;
      const header = document.querySelector('header')?.getBoundingClientRect().bottom ?? 0;
      const shown = targets.flatMap((target, i) => {
        const piece = parts.current.get(target.key);
        const rect = rects[i]!;
        if (!target.boxed || !piece) return [];
        const box: Box = target.fixed
          ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
          : { x: rect.x + scrollX, y: rect.y + scrollY, width: rect.width, height: rect.height };
        return [{ target, piece, box }];
      });
      const open = shown.find(({ target }) => target.key === active);
      const signature = [
        width,
        height,
        active,
        open && !open.target.fixed ? Math.round(scrollY) : 0,
        ...shown.map(({ box }) => `${box.x | 0},${box.y | 0},${box.width | 0},${box.height | 0}`),
      ].join(';');
      if (signature === last) return true;
      last = signature;

      // A tall, narrow component's label runs down its side. Then reads, then writes, so the
      // browser lays out once more at most.
      for (const { piece, box } of shown) {
        piece.item.toggleAttribute('data-vertical', runsDown(box));
        piece.item.toggleAttribute('data-compact', isSmall(box));
      }
      const sizes = shown.map(({ piece }) => ({
        width: piece.label.offsetWidth,
        height: piece.label.offsetHeight,
      }));
      const cardSize = open?.piece.card
        ? { width: open.piece.card.offsetWidth, height: open.piece.card.offsetHeight }
        : null;
      const request = (index: number): LabelRequest => ({
        box: shown[index]!.box,
        ...sizes[index]!,
        inset: shown[index]!.target.nested ? 0 : 6,
        vertical: runsDown(shown[index]!.box),
      });
      const labels = new Map<string, Box>();
      let railBottom = header;
      for (const fixed of [true, false]) {
        const indexes = shown.flatMap((item, index) =>
          item.target.fixed === fixed ? [index] : [],
        );
        // The header's labels hang in a row below it, on a rail; the page's stay clear of it.
        const bounds: Bounds = fixed
          ? { width, top: 0, hang: header, crowd: 'left' }
          : { width: width + scrollX, top: railBottom };
        placeLabels(indexes.map(request), bounds).forEach((place, n) => {
          const index = indexes[n]!;
          const { piece, target } = shown[index]!;
          const size = sizes[index]!;
          labels.set(target.key, { x: place.x, y: place.y, ...size });
          if (fixed) railBottom = Math.max(railBottom, place.y + size.height + 3);
          piece.item.style.translate = `${place.x}px ${place.y}px`;
          if (!place.anchor) {
            piece.leader.style.display = 'none';
            return;
          }
          // From the label's nearer edge to the corner it names.
          const startX = Math.max(place.x + 6, Math.min(place.anchor.x, place.x + size.width - 6));
          const startY = place.anchor.y < place.y ? place.y : place.y + size.height;
          const dx = place.anchor.x - startX;
          const dy = place.anchor.y - startY;
          Object.assign(piece.leader.style, {
            display: 'block',
            translate: `${startX - place.x}px ${startY - place.y}px`,
            width: `${Math.hypot(dx, dy)}px`,
            rotate: `${Math.atan2(dy, dx)}rad`,
          });
        });
      }

      if (rail.current) {
        Object.assign(rail.current.style, {
          top: `${header}px`,
          height: `${railBottom - header}px`,
        });
      }

      const label = open ? labels.get(open.target.key) : undefined;
      if (open && label && cardSize && open.piece.card) {
        // The card is placed on screen, so page labels are taken back to the viewport.
        const onScreen = open.target.fixed
          ? label
          : { ...label, x: label.x - scrollX, y: label.y - scrollY };
        const offset = placeCard(onScreen, cardSize, { width, height, top: header });
        open.piece.card.style.translate = `${offset.x}px ${offset.y}px`;
        if (open.piece.size) {
          open.piece.size.textContent = `${Math.round(open.box.width)} × ${Math.round(open.box.height)} px`;
        }
      }
      const box = focusBox.current;
      if (box) {
        if (open) {
          Object.assign(box.style, {
            display: 'block',
            translate: `${open.box.x}px ${open.box.y}px`,
            width: `${open.box.width}px`,
            height: `${open.box.height}px`,
          });
          if (focusSize.current) {
            focusSize.current.textContent = `${Math.round(open.box.width)} × ${Math.round(open.box.height)}`;
          }
        } else {
          box.style.display = 'none';
        }
      }
      return true;
    }

    function tick() {
      if (layout()) frame = requestAnimationFrame(tick);
    }
    if (layout()) frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [targets, active]);

  const shown = targets.filter((target) => target.boxed);
  const current = shown.find((target) => target.key === active);

  return (
    <div ref={overlay} className={styles.overlay}>
      <style href="xray-kinds" precedence="medium">
        {kindRules}
      </style>
      <Hud targets={targets} overlay={overlay} />
      {/* The header's labels hang on a rail below it, which the page's pass under. */}
      <div ref={rail} aria-hidden className={styles.rail} />
      <section aria-label="Components on this page">
        <ul className={styles.labels}>
          {shown.map((target) => (
            <Label
              key={target.key}
              target={target}
              open={target.key === active}
              register={(piece) => {
                if (piece) parts.current.set(target.key, piece);
                else parts.current.delete(target.key);
              }}
              onEnter={() => {
                hovered.current = target.key;
                sync();
              }}
              onLeave={() => {
                if (hovered.current === target.key) hovered.current = null;
                sync(160);
              }}
              onFocusIn={() => {
                focused.current = target.key;
                sync();
              }}
              onFocusOut={() => {
                if (focused.current === target.key) focused.current = null;
                sync();
              }}
              onPress={() => {
                pinned.current = pinned.current === target.key ? null : target.key;
                if (!pinned.current) focused.current = null;
                sync();
              }}
            />
          ))}
        </ul>
      </section>
      <div
        ref={focusBox}
        aria-hidden
        data-fixed={current?.fixed || undefined}
        data-kind={current?.entry.kind}
        className={styles.focus}
        style={{ display: 'none' }}
      >
        <span ref={focusSize} className={styles.size} />
      </div>
    </div>
  );
}

interface LabelProps {
  target: Target;
  open: boolean;
  register: (parts: LabelParts | null) => void;
  onEnter: () => void;
  onLeave: () => void;
  onFocusIn: () => void;
  onFocusOut: () => void;
  onPress: () => void;
}

function Label({
  target,
  open,
  register,
  onEnter,
  onLeave,
  onFocusIn,
  onFocusOut,
  onPress,
}: LabelProps) {
  const item = useRef<HTMLLIElement>(null);
  const label = useRef<HTMLButtonElement>(null);
  const leader = useRef<HTMLSpanElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const size = useRef<HTMLSpanElement>(null);
  const cardId = useId();
  const { entry } = target;

  useLayoutEffect(() => {
    if (!item.current || !label.current || !leader.current) return;
    register({
      item: item.current,
      label: label.current,
      leader: leader.current,
      card: card.current,
      size: size.current,
    });
    return () => register(null);
  });

  return (
    <li
      ref={item}
      className={styles.item}
      data-kind={entry.kind}
      data-fixed={target.fixed || undefined}
      data-active={open || undefined}
      onPointerEnter={(event) => {
        if (event.pointerType === 'mouse') onEnter();
      }}
      onPointerLeave={(event) => {
        if (event.pointerType === 'mouse') onLeave();
      }}
      onFocus={onFocusIn}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) onFocusOut();
      }}
    >
      <span ref={leader} aria-hidden className={styles.leader} style={{ display: 'none' }} />
      <button
        ref={label}
        type="button"
        // The name a voice user says comes first; the rest reads as a sentence, not as markup.
        aria-label={`${entry.name}, ${kindName[entry.kind]}, ${entry.loads}`}
        aria-expanded={open}
        aria-controls={open ? cardId : undefined}
        className={styles.label}
        onClick={onPress}
      >
        {/* The markup's punctuation and the chip stay out of what is compared with the name. */}
        <span className={styles.name}>
          <span aria-hidden className={styles.punct}>
            &lt;
          </span>
          {entry.name}
          <span aria-hidden className={styles.punct}>
            {' />'}
          </span>
        </span>{' '}
        {/* On phones the kind shrinks to a lettered chip, drawn in CSS so it isn't read as a
            word of the label; the HUD's legend spells it out. The spaces keep the words apart. */}
        <span className={styles.kind}>{kindName[entry.kind]}</span>
        <span aria-hidden className={styles.chip} data-letter={kindLetter[entry.kind]} />{' '}
        <span className={styles.loads}>{entry.loads}</span>
      </button>
      {open ? <Card id={cardId} entry={entry} cardRef={card} sizeRef={size} /> : null}
    </li>
  );
}

interface CardProps {
  id: string;
  entry: SiteComponent;
  cardRef: RefObject<HTMLDivElement | null>;
  sizeRef: RefObject<HTMLSpanElement | null>;
}

function Card({ id, entry, cardRef, sizeRef }: CardProps) {
  const repo = useBuild().repo;
  return (
    <div ref={cardRef} id={id} role="group" aria-labelledby={`${id}-name`} className={styles.card}>
      <div className={styles.cardHead}>
        <p id={`${id}-name`} className={styles.cardName}>
          <span aria-hidden className={styles.punct}>
            &lt;
          </span>
          {entry.name}
          <span aria-hidden className={styles.punct}>
            {' />'}
          </span>
        </p>
        <p className={styles.kind}>{kindName[entry.kind]}</p>
      </div>
      {repo ? (
        <a href={`${repo}/blob/main/${entry.file}`} className={styles.file}>
          {entry.file}
          <ArrowUpRight width={12} height={12} />
          <span className="sr-only"> (on GitHub)</span>
        </a>
      ) : (
        <p className={styles.file}>{entry.file}</p>
      )}
      <dl className={styles.facts}>
        <dt>Loads</dt>
        <dd>{entry.loads}</dd>
        {entry.islands?.length ? (
          <>
            <dt>Islands</dt>
            <dd>{entry.islands.join(', ')}</dd>
          </>
        ) : null}
        <dt>Uses</dt>
        <dd>
          <ul className={styles.chips}>
            {entry.features.map((feature) => (
              <li key={feature}>{feature}</li>
            ))}
          </ul>
        </dd>
        <dt>Box</dt>
        <dd>
          <span ref={sizeRef} />
        </dd>
      </dl>
      <p className={styles.why}>{entry.why}</p>
    </div>
  );
}

interface Build {
  repo?: string;
  react?: string;
  next?: string;
  commit?: string;
}

/** What the server wrote into the header at build time: the repository, versions and commit. */
function useBuild(): Build {
  const [build] = useState<Build>(() => {
    try {
      return JSON.parse(
        document.querySelector('[data-xray-build]')?.getAttribute('data-xray-build') ?? '{}',
      );
    } catch {
      return {};
    }
  });
  return build;
}

interface PageStats extends ResourceSummary {
  elements: number;
}

function pageStats(overlay: HTMLElement | null): PageStats {
  const entries = (performance.getEntriesByType?.('resource') ?? []) as PerformanceResourceTiming[];
  // The page's own elements: X-ray's are left out.
  const own = overlay ? overlay.getElementsByTagName('*').length + 1 : 0;
  return {
    ...summarizeResources(entries, location.origin),
    elements: document.getElementsByTagName('*').length - own,
  };
}

const sameStats = (a: PageStats, b: PageStats) =>
  (Object.keys(a) as (keyof PageStats)[]).every((key) => a[key] === b[key]);

/** The Lighthouse run for this page, or for the page of its kind that was measured. */
function lighthouseFor(path: string) {
  const pages: readonly { path: string }[] = measured.pages;
  return (
    measured.pages.find((page) => page.path === path) ??
    (path.startsWith('/work/') && pages.some((page) => page.path === '/work/mcp')
      ? measured.pages.find((page) => page.path === '/work/mcp')
      : undefined) ??
    homeMeasurement
  );
}

function Rated({ rating }: { rating: Rating }) {
  return (
    <>
      <span aria-hidden className={styles.rating} data-rating={rating} />
      <span className="sr-only">({rating})</span>
    </>
  );
}

function Legend({ inBody = false }: { inBody?: boolean }) {
  return (
    <ul
      className={inBody ? styles.legendBody : styles.legend}
      aria-label={inBody ? undefined : 'Outlines'}
      aria-hidden={inBody || undefined}
    >
      {(['server', 'client', 'css'] as const).map((kind) => (
        <li key={kind} className={styles.key} data-kind={kind}>
          <span aria-hidden className={styles.chip} data-letter={kindLetter[kind]} />
          {kindName[kind]}
        </li>
      ))}
    </ul>
  );
}

interface CellProps {
  term: string;
  children: ReactNode;
  note?: string;
  wide?: boolean;
}

function Cell({ term, children, note, wide }: CellProps) {
  return (
    <div className={styles.cell} data-wide={wide || undefined}>
      <dt>{term}</dt>
      <dd>
        <span className={styles.value}>{children}</span>
        {note ? <span className={styles.note}>{note}</span> : null}
      </dd>
    </div>
  );
}

function Hud({
  targets,
  overlay,
}: {
  targets: readonly Target[];
  overlay: RefObject<HTMLDivElement | null>;
}) {
  const titleId = useId();
  const bodyId = useId();
  const build = useBuild();
  const [vitals, setVitals] = useState<Vitals>({ cls: 0, interactions: 0 });
  const [stats, setStats] = useState(() => pageStats(null));
  const [collapsed, setCollapsed] = useState(() => matchMedia('(width < 48rem)').matches);

  useEffect(() => observeVitals(setVitals), []);
  useEffect(() => {
    const refresh = () =>
      setStats((current) => {
        const next = pageStats(overlay.current);
        return sameStats(current, next) ? current : next;
      });
    refresh();
    const timer = window.setInterval(refresh, 1000);
    return () => window.clearInterval(timer);
  }, [overlay]);

  const ids = new Set(targets.map((target) => target.entry.id));
  const count = (kind: ComponentKind) =>
    [...ids].filter((id) => componentById(id)?.kind === kind).length;
  const path = location.pathname;
  const lighthouse = lighthouseFor(path);
  const scores = [
    lighthouse.performance,
    lighthouse.accessibility,
    lighthouse.bestPractices,
    lighthouse.seo,
  ].join(' · ');

  return (
    <section
      aria-labelledby={titleId}
      className={styles.hud}
      data-collapsed={collapsed || undefined}
    >
      <div className={styles.hudHead}>
        <p id={titleId} className={styles.hudTitle}>
          Under the hood
        </p>
        <p className={styles.path}>{path}</p>
        <Legend />
        <button
          type="button"
          className={styles.hudButton}
          aria-expanded={!collapsed}
          aria-controls={bodyId}
          onClick={() => setCollapsed(!collapsed)}
        >
          <svg
            aria-hidden
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={styles.chevron}
          >
            <path d="m6 15 6-6 6 6" />
          </svg>
          <span className="sr-only">Stats</span>
        </button>
        <button
          type="button"
          className={styles.hudButton}
          aria-keyshortcuts="Escape"
          onClick={() => {
            document.getElementById(toggleId)?.focus();
            void toggle();
          }}
        >
          Exit
        </button>
      </div>
      <div id={bodyId} className={styles.hudBody}>
        {/* Phones have no room for the legend in the title row; it opens with the sheet. */}
        <Legend inBody />
        <p className={styles.caption}>This visit, measured in your browser</p>
        <dl className={styles.cells}>
          <Cell term="FCP">
            {vitals.fcp === undefined ? '—' : formatSeconds(vitals.fcp)}
            {vitals.fcp === undefined ? null : <Rated rating={rate('fcp', vitals.fcp)} />}
          </Cell>
          <Cell term="LCP">
            {vitals.lcp === undefined ? '—' : formatSeconds(vitals.lcp)}
            {vitals.lcp === undefined ? null : <Rated rating={rate('lcp', vitals.lcp)} />}
          </Cell>
          <Cell term="CLS">
            {formatShift(vitals.cls)}
            <Rated rating={rate('cls', vitals.cls)} />
          </Cell>
          <Cell
            term="INP"
            note={
              vitals.inp === undefined
                ? 'no interaction yet'
                : `${vitals.interactions} interaction${vitals.interactions === 1 ? '' : 's'}`
            }
          >
            {vitals.inp === undefined ? '—' : formatMilliseconds(vitals.inp)}
            {vitals.inp === undefined ? null : <Rated rating={rate('inp', vitals.inp)} />}
          </Cell>
          <Cell
            term="JavaScript"
            note={
              stats.cachedScripts
                ? `${stats.scripts} files, ${stats.cachedScripts} cached`
                : `${stats.scripts} files`
            }
          >
            {formatKilobytes(stats.scriptBytes)}
          </Cell>
          <Cell
            term="Requests"
            note={stats.opaque ? `${stats.opaque} cross-origin report 0 B` : undefined}
          >
            {formatCount(stats.requests)}
          </Cell>
          <Cell term="DOM elements">{formatCount(stats.elements)}</Cell>
          <Cell term="Components" note={`${count('server')} server · ${count('css')} CSS only`}>
            {count('client')} client
          </Cell>
        </dl>
        <p className={styles.caption}>
          The build
          {build.commit && build.repo ? (
            <>
              {', commit '}
              <a href={`${build.repo}/commit/${build.commit}`}>{build.commit.slice(0, 7)}</a>
            </>
          ) : null}
        </p>
        <dl className={styles.cells}>
          <Cell
            term="Lighthouse"
            wide
            note={`Performance, accessibility, best practices, SEO: ${lighthouse.path} on mobile, ${measuredOn()}`}
          >
            {scores}
          </Cell>
          <Cell term="Tests" note={`${formatCount(measured.tests.e2e.passed)} end-to-end`}>
            {formatCount(measured.tests.unit)} unit
          </Cell>
          {build.react ? (
            <Cell term="React" note={build.next ? `Next.js ${build.next}` : undefined}>
              {build.react}
            </Cell>
          ) : null}
        </dl>
      </div>
    </section>
  );
}

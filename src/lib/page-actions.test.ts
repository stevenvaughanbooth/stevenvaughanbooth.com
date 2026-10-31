import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mockReducedMotion } from '@/test/browser-mocks';
import { showOnPage } from './page-actions';

const page = `
  <section id="work">
    <header><p class="label">Work</p><h2 id="work-title" tabindex="-1">Better tools.</h2></header>
    <article id="work-mcp"><div><h3 id="work-mcp-title">Give an agent a map.</h3></div></article>
  </section>
  <ol>
    <li id="role-lead-engineer">
      <details name="career-role"><summary>Lead Engineer</summary><div>Detail</div></details>
    </li>
    <li id="role-principal-engineer">
      <details name="career-role" open><summary>Principal Engineer</summary><div>Now</div></details>
    </li>
  </ol>
  <div id="recognition" style="border-top-left-radius: 16px"><h3 tabindex="-1">Recognition</h3></div>
`;

const navigate = vi.fn();
const scrolled: number[] = [];
const animated: { element: Element; keyframes: Keyframe[] }[] = [];

beforeEach(() => {
  vi.useFakeTimers();
  mockReducedMotion(false);
  window.history.replaceState(null, '', '/');
  document.body.innerHTML = page;
  scrolled.length = 0;
  animated.length = 0;
  navigate.mockClear();
  vi.stubGlobal('scrollTo', ({ top }: ScrollToOptions) => scrolled.push(top ?? 0));
  HTMLElement.prototype.animate = function animate(this: HTMLElement, keyframes) {
    animated.push({ element: this, keyframes: keyframes as Keyframe[] });
    return { cancel() {} } as Animation;
  };
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

describe('showOnPage', () => {
  it('scrolls a section into view, focuses its heading and records the fragment', () => {
    expect(showOnPage('work', { navigate })).toBe(true);
    expect(scrolled).toHaveLength(1);
    expect(document.activeElement).toBe(document.getElementById('work-title'));
    expect(window.location.hash).toBe('#work');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('makes a theme’s heading focusable before focusing it', () => {
    showOnPage('work-mcp', { navigate });
    const heading = document.getElementById('work-mcp-title');
    expect(heading).toHaveAttribute('tabindex', '-1');
    expect(document.activeElement).toBe(heading);
  });

  it('opens a career role’s disclosure and focuses its summary', () => {
    const lead = document.querySelector<HTMLDetailsElement>('#role-lead-engineer details');
    showOnPage('role-lead-engineer', { navigate });
    expect(lead?.open).toBe(true);
    expect(document.activeElement).toBe(lead?.querySelector('summary'));
  });

  it('pulses once scrolling settles: the heading of a section, a card as a whole', () => {
    showOnPage('work', { navigate });
    expect(animated).toHaveLength(0);
    // Smooth scrolling keeps sending scroll events; the pulse waits for them to stop.
    vi.advanceTimersByTime(100);
    window.dispatchEvent(new Event('scroll'));
    vi.advanceTimersByTime(100);
    expect(animated).toHaveLength(0);
    vi.advanceTimersByTime(50);
    expect(animated.map(({ element }) => element)).toEqual([document.getElementById('work-title')]);

    showOnPage('recognition', { navigate });
    vi.advanceTimersByTime(200);
    expect(animated.at(-1)?.element).toBe(document.getElementById('recognition'));
  });

  it('only fades the ring under reduced motion, never moves it', () => {
    showOnPage('work', { navigate });
    vi.advanceTimersByTime(200);
    const moving = new Set(animated[0]?.keyframes.map((frame) => frame.outlineOffset));
    expect(moving.size).toBeGreaterThan(1);

    mockReducedMotion(true);
    showOnPage('work', { navigate });
    vi.advanceTimersByTime(200);
    const still = new Set(animated[1]?.keyframes.map((frame) => frame.outlineOffset));
    expect([...still]).toEqual(['6px']);
  });

  it('scrolls to the layout position under the fixed header, ignoring a reveal’s transform', () => {
    const work = document.getElementById('work')!;
    Object.defineProperty(work, 'offsetTop', { configurable: true, value: 2400 });
    work.style.translate = '0 24px';
    document.documentElement.style.scrollPaddingTop = '80px';
    showOnPage('work', { navigate });
    expect(scrolled).toEqual([2320]);
    document.documentElement.style.scrollPaddingTop = '';
  });

  it('opens a case study, a page of its own, through the router', () => {
    expect(showOnPage('case-study-platform', { navigate })).toBe(true);
    expect(navigate).toHaveBeenCalledWith('/work/platform');
    expect(scrolled).toEqual([]);
  });

  it('goes to the home page for an in-page target seen from another page', () => {
    window.history.replaceState(null, '', '/colophon');
    showOnPage('role-principal-engineer', { navigate });
    expect(navigate).toHaveBeenCalledWith('/#role-principal-engineer');
  });

  it('on a case study, shows its theme’s diagram there, and the page itself at its title', () => {
    window.history.replaceState(null, '', '/work/mcp');
    document.body.innerHTML = `
      <h1 id="case-study-title" tabindex="-1">Give an agent a map.</h1>
      <div id="diagram" style="border-top-left-radius: 16px"><div role="group">Map</div></div>`;
    const diagram = document.getElementById('diagram');
    showOnPage('work-mcp', { navigate });
    expect(document.activeElement).toBe(diagram);
    expect(`${window.location.pathname}${window.location.hash}`).toBe('/work/mcp#diagram');
    vi.advanceTimersByTime(200);
    expect(animated.at(-1)?.element).toBe(diagram);

    showOnPage('case-study-mcp', { navigate });
    expect(document.activeElement).toBe(document.getElementById('case-study-title'));
    expect(navigate).not.toHaveBeenCalled();

    // Another theme's diagram is on the home page.
    showOnPage('work-platform', { navigate });
    expect(navigate).toHaveBeenCalledWith('/#work-platform');
  });

  it('ignores anything outside the allowlist', () => {
    const before = document.activeElement;
    for (const id of ['film', 'work-title', 'javascript:alert(1)', '', undefined]) {
      expect(showOnPage(id, { navigate }), String(id)).toBe(false);
    }
    expect(navigate).not.toHaveBeenCalled();
    expect(scrolled).toEqual([]);
    expect(document.activeElement).toBe(before);
    expect(window.location.hash).toBe('');
  });
});

import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { projects, themes } from '@/content/profile';
import { mockIntersectionObserver, mockReducedMotion } from '@/test/browser-mocks';
import { MetadataPlatform } from '../metadata-platform';
import { type StoryId, stories } from './stories';

// The controller's first dynamic import is transformed on demand, which can take over a second
// when the whole suite runs in parallel.
const controllerLoad = { timeout: 5000 };

const dwellMs = 6000;

let page: ReturnType<typeof mockIntersectionObserver>;
const card = () => screen.getByRole('group', { name: 'Inside the platform, illustrative' });
const selectedTab = () => screen.getByRole('tab', { selected: true });
const phases = () => within(screen.getByRole('list', { name: 'Phases of this story' }));
const currentPhase = () =>
  phases()
    .getAllByRole('button')
    .find((button) => button.getAttribute('aria-current') === 'step');
// Timers advance in slices so each step's effect can schedule the next timer.
const tick = (ms: number) => {
  for (let elapsed = 0; elapsed < ms; elapsed += 100) act(() => vi.advanceTimersByTime(100));
};

/** Brings the card near the viewport and waits for the controller to replace the static render. */
async function loadController() {
  const staticTabs = screen.getByRole('tablist');
  page.show(0, { near: true });
  await waitFor(() => expect(staticTabs).not.toBeInTheDocument(), controllerLoad);
}

function story(id: StoryId) {
  const found = stories.find((item) => item.id === id);
  if (!found) throw new Error(`No story ${id}`);
  return found;
}

beforeEach(() => {
  page = mockIntersectionObserver();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('MetadataPlatform', () => {
  it('server-renders the last story’s outcome, with only its diagram in the document', () => {
    mockReducedMotion(false);
    render(<MetadataPlatform />);
    const migration = story('migration');

    expect(selectedTab()).toHaveAccessibleName(migration.short);
    expect(screen.getByRole('tabpanel')).toHaveAccessibleName(migration.short);
    expect(currentPhase()).toHaveAccessibleName(migration.phases[2].label);
    const diagram = within(card()).getByRole('img');
    expect(diagram).toHaveAccessibleName(migration.description);
    expect(card().querySelectorAll('[role="img"] svg')).toHaveLength(1);
    expect(screen.getByText(migration.result)).toBeInTheDocument();
    expect(screen.queryByText(story('agents').result)).not.toBeInTheDocument();
    const summary = projects.find((project) => project.id === 'migration')!.summary;
    expect(screen.getByText(summary)).toBeVisible();
  });

  it('puts the play control before the tabs, outside the region the tour holds for', () => {
    mockReducedMotion(false);
    render(<MetadataPlatform />);
    const play = screen.getByRole('button', { name: 'Play auto-advance' });
    expect(play.compareDocumentPosition(screen.getByRole('tablist'))).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  it('links the agent-context story to theme 02 instead of repeating its proof line', async () => {
    mockReducedMotion(true);
    render(<MetadataPlatform />);
    await loadController();
    fireEvent.click(screen.getByRole('tab', { name: story('agents').short }));

    const mcp = themes.find((theme) => theme.id === 'mcp')!;
    const link = within(card()).getByRole('link', { name: new RegExp(`^See ${mcp.index}`) });
    expect(link).toBeVisible();
    expect(link).toHaveAttribute('href', '#work-mcp');
    expect(card()).not.toHaveTextContent(projects.find((project) => project.id === 'mcp')!.summary);
  });

  it('opens a picked story on its outcome, by click and by keyboard', async () => {
    mockReducedMotion(true);
    render(<MetadataPlatform />);
    await loadController();
    const schema = story('schema');

    fireEvent.click(screen.getByRole('tab', { name: schema.short }));
    expect(selectedTab()).toHaveAccessibleName(schema.short);
    expect(screen.getByRole('img')).toHaveAccessibleName(schema.description);
    expect(currentPhase()).toHaveAccessibleName(schema.phases[2].label);
    expect(screen.getByText(schema.title)).toBeVisible();
    expect(screen.getByText(schema.phases[2].copy)).toBeVisible();
    expect(card().querySelectorAll('[role="img"] svg')).toHaveLength(1);

    fireEvent.keyDown(selectedTab(), { key: 'ArrowRight' });
    expect(selectedTab()).toHaveAccessibleName(story('migration').short);
    expect(selectedTab()).toHaveFocus();
    fireEvent.keyDown(selectedTab(), { key: 'Home' });
    expect(selectedTab()).toHaveAccessibleName(story('agents').short);
    fireEvent.keyDown(selectedTab(), { key: 'ArrowUp' });
    expect(selectedTab()).toHaveAccessibleName(story('migration').short);
    expect(selectedTab()).toHaveAttribute('tabindex', '0');
  });

  it('steps through a story’s phases and announces only the narration', async () => {
    mockReducedMotion(true);
    render(<MetadataPlatform />);
    await loadController();
    const migration = story('migration');

    fireEvent.click(phases().getByRole('button', { name: migration.phases[0].label }));
    expect(currentPhase()).toHaveAccessibleName(migration.phases[0].label);
    expect(selectedTab()).toHaveAccessibleName(migration.short);
    const live = card().querySelector('[aria-live="polite"]');
    expect(live).toHaveTextContent(migration.phases[0].copy);
    expect(card().querySelector('[data-phase]')).toHaveAttribute('data-phase', '0');

    fireEvent.click(screen.getByRole('tab', { name: story('schema').short }));
    expect(live).toBeEmptyDOMElement();
  });

  it('rests on the outcome under reduced motion and never tours', async () => {
    mockReducedMotion(true);
    render(<MetadataPlatform />);
    await loadController();
    vi.useFakeTimers();
    page.show(1);
    tick(dwellMs * 3);

    expect(selectedTab()).toHaveAccessibleName(story('migration').short);
    expect(currentPhase()).toHaveAccessibleName(story('migration').phases[2].label);
  });

  it('tours every phase of every story once as it scrolls in, holding off screen and on pause', async () => {
    mockReducedMotion(false);
    render(<MetadataPlatform />);
    await loadController();
    vi.useFakeTimers();
    const [agents, schema] = [story('agents'), story('schema')];

    page.show(0.2);
    expect(selectedTab()).toHaveAccessibleName(agents.short);
    expect(currentPhase()).toHaveAccessibleName(agents.phases[0].label);
    tick(dwellMs * 2);
    expect(currentPhase()).toHaveAccessibleName(agents.phases[0].label); // not far enough on screen

    page.show(0.8);
    expect(screen.getByText('Auto-advancing')).toBeInTheDocument();
    tick(dwellMs);
    expect(currentPhase()).toHaveAccessibleName(agents.phases[1].label);
    tick(dwellMs * 2);
    expect(selectedTab()).toHaveAccessibleName(schema.short);
    expect(currentPhase()).toHaveAccessibleName(schema.phases[0].label);

    page.show(0);
    tick(dwellMs * 2);
    expect(currentPhase()).toHaveAccessibleName(schema.phases[0].label);

    page.show(1);
    fireEvent.click(screen.getByRole('button', { name: 'Pause auto-advance' }));
    tick(dwellMs * 2);
    expect(currentPhase()).toHaveAccessibleName(schema.phases[0].label);

    fireEvent.click(screen.getByRole('button', { name: 'Play auto-advance' }));
    tick(dwellMs * 5);
    expect(selectedTab()).toHaveAccessibleName(story('migration').short);
    expect(currentPhase()).toHaveAccessibleName(story('migration').phases[2].label);
    tick(dwellMs * 2);
    expect(screen.getByRole('button', { name: 'Replay auto-advance' })).toBeInTheDocument();
    expect(card().querySelector('[aria-live="polite"]')).toBeEmptyDOMElement();
  });

  it('holds while keyboard focus is in the panel', async () => {
    mockReducedMotion(false);
    render(<MetadataPlatform />);
    await loadController();
    vi.useFakeTimers();
    page.show(1);

    act(() => screen.getByRole('tabpanel').focus());
    tick(dwellMs * 2);
    expect(currentPhase()).toHaveAccessibleName(story('agents').phases[0].label);
    expect(screen.getByText('Paused while you look')).toBeInTheDocument();

    act(() => screen.getByRole('tabpanel').blur());
    tick(dwellMs);
    expect(currentPhase()).toHaveAccessibleName(story('agents').phases[1].label);
  });

  it('stops for good once a tab takes focus, and never moves the selection under it', async () => {
    mockReducedMotion(false);
    render(<MetadataPlatform />);
    await loadController();
    vi.useFakeTimers();
    page.show(1);

    act(() => selectedTab().focus());
    tick(dwellMs * 4);
    expect(selectedTab()).toHaveAccessibleName(story('agents').short);
    expect(selectedTab()).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Play auto-advance' })).toBeInTheDocument();

    act(() => selectedTab().blur());
    tick(dwellMs * 4);
    expect(currentPhase()).toHaveAccessibleName(story('agents').phases[0].label);
  });

  it('never resets the story under a tab that already has focus', async () => {
    mockReducedMotion(false);
    render(<MetadataPlatform />);

    // Tabbing in focuses the static selected tab, which loads the controller at once.
    act(() => screen.getByRole('tab', { name: story('migration').short }).focus());
    await waitFor(() =>
      expect(screen.getByRole('tab', { name: story('migration').short })).toHaveFocus(),
    );
    vi.useFakeTimers();
    page.show(1);
    tick(dwellMs * 3);

    expect(selectedTab()).toHaveAccessibleName(story('migration').short);
    expect(selectedTab()).toHaveFocus();
  });
});

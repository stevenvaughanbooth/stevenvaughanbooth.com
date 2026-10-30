import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mockIntersectionObserver } from '@/test/browser-mocks';
import { ProgressiveDisclosure } from '../progressive-disclosure';

let page: ReturnType<typeof mockIntersectionObserver>;
const selectedTab = () => screen.getByRole('tab', { selected: true });
const live = () => document.querySelector('[aria-live="polite"]');

async function loadController() {
  const staticTabs = screen.getByRole('tablist');
  page.show(0, { near: true });
  await waitFor(() => expect(staticTabs).not.toBeInTheDocument());
}

beforeEach(() => {
  page = mockIntersectionObserver();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ProgressiveDisclosure', () => {
  it('server-renders the compact map, its tool call and one diagram', () => {
    render(<ProgressiveDisclosure />);
    expect(
      screen.getByRole('group', { name: 'Context on demand, illustrative' }),
    ).toBeInTheDocument();
    expect(selectedTab()).toHaveAccessibleName('Describe');
    const diagram = screen.getByRole('img', { name: /^Describe:/ });
    expect(diagram.querySelectorAll('svg')).toHaveLength(1);
    expect(screen.getByText('describe')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Next: Search' })).toBeInTheDocument();
  });

  it('steps through describe, search and query, announcing only the step and its title', async () => {
    render(<ProgressiveDisclosure />);
    await loadController();

    fireEvent.click(screen.getByRole('button', { name: 'Next: Search' }));
    expect(selectedTab()).toHaveAccessibleName('Search');
    expect(screen.getByRole('tabpanel')).toHaveAccessibleName('Search');
    expect(live()).toHaveTextContent(/^Search: Follow the relevant branch\.$/);

    fireEvent.click(screen.getByRole('button', { name: 'Next: Query' }));
    expect(screen.getByRole('img', { name: /^Query:/ })).toBeInTheDocument();
    const call = screen.getByText('query').closest('dl');
    expect(call).not.toBeNull();
    expect(
      within(call as HTMLElement)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(['Definition', '·Fields', '·Relationships']);

    fireEvent.click(screen.getByRole('button', { name: 'Start again' }));
    expect(selectedTab()).toHaveAccessibleName('Describe');
    expect(live()).toHaveTextContent(/^Describe: Start with a map\.$/);
  });

  it('supports the tabs keyboard pattern without a live announcement', async () => {
    render(<ProgressiveDisclosure />);
    await loadController();

    fireEvent.keyDown(selectedTab(), { key: 'ArrowLeft' });
    expect(selectedTab()).toHaveAccessibleName('Query');
    expect(selectedTab()).toHaveFocus();
    fireEvent.keyDown(selectedTab(), { key: 'ArrowDown' });
    expect(selectedTab()).toHaveAccessibleName('Describe');
    fireEvent.keyDown(selectedTab(), { key: 'End' });
    expect(selectedTab()).toHaveAccessibleName('Query');
    expect(live()).toBeEmptyDOMElement();
  });
});

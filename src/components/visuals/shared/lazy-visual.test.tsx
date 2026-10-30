import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { lazy, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mockIntersectionObserver } from '@/test/browser-mocks';
import { LazyVisual } from './lazy-visual';

function Card({
  live,
  count = 0,
  onClick,
}: {
  live: boolean;
  count?: number;
  onClick?: () => void;
}) {
  return (
    <div data-testid={live ? 'live' : 'static'}>
      <button type="button">First</button>
      <button type="button" onClick={onClick}>
        Clicked {count}
      </button>
    </div>
  );
}

function Controller() {
  const [count, setCount] = useState(0);
  return <Card live count={count} onClick={() => setCount(count + 1)} />;
}

function Throws(): never {
  throw new Error('Controller bug');
}

const load = async () => ({ default: Controller });
const Working = lazy(load);
const failing = () => Promise.reject(new Error('Failed to load chunk'));
const Unreachable = lazy(failing);
const Buggy = lazy(async () => ({ default: Throws }));

let page: ReturnType<typeof mockIntersectionObserver>;
const flush = () => act(async () => {});

beforeEach(() => {
  page = mockIntersectionObserver();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('LazyVisual', () => {
  it('shows the static render until the visual nears the viewport, then the controller', async () => {
    render(
      <LazyVisual fallback={<Card live={false} />} preload={load}>
        <Working />
      </LazyVisual>,
    );
    expect(screen.getByTestId('static')).toBeInTheDocument();

    page.show(0, { near: false });
    await flush();
    expect(screen.getByTestId('static')).toBeInTheDocument();

    page.show(0, { near: true });
    expect(await screen.findByTestId('live')).toBeInTheDocument();
    expect(screen.queryByTestId('static')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Clicked 0' }));
    expect(screen.getByRole('button', { name: 'Clicked 1' })).toBeInTheDocument();
  });

  it('loads as soon as focus enters, and keeps focus on the same control', async () => {
    render(
      <LazyVisual fallback={<Card live={false} />} preload={load}>
        <Working />
      </LazyVisual>,
    );
    act(() => screen.getByRole('button', { name: 'Clicked 0' }).focus());

    await screen.findByTestId('live');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Clicked 0' })).toHaveFocus());
  });

  it('keeps the static render when the chunk fails to load', async () => {
    render(
      <LazyVisual fallback={<Card live={false} />} preload={failing}>
        <Unreachable />
      </LazyVisual>,
    );
    page.show(0.5);
    await flush();

    expect(screen.getByTestId('static')).toBeInTheDocument();
  });

  it('keeps the static render when the controller throws', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <LazyVisual fallback={<Card live={false} />} preload={load}>
        <Buggy />
      </LazyVisual>,
    );
    page.show(0.5);
    await flush();
    await flush();

    expect(screen.getByTestId('static')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clicked 0' })).toBeInTheDocument();
  });
});

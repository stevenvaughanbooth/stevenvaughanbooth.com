import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { heroSuggestions } from '@/content/answers';
import { ASK_OPEN_EVENT, ASK_WARM_EVENT, type AskOpenDetail } from './ask-events';
import { HeroAsk } from './hero-ask';

const opened = vi.fn<(detail: AskOpenDetail) => void>();
const warmed = vi.fn();
const onOpen = (event: Event) => opened((event as CustomEvent<AskOpenDetail>).detail);

beforeEach(() => {
  opened.mockReset();
  warmed.mockReset();
  window.addEventListener(ASK_OPEN_EVENT, onOpen);
  window.addEventListener(ASK_WARM_EVENT, warmed);
});
afterEach(() => {
  window.removeEventListener(ASK_OPEN_EVENT, onOpen);
  window.removeEventListener(ASK_WARM_EVENT, warmed);
  vi.restoreAllMocks();
});

const field = () => screen.getByRole('textbox', { name: 'Ask about my work' });

describe('HeroAsk', () => {
  it('renders a labelled ask bar with suggested questions', () => {
    render(<HeroAsk className="mt-8" />);
    expect(screen.getByRole('form', { name: 'Ask about my work' })).toBeInTheDocument();
    expect(field()).toHaveAttribute('aria-keyshortcuts', '/');
    expect(field()).toHaveAttribute('placeholder', 'Ask about my work…');
    const group = screen.getByRole('group', { name: 'Try' });
    expect(
      within(group)
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual(heroSuggestions);
  });

  it('hands a typed question to the palette and clears the bar', async () => {
    render(<HeroAsk />);
    const user = userEvent.setup();
    await user.type(field(), '  Does Steven like hard problems?  {Enter}');
    expect(opened).toHaveBeenCalledWith({ question: 'Does Steven like hard problems?' });
    expect(field()).toHaveValue('');
  });

  it('opens the palette to browse when submitted empty', async () => {
    render(<HeroAsk />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Ask' }));
    expect(opened).toHaveBeenCalledWith({});
  });

  it('runs a suggestion as a prompt', async () => {
    render(<HeroAsk />);
    const suggestion = heroSuggestions[2] ?? '';
    await userEvent.setup().click(screen.getByRole('button', { name: suggestion }));
    expect(opened).toHaveBeenCalledWith({ prompt: suggestion });
  });

  it('starts loading the palette on hover or focus, before anything is sent', () => {
    render(<HeroAsk />);
    fireEvent.pointerEnter(screen.getByRole('form', { name: 'Ask about my work' }).parentElement!);
    fireEvent.focus(field());
    expect(warmed).toHaveBeenCalled();
    expect(opened).not.toHaveBeenCalled();
  });
});

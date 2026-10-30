import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { person, themes } from '@/content/profile';
import { QUESTION_MAX } from '@/lib/ask-contract';
import { openAsk } from './ask-events';
import { AskLauncher } from './ask-launcher';
import { AskPalette, type AskPaletteHandle } from './ask-palette';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

// jsdom implements <dialog> without the modal API.
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    if (!this.open) return;
    this.open = false;
    this.dispatchEvent(new Event('close'));
  };
});

interface Route {
  status?: { enabled: boolean; limit: number; remaining: number } | null;
  post?: () => Response;
}

function stream(text: string[], headers: Record<string, string>) {
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream({
      start(controller) {
        text.forEach((chunk) => controller.enqueue(encoder.encode(chunk)));
        controller.close();
      },
    }),
    { status: 200, headers: { 'Content-Type': 'text/plain', ...headers } },
  );
}

function json(status: number, body: unknown, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers });
}

function mockApi({ status = { enabled: true, limit: 3, remaining: 3 }, post }: Route = {}) {
  const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
    if (init?.method === 'POST') {
      if (!post) throw new Error('Unexpected POST');
      return post();
    }
    return status ? json(200, status) : json(503, { error: 'unavailable' });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function posts(fetchMock: ReturnType<typeof mockApi>) {
  return fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST');
}

const announce = vi.fn();

async function openPalette(detail?: { prompt?: string }) {
  const ref = createRef<AskPaletteHandle>();
  render(<AskPalette ref={ref} announce={announce} />);
  await act(async () => ref.current?.open(detail));
  return ref;
}

function combobox() {
  return screen.getByRole('combobox', { name: 'Ask a question or search', hidden: true });
}

/** The visible thread. */
async function thread() {
  return within(await screen.findByRole('region', { name: 'Conversation' }));
}

function activeOption() {
  const id = combobox().getAttribute('aria-activedescendant');
  return id ? document.getElementById(id) : null;
}

beforeEach(() => {
  push.mockReset();
  announce.mockReset();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function liveRegion() {
  const regions = document.querySelectorAll('[aria-live="polite"]');
  expect(regions).toHaveLength(1);
  return regions[0] as HTMLElement;
}

describe('AskLauncher', () => {
  it('lazily opens the palette with ⌘K or Ctrl+K, and toggles it closed', async () => {
    mockApi();
    render(<AskLauncher />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'k', metaKey: true });
    const dialog = await screen.findByRole('dialog', { name: 'Ask Steven' });
    expect(combobox()).toHaveFocus();

    fireEvent.keyDown(window, { key: 'k', metaKey: true });
    expect(dialog).not.toHaveAttribute('open');

    fireEvent.keyDown(window, { key: 'K', ctrlKey: true });
    expect(screen.getByRole('dialog', { name: 'Ask Steven' })).toHaveAttribute('open');
  });

  it('loads nothing until the visitor shows intent', async () => {
    const idle = vi.fn();
    vi.stubGlobal('requestIdleCallback', idle);
    const timeout = vi.spyOn(window, 'setTimeout');
    mockApi();
    render(<AskLauncher />);
    await act(async () => {});
    expect(idle).not.toHaveBeenCalled();
    expect(timeout).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog', { hidden: true })).not.toBeInTheDocument();
  });

  it('runs a suggested prompt from openAsk with its curated answer, without calling Claude', async () => {
    const fetchMock = mockApi();
    render(<AskLauncher />);
    const mcp = themes.find((theme) => theme.id === 'mcp');
    act(() => openAsk({ prompt: mcp?.prompt }));

    expect(await screen.findByRole('heading', { name: mcp?.prompt })).toBeInTheDocument();
    const view = await thread();
    expect(view.getByText('Context, one useful step at a time.')).toBeInTheDocument();
    expect(view.getByText('From Steven’s curated notes')).toBeInTheDocument();
    expect(posts(fetchMock)).toHaveLength(0);
  });

  it('keeps one live region, inside the open dialog, and speaks after the dialog opens', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockApi();
    render(<AskLauncher />);
    // Before the palette exists, the region waits in the page.
    expect(liveRegion()).toBeEmptyDOMElement();

    // Load the palette, then close it again.
    fireEvent.keyDown(window, { key: 'k', metaKey: true });
    const dialog = await screen.findByRole('dialog', { name: 'Ask Steven' });
    fireEvent.keyDown(window, { key: 'k', metaKey: true });

    act(() => openAsk({ prompt: themes[1]?.prompt }));
    expect(screen.getByText('Context, one useful step at a time.')).toBeInTheDocument();
    // A modal dialog hides the rest of the page from assistive technology, so it lives inside.
    expect(dialog).toContainElement(liveRegion());
    // Not in the same moment the dialog appears: a region that appears already full is not read.
    expect(liveRegion()).toBeEmptyDOMElement();
    await act(async () => vi.advanceTimersByTime(200));
    expect(liveRegion()).toHaveTextContent(/^Context, one useful step at a time\. Steven designed/);
    // Then cleared, so the answer isn't left in the page to be read twice.
    await act(async () => vi.advanceTimersByTime(6000));
    expect(liveRegion()).toBeEmptyDOMElement();
  });

  it('survives a palette that fails, then retries, with focus kept on the way forward', async () => {
    mockApi();
    const user = userEvent.setup();
    const { AskPalette: Real } = await import('./ask-palette');
    let fail = true;
    vi.doMock('./ask-palette', () => ({
      AskPalette: (props: Parameters<typeof Real>[0]) => {
        if (fail) throw new Error('Failed to load chunk');
        return <Real {...props} />;
      },
    }));
    vi.resetModules();
    const { AskLauncher: Launcher } = await import('./ask-launcher');
    const { openAsk: open } = await import('./ask-events');
    vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <>
        <button type="button" onClick={() => open()}>
          Ask Steven
        </button>
        <Launcher />
      </>,
    );
    await user.click(screen.getByRole('button', { name: 'Ask Steven' }));

    const notice = await screen.findByRole('region', { name: 'Ask Steven couldn’t load.' });
    expect(within(notice).getByRole('link', { name: 'Email Steven' })).toHaveAttribute(
      'href',
      person.links.email,
    );
    expect(within(notice).getByRole('button', { name: 'Try again' })).toHaveFocus();
    await waitFor(() => expect(liveRegion()).toHaveTextContent(/couldn’t load/));

    fail = false;
    await user.click(within(notice).getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('dialog', { name: 'Ask Steven' })).toHaveAttribute('open');
    expect(screen.queryByRole('region', { name: /couldn’t load/ })).not.toBeInTheDocument();
    vi.doUnmock('./ask-palette');
  });

  it('dismisses the failure notice with Escape and returns focus', async () => {
    mockApi();
    const user = userEvent.setup();
    vi.doMock('./ask-palette', () => ({
      AskPalette: () => {
        throw new Error('Failed to load chunk');
      },
    }));
    vi.resetModules();
    const { AskLauncher: Launcher } = await import('./ask-launcher');
    const { openAsk: open } = await import('./ask-events');
    vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <>
        <button type="button" onClick={() => open()}>
          Ask Steven
        </button>
        <Launcher />
      </>,
    );
    const trigger = screen.getByRole('button', { name: 'Ask Steven' });
    await user.click(trigger);
    await screen.findByRole('region', { name: 'Ask Steven couldn’t load.' });
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('region', { name: /couldn’t load/ })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    vi.doUnmock('./ask-palette');
  });
});

describe('AskPalette keyboard', () => {
  it('is an accessible modal with a combobox and grouped listbox', async () => {
    mockApi();
    await openPalette();
    expect(screen.getByRole('dialog', { name: 'Ask Steven' })).toHaveAttribute('open');
    const listbox = screen.getByRole('listbox', { name: 'Results' });
    expect(combobox()).toHaveAttribute('aria-controls', listbox.id);
    expect(combobox()).toHaveAttribute('aria-expanded', 'true');
    expect(within(listbox).getByRole('group', { name: 'Topics' })).toBeInTheDocument();
    expect(within(listbox).getByRole('group', { name: 'Go to' })).toBeInTheDocument();
    expect(within(listbox).getByRole('group', { name: 'Links' })).toBeInTheDocument();
  });

  it('moves the active option with arrows, Home and End, wrapping at the ends', async () => {
    mockApi();
    await openPalette();
    const user = userEvent.setup();
    const options = screen.getAllByRole('option');
    const first = options[0];
    const last = options.at(-1);

    expect(activeOption()).toBe(first);
    expect(first).toHaveAttribute('aria-selected', 'true');

    await user.keyboard('{ArrowDown}');
    expect(activeOption()).toBe(options[1]);
    expect(first).toHaveAttribute('aria-selected', 'false');

    await user.keyboard('{End}');
    expect(activeOption()).toBe(last);
    await user.keyboard('{ArrowDown}');
    expect(activeOption()).toBe(first);
    await user.keyboard('{ArrowUp}');
    expect(activeOption()).toBe(last);
    await user.keyboard('{Home}');
    expect(activeOption()).toBe(first);
  });

  it('answers a topic on Enter and shows the conversation', async () => {
    mockApi();
    await openPalette();
    const user = userEvent.setup();
    expect(activeOption()).toHaveTextContent('A multiplier for builders');

    await user.keyboard('{Enter}');
    expect(screen.getByRole('heading', { name: /adopt better workflows/ })).toBeInTheDocument();
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(combobox()).toHaveAttribute('aria-expanded', 'false');
    expect(combobox()).not.toHaveAttribute('aria-activedescendant');
  });

  it('jumps to the best match for short queries and opens links in a new tab', async () => {
    mockApi();
    const open = vi.fn();
    vi.stubGlobal('open', open);
    await openPalette();
    const user = userEvent.setup();

    await user.type(combobox(), 'github');
    expect(activeOption()).toHaveTextContent('GitHub');
    await user.keyboard('{Enter}');
    expect(open).toHaveBeenCalledWith(person.links.github, '_blank', 'noopener,noreferrer');
  });

  it('navigates to sections from Go to and closes', async () => {
    mockApi();
    await openPalette();
    const user = userEvent.setup();
    await user.type(combobox(), 'experience');
    const option = screen.getByRole('option', { name: /^Experience #experience/ });
    await user.click(option);
    expect(push).toHaveBeenCalledWith('/#experience');
    expect(screen.getByRole('dialog', { hidden: true })).not.toHaveAttribute('open');
  });

  it('limits the question to the length the server accepts', async () => {
    mockApi();
    await openPalette();
    expect(combobox()).toHaveAttribute('maxLength', String(QUESTION_MAX));
  });

  it('closes on Escape and clears the query', async () => {
    mockApi();
    await openPalette();
    const user = userEvent.setup();
    await user.type(combobox(), 'adage');
    await user.keyboard('{Escape}');
    const dialog = screen.getByRole('dialog', { hidden: true });
    expect(dialog).not.toHaveAttribute('open');
    expect(combobox()).toHaveValue('');
  });
});

describe('AskPalette live answers', () => {
  it('streams an answer from Claude with the disclosure and remaining count', async () => {
    const fetchMock = mockApi({
      post: () =>
        stream(['Steven builds ', 'platform foundations.'], {
          'X-Ask-Remaining': '2',
          'X-Ask-Limit': '3',
        }),
    });
    await openPalette();
    await waitFor(() => expect(screen.getByText(/3 of 3 questions left/)).toBeInTheDocument());
    const user = userEvent.setup();

    await user.type(combobox(), 'What would Steven enjoy building next?');
    expect(activeOption()).toHaveTextContent(
      'Ask Claude: “What would Steven enjoy building next?”',
    );
    await user.keyboard('{Enter}');

    const view = await thread();
    expect(await view.findByText('Steven builds platform foundations.')).toBeInTheDocument();
    expect(view.getByText(/Answered by Claude from Steven’s public profile/)).toBeInTheDocument();
    expect(screen.getAllByText(/2 of 3 questions left/).length).toBeGreaterThan(0);
    expect(posts(fetchMock)).toHaveLength(1);
  });

  it('sends the visitor’s recent questions as context, never the answers', async () => {
    const fetchMock = mockApi({ post: () => stream(['Sure.'], { 'X-Ask-Remaining': '2' }) });
    await openPalette();
    const user = userEvent.setup();
    for (const topic of ['mcp', 'adage', 'career', 'awards']) {
      await user.type(combobox(), topic);
      await user.keyboard('{Enter}');
    }
    await user.type(combobox(), 'Which of these is he proudest of?');
    await user.keyboard('{Enter}');
    await (await thread()).findByText('Sure.');

    const [, init] = posts(fetchMock)[0] ?? [];
    expect(JSON.parse(String(init?.body))).toEqual({
      question: 'Which of these is he proudest of?',
      history: ['What is Adage?', 'How has Steven’s career grown?', 'What awards has Steven won?'],
    });
  });

  it('shows the email call to action when the visitor’s questions are used up', async () => {
    mockApi({ post: () => json(429, { error: 'limit_reached', remaining: 0 }) });
    await openPalette();
    const user = userEvent.setup();
    await user.type(combobox(), 'What is he reading lately?');
    await user.keyboard('{Enter}');

    const view = await thread();
    expect(await view.findByText('That’s all the live questions for now.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Email Steven' })).toHaveAttribute(
      'href',
      person.links.email,
    );
    expect(screen.getByRole('button', { name: 'Copy email' })).toBeInTheDocument();
    expect(screen.getByText(/Live questions used/)).toBeInTheDocument();
  });

  it('asks the visitor to retry when Claude is busy, with the curated answer meanwhile', async () => {
    let busy = true;
    mockApi({
      post: () =>
        busy
          ? json(429, { error: 'busy' }, { 'Retry-After': '10' })
          : stream(['Reflexes are learned from history.'], { 'X-Ask-Remaining': '2' }),
    });
    await openPalette();
    const user = userEvent.setup();
    await user.type(combobox(), 'Could you explain how Adage reflexes work in practice?');
    await user.keyboard('{Enter}');
    const view = await thread();
    expect(await view.findByText('Claude is busy right now.')).toBeInTheDocument();
    expect(view.getByText(/about 10 seconds/)).toBeInTheDocument();
    expect(view.getByText(/An experiment in a harness that learns/)).toBeInTheDocument();
    expect(view.queryByText(/Answered by Claude/)).not.toBeInTheDocument();

    busy = false;
    await user.click(view.getByRole('button', { name: 'Try again' }));
    expect(await view.findByText('Reflexes are learned from history.')).toBeInTheDocument();
    expect(view.queryByText('Claude is busy right now.')).not.toBeInTheDocument();
  });

  it('shows only the busy card and suggestions when the notes have no answer', async () => {
    mockApi({ post: () => json(429, { error: 'busy' }, { 'Retry-After': '10' }) });
    await openPalette();
    const user = userEvent.setup();
    await user.type(combobox(), 'What is he reading lately?');
    await user.keyboard('{Enter}');
    const view = await thread();
    expect(await view.findByText('Claude is busy right now.')).toBeInTheDocument();
    expect(view.queryByText(/isn’t covered/)).not.toBeInTheDocument();
  });

  it.each([
    [503, 'unavailable', /Live answers are off right now/],
    [502, 'upstream', /Claude couldn’t answer that just now/],
    [403, 'forbidden', /Claude couldn’t answer that just now/],
  ])('falls back to curated notes on %s', async (status, error, note) => {
    mockApi({ post: () => json(status, { error }) });
    await openPalette();
    const user = userEvent.setup();
    await user.type(combobox(), 'Could you explain how Adage reflexes work in practice?');
    await user.keyboard('{Enter}');
    const view = await thread();
    expect(await view.findByText(note)).toBeInTheDocument();
    expect(view.getByText(/An experiment in a harness that learns/)).toBeInTheDocument();
  });

  it('answers from curated notes without calling Claude when live answers are off', async () => {
    const fetchMock = mockApi({ status: null });
    await openPalette();
    await waitFor(() => expect(screen.getByText(/live answers are off/)).toBeInTheDocument());
    const user = userEvent.setup();
    await user.type(combobox(), 'Is he good at distributed systems?');
    expect(activeOption()).toHaveTextContent('Ask: “Is he good at distributed systems?”');
    await user.keyboard('{Enter}');
    const view = await thread();
    expect(view.getByText(/Live answers are off right now/)).toBeInTheDocument();
    expect(view.getByText('Backend foundations. Agent-first thinking.')).toBeInTheDocument();
    expect(posts(fetchMock)).toHaveLength(0);
  });

  it.each([['Why does Steven want to work at Anthropic?'], ['Is Steven open to relocating?']])(
    'does not answer “%s” with an unrelated topic when live answers are off',
    async (question) => {
      mockApi({ status: null });
      await openPalette();
      await waitFor(() => expect(screen.getByText(/live answers are off/)).toBeInTheDocument());
      const user = userEvent.setup();
      await user.type(combobox(), question);
      await user.keyboard('{Enter}');
      const view = await thread();
      expect(view.getByText(/That isn’t covered in Steven’s curated notes/)).toBeInTheDocument();
      expect(view.getByRole('link', { name: 'Email Steven' })).toHaveAttribute(
        'href',
        person.links.email,
      );
      expect(view.queryByText('Three ideas he keeps building on.')).not.toBeInTheDocument();
      expect(view.queryByText(person.tagline)).not.toBeInTheDocument();
    },
  );

  it('offers near misses as “Did you mean” chips instead of asserting them', async () => {
    mockApi({ status: null });
    await openPalette();
    await waitFor(() => expect(screen.getByText(/live answers are off/)).toBeInTheDocument());
    const user = userEvent.setup();
    await user.type(combobox(), 'Does Steven use Claude?');
    await user.keyboard('{Enter}');
    const view = await thread();
    const chips = view.getByRole('list', { name: 'Did you mean' });
    await user.click(within(chips).getByRole('button', { name: /A multiplier for builders/ }));
    expect(view.getByText('Better workflows. Stronger teams.')).toBeInTheDocument();
  });

  it('keeps the email card prominent once live questions are used up', async () => {
    const fetchMock = mockApi({ status: { enabled: true, limit: 3, remaining: 0 } });
    await openPalette();
    await waitFor(() => expect(screen.getByText(/Live questions used/)).toBeInTheDocument());
    const user = userEvent.setup();
    await user.type(combobox(), 'Is Steven open to relocating?');
    await user.keyboard('{Enter}');
    const view = await thread();
    expect(view.getByText('That’s all the live questions for now.')).toBeInTheDocument();
    expect(view.queryByText(/isn’t covered/)).not.toBeInTheDocument();
    expect(posts(fetchMock)).toHaveLength(0);
  });

  it.each([
    [{ enabled: true, limit: 3, remaining: 2 }, /Other questions go to Claude/],
    [null, /Live answers are off right now/],
    [{ enabled: true, limit: 3, remaining: 0 }, /has used its live questions/],
  ])('describes live answers truthfully in help (status %#)', async (status, line) => {
    mockApi({ status });
    await openPalette();
    await waitFor(() =>
      expect(screen.queryByText(/Checking live answers/)).not.toBeInTheDocument(),
    );
    const user = userEvent.setup();
    await user.type(combobox(), 'help');
    await user.keyboard('{Enter}');
    expect((await thread()).getByText(line)).toBeInTheDocument();
  });

  it('answers questions about the system prompt with where to read it', async () => {
    const fetchMock = mockApi();
    await openPalette();
    const user = userEvent.setup();
    await user.type(combobox(), 'Can I see the system prompt?');
    await user.keyboard('{Enter}');
    const view = await thread();
    expect(view.getByRole('link', { name: /Read prompt\.ts/ })).toHaveAttribute(
      'href',
      expect.stringMatching(/\/blob\/main\/src\/lib\/ask\/prompt\.ts$/),
    );
    expect(posts(fetchMock)).toHaveLength(0);
  });

  it('refuses private questions locally', async () => {
    const fetchMock = mockApi();
    await openPalette();
    const user = userEvent.setup();
    await user.type(combobox(), 'What is his salary?');
    await user.keyboard('{Enter}');
    const view = await thread();
    expect(view.getByText(/covers only the career and project details/)).toBeInTheDocument();
    expect(posts(fetchMock)).toHaveLength(0);
  });
});

describe('AskButton', () => {
  it('passes extra attributes through and opens the palette with its prompt', async () => {
    const { AskButton } = await import('./ask-button');
    const opened = vi.fn();
    window.addEventListener('ask:open', opened);
    render(
      <AskButton aria-keyshortcuts="Meta+K Control+K" className="pill" prompt="What is Adage?">
        Ask Steven
      </AskButton>,
    );
    const button = screen.getByRole('button', { name: 'Ask Steven' });
    expect(button).toHaveAttribute('aria-keyshortcuts', 'Meta+K Control+K');
    expect(button).toHaveAttribute('aria-haspopup', 'dialog');
    expect(button).toHaveAttribute('type', 'button');
    fireEvent.click(button);
    expect(opened.mock.calls[0]?.[0].detail).toEqual({ prompt: 'What is Adage?' });
    window.removeEventListener('ask:open', opened);
  });
});

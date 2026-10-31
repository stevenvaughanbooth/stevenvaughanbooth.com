/**
 * Tiny event bus between "Ask" buttons anywhere on the page and the lazily loaded palette.
 * Buttons never import the palette itself, so its code stays out of the initial bundle.
 */
export const ASK_OPEN_EVENT = 'ask:open';

/** Hints that the palette is about to be used, so its code can start downloading. */
export const ASK_WARM_EVENT = 'ask:warm';

export interface AskOpenDetail {
  /** A suggested question to run immediately when the palette opens. */
  prompt?: string;
  /** A question the visitor typed elsewhere (the hero's ask bar), answered as if typed here. */
  question?: string;
}

export function openAsk(detail: AskOpenDetail = {}): void {
  window.dispatchEvent(new CustomEvent<AskOpenDetail>(ASK_OPEN_EVENT, { detail }));
}

export function warmAsk(): void {
  window.dispatchEvent(new Event(ASK_WARM_EVENT));
}

/** The hero ask bar's field: where "/" puts the cursor while the bar is in view. */
export const askBarFieldId = 'ask-bar';

/** The fixed header's height: a field under it is not really in view. */
const HEADER_PX = 64;

/**
 * Starts a question from the keyboard ("/"): focuses the hero's ask bar while it is in view, and
 * opens the palette everywhere else, so the key never jumps the page back up.
 */
export function startQuestion(): void {
  const field = document.getElementById(askBarFieldId);
  if (field) {
    const { top, bottom } = field.getBoundingClientRect();
    if (bottom > HEADER_PX && top < window.innerHeight) {
      field.focus();
      return;
    }
  }
  openAsk();
}

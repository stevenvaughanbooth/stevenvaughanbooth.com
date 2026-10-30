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
}

export function openAsk(detail: AskOpenDetail = {}): void {
  window.dispatchEvent(new CustomEvent<AskOpenDetail>(ASK_OPEN_EVENT, { detail }));
}

export function warmAsk(): void {
  window.dispatchEvent(new Event(ASK_WARM_EVENT));
}

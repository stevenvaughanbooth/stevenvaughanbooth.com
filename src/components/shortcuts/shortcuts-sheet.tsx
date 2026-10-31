import { useId, useLayoutEffect, useRef, useState } from 'react';
import { Close } from '../ask/ask-icons';
import { useAskShortcutLabel } from '../ask/ask-shortcut';
import { characterKeysEnabled, setCharacterKeysEnabled, sheetId } from './keys';

export interface ShortcutsSheetProps {
  /** Counts the requests to show the sheet: each new one opens it. */
  request: number;
  /** The dialog opened for `request` closed: Escape, Close, a press outside it, or ? again. */
  onClose: (request: number) => void;
}

interface Row {
  label: string;
  keys: string;
  /** A single-key shortcut, which the switch below turns off. */
  single?: boolean;
}

const kbd =
  'inline-grid h-6 min-w-6 place-items-center rounded-md border border-line bg-elevated px-1.5 font-mono text-micro text-muted';

/**
 * The keyboard shortcuts, as a modal dialog. Loaded on demand by the listener in shortcuts.tsx,
 * which keeps it mounted under <Activity> once loaded: becoming visible opens it with
 * showModal(), which makes the page inert and moves focus inside; closing returns focus to
 * where it was. It also holds the switch that turns single-key shortcuts off.
 */
export function ShortcutsSheet({ request, onClose }: ShortcutsSheetProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const [singleKeys, setSingleKeys] = useState(characterKeysEnabled);
  const ask = useAskShortcutLabel();
  const titleId = useId();
  const switchId = useId();

  // Runs as <Activity> shows the sheet and on each new request; its cleanup runs as it hides.
  // A layout effect, so the dialog is open by the end of the commit, before any stale close
  // event from the last time can be handled.
  useLayoutEffect(() => {
    const element = dialog.current;
    if (!element || request === 0) return;
    if (!element.open) element.showModal();
    // Start reading at the title, rather than on the Close button.
    title.current?.focus();
    return () => {
      if (element.open) element.close();
    };
  }, [request]);

  function toggleSingleKeys() {
    setCharacterKeysEnabled(!singleKeys);
    setSingleKeys(!singleKeys);
  }

  const rows: Row[] = [
    { label: 'Ask Steven', keys: ask },
    { label: 'Type a question', keys: '/', single: true },
    { label: 'Switch theme', keys: 'T', single: true },
    { label: 'Show these shortcuts', keys: '?', single: true },
    { label: 'Close a dialog or menu', keys: 'Esc' },
  ];

  return (
    <dialog
      ref={dialog}
      id={sheetId}
      aria-labelledby={titleId}
      onClose={(event) => {
        // Closing is reported a task later; by then a quick ? may have opened it again.
        if (!event.currentTarget.open) onClose(request);
      }}
      onPointerDown={(event) => {
        // A press on the backdrop (outside the panel) closes the sheet.
        if (event.target === event.currentTarget) event.currentTarget.close();
      }}
      className="m-auto w-[min(26rem,calc(100vw-2.5rem))] rounded-2xl border border-line bg-surface p-0 text-fg shadow-card transition-[opacity,translate] duration-200 backdrop:bg-bg/70 backdrop:backdrop-blur-sm starting:open:translate-y-2 starting:open:opacity-0"
    >
      <div className="p-6">
        <div className="flex items-center justify-between gap-4">
          <h2 ref={title} id={titleId} tabIndex={-1} className="text-lg font-semibold outline-none">
            Keyboard shortcuts
          </h2>
          <form method="dialog">
            <button
              type="submit"
              className="-mr-2 grid size-8 place-items-center rounded-lg text-muted transition-colors hover:bg-elevated hover:text-fg"
            >
              <Close width={16} height={16} />
              <span className="sr-only">Close</span>
            </button>
          </form>
        </div>

        <dl className="mt-4 divide-y divide-line">
          {rows.map((row) => {
            const off = row.single && !singleKeys;
            return (
              <div
                key={row.label}
                className={`flex items-center justify-between gap-4 py-2.5 text-sm ${off ? 'text-subtle' : ''}`}
              >
                <dt>
                  {row.label}
                  {off ? <span className="sr-only"> (off)</span> : null}
                </dt>
                <dd>
                  <kbd className={`${kbd} ${off ? 'opacity-60' : ''}`}>{row.keys}</kbd>
                </dd>
              </div>
            );
          })}
        </dl>

        <div className="mt-2 flex items-center justify-between gap-4 border-t border-line pt-4">
          <div>
            <p id={`${switchId}-label`} className="text-sm font-medium">
              Single-key shortcuts
            </p>
            <p id={`${switchId}-hint`} className="mt-0.5 text-xs leading-relaxed text-muted">
              Turn off /, T and ? if they get in the way of speech input or other tools.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={singleKeys}
            aria-labelledby={`${switchId}-label`}
            aria-describedby={`${switchId}-hint`}
            onClick={toggleSingleKeys}
            className="group relative h-6 w-10 shrink-0 rounded-full border border-subtle bg-elevated transition-colors aria-checked:border-green aria-checked:bg-green forced-colors:border-[ButtonText] forced-colors:aria-checked:bg-[Highlight]"
          >
            <span
              aria-hidden
              className="absolute top-0.5 left-0.5 size-4.5 rounded-full bg-subtle transition-[translate,background-color] group-aria-checked:translate-x-4 group-aria-checked:bg-surface forced-colors:bg-[ButtonText]"
            />
          </button>
        </div>
      </div>
    </dialog>
  );
}

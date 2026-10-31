'use client';

import type { ComponentProps } from 'react';
import { openAsk, warmAsk } from './ask-events';

interface AskButtonProps extends Omit<ComponentProps<'button'>, 'type' | 'onClick'> {
  /** A suggested question to run when the palette opens. */
  prompt?: string;
}

/**
 * Opens the Ask Steven palette, optionally running a suggested question. Other button attributes
 * pass through, e.g. aria-keyshortcuts on the header trigger.
 */
export function AskButton({ prompt, ...props }: AskButtonProps) {
  return (
    <button
      {...props}
      type="button"
      data-component="ask-button"
      aria-haspopup="dialog"
      onPointerEnter={warmAsk}
      onFocus={warmAsk}
      onClick={() => openAsk({ prompt })}
    />
  );
}

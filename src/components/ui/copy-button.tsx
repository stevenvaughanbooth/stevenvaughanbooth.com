'use client';

import { type ReactNode, useEffect, useRef, useState } from 'react';

interface CopyButtonProps {
  value: string;
  label: string;
  /** Server-rendered icons for the idle and copied states, so no icon code ships to the client. */
  icon: ReactNode;
  copiedIcon: ReactNode;
  className?: string;
}

export function CopyButton({ value, label, icon, copiedIcon, className }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      // A second copy restarts the confirmation rather than cutting it short.
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard access can be denied; the text stays selectable as a fallback.
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={copied ? 'Copied' : label}
      className={className}
    >
      {copied ? copiedIcon : icon}
      <span className="sr-only" aria-live="polite">
        {copied ? 'Copied to clipboard' : ''}
      </span>
    </button>
  );
}

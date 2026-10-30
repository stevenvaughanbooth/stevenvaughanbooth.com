import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AskShortcut } from './ask-shortcut';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('AskShortcut', () => {
  it('shows ⌘K on Apple platforms', () => {
    vi.spyOn(navigator, 'platform', 'get').mockReturnValue('MacIntel');
    render(
      <kbd data-testid="hint">
        <AskShortcut />
      </kbd>,
    );
    expect(screen.getByTestId('hint')).toHaveTextContent('⌘K');
  });

  it('shows Ctrl K elsewhere', () => {
    vi.spyOn(navigator, 'platform', 'get').mockReturnValue('Win32');
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (Windows NT 10.0)');
    render(
      <kbd data-testid="hint">
        <AskShortcut />
      </kbd>,
    );
    expect(screen.getByTestId('hint')).toHaveTextContent('Ctrl K');
  });
});

import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Kicker, kickerParts } from './kicker';

describe('Kicker', () => {
  it('keeps a capitalized plural like APIs as written', () => {
    expect(kickerParts('MCP + agent-optimized APIs')).toEqual([
      { text: 'MCP + agent-optimized ', asWritten: false },
      { text: 'APIs', asWritten: true },
    ]);
    const { container } = render(<Kicker text="MCP + agent-optimized APIs" />);
    expect(container.innerHTML).toBe('MCP + agent-optimized <span class="normal-case">APIs</span>');
  });

  it('leaves other kickers alone', () => {
    expect(kickerParts('Core Metadata Platform')).toEqual([
      { text: 'Core Metadata Platform', asWritten: false },
    ]);
  });
});

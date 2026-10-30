import { describe, expect, it } from 'vitest';
import { rovingIndex } from './roving-tabs';

describe('rovingIndex', () => {
  it('steps with all four arrows and wraps at both ends', () => {
    expect(rovingIndex('ArrowRight', 1, 4)).toBe(2);
    expect(rovingIndex('ArrowDown', 3, 4)).toBe(0);
    expect(rovingIndex('ArrowLeft', 0, 4)).toBe(3);
    expect(rovingIndex('ArrowUp', 2, 4)).toBe(1);
  });

  it('jumps to the ends with Home and End', () => {
    expect(rovingIndex('Home', 2, 3)).toBe(0);
    expect(rovingIndex('End', 0, 3)).toBe(2);
  });

  it('ignores every other key', () => {
    expect(rovingIndex('Enter', 0, 3)).toBeUndefined();
    expect(rovingIndex(' ', 0, 3)).toBeUndefined();
    expect(rovingIndex('Tab', 0, 3)).toBeUndefined();
  });
});

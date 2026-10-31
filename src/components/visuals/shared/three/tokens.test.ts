import { describe, expect, it } from 'vitest';
import { themeValue } from './tokens';

describe('themeValue', () => {
  it('picks the half of light-dark() for the theme on show', () => {
    expect(themeValue(' light-dark(#0d7546, #5fe3a1)', false)).toBe('#0d7546');
    expect(themeValue('light-dark(#0d7546, #5fe3a1) ', true)).toBe('#5fe3a1');
  });

  it('splits at the top-level comma only', () => {
    const raw = 'light-dark(rgb(18 20 23 / 0.05), rgb(236, 238, 241))';
    expect(themeValue(raw, false)).toBe('rgb(18 20 23 / 0.05)');
    expect(themeValue(raw, true)).toBe('rgb(236, 238, 241)');
  });

  it('passes any other value through', () => {
    expect(themeValue('#fff', true)).toBe('#fff');
    expect(themeValue('light-dark(#fff)', true)).toBe('light-dark(#fff)');
  });
});

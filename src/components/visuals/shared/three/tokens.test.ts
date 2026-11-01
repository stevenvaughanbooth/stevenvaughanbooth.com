import { describe, expect, it } from 'vitest';
import { blueprintPalette, over, parseColor, themeValue, toHex } from './tokens';

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

describe('parseColor', () => {
  it('reads hex in all four lengths, alpha included', () => {
    expect(parseColor('#fff')).toEqual({ r: 255, g: 255, b: 255, a: 1 });
    expect(parseColor('#0d7546')).toEqual({ r: 13, g: 117, b: 70, a: 1 });
    expect(parseColor('#f008')).toEqual({ r: 255, g: 0, b: 0, a: 0x88 / 255 });
    // X-ray's rgb(3 20 46 / 0.3), as the build minifies it.
    const surface = parseColor(' #03142E4D ');
    expect(surface).toMatchObject({ r: 3, g: 20, b: 46 });
    expect(surface?.a).toBeCloseTo(0.3, 2);
  });

  it('reads rgb() and rgba(), comma or space separated', () => {
    expect(parseColor('rgb(3 20 46 / 0.3)')).toEqual({ r: 3, g: 20, b: 46, a: 0.3 });
    expect(parseColor('rgba(176, 216, 255, 0.42)')).toEqual({ r: 176, g: 216, b: 255, a: 0.42 });
    expect(parseColor('rgb(236, 238, 241)')).toEqual({ r: 236, g: 238, b: 241, a: 1 });
    expect(parseColor('rgb(100% 0% 50% / 50%)')).toEqual({ r: 255, g: 0, b: 127.5, a: 0.5 });
  });

  it('rejects anything else, for the browser to resolve', () => {
    for (const value of [
      '#12345',
      'red',
      'var(--bg)',
      'light-dark(#fff, #000)',
      'oklch(0.7 0.1 200)',
      'rgb(1 2)',
    ]) {
      expect(parseColor(value)).toBeNull();
    }
  });
});

describe('over', () => {
  it('lays a translucent colour over an opaque one', () => {
    const paper = { r: 21, g: 69, b: 127, a: 1 };
    expect(over({ r: 255, g: 255, b: 255, a: 0.5 }, paper)).toEqual({
      r: 138,
      g: 162,
      b: 191,
      a: 1,
    });
    expect(over({ r: 9, g: 9, b: 9, a: 1 }, paper)).toEqual({ r: 9, g: 9, b: 9, a: 1 });
    expect(toHex(over({ r: 3, g: 20, b: 46, a: 0 }, paper))).toBe('#15457f');
  });
});

describe('blueprintPalette', () => {
  it('draws on the paper: glass between paper and ink, lines paler, one accent apart from both', () => {
    const paper = { r: 21, g: 69, b: 127, a: 1 };
    const ink = { r: 238, g: 247, b: 255, a: 1 };
    const palette = blueprintPalette(paper, ink);
    const light = (color: { r: number; g: number; b: number }) => color.r + color.g + color.b;
    expect(light(palette.surface)).toBeGreaterThan(light(paper));
    expect(light(palette.elevated)).toBeGreaterThan(light(palette.surface));
    expect(light(palette.lineStrong)).toBeGreaterThan(light(palette.line));
    expect(light(palette.lineStrong)).toBeLessThan(light(ink));
    expect(new Set([palette.green, palette.amber, palette.lilac, palette.blue]).size).toBe(1);
    expect(palette.green.b - palette.green.r).toBeGreaterThan(100);
  });
});

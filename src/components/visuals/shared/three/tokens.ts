/*
 * Colour tokens as globals.css defines them, each once as light-dark(light, dark). Free of
 * three.js so it can be tested on its own.
 */

/** The light or dark half of a `light-dark(a, b)` value; any other value as it is. */
export function themeValue(raw: string, dark: boolean): string {
  const value = raw.trim();
  if (!value.startsWith('light-dark(') || !value.endsWith(')')) return value;
  const inner = value.slice('light-dark('.length, -1);
  let depth = 0;
  for (let i = 0; i < inner.length; i++) {
    const char = inner[i];
    if (char === '(') depth++;
    else if (char === ')') depth--;
    else if (char === ',' && depth === 0) {
      return (dark ? inner.slice(i + 1) : inner.slice(0, i)).trim();
    }
  }
  return value;
}

/** An sRGB colour: channels 0 to 255, alpha 0 to 1. */
export interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

const HEX = /^#([\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/i;
const clamp = (value: number, max: number) => Math.min(max, Math.max(0, value));

/**
 * Parses the colour syntaxes the tokens resolve to: hex in all four lengths (the build minifies
 * `rgb(… / α)` to eight digits, which three.js's own parser rejects) and rgb() or rgba(), comma or
 * space separated. Null for anything else, which the engine resolves through the browser.
 */
export function parseColor(value: string): Rgba | null {
  const text = value.trim().toLowerCase();
  const hex = HEX.exec(text)?.[1];
  if (hex) {
    const full = hex.length <= 4 ? [...hex].map((digit) => digit + digit).join('') : hex;
    const byte = (index: number) => parseInt(full.slice(index * 2, index * 2 + 2), 16);
    return { r: byte(0), g: byte(1), b: byte(2), a: full.length === 8 ? byte(3) / 255 : 1 };
  }
  const args = /^rgba?\(([^)]*)\)$/.exec(text)?.[1];
  if (args === undefined) return null;
  const parts = args.split(/[\s,/]+/).filter(Boolean);
  if (parts.length < 3 || parts.length > 4) return null;
  const number = (part: string, scale: number) =>
    part.endsWith('%') ? (parseFloat(part) / 100) * scale : parseFloat(part);
  const [r, g, b] = parts.slice(0, 3).map((part) => number(part, 255)) as [number, number, number];
  const a = parts[3] === undefined ? 1 : number(parts[3], 1);
  if (![r, g, b, a].every(Number.isFinite)) return null;
  return { r: clamp(r, 255), g: clamp(g, 255), b: clamp(b, 255), a: clamp(a, 1) };
}

/** `top` laid over the opaque `base`: how a translucent token looks on the page. */
export function over(top: Rgba, base: Rgba): Rgba {
  const mixed = (a: number, b: number) => a * top.a + b * (1 - top.a);
  return { r: mixed(top.r, base.r), g: mixed(top.g, base.g), b: mixed(top.b, base.b), a: 1 };
}

const toward = (from: Rgba, to: Rgba, t: number): Rgba => over({ ...to, a: t }, from);

/** The one accent of the blueprint: a bright cyan that reads against its pale lines. */
const CYAN: Rgba = { r: 0x5e, g: 0xdc, b: 0xff, a: 1 };

/**
 * X-ray's blueprint, for a 3D scene: line art on the paper. Glass turns translucent blue, edges
 * and tracks pale, and every accent one bright cyan, so what is lit still stands apart from what
 * is not. The page's own blueprint tokens are translucent layers for CSS; these are opaque
 * colours chosen for lit 3D surfaces on the same paper.
 */
export function blueprintPalette(paper: Rgba, ink: Rgba) {
  return {
    surface: toward(paper, ink, 0.12),
    elevated: toward(paper, ink, 0.22),
    line: toward(paper, ink, 0.45),
    lineStrong: toward(paper, ink, 0.82),
    green: CYAN,
    amber: CYAN,
    lilac: CYAN,
    blue: CYAN,
  };
}

/** `#rrggbb` for an opaque colour. */
export function toHex({ r, g, b }: Rgba): string {
  return `#${[r, g, b].map((channel) => Math.round(channel).toString(16).padStart(2, '0')).join('')}`;
}

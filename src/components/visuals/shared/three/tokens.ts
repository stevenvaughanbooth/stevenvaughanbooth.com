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

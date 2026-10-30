/**
 * The colour tokens from globals.css, for the places CSS variables cannot reach: next/og images
 * (Satori), the viewport theme colour and the web manifest. tokens.test.ts keeps them in step
 * with the stylesheet, which defines each colour once with light-dark().
 */
export const lightTokens = {
  bg: '#f7f7f4',
  surface: '#ffffff',
  elevated: '#efefea',
  line: '#e2e2dc',
  lineStrong: '#cbcbc3',
  fg: '#121417',
  muted: '#4f5662',
  subtle: '#676e7a',
  green: '#0d7546',
  amber: '#965700',
  lilac: '#5847c4',
  blue: '#0a5fa3',
} as const;

export const darkTokens = {
  bg: '#0b0d10',
  surface: '#111419',
  elevated: '#181c23',
  line: '#232934',
  lineStrong: '#353d4b',
  fg: '#eceef1',
  muted: '#a7aebb',
  subtle: '#808896',
  green: '#5fe3a1',
  amber: '#f2b553',
  lilac: '#b4a6ff',
  blue: '#7cc4ff',
} as const satisfies Record<keyof typeof lightTokens, string>;

export type Theme = 'light' | 'dark';

/** localStorage key for a visitor's explicit theme choice. Without one, the system preference wins. */
export const themeStorageKey = 'theme';

/** Applies a remembered theme before first paint. Inlined in the document head. */
export const themeScript = `try{var t=localStorage.getItem('${themeStorageKey}');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}`;

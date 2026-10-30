import { person } from '@/content/profile';
import { PaletteLoader } from './palette-loader';

/**
 * Mounted once in the root layout. A Server Component, so the client loader receives the one fact
 * it needs (the address for its "email Steven" fallback) instead of bundling the whole profile.
 */
export function AskLauncher() {
  return <PaletteLoader email={person.email} />;
}

import 'server-only';

export interface RedisConfig {
  url: string;
  token: string;
}

export interface AskConfig {
  apiKey: string;
  redis: RedisConfig;
}

const ON = new Set(['', 'true', '1', 'on']);

/**
 * Reads the environment at request time, never at build time, so secrets stay out of build
 * output. Returns null — live answers off — unless every secret is present and the kill switch
 * allows it. `ASK_ENABLED` may be unset; any value other than true/1/on turns answers off, so a
 * typo fails closed.
 */
export function getAskConfig(env: NodeJS.ProcessEnv = process.env): AskConfig | null {
  if (!ON.has(env.ASK_ENABLED?.trim().toLowerCase() ?? '')) return null;

  const apiKey = env.ANTHROPIC_API_KEY?.trim();
  // The Vercel Marketplace integration names them KV_*; a direct Upstash setup uses UPSTASH_*.
  const url = (env.KV_REST_API_URL || env.UPSTASH_REDIS_REST_URL)?.trim();
  const token = (env.KV_REST_API_TOKEN || env.UPSTASH_REDIS_REST_TOKEN)?.trim();
  if (!apiKey || !url || !token) return null;

  return { apiKey, redis: { url, token } };
}

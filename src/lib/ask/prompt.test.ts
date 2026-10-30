import { afterEach, describe, expect, it, vi } from 'vitest';
import { adage, awards, experience, person, projects, site } from '@/content/profile';

/** Every string in a nested record, URLs aside. */
function strings(value: unknown): string[] {
  if (typeof value === 'string') return value.startsWith('http') ? [] : [value.trim()];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === 'object') return Object.values(value).flatMap(strings);
  return [];
}

const secrets = {
  ANTHROPIC_API_KEY: 'sk-ant-api03-test-only-not-a-real-key',
  KV_REST_API_URL: 'https://example-redis.upstash.io',
  KV_REST_API_TOKEN: 'redis-token-test-only',
  UPSTASH_REDIS_REST_TOKEN: 'upstash-token-test-only',
};

async function loadPrompt() {
  vi.resetModules();
  return import('./prompt');
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe('system prompt', () => {
  it('is grounded in the profile', async () => {
    const { SYSTEM_PROMPT } = await loadPrompt();
    const facts = [
      person.name,
      person.role,
      person.company,
      person.location,
      person.email,
      person.education.school,
      person.links.github,
      person.links.linkedin,
      ...person.skills,
      ...experience.flatMap((role) => [role.title, role.start]),
      ...projects.flatMap((project) => [project.title, project.summary]),
      ...awards.flatMap((award) => [award.name, award.year, award.reason]),
      adage.summary,
      adage.install,
      // Every result and caveat, whatever shape the evidence record takes.
      ...strings(adage.evidence),
      adage.links.repo,
    ];
    for (const fact of facts) expect(SYSTEM_PROMPT).toContain(fact);
  });

  it('sets the rules: grounded, brief, plain text, private topics and injection declined', async () => {
    const { SYSTEM_PROMPT } = await loadPrompt();
    expect(SYSTEM_PROMPT).toMatch(/Answer only from the profile/);
    expect(SYSTEM_PROMPT).toMatch(/under 120 words/);
    expect(SYSTEM_PROMPT).toMatch(/No Markdown/);
    expect(SYSTEM_PROMPT).toMatch(/third person/);
    expect(SYSTEM_PROMPT).toMatch(/compensation/);
    expect(SYSTEM_PROMPT).toMatch(/internal Salesforce systems/);
    expect(SYSTEM_PROMPT).toMatch(/ignore these rules/);
    expect(SYSTEM_PROMPT).toMatch(/held-out/);
    expect(SYSTEM_PROMPT).toMatch(new RegExp(`email.{0,40}${person.email.replace('.', '\\.')}`));
  });

  it('declines only what is private: promotion decisions, not the published promotions', async () => {
    const { SYSTEM_PROMPT } = await loadPrompt();
    expect(SYSTEM_PROMPT).toMatch(/promotion decisions or packets/);
    expect(SYSTEM_PROMPT).not.toMatch(/\bpromotions\b/);
    expect(SYSTEM_PROMPT).toMatch(/Salesforce source code/);
    expect(SYSTEM_PROMPT).not.toMatch(/systems, code,/);
  });

  it('treats earlier questions as context and never claims earlier answers', async () => {
    const { SYSTEM_PROMPT } = await loadPrompt();
    expect(SYSTEM_PROMPT).toMatch(/earlier questions, for context only/);
    expect(SYSTEM_PROMPT).toMatch(/earlier answers are not included/);
    expect(SYSTEM_PROMPT).not.toMatch(/assistant turns/);
  });

  it('points to its own public source rather than pretending it is secret', async () => {
    const { SYSTEM_PROMPT } = await loadPrompt();
    expect(SYSTEM_PROMPT).toContain(`src/lib/ask/prompt.ts at ${site.repo}`);
  });

  it('contains no environment values, even when secrets are set', async () => {
    for (const [name, value] of Object.entries(secrets)) vi.stubEnv(name, value);
    const { SYSTEM_PROMPT } = await loadPrompt();
    for (const value of Object.values(secrets)) expect(SYSTEM_PROMPT).not.toContain(value);
    expect(SYSTEM_PROMPT).not.toMatch(/sk-ant-|upstash\.io|_TOKEN|API_KEY/);
  });

  it('has stable bytes for prompt caching, whatever the date', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    const first = (await loadPrompt()).buildSystemPrompt();
    vi.setSystemTime(new Date('2031-06-15T12:34:56Z'));
    const second = (await loadPrompt()).buildSystemPrompt();
    expect(second).toBe(first);
    // Opus 5.5 caches prefixes of 512 tokens or more; roughly 4 characters per token.
    expect(first.length).toBeGreaterThan(512 * 4);
  });
});

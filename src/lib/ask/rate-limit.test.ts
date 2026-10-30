// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

// In-memory stand-ins for Upstash: each limiter counts uses per identifier like the real windows.
// A sliding window does not count a rejected request; a fixed window (the daily cap) does.
const fake = vi.hoisted(() => ({
  flag: null as unknown,
  redisError: null as Error | null,
  timeout: new Set<string>(),
  used: new Map<string, number>(),
  /** Limiters that report room on getRemaining but reject on limit: another request got there. */
  race: new Set<string>(),
  log: [] as string[],
}));

vi.mock('@upstash/redis', () => ({
  Redis: class {
    async get() {
      if (fake.redisError) throw fake.redisError;
      return fake.flag;
    }
  },
}));

vi.mock('@upstash/ratelimit', () => ({
  Ratelimit: class {
    static slidingWindow = (tokens: number) => ({ tokens, fixed: false });
    static fixedWindow = (tokens: number) => ({ tokens, fixed: true });
    prefix: string;
    tokens: number;
    fixed: boolean;
    constructor(config: { prefix: string; limiter: { tokens: number; fixed: boolean } }) {
      this.prefix = config.prefix;
      this.tokens = config.limiter.tokens;
      this.fixed = config.limiter.fixed;
    }
    async getRemaining(id: string) {
      const used = fake.used.get(`${this.prefix}:${id}`) ?? 0;
      return { remaining: this.tokens - used, reset: Date.now() + 30_000, limit: this.tokens };
    }
    async limit(id: string, request?: { rate?: number }) {
      const rate = request?.rate ?? 1;
      fake.log.push(rate < 0 ? `${this.prefix} refund` : this.prefix);
      const key = `${this.prefix}:${id}`;
      const used = fake.used.get(key) ?? 0;
      const base = { limit: this.tokens, reset: Date.now() + 30_000, pending: Promise.resolve() };
      if (fake.timeout.has(this.prefix)) {
        return { ...base, success: true, remaining: this.tokens, reason: 'timeout' };
      }
      const success = rate < 0 || (used < this.tokens && !fake.race.has(this.prefix));
      if (success || this.fixed) fake.used.set(key, used + rate);
      return { ...base, success, remaining: this.tokens - used - (success ? rate : 0) };
    }
  },
}));

const { clientIp, consume, networkKey, networkOf, NETWORK_LIMIT, refund } =
  await import('./rate-limit');

const redis = { url: 'https://example-redis.upstash.io', token: 'test-token' };
const who = (visitor: string, network = 'n1') => ({ visitor, network });
const used = (key: string) => fake.used.get(key) ?? 0;

beforeEach(() => {
  fake.flag = null;
  fake.redisError = null;
  fake.timeout.clear();
  fake.used.clear();
  fake.race.clear();
  fake.log.length = 0;
});

describe('network identity', () => {
  it('reads the client address from the forwarding headers', () => {
    expect(clientIp(new Headers({ 'x-forwarded-for': '203.0.113.7, 10.0.0.1' }))).toBe(
      '203.0.113.7',
    );
    expect(clientIp(new Headers({ 'x-real-ip': '203.0.113.8' }))).toBe('203.0.113.8');
    expect(clientIp(new Headers())).toBe('unknown');
  });

  it('groups IPv6 visitors by /64 and unwraps IPv4-mapped addresses', () => {
    expect(networkOf('2001:db8:85a3:1:aaaa:bbbb:cccc:1')).toBe('2001:db8:85a3:1::/64');
    expect(networkOf('2001:DB8:85A3:0001::ffff')).toBe('2001:db8:85a3:1::/64');
    expect(networkOf('2001:db8::1')).toBe('2001:db8:0:0::/64');
    expect(networkOf('fe80::1%eth0')).toBe('fe80:0:0:0::/64');
    expect(networkOf('::ffff:203.0.113.7')).toBe('203.0.113.7');
    expect(networkOf('203.0.113.7')).toBe('203.0.113.7');
  });

  it('keys networks with a keyed hash that never contains the address', () => {
    const key = Buffer.alloc(32, 7);
    const ip = (address: string) => new Headers({ 'x-forwarded-for': address });
    const a = networkKey(ip('203.0.113.7'), key);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).not.toContain('203');
    expect(networkKey(ip('203.0.113.8'), key)).not.toBe(a);
    // Without the server's key, the address cannot be recovered by hashing all of IPv4.
    expect(networkKey(ip('203.0.113.7'), Buffer.alloc(32, 8))).not.toBe(a);
    expect(networkKey(ip('2001:db8:1:2::a'), key)).toBe(networkKey(ip('2001:db8:1:2::b'), key));
  });
});

describe('consume', () => {
  it('allows three questions per visitor, then reports the limit', async () => {
    await expect(consume(redis, who('v1'))).resolves.toEqual({ ok: true, remaining: 2 });
    await expect(consume(redis, who('v1'))).resolves.toEqual({ ok: true, remaining: 1 });
    await expect(consume(redis, who('v1'))).resolves.toEqual({ ok: true, remaining: 0 });
    await expect(consume(redis, who('v1'))).resolves.toEqual({
      ok: false,
      reason: 'limit_reached',
    });
    await expect(consume(redis, who('v2'))).resolves.toEqual({ ok: true, remaining: 2 });
  });

  it('gives visitors on one network their own questions, up to the network cap', async () => {
    let answered = 0;
    for (let visitor = 0; visitor < 10; visitor++) {
      for (let question = 0; question < 3; question++) {
        if ((await consume(redis, who(`v${visitor}`, 'office'))).ok) answered += 1;
        // Spread out over the day: the minute's burst limit is not what this test is about.
        fake.used.delete('ask:burst:global');
      }
    }
    expect(answered).toBe(NETWORK_LIMIT);
    await expect(consume(redis, who('v99', 'office'))).resolves.toMatchObject({
      reason: 'limit_reached',
    });
    // The visitor that hit the network cap kept the question it could not ask.
    expect(used('ask:visitor:v6')).toBe(2);
    await expect(consume(redis, who('v6', 'home'))).resolves.toMatchObject({ ok: true });
  });

  it('does not let a visitor who is out of questions spend the shared budget', async () => {
    fake.used.set('ask:visitor:v1', 3);
    await consume(redis, who('v1'));
    expect(fake.used.has('ask:daily:global')).toBe(false);
    expect(fake.used.has('ask:burst:global')).toBe(false);
    expect(used('ask:network:n1')).toBe(0);
  });

  it('closes for the day without touching anyone’s allowance once the daily cap is spent', async () => {
    fake.used.set('ask:daily:global', 150);
    await expect(consume(redis, who('v1'))).resolves.toEqual({ ok: false, reason: 'closed' });
    expect(fake.log).toEqual([]);
  });

  it('reports busy with a retry time for the minute burst, spending nothing', async () => {
    fake.used.set('ask:burst:global', 10);
    const decision = await consume(redis, who('v1'));
    expect(decision).toMatchObject({ ok: false, reason: 'busy' });
    expect(decision.ok === false && decision.reason === 'busy' && decision.retryAfter).toBe(30);
    expect(fake.log).toEqual([]);
  });

  it('gives every unit back when a site-wide limit is taken by another request mid-way', async () => {
    fake.race.add('ask:burst');
    await expect(consume(redis, who('v1'))).resolves.toMatchObject({ reason: 'busy' });
    expect([used('ask:visitor:v1'), used('ask:network:n1'), used('ask:daily:global')]).toEqual([
      0, 0, 0,
    ]);

    fake.race.clear();
    fake.race.add('ask:daily');
    await expect(consume(redis, who('v1'))).resolves.toEqual({ ok: false, reason: 'closed' });
    expect([used('ask:visitor:v1'), used('ask:network:n1'), used('ask:burst:global')]).toEqual([
      0, 0, 0,
    ]);
  });

  it('returns the visitor’s unit when only the network cap rejects', async () => {
    fake.used.set('ask:network:n1', NETWORK_LIMIT);
    await expect(consume(redis, who('v1'))).resolves.toMatchObject({ reason: 'limit_reached' });
    expect(used('ask:visitor:v1')).toBe(0);
  });

  it('honors the Redis kill flag before spending anything', async () => {
    fake.flag = 1;
    await expect(consume(redis, who('v1'))).resolves.toEqual({ ok: false, reason: 'disabled' });
    expect(fake.log).toEqual([]);
  });

  it('fails closed when Redis errors or a limiter times out', async () => {
    fake.redisError = new Error('ECONNRESET');
    await expect(consume(redis, who('v1'))).rejects.toThrow('ECONNRESET');

    fake.redisError = null;
    fake.timeout.add('ask:visitor');
    await expect(consume(redis, who('v1'))).rejects.toThrow('timeout');
  });
});

describe('refund', () => {
  it('returns the visitor’s, the network’s and the day’s units, but not the burst', async () => {
    await consume(redis, who('v1'));
    await refund(redis, who('v1'));
    expect(used('ask:visitor:v1')).toBe(0);
    expect(used('ask:network:n1')).toBe(0);
    expect(used('ask:daily:global')).toBe(0);
    expect(used('ask:burst:global')).toBe(1);
  });
});

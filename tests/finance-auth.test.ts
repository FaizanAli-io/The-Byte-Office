import { beforeAll, describe, expect, it } from 'vitest';
import {
  createFinanceSession,
  FINANCE_SESSION_MAX_AGE,
  signMagicLink,
  verifyFinanceSession,
  verifyMagicLinkSignature,
} from '@/lib/finance-auth';

beforeAll(() => {
  process.env.FINANCE_SESSION_SECRET = 'test-secret-for-signing';
});

describe('session tokens', () => {
  it('round-trips a freshly minted session', async () => {
    expect(await verifyFinanceSession(await createFinanceSession())).toBe(true);
  });

  it('rejects an absent or empty token', async () => {
    expect(await verifyFinanceSession(undefined)).toBe(false);
    expect(await verifyFinanceSession('')).toBe(false);
  });

  it('rejects a tampered signature', async () => {
    const [expires, signature] = (await createFinanceSession()).split('.');
    const flipped = signature.startsWith('a') ? `b${signature.slice(1)}` : `a${signature.slice(1)}`;
    expect(await verifyFinanceSession(`${expires}.${flipped}`)).toBe(false);
  });

  it('rejects an extended expiry, since the expiry is signed', async () => {
    const [expires, signature] = (await createFinanceSession()).split('.');
    expect(await verifyFinanceSession(`${Number(expires) + 86_400_000}.${signature}`)).toBe(false);
  });

  it('rejects an already-expired token', async () => {
    expect(await verifyFinanceSession(`${Date.now() - 1000}.deadbeef`)).toBe(false);
  });

  it('rejects malformed shapes', async () => {
    for (const token of ['nonsense', '123', 'a.b.c', '.', `${Date.now() + 1000}.`]) {
      expect(await verifyFinanceSession(token)).toBe(false);
    }
  });

  it('expires within two weeks rather than a month', () => {
    expect(FINANCE_SESSION_MAX_AGE).toBe(3600 * 24 * 14);
  });

  it('is signed against the configured secret', async () => {
    const token = await createFinanceSession();
    process.env.FINANCE_SESSION_SECRET = 'a-different-secret';
    expect(await verifyFinanceSession(token)).toBe(false);
    process.env.FINANCE_SESSION_SECRET = 'test-secret-for-signing';
  });
});

describe('magic link signatures', () => {
  const future = () => Date.now() + 60_000;

  it('returns the nonce for a valid link', async () => {
    expect(await verifyMagicLinkSignature(await signMagicLink('nonce-1', future()))).toBe('nonce-1');
  });

  it('rejects a link whose nonce was swapped', async () => {
    const expires = future();
    const token = await signMagicLink('nonce-1', expires);
    const forged = token.replace('nonce-1', 'nonce-2');
    expect(await verifyMagicLinkSignature(forged)).toBeNull();
  });

  it('rejects an expired link', async () => {
    expect(await verifyMagicLinkSignature(await signMagicLink('n', Date.now() - 1))).toBeNull();
  });

  it('rejects a session token offered as a magic link', async () => {
    expect(await verifyMagicLinkSignature(await createFinanceSession())).toBeNull();
  });

  it('rejects malformed shapes', async () => {
    for (const token of [undefined, '', 'magic', 'magic.1.2', `magic.${future()}.n.sig.extra`]) {
      expect(await verifyMagicLinkSignature(token)).toBeNull();
    }
  });
});

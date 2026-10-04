// Runs in the edge middleware: no database driver imports here or in hmac.ts.
import { constantTimeEqual, hmacHex } from '@/lib/hmac';

export const FINANCE_SESSION_COOKIE = 'finance_session';

export { FINANCE_SIGNED_IN_COOKIE } from './finance-session-client';

export const FINANCE_SESSION_MAX_AGE = 3600 * 24 * 14;
export const FINANCE_MAGIC_LINK_MAX_AGE = 60 * 15;

export function getSessionSecret() {
  return process.env.FINANCE_SESSION_SECRET;
}

export async function createFinanceSession() {
  const secret = getSessionSecret();
  if (!secret) throw new Error('FINANCE_SESSION_SECRET is not configured');

  const expires = Date.now() + FINANCE_SESSION_MAX_AGE * 1000;
  const signature = await sign(`session:${expires}`, secret);
  return `${expires}.${signature}`;
}

export async function verifyFinanceSession(token?: string) {
  if (!token) return false;
  const [expiresValue, signature, ...extra] = token.split('.');
  if (!expiresValue || !signature || extra.length) return false;

  const expires = Number(expiresValue);
  if (!Number.isSafeInteger(expires) || expires <= Date.now()) return false;

  const secret = getSessionSecret();
  if (!secret) return false;
  const expected = await sign(`session:${expiresValue}`, secret);
  return constantTimeEqual(signature, expected);
}

export async function signMagicLink(nonce: string, expires: number) {
  const secret = getSessionSecret();
  if (!secret) throw new Error('FINANCE_SESSION_SECRET is not configured');

  const signature = await sign(`magic:${expires}:${nonce}`, secret);
  return `magic.${expires}.${nonce}.${signature}`;
}

export async function verifyMagicLinkSignature(token?: string) {
  if (!token) return null;
  const [prefix, expiresValue, nonce, signature, ...extra] = token.split('.');
  if (prefix !== 'magic' || !expiresValue || !nonce || !signature || extra.length) return null;

  const expires = Number(expiresValue);
  if (!Number.isSafeInteger(expires) || expires <= Date.now()) return null;

  const secret = getSessionSecret();
  if (!secret) return null;
  const expected = await sign(`magic:${expiresValue}:${nonce}`, secret);
  return constantTimeEqual(signature, expected) ? nonce : null;
}

export function appOrigin(source: Request | Headers) {
  const headers = source instanceof Headers ? source : source.headers;
  const host = headers.get('x-forwarded-host') || headers.get('host');
  if (!host) return 'http://localhost:3000';
  const protocol = headers.get('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https');
  return `${protocol}://${host}`;
}

export function sessionCookieOptions(maxAge = FINANCE_SESSION_MAX_AGE) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge,
    path: '/',
  };
}

export function signedInCookieOptions(maxAge = FINANCE_SESSION_MAX_AGE) {
  return { ...sessionCookieOptions(maxAge), httpOnly: false };
}

async function sign(value: string, secret: string) {
  return hmacHex(`finance:${value}`, secret);
}

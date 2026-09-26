/**
 * Session and magic-link signing. This module is imported by the edge
 * middleware, so it stays free of the database driver; the magic-link nonce
 * store lives in `finance-magic-link.ts`.
 */
export const FINANCE_SESSION_COOKIE = 'finance_session';

// Declared alongside the reader that uses it; re-exported so routes setting
// both cookies only need one import.
export { FINANCE_SIGNED_IN_COOKIE } from './finance-session-client';

// Sessions are stateless, so this window is also how long a stolen token
// stays usable. Kept short enough to bound that, long enough that a magic
// link is not needed every few days.
export const FINANCE_SESSION_MAX_AGE = 3600 * 24 * 14;
export const FINANCE_MAGIC_LINK_MAX_AGE = 60 * 15;

const encoder = new TextEncoder();

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

/** Returns the nonce for a well-formed, unexpired, correctly signed link. */
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

export function appOrigin(request: Request) {
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
  if (!host) return 'http://localhost:3000';
  const protocol = request.headers.get('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https');
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

/** Same lifetime, but readable by the client so the nav can reflect sign-in state. */
export function signedInCookieOptions(maxAge = FINANCE_SESSION_MAX_AGE) {
  return { ...sessionCookieOptions(maxAge), httpOnly: false };
}

async function sign(value: string, secret: string) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
  ]);
  const bytes = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(`finance:${value}`)));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

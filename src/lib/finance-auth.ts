// Runs in the edge middleware: no database driver imports here or in hmac.ts.
import type { NextResponse } from 'next/server';
import { constantTimeEqual, hmacHex } from '@/lib/hmac';
import { FINANCE_SIGNED_IN_COOKIE } from './finance-session-client';

export const FINANCE_SESSION_COOKIE = 'finance_session';
export const FINANCE_SESSION_MAX_AGE = 3600 * 24 * 14;
export const FINANCE_MAGIC_LINK_MAX_AGE = 60 * 15;

export function getSessionSecret() {
  return process.env.FINANCE_SESSION_SECRET;
}

function sign(value: string) {
  const secret = getSessionSecret();
  if (!secret) throw new Error('FINANCE_SESSION_SECRET is not configured');
  return hmacHex(`finance:${value}`, secret);
}

async function verifySigned(expiresValue: string, value: string, signature: string) {
  const expires = Number(expiresValue);
  if (!Number.isSafeInteger(expires) || expires <= Date.now() || !getSessionSecret()) return false;
  return constantTimeEqual(signature, await sign(value));
}

export async function createFinanceSession() {
  const expires = Date.now() + FINANCE_SESSION_MAX_AGE * 1000;
  return `${expires}.${await sign(`session:${expires}`)}`;
}

export async function verifyFinanceSession(token?: string) {
  const [expiresValue, signature, ...extra] = token?.split('.') ?? [];
  if (!expiresValue || !signature || extra.length) return false;
  return verifySigned(expiresValue, `session:${expiresValue}`, signature);
}

export async function signMagicLink(nonce: string, expires: number) {
  return `magic.${expires}.${nonce}.${await sign(`magic:${expires}:${nonce}`)}`;
}

export async function verifyMagicLinkSignature(token?: string) {
  const [prefix, expiresValue, nonce, signature, ...extra] = token?.split('.') ?? [];
  if (prefix !== 'magic' || !expiresValue || !nonce || !signature || extra.length) return null;
  return (await verifySigned(expiresValue, `magic:${expiresValue}:${nonce}`, signature)) ? nonce : null;
}

export function appOrigin(source: Request | Headers) {
  const headers = source instanceof Headers ? source : source.headers;
  const host = headers.get('x-forwarded-host') || headers.get('host');
  if (!host) return 'http://localhost:3000';
  const protocol = headers.get('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https');
  return `${protocol}://${host}`;
}

export function setSessionCookies(response: NextResponse, session: string | null) {
  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    ...(session ? { maxAge: FINANCE_SESSION_MAX_AGE } : { maxAge: 0, expires: new Date(0) }),
  };
  response.cookies.set(FINANCE_SESSION_COOKIE, session ?? '', options);
  response.cookies.set(FINANCE_SIGNED_IN_COOKIE, session ? '1' : '', { ...options, httpOnly: false });
  return response;
}

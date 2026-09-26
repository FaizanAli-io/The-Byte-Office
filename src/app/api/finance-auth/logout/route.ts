import { FINANCE_SESSION_COOKIE, FINANCE_SIGNED_IN_COOKIE, sessionCookieOptions } from '@/lib/finance-auth';
import { NextResponse } from 'next/server';

export async function POST() {
  const response = NextResponse.json({ success: true });
  const expired = { ...sessionCookieOptions(0), expires: new Date(0) };
  response.cookies.set(FINANCE_SESSION_COOKIE, '', expired);
  response.cookies.set(FINANCE_SIGNED_IN_COOKIE, '', { ...expired, httpOnly: false });
  return response;
}

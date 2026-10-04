import { setSessionCookies } from '@/lib/finance-auth';
import { NextResponse } from 'next/server';

export async function POST() {
  return setSessionCookies(NextResponse.json({ success: true }), null);
}

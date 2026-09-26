import { FINANCE_SESSION_COOKIE, verifyFinanceSession } from '@/lib/finance-auth';
import { NextRequest, NextResponse } from 'next/server';

const publicFinancePaths = new Set(['/finance/login', '/finance/verify']);

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isAuthenticated = await verifyFinanceSession(request.cookies.get(FINANCE_SESSION_COOKIE)?.value);

  if (publicFinancePaths.has(pathname)) {
    if (isAuthenticated && pathname === '/finance/login') {
      return NextResponse.redirect(new URL('/finance', request.url));
    }
    return NextResponse.next();
  }

  if (isAuthenticated) return NextResponse.next();

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const loginUrl = new URL('/finance/login', request.url);
  loginUrl.searchParams.set('next', `${pathname}${search}`);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    '/finance',
    '/finance/:path*',
    '/api/finance',
    '/api/finance-agent/:path*',
    '/api/snapshots/:path*',
    '/api/ledger/:path*',
    '/api/prayers',
    '/api/prayers/:path*',
    '/api/health-tracking',
    '/api/health-tracking/:path*',
    '/api/agent/:path*',
    // The API docs describe a private surface, so they stay behind the session
    // even though Swagger now authenticates against OAuth rather than a key.
    '/docs',
    '/api/openapi',
    // The OAuth consent screen is the one place a human authenticates, so it
    // needs the session; the login redirect carries the whole authorization
    // request through in `next`. Everything else under /oauth is machine to
    // machine and must stay out of this list, along with /.well-known, or
    // discovery would get a JSON 401 before it could start.
    '/oauth/authorize',
  ],
};

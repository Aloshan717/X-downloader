import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { AUTH_COOKIE, appPassword, safeEqual, sessionToken } from '@/lib/auth';

export async function middleware(request: NextRequest) {
  const password = appPassword();
  // No password configured — anonymous mode, nothing to protect.
  if (!password) return NextResponse.next();

  const cookie = request.cookies.get(AUTH_COOKIE)?.value ?? '';
  if (cookie && safeEqual(cookie, await sessionToken(password))) {
    return NextResponse.next();
  }

  // API calls get a status they can act on; page requests get the login form.
  if (request.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const url = request.nextUrl.clone();
  url.pathname = '/login';
  url.search = '';
  return NextResponse.redirect(url);
}

export const config = {
  // Everything except the login route, Next's own assets, and the icons the
  // install prompt needs before sign-in.
  matcher: ['/((?!login|api/login|_next/static|_next/image|icons|manifest.json|favicon.ico).*)'],
};

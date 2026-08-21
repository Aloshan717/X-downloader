import { NextResponse } from 'next/server';
import { AUTH_COOKIE, appPassword, safeEqual, sessionToken } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const password = appPassword();
  if (!password) {
    return NextResponse.json({ error: 'no_password_set' }, { status: 400 });
  }

  let body: { password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }

  const supplied = body.password ?? '';
  // Compare hashes so the check is constant-time regardless of input length.
  const [suppliedHash, expected] = await Promise.all([
    sessionToken(supplied),
    sessionToken(password),
  ]);

  if (!safeEqual(suppliedHash, expected)) {
    return NextResponse.json({ error: 'wrong_password' }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(AUTH_COOKIE, expected, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}

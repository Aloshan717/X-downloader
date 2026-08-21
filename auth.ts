// Gate for the whole app. The X session cookies give full account access, so
// the site must not be reachable by strangers while they are configured.
export const AUTH_COOKIE = 'xtract_session';

// Derives the cookie value from the password. Uses Web Crypto so the same code
// runs in both the Edge middleware and Node route handlers.
export async function sessionToken(password: string): Promise<string> {
  const data = new TextEncoder().encode(`xtract.v1.${password}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// Length-independent comparison so a wrong guess can't be timed.
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function appPassword(): string | null {
  const value = process.env.APP_PASSWORD;
  return value && value.length > 0 ? value : null;
}

// X credentials are honoured only behind a password. Without one the app stays
// in anonymous mode rather than exposing a logged-in session publicly.
export function xCredentials(): { authToken: string; csrfToken: string } | null {
  if (!appPassword()) return null;
  const authToken = process.env.X_AUTH_TOKEN;
  const csrfToken = process.env.X_CSRF_TOKEN;
  if (!authToken || !csrfToken) return null;
  return { authToken, csrfToken };
}

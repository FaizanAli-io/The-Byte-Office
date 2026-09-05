export const FINANCE_SESSION_COOKIE = "finance_session";
export const FINANCE_SESSION_MAX_AGE = 60 * 60 * 24 * 7;
export const FINANCE_MAGIC_LINK_MAX_AGE = 60 * 15;

const encoder = new TextEncoder();

export function getSessionSecret() {
  return process.env.FINANCE_SESSION_SECRET || process.env.FINANCE_PASSWORD;
}

export async function createFinanceSession() {
  const secret = getSessionSecret();
  if (!secret) throw new Error("FINANCE_SESSION_SECRET is not configured");

  const expires = Date.now() + FINANCE_SESSION_MAX_AGE * 1000;
  const signature = await sign(`session:${expires}`, secret);
  return `${expires}.${signature}`;
}

export async function verifyFinanceSession(token?: string) {
  if (!token) return false;
  const [expiresValue, signature, ...extra] = token.split(".");
  if (!expiresValue || !signature || extra.length) return false;

  const expires = Number(expiresValue);
  if (!Number.isSafeInteger(expires) || expires <= Date.now()) return false;

  const secret = getSessionSecret();
  if (!secret) return false;
  const expected = await sign(`session:${expiresValue}`, secret);
  return constantTimeEqual(signature, expected);
}

export async function createMagicLinkToken() {
  const secret = getSessionSecret();
  if (!secret) throw new Error("FINANCE_SESSION_SECRET is not configured");

  const expires = Date.now() + FINANCE_MAGIC_LINK_MAX_AGE * 1000;
  const nonce = crypto.randomUUID();
  const signature = await sign(`magic:${expires}:${nonce}`, secret);
  return `magic.${expires}.${nonce}.${signature}`;
}

export async function verifyMagicLinkToken(token?: string) {
  if (!token) return false;
  const [prefix, expiresValue, nonce, signature, ...extra] = token.split(".");
  if (prefix !== "magic" || !expiresValue || !nonce || !signature || extra.length) {
    return false;
  }

  const expires = Number(expiresValue);
  if (!Number.isSafeInteger(expires) || expires <= Date.now()) return false;

  const secret = getSessionSecret();
  if (!secret) return false;
  const expected = await sign(`magic:${expiresValue}:${nonce}`, secret);
  return constantTimeEqual(signature, expected);
}

export function appOrigin(request: Request) {
  const host =
    request.headers.get("x-forwarded-host") || request.headers.get("host");
  if (!host) return "http://localhost:3000";
  const protocol =
    request.headers.get("x-forwarded-proto") ||
    (host.includes("localhost") ? "http" : "https");
  return `${protocol}://${host}`;
}

export function sessionCookieOptions(maxAge = FINANCE_SESSION_MAX_AGE) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge,
    path: "/",
  };
}

async function sign(value: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const bytes = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, encoder.encode(`finance:${value}`)),
  );
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

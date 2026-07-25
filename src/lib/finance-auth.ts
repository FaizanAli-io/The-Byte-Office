export const FINANCE_SESSION_COOKIE = "finance_session";
export const FINANCE_SESSION_MAX_AGE = 60 * 60 * 24 * 7;

const encoder = new TextEncoder();

export async function createFinanceSession() {
  const secret = getSessionSecret();
  if (!secret) throw new Error("FINANCE_PASSWORD is not configured");

  const expires = Date.now() + FINANCE_SESSION_MAX_AGE * 1000;
  const signature = await sign(String(expires), secret);
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
  const expected = await sign(expiresValue, secret);
  return constantTimeEqual(signature, expected);
}

function getSessionSecret() {
  return process.env.FINANCE_SESSION_SECRET || process.env.FINANCE_PASSWORD;
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

const encoder = new TextEncoder();

export async function hmacHex(message: string, secret: string) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
  ]);
  const bytes = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(message)));
  return toHex(bytes);
}

export async function sha256Hex(message: string) {
  return toHex(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(message))));
}

export async function sha256Base64Url(message: string) {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(message)));
  return base64UrlEncode(bytes);
}

export function base64UrlEncode(input: string | Uint8Array) {
  const binary = typeof input === 'string' ? input : Array.from(input, (byte) => String.fromCharCode(byte)).join('');
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function base64UrlDecode(value: string) {
  const padded = value
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(Math.ceil(value.length / 4) * 4, '=');
  return atob(padded);
}

export function randomToken(bytes = 32) {
  return base64UrlEncode(crypto.getRandomValues(new Uint8Array(bytes)));
}

export function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

function toHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

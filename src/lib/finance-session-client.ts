export const FINANCE_SIGNED_IN_COOKIE = 'finance_signed_in';
export const FINANCE_AUTH_EVENT = 'finance-auth-changed';

/**
 * Whether the browser is signed in, read from a flag cookie that carries no
 * secret. The session token itself is httpOnly and deliberately unreachable
 * from JavaScript, so cross-site scripting cannot lift it.
 */
export function isFinanceSignedIn() {
  if (typeof document === 'undefined') return false;
  return document.cookie.split('; ').includes(`${FINANCE_SIGNED_IN_COOKIE}=1`);
}

export function announceFinanceAuthChange() {
  window.dispatchEvent(new Event(FINANCE_AUTH_EVENT));
}

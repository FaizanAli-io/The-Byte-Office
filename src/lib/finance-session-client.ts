export const FINANCE_SIGNED_IN_COOKIE = 'finance_signed_in';
export const FINANCE_AUTH_EVENT = 'finance-auth-changed';

export function isFinanceSignedIn() {
  if (typeof document === 'undefined') return false;
  return document.cookie.split('; ').includes(`${FINANCE_SIGNED_IN_COOKIE}=1`);
}

export function announceFinanceAuthChange() {
  window.dispatchEvent(new Event(FINANCE_AUTH_EVENT));
}

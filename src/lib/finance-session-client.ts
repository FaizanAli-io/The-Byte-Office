export const FINANCE_TOKEN_KEY = "finance_session_token";
export const FINANCE_AUTH_EVENT = "finance-auth-changed";

export function readFinanceToken() {
  if (typeof window === "undefined") return null;
  const token = window.localStorage.getItem(FINANCE_TOKEN_KEY);
  if (!token) return null;

  const expires = Number(token.split(".")[0]);
  if (!Number.isSafeInteger(expires) || expires <= Date.now()) {
    window.localStorage.removeItem(FINANCE_TOKEN_KEY);
    return null;
  }

  return token;
}

export function persistFinanceToken(token: string) {
  window.localStorage.setItem(FINANCE_TOKEN_KEY, token);
  window.dispatchEvent(new Event(FINANCE_AUTH_EVENT));
}

export function clearFinanceToken() {
  window.localStorage.removeItem(FINANCE_TOKEN_KEY);
  window.dispatchEvent(new Event(FINANCE_AUTH_EVENT));
}

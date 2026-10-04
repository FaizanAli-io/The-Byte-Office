'use client';

export class ApiRequestError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
  }
}

type Options = Omit<RequestInit, 'body'> & { body?: unknown };

export async function apiFetch<T>(url: string, { body, method, headers, ...init }: Options = {}): Promise<T> {
  const response = await fetch(url, {
    ...init,
    method: method ?? (body === undefined ? 'GET' : 'POST'),
    cache: init.cache ?? 'no-store',
    headers: body === undefined ? headers : { 'Content-Type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const payload = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) {
    throw new ApiRequestError(payload.error || `Request failed (${response.status})`, response.status);
  }
  return payload as T;
}

export async function apiFetchOrNull<T>(url: string, options: Options = {}): Promise<T | null> {
  try {
    return await apiFetch<T>(url, options);
  } catch (cause) {
    if (cause instanceof ApiRequestError && cause.status === 404) return null;
    throw cause;
  }
}

export function errorMessage(cause: unknown, fallback: string) {
  return cause instanceof Error && cause.message ? cause.message : fallback;
}

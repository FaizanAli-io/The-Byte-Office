import { NextResponse } from 'next/server';
import type { z } from 'zod/v4';

export class ApiError extends Error {
  constructor(
    message: string,
    public status = 400
  ) {
    super(message);
  }
}

function statusOf(error: unknown): number | null {
  if (error instanceof Error && 'status' in error) {
    const status = (error as { status: unknown }).status;
    if (typeof status === 'number' && status >= 400 && status < 600) return status;
  }
  return null;
}

type Handler<A extends unknown[]> = (...args: A) => Promise<unknown>;

export function apiRoute<A extends unknown[]>(label: string, fallback: string, handler: Handler<A>) {
  return async (...args: A): Promise<Response> => {
    try {
      const result = await handler(...args);
      return result instanceof Response ? result : NextResponse.json(result ?? { success: true });
    } catch (cause) {
      console.error(`${label} error:`, cause);
      const status = statusOf(cause);
      if (status) return NextResponse.json({ error: (cause as Error).message }, { status });
      return NextResponse.json({ error: fallback }, { status: 500 });
    }
  };
}

export async function jsonBody<T = Record<string, unknown>>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new ApiError('Request body must be valid JSON');
  }
}

export async function optionalJsonBody<T = Record<string, unknown>>(request: Request): Promise<Partial<T>> {
  return (await request.json().catch(() => ({}))) as Partial<T>;
}

export async function bodyId(request: Request, noun: string) {
  const { id } = await jsonBody<{ id?: string }>(request);
  if (!id) throw new ApiError(`Missing ${noun} id`);
  return id;
}

export type IdContext = { params: Promise<{ id: string }> };

export function ipThrottle(windowMs: number, message: string) {
  const lastSentAt = new Map<string, number>();
  return (request: Request) => {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
    if (Date.now() - (lastSentAt.get(ip) ?? 0) < windowMs) throw new ApiError(message, 429);
    return () => void lastSentAt.set(ip, Date.now());
  };
}

export function searchParam(request: Request, name: string) {
  return new URL(request.url).searchParams.get(name);
}

export function created(body: unknown) {
  return NextResponse.json(body, { status: 201 });
}

export function parseWith<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new ApiError(result.error.issues[0]?.message ?? 'Invalid request');
  return result.data;
}

export function found<T>(value: T | null | undefined, message: string, status = 404): T {
  if (value === null || value === undefined) throw new ApiError(message, status);
  return value;
}

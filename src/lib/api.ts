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
  if (error instanceof ApiError) return error.status;
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

export function idResource<Row, Update>(config: {
  path: string;
  notFound: string;
  noun: string;
  get: (id: string) => Promise<Row | null>;
  update: (id: string, data: Update) => Promise<Row | null>;
  remove: (id: string) => Promise<boolean>;
  schema: z.ZodType<Update>;
  mapError?: (cause: unknown) => ApiError | null;
}) {
  type Context = { params: Promise<{ id: string }> };

  const rethrow = (cause: unknown): never => {
    throw config.mapError?.(cause) ?? cause;
  };

  return {
    GET: apiRoute(`GET ${config.path}`, `Failed to load ${config.noun}`, async (_req: Request, ctx: Context) =>
      found(await config.get((await ctx.params).id), config.notFound)
    ),
    PUT: apiRoute(`PUT ${config.path}`, `Failed to update ${config.noun}`, async (req: Request, ctx: Context) => {
      const { id } = await ctx.params;
      const data = parseWith(config.schema, await jsonBody(req));
      const row = await config.update(id, data).catch(rethrow);
      return found(row, config.notFound);
    }),
    DELETE: apiRoute(
      `DELETE ${config.path}`,
      `Failed to delete ${config.noun}`,
      async (_req: Request, ctx: Context) => {
        found((await config.remove((await ctx.params).id)) || null, config.notFound);
        return { success: true };
      }
    ),
  };
}

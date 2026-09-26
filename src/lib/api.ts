import { NextResponse } from 'next/server';
import type { z } from 'zod/v4';

/**
 * Shared plumbing for the route handlers.
 *
 * Every route used to hand-roll the same block: try, do the work, JSON-encode
 * it, catch, `console.error` with the method and path, and return a 500 with a
 * generic message. That is a dozen lines of ceremony per file and it drifted —
 * some routes mapped their domain errors to a status, others swallowed them
 * into a 500.
 */

/** Throw to return a specific status instead of a generic 500. */
export class ApiError extends Error {
  constructor(
    message: string,
    public status = 400
  ) {
    super(message);
  }
}

/** Errors from other layers (AgentActionError, GroqError) already carry a status. */
function statusOf(error: unknown): number | null {
  if (error instanceof ApiError) return error.status;
  if (error instanceof Error && 'status' in error) {
    const status = (error as { status: unknown }).status;
    if (typeof status === 'number' && status >= 400 && status < 600) return status;
  }
  return null;
}

type Handler<A extends unknown[]> = (...args: A) => Promise<unknown>;

/**
 * Wraps a handler so it can just return data, or throw an `ApiError`.
 * Returning a `Response` (for a non-200 status, or a stream) passes straight
 * through.
 *
 * @param label  identifies the route in logs, e.g. `GET /api/ledger`
 * @param fallback  user-facing message for an unexpected failure
 */
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

/** Reads and validates a JSON body, treating a malformed one as a 400. */
export async function jsonBody<T = Record<string, unknown>>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new ApiError('Request body must be valid JSON');
  }
}

/** A JSON body, or `{}` when the request has none. */
export async function optionalJsonBody<T = Record<string, unknown>>(request: Request): Promise<Partial<T>> {
  return (await request.json().catch(() => ({}))) as Partial<T>;
}

export function searchParam(request: Request, name: string) {
  return new URL(request.url).searchParams.get(name);
}

export function created(body: unknown) {
  return NextResponse.json(body, { status: 201 });
}

/** Validates against a zod schema, surfacing the first issue as a 400. */
export function parseWith<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new ApiError(result.error.issues[0]?.message ?? 'Invalid request');
  return result.data;
}

export function found<T>(value: T | null | undefined, message: string): T {
  if (value === null || value === undefined) throw new ApiError(message, 404);
  return value;
}

/**
 * GET/PUT/DELETE handlers for a single row addressed by `/{id}`. The prayer and
 * health-tracking resources were byte-for-byte the same shape apart from their
 * nouns and callbacks.
 */
export function idResource<Row, Update>(config: {
  path: string;
  notFound: string;
  noun: string;
  get: (id: string) => Promise<Row | null>;
  update: (id: string, data: Update) => Promise<Row | null>;
  remove: (id: string) => Promise<boolean>;
  schema: z.ZodType<Update>;
  /** Turns a driver-level failure into a friendlier status, e.g. a unique violation. */
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

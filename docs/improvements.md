# Improvements backlog

Defects and hygiene worth fixing, as opposed to [`expansion.md`](./expansion.md), which is about building new things,
and [`architecture.md`](./architecture.md), which is about the structural decisions underneath both.

Only open items are listed. Everything that has landed has been removed rather than marked done — git remembers, and
a backlog that is mostly ticked boxes is a backlog nobody reads.

**The workspace has exactly one user**, so items whose only cost is scale are not the priority.

| Priority | Item                                                            | Why here                                                                                       |
| -------- | --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| **1**    | [1 — no security headers](#1-no-security-headers)               | `next.config.ts` still sets only `distDir`. A CSP is the cheapest hardening left.              |
| **2**    | [2 — sessions cannot be revoked](#2-sessions-cannot-be-revoked) | Magic links are single-use and the token is out of `localStorage`; revocation is what is left. |

**Deprioritised while this stays single-user:** items 3, 4 and 5.

---

## 1. No security headers

`next.config.ts` carries only the `distDir` override. No CSP, HSTS, `X-Frame-Options` or `Referrer-Policy`.

The workspace is behind a session and `/docs` is no longer public, so this is defence in depth rather than a hole —
but it is a config block, not a refactor, and it is the cheapest risk reduction remaining.

## 2. Sessions cannot be revoked

The replay hole is closed (magic links are single-use) and the session token is an httpOnly cookie rather than
`localStorage`, so what is left is revocation: logging out cannot invalidate a token that is still inside its 30-day
window.

Deliberately deferred, because doing it properly means a database read in the middleware on **every** protected
request. A middle path is a `sessions_revoked_after` timestamp per user, checked only when the token is older than
some threshold.

## Deprioritised while single-user

### 3. `syncActionInMessages` reads every chat message in the database

```ts
// src/lib/agent/repository.ts
const rows = await getDb().select().from(financeAgentMessages);
```

No `WHERE`, no limit, on every action confirm and cancel — then an individual `UPDATE` per matching row, each its own
round trip over Neon HTTP. Invisible at this size, degrades linearly forever. An `action_id` column, or a GIN index on
`actions` with a `@>` query, makes it one statement.

### 4. The login rate limiter does nothing in production

`const lastSentAt = new Map<string, number>()` at module scope in `src/app/api/finance-auth/login/route.ts` is
per-instance on Vercel, so concurrency bypasses it, and it is an unbounded map keyed by client IP. With one recipient
address the practical risk is mailbox flooding and SMTP quota burn rather than access. A real limit needs a shared
store.

### 5. Chat history round-trips through the client

The client POSTs the full `messages` array and `sanitizeHistory` validates it — but the server already persists every
message in `financeAgentMessages`, and the request carries a `chatId`. Loading history server-side would remove a
tamperable input, a redundant payload and a second source of truth.

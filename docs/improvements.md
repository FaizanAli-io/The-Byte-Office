# Improvements backlog

A prioritised review of the codebase, written up as a working backlog. Each item states the problem, where it lives, and
what fixing it involves. Tick items off as they land.

Status legend: **done** · **open**

---

## Start here

The workspace has exactly one user, so items whose only cost is scale are **not** the priority.

All four original priorities are now done: the API docs page is locked down, magic links are single-use and the
session token is out of `localStorage`, the ledger arithmetic has tests, and money is one consistent unit end to end.
What is left, in order:

| Priority | Item                                                                                                            | Why it is here                                                                                                                                                                                                        |
| -------- | --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1**    | [19 — no security headers](#19-no-security-headers--open)                                                       | `next.config.ts` is still an empty object. A CSP is the cheapest remaining hardening and complements the work on `/docs`.                                                                                             |
| **2**    | [4 — server-side session revocation](#4-magic-links-are-replayable-and-sessions-cannot-be-revoked--mostly-done) | The replay hole is closed and the token is no longer reachable from JavaScript, so what is left is revocation. Deferred because doing it properly means a database read in the middleware on every protected request. |
| **3**    | [17 — non-UUID path parameters return 500](#17-non-uuid-path-parameters-return-500--open)                       | Small and self-contained. A bad id should be a 400 or 404, not a generic server error.                                                                                                                                |
| **4**    | [16 — the mutual-funds shape works against the code](#16-the-mutual-funds-shape-works-against-the-code--open)   | The `Record<bank, funds[]>[]` shape and the sort-order stride are the last real awkwardness in the data model.                                                                                                        |

**Explicitly deprioritised while this stays single-user:** item 2 (`syncActionInMessages` full-table scan), item 8
(per-instance login throttle), item 14 (ledger write concurrency).

Item 3 (MCP writes bypass the confirmation model) is documented rather than surprising, and with one key holder it is
a deliberate choice. It becomes urgent the moment a second person or a shared agent gets that key.

-------- | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1** | [4 — server-side session revocation](#4-magic-links-are-replayable-and-sessions-cannot-be-revoked--mostly-done) | The replay hole is closed and the token is no longer reachable from JavaScript, so what is left is revocation. Deliberately deferred: doing it properly means a database read in the middleware on every protected request. |
| **2** | [19 — no security headers](#19-no-security-headers--open) | `next.config.ts` is still an empty object. A CSP is the cheapest remaining hardening and complements the work already done on `/docs`. |
| **3** | [17 — non-UUID path parameters return 500](#17-non-uuid-path-parameters-return-500--open) | Small and self-contained. A bad id should be a 400 or 404, not a stack trace and a generic server error. |

**Explicitly deprioritised while this stays single-user:** item 2 (`syncActionInMessages` full-table scan), item 8
(per-instance login throttle), item 14 (ledger write concurrency).

Item 3 (MCP writes bypass the confirmation model) is documented rather than surprising, and with one key holder it is
a deliberate choice. It becomes urgent the moment a second person or a shared agent gets that key.

-------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1** | [6 — `/docs` is public and invites pasting the master API key](#6-docs-is-public-and-invites-pasting-the-master-api-key--open) | A public, indexable page that loads a third-party script from unpkg onto your origin and asks you to paste `MCP_API_KEY`, which it then stores in `localStorage`. That key writes to your ledger without confirmation. Cheapest fix on the list. |
| **2** | [4 — magic links are replayable](#4-magic-links-are-replayable-and-sessions-cannot-be-revoked--open) + [5 — session token in `localStorage`](#5-a-30-day-session-token-sits-in-localstorage--open) | One user means one account and no second line of defence. A link that leaks from email or a proxy log works repeatedly for 15 minutes, the session it mints lasts 30 days, and logout cannot revoke it. Item 5 hands an equivalent token to any XSS in order to toggle a nav item. |
| **3** | [18 — no tests and no CI](#18-no-tests-and-no-ci--open) | Independent of user count. `accountMovement`, `expectedBalance`, `accountStats`, `ledgerSummary` and `variancePct` are the arithmetic your reconciliation depends on, they are pure and dependency-free, and they have never been executed by anything but the UI. |
| **4** | [15 — money is JavaScript floats](#15-money-is-javascript-floats--closed-by-decision) | Also independent of user count. Drift accumulates through `expectedBalance` and surfaces as a phantom reconciliation variance. Bigger job than the others, which is why it is fourth rather than first. |

**Explicitly deprioritised while this stays single-user:** item 2 (`syncActionInMessages` full-table scan — degrades
with message volume, and you are one person), item 8 (per-instance login throttle — a real limit needs a shared store,
which is multi-instance work), and item 14 (ledger write concurrency — only bites with two tabs open at once).

Item 3 (MCP writes bypass the confirmation model) sits outside this ranking: it is now documented rather than
surprising, and with one key holder it is a deliberate choice rather than a hole. It becomes urgent the moment a second
person or a shared agent gets that key.

---

## Tier 1 — Correctness and exposure

### 1. Portfolio holding IDs must stay stable across saves — **done**

`saveFinanceDoc` deleted every row in `local_banks`, `remote_banks` and `mutual_funds` and reinserted them. All three
tables use `uuid().defaultRandom()`, so **every holding UUID changed on every save from the editor.**

The finance agent advertises `portfolio_get` as returning "stable item IDs", and `portfolio_item_update` /
`portfolio_item_remove` resolve an item by ID and then compare a content fingerprint before writing
(`src/lib/finance-agent/actions.ts`). So: agent reads the portfolio → you press Save → you confirm the agent's card →
`Portfolio item no longer exists (409)`. Every agent-proposed portfolio write was one editor save away from failing.

Fixed by making the save a diff:

- `FinanceDoc` holdings now carry an optional `id` (`src/types/finance.ts`). Present on anything loaded from Postgres,
  absent on a row the editor just added.
- `loadFinanceDoc` returns IDs; `flattenMutualFunds` / `groupMutualFunds` carry them through the grouping round trip.
- `saveFinanceDoc` updates known IDs in place, inserts rows without one, and deletes rows the editor dropped — all in a
  single transaction. An unrecognised ID is treated as an insert, so a stale tab degrades to creating a duplicate rather
  than failing the whole save.
- `POST /api/finance` returns the saved document, and the editor adopts it. Without this, a holding added in the session
  would still have no ID client-side and the next save would insert it a second time.
- `validateFinanceDoc` accepts optional IDs and rejects duplicates within a table — two rows sharing an ID would both
  resolve to the same `UPDATE` and one edit would vanish silently.
- Snapshots strip IDs before writing their JSONB blob: a snapshot records values at a point in time, and the rows those
  IDs point at can be edited or deleted later. The stored `SnapshotHoldings` shape is unchanged, so existing snapshots
  still read back correctly.
- The three holding sections now key their lists on the row ID instead of the array index, which also fixes inputs
  carrying the wrong value after deleting a row from the middle of a list.

### 7. The portfolio editor must not swallow save failures — **done**

`handleSave` fired the request and never looked at the response, so a `400 Invalid finance data`, a `401` from an
expired session and a `500` all rendered as a successful save — on the screen where you edit your net worth.

It now checks `res.ok`, surfaces the server's error message, and returns a toast state that `FinanceEditor` renders
through the existing `FinanceToast`. It also guards against a double submit.

### 2. `syncActionInMessages` reads every chat message in the database — **open**

```ts
// src/lib/finance-agent/repository.ts
const rows = await getDb().select().from(financeAgentMessages);
```

No `WHERE`, no limit, on every action confirm and cancel — then an individual `UPDATE` per matching row, each a separate
round trip over Neon HTTP. Invisible today, degrades linearly forever.

Add an `action_id` column (or a GIN index on `actions` and a `@>` query) and make it one statement.

### 3. MCP write tools bypass the confirmation model the docs promise — **open**

`docs/finance-agent.md` said the agent "cannot bypass confirmation". `applyFinanceAction` proposes an action and
immediately executes it, and every MCP write tool plus `POST /api/mcp/tools/{name}` routes through it. Anyone holding
`MCP_API_KEY` mutates the ledger with no human confirmation.

The tool descriptions have already drifted to match: the chat catalog says "never writes before user confirmation" while
`src/mcp/catalog.ts` says "Add an entry to a draft ledger immediately."

That may well be the intent for a machine-to-machine surface — but it is two security models over one data store, and
only one of them was documented. Decide explicitly, then either document the split or route MCP writes through the same
pending-action flow. `verifyMcpRequest` already returns a `scopes` array that nothing reads; splitting the key into
read-only and read-write is cheap.

### 4. Magic links are replayable and sessions cannot be revoked — **mostly done**

In `src/lib/finance-auth.ts`:

- `createMagicLinkToken` generates a `nonce` that is never stored and `verifyMagicLinkToken` never consumes it. The link
  works an unlimited number of times for its full 15 minutes.
- The token travels as a URL query parameter, so it lands in browser history, `Referer` headers and any proxy log.
- Sessions are `expires.HMAC(secret, expires)` — stateless, one global secret. Logout clears one cookie; the token stays
  valid for 30 days. Rotating `FINANCE_SESSION_SECRET` is the only revocation and it kills every session.
- `getSessionSecret()` silently falls back to an undocumented `FINANCE_PASSWORD`.

Done: magic links are now single-use. `finance.magic_links` records each issued nonce and verification claims it with
`UPDATE ... WHERE consumed_at IS NULL RETURNING`, so a replayed link fails even inside its window; expired rows are
cleaned opportunistically on the next issue. The nonce store lives in `finance-magic-link.ts` rather than
`finance-auth.ts`, because the latter is imported by the edge middleware and must stay free of the driver. The
undocumented `FINANCE_PASSWORD` fallback is gone, and the session window dropped from 30 days to 14.

**Still open: server-side revocation.** Sessions remain stateless, so signing out clears the cookies on that browser
but cannot invalidate a token that has already been copied. Fixing it properly means a sessions table and a database
read in the middleware on every protected request. That is a real latency cost on every page and API call for a
single-user workspace, so it was left as a deliberate trade rather than done badly. Rotating
`FINANCE_SESSION_SECRET` remains the break-glass option, and it invalidates everything at once.

### 5. A 30-day session token sits in `localStorage` — **done**

`src/app/finance/verify/page.tsx` writes the session token to `localStorage` via `persistFinanceToken`. Its only
consumer is `src/app/components/Navigation.tsx`, deciding whether to show one menu item.

Fixed. The verify endpoint no longer returns the token in its response body at all; it sets the httpOnly session
cookie plus a `finance_signed_in=1` flag cookie that carries no secret. `finance-session-client.ts` is down to
`isFinanceSignedIn()`, which reads that flag. There is no longer any copy of the session token reachable from
JavaScript.

### 6. `/docs` is public and invites pasting the master API key — **done**

`src/app/docs/page.tsx` is in neither the middleware matcher nor the `robots.ts` disallow list, so it is public and
indexable. It loads `swagger-ui-bundle.js` from unpkg with no SRI on a floating major version, sets
`persistAuthorization: true` (which stores whatever key is typed into `localStorage`), and documents the private finance
API via the equally public `/api/openapi`.

Fixed: `/docs` and `/api/openapi` are in the middleware matcher, `/docs` replaced `/finance/snapshots` in the robots
disallow list (which was redundant under `/finance` anyway), the Swagger assets are pinned to `5.17.14` with
subresource integrity instead of floating on `@5`, and `persistAuthorization` is off so the key is never written to
`localStorage`.

### 8. The login rate limiter does nothing in production — **open**

`const lastSentAt = new Map<string, number>()` at module scope in `src/app/api/finance-auth/login/route.ts` is
per-instance on Vercel, so concurrency bypasses it, and it is an unbounded memory leak keyed by client IP. With one
recipient address the practical risk is mailbox flooding and SMTP quota burn. Move it to a table or Upstash.

---

## Tier 2 — Architecture

### 9. Tool definitions exist three times and have already drifted — **done**

The same eleven tools are declared in `src/lib/finance-agent/tools.ts` (hand-written JSON Schema for Groq),
`src/mcp/modules/finance/tools.ts` (zod, for MCP) and `src/mcp/catalog.ts` (zod again, for the REST wrappers and
OpenAPI). Three name lists, three description sets, two schema languages — and `isWriteTool()` duplicates
`FINANCE_WRITE_ACTIONS` as a third hardcoded list of write tools.

They have already diverged on the most safety-relevant sentence in the system (see item 3).

Collapsed into `src/lib/agent/registry.ts`: one entry per tool carrying the zod schema, the `write` / `mcp` /
`destructive` flags and both descriptions (writes really are proposals in chat and immediate over MCP, so that one
difference is now explicit rather than accidental). The Groq JSON Schema is derived with `z.toJSONSchema()`, MCP
registers in a loop, and the REST catalogue and OpenAPI document read the same list. `schemas.ts` is gone and
`isWriteTool` is derived rather than hardcoded.

The registry schemas are flat objects rather than discriminated unions: tool-calling models handle a flat object far
better than `oneOf`, and the real per-type validation always happened downstream in `parsePortfolioItem`.

### 10. Circular dependency between `lib/agent` and `lib/finance-agent` — **open**

```
finance-agent/actions.ts → agent/modules/personal.ts → finance-agent/tools.ts → finance-agent/actions.ts
```

`finance-agent/` became the home for generic agent infrastructure: `repository.ts` owns conversations, messages, tool
logs and every action type including `prayer_set` and `tbo_send_inquiry`. The schema shows the same leak — `personal`
workspace conversations live in the `finance` Postgres schema, in a table called `finance_agent_messages`.

Promote the shared pieces to `lib/agent/` and leave `lib/finance-agent/` as one module beside `personal` and `tbo`. The
three-module split in `SYSTEM_PROMPT` is the right shape; the directories just do not match it.

### 11. Regex intent-routing in the chat route — **done**

`src/app/api/finance-agent/chat/route.ts` carries roughly 200 lines of keyword matching that force-selects a tool via
`tool_choice`, regex that extracts payers, purposes and amounts from English prose, and a `parseToolArguments` with six
fallback layers for repairing model output (code fences, double-encoded JSON, concatenated objects, single quotes,
unquoted keys, Python call syntax).

Both exist because `openai/gpt-oss-20b` is too small to reliably emit tool calls. That is a legitimate constraint, but
the cost is real: `/\bfor\s+(...)/` will set `category: "Groceries And Also"` on entries you did not intend, and the
forced-tool logic means asking _how_ to add a ledger entry opens a write form.

Deleted. `writeIntentFor`, `requiredToolFor`, `monthFromMessage`, `draftMonthFromToolMessages`, `latestDraftMonth`,
`openLedgerAddForm`, `ledgerAddPrefill` and `titleCase` are gone, along with the forced `tool_choice` and five of the
six JSON-repair layers. `PRIMARY_MODEL` is now `openai/gpt-oss-120b`, with the 20b model kept as the rate-limit
fallback. The route went from 596 lines to 257.

This is a deliberate behaviour change: the assistant now relies on the model to call `ledger_entry_add` itself rather
than being pushed into it by keyword matching, and there is no longer a fallback that force-opens the entry form. Worth
exercising the ledger-entry flow in the UI before trusting it.

### 12. Chat history round-trips through the client — **open**

The client POSTs the full `messages` array, which `sanitizeHistory` then validates. But the server already persists
every message in `financeAgentMessages` and the request carries a `chatId`. Loading history server-side removes a
tamperable input, a redundant payload and a second source of truth.

### 13. Two validation systems — **partly done**

`personal-validation.ts` is now zod, shared by the REST routes and the assistant's tools. `finance-validation.ts` is
still hand-rolled predicates returning `string | null`. It is well covered by tests now, so converting it is lower
risk than it was, but also lower value: `validateLedger` does cross-field work (currency matching, account membership,
finalize preconditions) that reads clearly as imperative code and would need several `superRefine` blocks in zod.

---

## Tier 3 — Data layer

### 14. `saveLedger` is truncate-and-reinsert with no concurrency control — **open**

It deletes all entries and accounts for a month and rewrites them. The agent path is protected by the application-level
fingerprint in `executeLedgerPayload`, but `PUT /api/ledger` — used by the ledger UI — has no such check. Two open tabs
means silent last-write-wins on a whole month's books. Add an `updated_at` precondition to the `UPDATE`.

### 15. Money is JavaScript floats — **closed, by decision**

Closed deliberately rather than fixed, and the reasoning is worth keeping.

This was first implemented as integer minor units: paisa and cents, held in a `src/lib/money.ts` that converted at
every boundary. That representation is exact, but it put two units in the codebase at once, and the second one leaked.
Read paths returned paisa while write paths accepted rupees, so `portfolio_get` reported a balance a hundred times too
large and any agent that read a value and wrote it back would have inflated it.

The decision was to have **one unit everywhere** — rupees, the major unit — across the database, the internal values,
the `/api/*` bodies, the MCP tools and the UI. Nothing converts, so nothing can convert inconsistently. `money.ts` is
gone, along with every call site that used it.

The cost is that decimal sums drift in binary floating point. That drift is around 1e-10 on a portfolio of this size,
roughly eight orders of magnitude below the two decimal places anything is ever displayed at. It is handled in the one
place it can be observed: `variancePct` treats an expected balance below half a paisa as zero. `tests/ledger.test.ts`
covers exactly that, reconciling a thousand one-paisa entries and asserting the result reads as balanced.

No data migration was needed in either direction. The columns have been `numeric(18, 2)` throughout — Postgres numeric
is exact and was never the problem — and only the Drizzle read mode changed.

### 16. The mutual-funds shape works against the code — **open**

`Record<bankName, Fund[]>[]` — an array of single-key objects — forces `Object.keys(group)[0]` at six call sites and the
`MUTUAL_FUND_GROUP_STRIDE = 1000` encoding in `queries.ts`, which breaks past 1000 funds per bank and cannot express two
groups with the same bank name. The Postgres table is already flat. Return the flat shape from the API and drop the
stride arithmetic.

### 17. Non-UUID path parameters return 500 — **open**

`deleteSnapshot('abc')` hands `abc` to a `uuid` comparison; Postgres raises `22P02` and the catch-all returns a 500.
Same for `getPortfolioItem` and `getConversation`. Validate UUIDs at the boundary and return 400 or 404.

---

## Tier 4 — Engineering hygiene

### 18. No tests and no CI — **done**

There is no test runner and no `.github/`. The pure functions in `src/lib/ledger.ts` — `accountMovement`,
`expectedBalance`, `accountStats`, `ledgerSummary`, `variancePct` — are the financial correctness core, are
dependency-free, and are about an hour of Vitest coverage. `validateLedger` and the `finance-auth` sign/verify pair are
next. A workflow running `lint`, `tsc --noEmit` and tests on PR is a twenty-line file.

### 19. No security headers — **open**

`next.config.ts` is an empty object with a placeholder comment. No CSP, HSTS, `X-Frame-Options` or `Referrer-Policy`.
Given items 5 and 6, a CSP is the cheapest available mitigation.

### 20. Dependency and root-directory cruft — **partly done**

Removed: `instructions.md` (a spent one-shot design prompt), `public/llms.md` (unreferenced; `llms.txt` and
`llms-full.txt` are the actual convention and `llms.txt` is the one linked from the footer),
`public/browserconfig.xml` (nothing references it — there is no `msapplication-config` meta tag) and the five unused
Create Next App SVGs.

Also removed: `mongodb` and `scripts/migrate-mongo-to-postgres.mjs`, a one-time migration that ran in `24b03c1`.
MongoDB stays in `src/content/site.ts` and `public/llms-full.txt`, which is marketing copy rather than a dependency.

Still open: `drizzle.config.ts` imports `@next/env`, which is not declared in `package.json` and resolves only as a
transitive of `next`.

### 21. Setup docs guarantee a broken first run — **done**

Fixed. `MCP_API_KEY` is in `example.env` and the README, both noting that the MCP endpoints return 401 until it is
set. The undocumented `FINANCE_PASSWORD` fallback was removed rather than documented, so there is one way to configure
the signing secret. `@next/env` is now a declared devDependency instead of relying on it being a transitive of `next`.

### 22. The streaming chat route has no runtime or duration config — **done**

Fixed while rewriting the route: it now exports `maxDuration = 300` and checks `request.signal.aborted` at the top of
each tool round, so a client that navigates away stops the loop instead of burning Groq calls and persisting a spurious
error message.

---

## Suggested sequence

| Order | Work                                                                            | Why here                                                             |
| ----- | ------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| 1     | Stable portfolio IDs (1) and honest save errors (7) — **done**                  | Agent portfolio writes did not work; the editor hid its own failures |
| 2     | Decide and document the MCP write model (3); scope the API key                  | One data store, two contradictory safety guarantees                  |
| 3     | Single-use magic links (4), drop the `localStorage` token (5), lock `/docs` (6) | Small diffs, disproportionate risk reduction                         |
| 4     | Vitest over `lib/ledger.ts` and `finance-validation.ts`, plus CI (18)           | Everything below this line is safer to refactor once this exists     |
| 5     | Unify the tool registry (9); break the `agent`/`finance-agent` cycle (10)       | The drift in item 3 was caused by item 9 and will recur              |
| 6     | Fix `syncActionInMessages` (2); ledger concurrency control (14)                 | Scaling and multi-tab correctness                                    |

---

## Landed in the restructure

Two changes beyond the numbered backlog.

### Route groups

`src/app` is split into `(site)` and `(workspace)`. Route groups do not affect URLs — all 38 routes resolve exactly as
before — but the two halves now have their own layouts:

- the root layout holds only the document shell, fonts, viewport and shared identity metadata;
- `(site)` adds the marketing chrome: Navigation, Footer and the Organization/WebSite JSON-LD;
- `(workspace)` keeps Navigation so you can move between finance, personal and the assistant, and drops the marketing
  footer and structured data. Those pages are `noindex`, so the JSON-LD was never doing anything there.

Supporting code moved out of `src/app` to make the boundary real: `src/components/Navigation.tsx` (shared),
`src/components/site/` (marketing-only), `src/content/site.ts` (shared content — the TBO agent module and the inquiry
email read it too) and `src/lib/seo.tsx`.

### Shared plumbing

- `src/lib/api.ts` — `apiRoute` wraps a handler with the try/catch, logging and error-to-status mapping every route
  repeated by hand; `idResource` supplies GET/PUT/DELETE for a row addressed by `/{id}`. The two personal `[id]` routes
  were 93 lines and are now 27.
- `src/lib/client-api.ts` — `apiFetch` replaces the "fetch, parse, check `ok`, throw `body.error`" block at 22 call
  sites, so a route that starts returning a useful message surfaces it everywhere.
- `HoldingTypes/HoldingSection.tsx` — the local and remote bank sections were the same component with different fields
  and are now one spec-driven component plus two ~25-line configs. `useFinanceHandlers` collapsed its eight
  near-identical add/delete handlers onto a single `edit(mutate)` primitive.

### Contact form — **fixed**

The public form at `/contact` used to validate, set `status: 'success'` and clear the fields without sending anything.
Visitors were told their message had been sent when nothing had. It now posts to a new `POST /api/contact`, which
shares `parseInquiry` with the assistant's `tbo_send_inquiry` tool (both reach the same mailbox, so both get the same
rules) and calls the existing `sendInquiryEmail`. The form shows a sending state, surfaces the server's error, and only
claims success when the mail actually went out. The "Open Email Draft" `mailto:` button stays as a fallback.

The endpoint is public, so it carries a honeypot field and a 30-second per-IP throttle. That throttle is per-instance
and therefore a courtesy limit, exactly like the finance login one — item 8 covers moving both to a shared store.

### Counting the code

`scripts/count-lines.mjs` (`npm run lines`) reports source lines by extension and the largest files. It takes its file
list from git, so build output and anything gitignored is excluded automatically, and it additionally skips the
lockfile, Drizzle's generated migrations and snapshots, `public/` and the vendored `.agents/` skills. `--top N`,
`--all` and `--json` are supported.

A `.prettierignore` was added at the same time: `npm run format` runs `prettier --write .`, which would otherwise
rewrite `package-lock.json` and Drizzle's generated snapshots.

---

## File size

Every file in the repository is kept under 500 lines. `npm run lines -- --top 10` shows the current largest; the
counter reads its file list from git, so build output and generated files are excluded. It counts lines that carry
code, skipping comments and blank lines, so documenting something never reads as the codebase growing — `--raw`
gives the unfiltered count, and tests are reported on their own line.

Three files crossed the limit and were split along real seams rather than arbitrarily:

- `FinanceAgentChat.tsx` (668) → container plus `ChatMessage.tsx`, which holds the pure presentational pieces
- `actions.ts` (586) → orchestration plus `action-parsing.ts`, the argument parsing and fingerprint helpers that
  never touch the database
- `LedgerEntries.tsx` (527) → the table plus `EntryFiltersPanel.tsx`; `CollapseToggle` moved next to `Field` in
  `LedgerAccounts.tsx` since both files now use it

Feature ideas, as opposed to fixes, live in [`expansion.md`](./expansion.md).

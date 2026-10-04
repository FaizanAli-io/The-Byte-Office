# Improvements

Everything worth knowing before changing this codebase: the open defects, the structure underneath, and the ideas
worth building. Only open items are listed — anything that lands is removed rather than marked done.

**The workspace has exactly one user**, so items whose only cost is scale are not the priority.

---

## Open defects

### 1. Sessions cannot be revoked

Magic links are single-use and the session token is an httpOnly cookie, so what is left is revocation: logging out
cannot invalidate a token that is still inside its 14-day window.

Deliberately deferred, because doing it properly means a database read in the middleware on **every** protected
request. A middle path is a `sessions_revoked_after` timestamp, checked only when the token is older than some
threshold.

### 2. The login rate limiter does nothing in production (deprioritised while single-user)

`ipThrottle` in `src/lib/api.ts` (used by login and contact) keeps a module-scope `Map`, so it is per-instance on
Vercel, concurrency bypasses it, and it is unbounded. With one recipient address the risk is mailbox flooding and SMTP quota
burn rather than access. A real limit needs a shared store.

---

## Architecture

### The map

- **Two Postgres schemas.** `finance` holds holdings, ledgers, snapshots, OAuth and assistant conversations;
  `personal` holds prayers and health metrics and readings.
- **One tool registry, three surfaces.** [`lib/agent/registry.ts`](../src/lib/agent/registry.ts) declares each tool
  once — name, zod schema, description, module, whether it writes. The chat assistant, the MCP server and the REST
  wrappers under `/api/mcp/tools/{name}` all derive from it. Arguments are validated once, by `parseToolArgs`.
- **Shared agent core, three modules.** `lib/agent/` owns the wire types, conversations, messages, tool logs and the
  action lifecycle. The finance, personal and TBO modules live in `lib/agent/modules/` and never import each other;
  only `runtime.ts` and `actions.ts` know all three. A chat message stores only its cards' action ids.
- **Writes go through an action layer.** The chat assistant proposes; the user confirms; `executeAgentAction` claims
  the row atomically, re-reads the source, checks a fingerprint and only then writes. MCP writes run the same proposal
  at once, gated by OAuth scope instead.
- **A pure library layer.** `lib/ledger.ts`, `lib/finance.ts`, `lib/accounts.ts` and `lib/health.ts` hold arithmetic
  with no database or React imports, which is what makes them testable.
- **One client-side API module.** [`lib/api-client.ts`](../src/lib/api-client.ts) owns every URL the browser calls;
  `client-api.ts` owns the transport and errors. No component holds a path string.

### One account model

`holdings` is the list of accounts — kind, name, a fund's bank, order, `archived_at`. `ledger_accounts` holds only the
monthly figures for a holding (opening, actual closing, cost basis, rate). Nothing is stored twice.

- **The portfolio is read from the newest month**: each holding is worth its statement balance there, else what the
  entries add up to (`accounts.ts`, read through `db/portfolio.ts`).
- **Portfolio writes land in the newest draft month**: a changed amount becomes the closing balance. If that month is
  finalized, the next month is opened first.
- **Removing is archiving.** `holding_id` is a restricting foreign key, so a holding used by past months is archived:
  out of the portfolio and the next month, while history keeps its name.
- **Ledger edits that touch identity** — adding, renaming or removing an account — create, rename or archive the
  holding (`saveLedgerSynced`).

Still open: held funds are subtracted from the portfolio total as a whole, so there is no per-account net — you cannot
ask "how much of HBL is actually mine".

### Two validation styles

Tool arguments and `personal-validation.ts` are zod; `finance-validation.ts` — the ledger and portfolio checks behind
the REST routes — is hand-rolled predicates returning `string | null`. Worth knowing rather than fixing:
`validateLedger` is cross-field work that reads clearly as imperative code and would become several `superRefine`
blocks.

### What should not change

- **One tool registry.** When the surfaces were separate they drifted into contradicting each other about whether
  writes were confirmed.
- **Held funds derived, never stored.** The outstanding balance is a fold over hold entries; a stored total would be a
  second source of truth.
- **One list per closed set.** `LEDGER_ENTRY_TYPES`, `CATEGORY_KINDS` and `HOLDING_KINDS` each feed the enum, the
  validator, the zod schema and the UI labels. Adding a value is one edit.
- **Gross versus net kept apart.** Reconciliation uses gross because the cash is physically present; only the
  displayed net subtracts what is owed back.

---

## Worth building

### 1. Render markers in assistant replies

The assistant emits a fenced block the chat turns into a real component instead of prose:

````
```tbo
{ "render": "allocation-chart" }
```
````

Override `code` in `MARKDOWN_COMPONENTS`, check for `language-tbo`, parse the JSON and look the name up in a registry.
`react-markdown` already tokenises fences, a malformed marker degrades to a visible code block, and a half-streamed
fence renders as text until it closes — roughly 30 lines.

Markers are **display only**. Confirmation cards and ledger forms come from server-attached actions with an id, expiry
and fingerprint; a model-emitted `{"render": "confirm"}` would let the model decide what gets written.

Candidates: `allocation-chart` (`AllocationChart`), `portfolio-summary` (`StatCard`, `portfolioTotals`), `ledger-table`
(parts of `LedgerEntries`), `variance` (`accountStats`). Data probably inline, from the tool result the model just
read.

### 2. Tighten the model contract

The primary model is `gpt-oss-120b` and the old tool-forcing heuristics are gone. Once there is usage data: log how
often it fails to call `ledger_entry_add` when it should, try strict tool schemas if Groq exposes them, and shorten the
system prompt written for the smaller model.

### 3. Ledger import

A CSV import mapped onto existing accounts, with a preview before commit, reusing the ledger validation. Bank
statement formats vary, so the mapping step is the real work.

### 4. Scheduled portfolio snapshots

Finalizing a month snapshots the portfolio; months never finalized leave a gap. A job on the first of each month would
close it — worth it only if months routinely stay open.

### 5. A second workspace user

Not before there is a second person. In order: an owner column and scoped queries everywhere; a real session identity
(defect 1); OAuth clients with an owner; a shared store for the throttles (defect 2).

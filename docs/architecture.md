# Architecture

Where the structure of this codebase works against itself. [`improvements.md`](./improvements.md) lists discrete
defects and [`expansion.md`](./expansion.md) lists things worth building; this file is for the shape underneath both —
the decisions that are hard to reverse and that keep generating smaller problems.

Nothing here is urgent. The application works, the arithmetic is tested, and the workspace has one user. These are
written down so that the next time one of them bites, the fix is a decision rather than a discovery.

---

## The map, as it stands

**Two Postgres schemas.** `finance` holds the portfolio, ledgers, snapshots, OAuth and every assistant conversation;
`personal` holds prayers and health readings.

**Three surfaces over one tool registry.** [`lib/agent/registry.ts`](../src/lib/agent/registry.ts) declares each tool
once — name, zod schema, description, module, whether it writes. The chat assistant, the MCP server and the REST
wrappers under `/api/mcp/tools/{name}` all derive from it. This is the part of the design that has held up best.

**A pure library layer.** `lib/ledger.ts`, `lib/finance.ts` and `lib/health.ts` hold arithmetic with no imports from
the database or React, which is why they are the only parts with real test coverage.

**One client-side API module.** [`lib/api-client.ts`](../src/lib/api-client.ts) owns every URL the browser calls, its
method and its response type; [`client-api.ts`](../src/lib/client-api.ts) underneath owns the transport, the JSON and
the error. No component holds a path string.

**Writes go through an action layer.** The chat assistant proposes; the user confirms; `executeAgentAction` claims the
row atomically, re-reads the source data, checks a fingerprint and only then writes. MCP writes skip the proposal step
and are gated by OAuth scope instead.

**Shared agent core, three modules.** `lib/agent/` owns what every module uses — the wire types, conversations,
messages, tool logs and the action lifecycle (`actions.ts` claims, dispatches and records). The finance, personal and
TBO modules live in `lib/agent/modules/`. Modules import the core and never each other; only `runtime.ts` and
`actions.ts` know all three. Tool arguments are validated once, against the registry schema (`parseToolArgs`), on both
the chat and MCP paths. A chat message stores only its cards' action ids; status and preview are read from the action.

---

## 1. One account model: holdings are identity, ledger months hold the figures

`holdings` is the list of accounts — kind, name, a fund's bank, order, and `archived_at`. `ledger_accounts` holds only
the monthly figures for a holding (opening, actual closing, cost basis, rate); name, type and currency come from the
holding. Nothing is stored twice, so nothing has to be kept in step.

- **The portfolio is read from the newest month**: each holding is worth its account's statement balance there, else
  what the entries add up to. [`accounts.ts`](../src/lib/accounts.ts) holds that rule; reads go through
  [`db/portfolio.ts`](../src/lib/db/portfolio.ts).
- **Portfolio writes land in the newest draft month**: a changed amount becomes the account's closing balance. If that
  month is finalized, the next month is opened first.
- **Removing is archiving.** A holding referenced by past months cannot be deleted (`holding_id` is a restricting
  foreign key); archiving takes it out of the portfolio and the next month while history keeps its name.
- **Ledger edits that touch identity** — adding, renaming or removing an account — create, rename or archive the
  holding (`saveLedgerSynced`).

Still open: held funds are subtracted from the portfolio total as a whole, so there is no per-account net — you cannot
ask "how much of HBL is actually mine".

## 2. Two validation systems

Tool arguments and `personal-validation.ts` are zod. [`finance-validation.ts`](../src/lib/finance-validation.ts) —
the ledger and portfolio checks behind the REST routes — is hand-rolled predicates returning `string | null`.

Worth knowing rather than worth fixing. `validateLedger` does cross-field work — currency matching, account
membership, hold-on-a-bank-account, category existence, finalize preconditions — that reads clearly as imperative code
and would become several `superRefine` blocks. It also has the better test coverage of the two. The cost is that a
contributor has to learn both conventions.

---

## What should not change

Worth stating, so a future pass does not "fix" these:

- **One tool registry.** Three surfaces derive from it. The last time they were separate they drifted into
  contradicting each other about whether writes were confirmed.
- **Held funds derived, never stored.** The outstanding balance is a fold over the ledger's hold entries. A stored
  total would be a second source of truth for something already written down.
- **One list per closed set.** `LEDGER_ENTRY_TYPES` and `CATEGORY_KINDS` each feed the Postgres enum, the validator,
  the zod schema and the UI labels. Adding a type is one edit.
- **The pure library layer.** Keeping arithmetic free of database and React imports is what makes it testable.
- **URLs in one module.** Paths spread through components drifted into duplicated response generics and three
  components dropping to raw `fetch` with their own error handling.
- **Gross versus net kept apart.** Reconciliation uses gross because the cash is physically present; only the
  displayed net subtracts what is owed back.

---

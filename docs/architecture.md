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
messages, tool logs and the action lifecycle (`actions.ts` claims, dispatches and records). The finance module lives in
`lib/finance-agent/`, personal and TBO in `lib/agent/modules/`. Modules import the core and never each other; only
`runtime.ts` and `actions.ts` know all three.

---

## 1. Two account models, now linked rather than unified

The portfolio keeps holdings in `holdings`; the ledger keeps `ledger_accounts`, one set **per month**. Each account
carries a `holding_id` foreign key, and
[`portfolio-sync.ts`](../src/lib/portfolio-sync.ts) keeps the newest month and the portfolio equal in both directions:
a ledger save sets each holding to its account's value, a portfolio change becomes the account's closing balance, and
adding, renaming or removing on one side does the same on the other. A new month opens at the portfolio's figures, and
finalizing a month snapshots the portfolio.

What is still not ideal:

- It is two stores kept in step, not one. Both directions are diff-based (before/after a save) precisely so that
  neither side can overwrite the other with figures nobody touched — that rule is what keeps it safe, and any new
  write path has to go through `saveLedgerSynced` or `withPortfolioSync` to stay inside it.
- Held funds are still subtracted from the portfolio total as a whole, so there is no per-account net — you cannot ask
  "how much of HBL is actually mine".

A true account entity — holdings as balances _of_ an account, ledger rows as monthly records _for_ it — would remove the
syncing altogether. Worth it only if the sync starts needing special cases.

## 2. One holding was three tables — storage merged, API not yet

`local_banks`, `remote_banks` and `mutual_funds` differed only by currency and whether a holding sits under a bank.
They are now one `holdings` table (`kind`, `name`, `group_name` for a fund's bank, `amount` in the kind's currency, and
`exchange_rate` for remote banks), and [`db/holdings.ts`](../src/lib/db/holdings.ts) is the only code that touches it.
Fund grouping is by bank name, so the `floor(sort_order / 1000)` stride is gone, and `ledger_accounts.holding_id` is a
real foreign key.

What is left is the shape crossing the wire. The API still speaks in three kinds:

| Layer                                                             | What the three kinds still cost                                 |
| ----------------------------------------------------------------- | --------------------------------------------------------------- |
| [`registry.ts`](../src/lib/agent/registry.ts)                     | `itemType` enum plus a flat union of every field any kind needs |
| [`action-parsing.ts`](../src/lib/finance-agent/action-parsing.ts) | `HOLDING_FIELDS`, one validator list per kind                   |
| [`finance.ts`](../src/lib/finance.ts)                             | `HoldingRows` with three arrays and three separate sums         |

and `mutualFunds` is still `Record<bank, Fund[]>[]`, an array of single-key objects that forces `Object.keys(group)[0]`
at several call sites. Exposing holdings as one flat list is the remaining half, and it changes the MCP tools, so it
deserves its own pass.

## 3. The ledger is edited as a document, not as rows

`PUT /api/ledger` takes a whole month and `saveLedger` deletes every account and entry for it and reinserts them. A
save carries the `updatedAt` it read and is rejected with a 409 if the month has moved on, so two tabs no longer lose
each other's edits silently. What the shape still costs:

- every entry's `sort_order` is reassigned on every save;
- adding one transaction rewrites the month;
- a rejected save means reloading the whole month, not merging one row.

It is a reasonable shape for a form that edits a whole month at once, and it is genuinely simple. The larger fix is
row-level endpoints for entries, which the assistant's action layer effectively already wants.

## 4. Two validation systems

`personal-validation.ts` is zod, shared by the REST routes and the assistant's tools.
[`finance-validation.ts`](../src/lib/finance-validation.ts) is hand-rolled predicates returning `string | null`.

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

## If these were tackled, in this order

1. **2 — flatten the holdings API.** One list of holdings on the wire instead of three kinds and grouped funds.
2. **3 — row-level ledger entry endpoints.** Only once whole-month saves start to hurt.
3. **1 — a shared account entity.** Only if the sync starts needing special cases.

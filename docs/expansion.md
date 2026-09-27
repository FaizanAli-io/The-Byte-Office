# Expansion ideas

Things worth building, as opposed to [`improvements.md`](./improvements.md), which is about fixing what is already
here. It is a place to keep ideas with enough detail that picking one up later does not mean rediscovering the
design.

**Queued next: items 7 and 8.** Item 9 is built. Everything above them is unscheduled.

---

## 1. Render markers for the assistant

**The idea.** The assistant emits a marker in its reply; the frontend catches it and renders a real component instead
of prose. "Your allocation looks like this" followed by an actual chart, rather than a Markdown table.

**Syntax: a fenced code block.** This is the part worth writing down, because it is much cheaper than a custom parser.
Since the chat switched to `react-markdown`, fenced blocks are already parsed and isolated:

````
```tbo
{ "render": "allocation-chart" }
```
````

Override the `code` entry in `MARKDOWN_COMPONENTS`, check for `language-tbo`, parse the JSON and look the name up in a
registry. That means:

- no marker parser and no remark plugin — `react-markdown` does the tokenising
- no escaping problems, because fenced content is opaque to the rest of the Markdown
- a malformed marker degrades to a visible code block rather than leaking raw text into the reply
- streaming is safe: a half-written fence renders as text until it closes

Roughly 30 lines of plumbing on top of the existing component map.

**What markers must not do.** They must not become a second way to write data. Confirmation cards and the in-chat
ledger form are driven by `message.actions`, which the _server_ attaches: those are database rows with an id, an
expiry and a `sourceFingerprint`, and the confirm endpoint claims them atomically. If the model could emit
`{"render": "confirm", ...}` with inline values it would be deciding what gets written to the ledger. Markers are for
**display only**; writes stay on the action channel.

**Candidate markers**, in rough order of value. The first two reuse components that already exist, so they add
almost nothing:

| Marker              | Renders                                  | Reuses                                    |
| ------------------- | ---------------------------------------- | ----------------------------------------- |
| `allocation-chart`  | Portfolio split by class or by bank      | `AllocationChart` from the snapshots page |
| `portfolio-summary` | The stat-tile row                        | `StatCard`, `holdingTotals`               |
| `ledger-table`      | A filtered transaction table             | Parts of `LedgerEntries`                  |
| `variance`          | Reconciliation difference for an account | `accountStats`, `formatVariancePct`       |

**Open questions.** Does the marker carry the data inline, or just a query the client re-fetches? Inline is simpler and
matches what the model already has in context; re-fetching guarantees freshness and keeps replies small. Probably
inline, with the data coming from the tool result the model just read.

---

## 2. Tighten the model contract now that the heuristics are gone

The chat route no longer forces tool choice or repairs malformed tool arguments, and the primary model is
`gpt-oss-120b`. Worth revisiting once there is real usage data:

- log how often the model fails to call `ledger_entry_add` when the user clearly wanted to add an entry
- consider structured outputs / strict tool schemas if Groq exposes them for these models
- the system prompt still carries instructions written for the smaller model and could be shortened

---

## 3. A second workspace user

Not needed today — the workspace has one user. If that changes, the shape of the work is known:

- holdings, ledgers, prayers and health all need an owner column and every query needs scoping
- the session becomes a real identity rather than a signed timestamp (see improvements item 4)
- OAuth clients gain an owner, so a token names a person as well as a client
- the per-instance throttles become a shared store (improvements item 8)

Worth doing in that order, and not before there is a second person.

---

## 4. Snapshot diffing

Snapshots record the portfolio at a point in time but can only be viewed one at a time. Comparing two — what moved,
by how much, which fund drove it — is the obvious next step, and `holdingTotals` plus the stored JSONB already have
everything needed.

---

## 5. Ledger import

Entering transactions by hand is the slowest part of the monthly close. A CSV import mapped onto existing accounts,
with a preview before commit, would reuse the ledger validation that already exists. Bank statement formats vary, so
the mapping step is the real work.

---

## 6. Scheduled portfolio snapshots

Snapshots are taken manually, so the history has gaps. A scheduled job that snapshots on the first of each month would
make the allocation history continuous and give the assistant something to reason about over time.

---

## 7. Health metrics over time

**The idea.** The health page is a list of readings. The point of tracking weight or glucose is the trend, which a
list does not show. A line chart over time, with filters, makes the page worth opening.

`recharts` is already a dependency and `AllocationChart` on the snapshots page is the working precedent. The data
needs no change: `health_tracking` now holds `numeric(10, 3)` values with a `created_at`, and
`GET /api/health-tracking?metric=` already filters server-side, as does the `health_list` tool.

**One metric at a time.** This is the design decision to make first. Metrics are free-text and carry different units
and magnitudes — plotting `weight_kg` at 80 against `body_fat_pct` at 18 on a shared axis is meaningless, and a dual
axis invites the same misreading more subtly. A metric selector showing one series is honest and simpler. Comparing
two metrics can come later as small multiples rather than one overlaid chart.

**Filters worth having**, in order of value:

| Filter      | Notes                                                                                 |
| ----------- | ------------------------------------------------------------------------------------- |
| Metric      | Required, since a chart only makes sense within one unit. Populate from distinct rows |
| Date range  | Last 30 / 90 / 365 days / all, as buttons rather than a date picker                   |
| Aggregation | Raw points versus a weekly average, once there are enough readings to be noisy        |

**Loose ends.** The metric list needs a `select distinct metric` query, which nothing does yet. Free-text metrics
also mean typos become separate series — `weight_kg` and `weight-kg` would plot apart. That is the same problem item
8 solves for ledger categories, and the two could share an approach if it is worth it.

---

## 8. A categories table for the ledger

**The idea.** `ledger_entries.category` is a free-text column with nothing behind it. There is no canonical list, so
the UI cannot offer a picker, the assistant cannot be told what is valid, and a typo silently creates a new
category. A `finance.categories` table fixes all three.

**Reference or copy.** The decision that shapes everything else. A foreign key gives one canonical name and makes a
rename propagate; free text keeps historical entries readable if a category is later removed. The middle path is a
foreign key with `on delete restrict` plus an `archived` flag, so a category can leave the picker without
rewriting history. That is probably right, and it matches how ledger accounts already behave.

**Shape.** `id`, `name` (unique), `kind` (`income` / `expense` / `both`), `sort_order`, `archived_at`. `kind` is
what lets the entry form show only sensible options once a type is chosen, which is most of the value of having the
table at all.

**Migration.** Back-fill from `select distinct category from finance.ledger_entries where category is not null`,
then add `category_id` and map. Keep the text column until the mapping is verified, then drop it.

**Surfaces.** Three, and one of them already has the pattern:

- the ledger entry form gets a select instead of a text input
- the agent takes a category name and resolves it, exactly as `resolveAccountId` in
  [`action-parsing.ts`](../src/lib/finance-agent/action-parsing.ts) already resolves an account from a fuzzy name
- a `categories_list` tool under `finance:read`, so the model can see valid values before proposing an entry

**Loose end.** Deciding whether the assistant may create a category, or only choose one. Only choosing is safer and
keeps the list from growing a long tail; creating is more convenient. Probably only choosing, with a clear error
naming the closest matches.

---

## 9. Held funds: money in an account that is not yours — **done**

**The idea.** Some of the balance in an account is money being held for someone else. It is really there — the bank
says so and reconciliation must agree — but it is not part of net worth. The portfolio total used to count it
silently, which overstated what you actually have.

**Built as ledger entry types, not a register.** The write-up here originally proposed a `finance.held_funds` table
standing apart from the ledger. Reading the code again showed why that was wrong: cash handed to you lands in a real
account, so it already had to be entered in the ledger or `expectedBalance` would stop matching the statement — and
the only types available were `income` and `expense`. A hold was therefore inflating the monthly income figure, and a
separate table would have left that untouched.

So `hold_received` and `hold_returned` joined `ledger_entry_type` instead. They move the account balance like any
other entry, which keeps reconciliation honest, and they sit outside income and expenses, which keeps the monthly
summary honest.

**One source of truth.** There is no stored balance. What is outstanding is a fold over the hold entries —
`Σ received − Σ returned`, grouped by counterparty — so a register and its entries can never drift apart. The same
fold answers three questions depending on what it is given: one month's entries give that month's movement, every
entry gives what is held now, and entries up to a date give what was held then. That last one is why snapshots did
**not** need a `held_total` column: unlike `grand_total`, which captures mutable holdings, the held figure for any
past moment is still derivable from the ledger.

**What it touches.**

| Piece                                                               | Change                                                                    |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `LEDGER_ENTRY_TYPES` in [`types/ledger.ts`](../src/types/ledger.ts) | The one list the enum, validator, zod schema and labels all derive from   |
| `ledger_entries.counterparty`                                       | Whose money it is; replaces the category field on the form for hold types |
| `accountMovement`                                                   | `hold_received` adds to the balance, `hold_returned` subtracts            |
| `ledgerSummary`                                                     | Gains `heldMovement`; income and expenses are untouched by holds          |
| `heldFunds()` in [`ledger.ts`](../src/lib/ledger.ts)                | The fold, plus the per-counterparty breakdown                             |
| `holdingTotals`                                                     | Gains `held` and `net`; `grandTotal` stays gross                          |
| `GET /api/held-funds`                                               | Totals plus the dated movements behind them                               |
| `portfolio_get`                                                     | Reports `grandTotalPkr`, `heldForOthersPkr` and `netTotalPkr`             |

**Two constraints worth remembering.** A hold must sit in a bank account, enforced in `validateLedger` and not merely
in the form: parked on a fund it would move `expected` without moving `netInvested`, so the fund's gain or loss would
come out wrong with nothing on screen to explain it. And the portfolio's gross total is still what a snapshot records
and what reconciliation compares against — only the displayed net line and the assistant's answer subtract the holds.

**Still open.** This is the first liability in the model. If credit card balances or loans follow, a general
`obligations` table would serve all of them and holds would become one `kind`. Not worth generalising until a second
case actually arrives. The snapshot detail page could also show a net line by asking `/api/held-funds` for the
movements up to that snapshot's timestamp; the endpoint already returns them.

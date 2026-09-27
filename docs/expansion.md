# Expansion ideas

Things worth building, as opposed to [`improvements.md`](./improvements.md), which is about fixing what is already
here. It is a place to keep ideas with enough detail that picking one up later does not mean rediscovering the
design.

**Items 7, 8 and 9 are built.** Everything above them is unscheduled.

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

## 7. Health metrics over time — **done**

**The idea.** The health page was a list of readings. The point of tracking weight or glucose is the trend, which a
list does not show. [`HealthChart`](<../src/app/(workspace)/finance/personal/HealthChart.tsx>) draws one metric over
time with a range filter and optional weekly smoothing.

**One metric at a time**, which was the decision that shaped the rest. Metrics are free text and carry different
units, so plotting `weight_kg` at 80 against `body_fat_pct` at 18 on a shared axis says nothing true — and a second
Y axis makes the same misreading quietly rather than loudly. A metric selector showing one series is honest and
simpler. Comparing two could come later as small multiples, never as one overlaid chart.

**No new query.** The write-up here expected to need `select distinct metric`. It did not: the page already loads
every reading through `GET /api/health-tracking` with no filter, so the metric list, the window and the averages are
all derived on the client from data that had already arrived. The endpoint's `metric` parameter stays useful to the
assistant, which does not want the whole table.

**Filters.** Range as buttons (30d / 90d / 1y / All) rather than a date picker, since the question is almost always
"recently" rather than "between two specific dates". The weekly-average toggle only appears once a window holds at
least twelve readings, because smoothing three points hides more than it reveals; each averaged point carries its
bucket size so the tooltip can say how many readings it stands for.

Below the line: latest, change across the window, and the window's mean — what a trend line actually gets read for.

**Split.** The arithmetic lives in [`lib/health.ts`](../src/lib/health.ts) and the component only draws, matching
how `ledger.ts` and `finance.ts` already separate sums from screens. That is what makes the week bucketing testable,
including the case worth getting wrong: `getDay()` returns 0 on Sunday, which belongs to the week that began six
days earlier, not the one starting tomorrow.

**Loose end, unchanged.** Free-text metrics mean a typo becomes its own series — `weight_kg` and `weight-kg` plot
apart, and the selector lists both. That is the same problem item 8 solves for ledger categories, and the fix would
be the same shape.

---

## 8. A categories table for the ledger — **done**

**The idea.** `ledger_entries.category` was free text with nothing behind it. There was no canonical list, so the UI
could not offer a picker, the assistant could not be told what was valid, and a typo silently created a new
category. `finance.categories` fixes all three.

**Reference, not copy.** The decision that shaped the rest. Entries hold a `category_id`, so renaming a category
updates every entry that used it. `on delete restrict` plus an `archived_at` flag is what keeps history readable: a
category can leave the picker without rewriting the past, and one that entries still point at cannot be deleted at
all — the API refuses with a count and says archiving is probably what was wanted.

**Shape.** `id`, `name` (unique), `kind` (`income` / `expense` / `both`), `sort_order`, `archived_at`. `kind` only
narrows the picker; it never rejects an entry. Income and expense entries see the categories that suit them plus the
`both` ones, and every other entry type — transfer, fund movement — is neither, so it sees the whole list.

**One rule worth knowing:** a picker always keeps the entry's _current_ category, archived or unsuited. Without that,
opening an old entry to change its amount would quietly blank its category on save.

**Migration, in two files on purpose.** `0013` creates the table, back-fills one row per distinct name already in
use, points every entry at its match, and seeds `Reconciliation`, which is the one category the application writes
by itself. `0014` drops the old text column. They are separate so the drop can be held back and inspected; run
together they are a single change. The kind of each back-filled category is inferred from how the name has actually
been used, so a category only ever seen on expenses starts as an expense rather than as the permissive default.
Case is preserved rather than folded — `Food` and `food` become two categories, which is faithful to the data and
mergeable by hand.

**Surfaces.**

| Piece                                                                              | Change                                                                                     |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Entry form                                                                         | A select, on the ledger page and in the assistant's in-chat form alike                     |
| [`LedgerCategories`](<../src/app/(workspace)/finance/ledger/LedgerCategories.tsx>) | Add, rename, re-kind, archive and delete, collapsed by default on the ledger page          |
| `GET/POST/PUT/DELETE /api/categories`                                              | The canonical list; delete refuses a category in use                                       |
| `resolveCategoryId` in [`ledger.ts`](../src/lib/ledger.ts)                         | Exact name wins, one unambiguous partial match is accepted, ambiguity resolves to nothing  |
| `categories_list` tool                                                             | Under `finance:read`, so the model can see valid values before proposing an entry          |
| `ledger_get`                                                                       | Entries carry the category _name_ alongside the id, so the assistant never joins two lists |
| `validateLedger`                                                                   | Rejects an unknown category id, turning a foreign-key violation into a sentence            |

**The loose end is settled: the assistant may only choose, never create.** An unknown or ambiguous name leaves the
entry uncategorised rather than inventing a category, which is exactly the long tail the table exists to prevent.
Archived categories are skipped during resolution too, so a retired one cannot be revived by naming it.

**Still open.** There is no merge. Two categories that should be one — a case difference, or a synonym — can only be
fixed by re-pointing entries by hand. Worth building the first time it is actually needed.

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

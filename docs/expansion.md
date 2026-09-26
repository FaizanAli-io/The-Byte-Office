# Expansion ideas

Things worth building, as opposed to [`improvements.md`](./improvements.md), which is about fixing what is already
here. Nothing on this list is scheduled — it is a place to keep ideas with enough detail that picking one up later
does not mean rediscovering the design.

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
- `MCP_API_KEY` becomes a per-user token
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

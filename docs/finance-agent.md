# Finance agent

The protected finance assistant answers questions from the live portfolio,
snapshots, and monthly ledgers. It can propose changes, but every write requires
an explicit confirmation in the chat.

Assistant replies stream into the chat and support safe Markdown, including
headings, lists, emphasis, links, inline code, and tables.

## Setup

Add these values to `.env`:

```dotenv
GROQ_API_KEY=your_server_side_key
```

The assistant uses Groq's `openai/gpt-oss-20b` model.

Review the pending migrations in `drizzle/`, then apply them with:

```bash
npm run db:migrate
```

Never expose the Groq key through a `NEXT_PUBLIC_` variable.

## Tools

Reads run immediately:

- `portfolio_get`
- `snapshots_list`, `snapshot_get`
- `categories_list`
- `ledgers_list`, `ledger_get`

Writes only create a pending proposal:

- `portfolio_item_add`, `portfolio_item_update`, `portfolio_item_remove`
- `ledger_entry_add`, `ledger_entry_update`, `ledger_entry_remove`
- `category_add`, `category_update`, `category_remove`

Ledger add and edit proposals render a form in chat. Add defaults the date to
today, type to expense, and account to the first account. Edit is filled from
the existing record. Submitting the form inserts or updates that ledger entry.

Categories are addressed two ways, deliberately.

**Assigning one to an entry uses its name.** `ledger_entry_add` and
`ledger_entry_update` take `category` as a name, and the server resolves it: an
exact match wins, a single unambiguous partial match is accepted, and anything
unknown or ambiguous is an error naming the near misses rather than a silently
uncategorised entry. `null` clears the category. Archived categories are
skipped, so a retired one cannot be revived by naming it on a transaction.

**Managing one uses its id**, from `categories_list`. A rename would otherwise
have to match the name it is about to replace, and archived categories are
deliberately unreachable by name.

Names are unique case-insensitively — "Food" and "food" are the same category,
enforced by a unique index on `lower(name)` as well as by a readable check in
the application. `category_remove` deletes outright and is refused while any
entry still references the category, with a count of how many; archiving is
the ordinary way to retire one. Both rules live in `lib/categories.ts`, shared
with the REST route behind the ledger page.

The user can confirm or cancel a proposal for 15 minutes. Confirmation claims it
once, reloads the source data, rejects stale or finalized records, validates the
payload again, and only then writes. Replayed confirmations cannot execute.

Every tool call is also stored in `finance_agent_tool_logs`, including the
request ID, model, tool name, arguments, result or error, duration, and time.
Open `/finance/agent/logs` to review these calls.

## Privacy and limits

Relevant finance data and recent chat messages are sent to Groq when the
assistant uses a tool. Conversation history is stored in
`finance_agent_messages` so it continues across devices. Clear chat deletes that
conversation. The server limits message size, history size, reasoning rounds,
tool calls, output size, and request duration.

The agent cannot run SQL, edit ledger accounts, or finalize ledgers. The
existing finance session protects the page and all agent API routes.

The confirmation flow described above covers the **chat** surface only. The MCP
surface (`/api/mcp` and `/api/mcp/tools/{name}`) calls `applyFinanceAction`,
which proposes and immediately executes in one step, so a client writes without
confirmation.

What limits that is the OAuth scope it was granted. A client holding only
`finance:read` cannot reach a write tool — it is not registered for that token,
so it does not appear in `tools/list` at all. Scopes are per module, so a
finance client also cannot touch prayers or health readings. Grant a `:write`
scope only to a client you intend to let change data, and revoke it by
deleting the client row. See [`oauth.md`](./oauth.md).

`tbo_send_inquiry` is the one tool never exposed over MCP: it sends real
email, so it stays on the chat surface where a person confirms it.

## Troubleshooting

- `Groq is not configured`: set `GROQ_API_KEY` and restart Next.js.
- Proposal creation or logging reports a missing table: review and apply the
  pending migrations.
- Assistant logs are empty until a new assistant request runs after migration
  `0002`.
- Conversation history needs migration `0003` (`finance_agent_messages`).
- A confirmation is stale or expired: ask the assistant to read current data
  and create a new proposal.
- The model is rate-limited: wait and try again later, or review your Groq
  account limits.

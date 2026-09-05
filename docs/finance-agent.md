# Finance agent

The protected finance assistant answers questions from the live portfolio,
snapshots, and monthly ledgers. It can propose changes, but every write requires
an explicit confirmation in the chat.

Assistant replies stream into the chat and support safe Markdown, including
headings, lists, emphasis, links, inline code, and tables.

## Setup

Add these values to `.env`:

```dotenv
OPENROUTER_API_KEY=your_server_side_key
OPENROUTER_MODEL=z-ai/glm-5.2:free
```

`OPENROUTER_MODEL` is optional. Availability and rate-limit failures fall back
to OpenRouter's capability-filtered `openrouter/free` router.

Review the pending migrations in `drizzle/`, then apply them with:

```bash
npm run db:migrate
```

Never expose the OpenRouter key through a `NEXT_PUBLIC_` variable.

## Tools

Reads run immediately:

- `portfolio_get`
- `snapshots_list`, `snapshot_get`
- `ledgers_list`, `ledger_get`

Writes only create a pending proposal:

- `portfolio_item_add`, `portfolio_item_update`, `portfolio_item_remove`
- `ledger_entry_add`, `ledger_entry_update`, `ledger_entry_remove`

Ledger add and edit proposals render a form in chat. Add defaults the date to
today, type to expense, and account to the first account. Edit is filled from
the existing record. Submitting the form inserts or updates that ledger entry.

The user can confirm or cancel a proposal for 15 minutes. Confirmation claims it
once, reloads the source data, rejects stale or finalized records, validates the
payload again, and only then writes. Replayed confirmations cannot execute.

Every tool call is also stored in `finance_agent_tool_logs`, including the
request ID, model, tool name, arguments, result or error, duration, and time.
Open `/finance/agent/logs` to review these calls.

## Privacy and limits

Relevant finance data and recent chat messages are sent to OpenRouter when the
assistant uses a tool. Conversation history is stored in
`finance_agent_messages` so it continues across devices. Clear chat deletes that
conversation. The server limits message size, history size, reasoning rounds,
tool calls, output size, and request duration.

The agent cannot run SQL, edit ledger accounts, finalize ledgers, or bypass
confirmation. The existing finance session protects the page and all agent API
routes.

## Troubleshooting

- `OpenRouter is not configured`: set `OPENROUTER_API_KEY` and restart Next.js.
- Proposal creation or logging reports a missing table: review and apply the
  pending migrations.
- Assistant logs are empty until a new assistant request runs after migration
  `0002`.
- Conversation history needs migration `0003` (`finance_agent_messages`).
- A confirmation is stale or expired: ask the assistant to read current data
  and create a new proposal.
- A free model is unavailable or rate-limited: OpenRouter free models share one
  daily quota across your account (50/day without credits). Add $10 in credits
  at openrouter.ai for 1,000 free requests/day, wait until the quota resets,
  or set `OPENROUTER_MODEL` to a paid tool-capable model (for example
  `z-ai/glm-5.2` without the `:free` suffix).

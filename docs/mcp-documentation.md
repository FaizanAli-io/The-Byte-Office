# MCP documentation

The MCP server at `/api/mcp` and its REST twin at `/api/mcp/tools/{name}`. Every tool comes from
[`registry.ts`](../src/lib/agent/registry.ts); a tool is exposed when it has `mcp: true`. The chat assistant at
`/finance/agent` uses the same tools.

## Connecting

Authentication is OAuth 2.1 with no static key. A client discovers the server, registers itself and runs the
authorization code flow; you approve it once in the browser while signed in to the finance workspace.

- **Discovery:** `/.well-known/oauth-protected-resource/api/mcp` and `/.well-known/oauth-authorization-server`.
- **Endpoints:** `POST /oauth/register` (open dynamic registration — a `client_id` grants nothing until approved),
  `/oauth/authorize`, `POST /oauth/token`, `POST /oauth/revoke`.
- **Public clients only:** no client secret, PKCE `S256` required, `redirect_uri` matched exactly.
- **Tokens:** access tokens are HMAC-signed with `OAUTH_SIGNING_SECRET`, bound to this server's MCP URL and valid for
  6 hours with no database read. Refresh tokens are stored hashed, last 30 days, rotate on use, and reusing a spent
  one revokes its whole chain. Codes are single-use and expire in 60 seconds.
- **Revoking:** revoke the refresh token or delete the client row; its current access token runs out within 6 hours.
  Rotating `OAUTH_SIGNING_SECRET` kills every token at once without signing you out of the website.
- **Without a browser:** `npm run oauth:token` issues a token directly (needs database access); `npm run mcp:smoke`
  checks discovery, the 401 challenge and, given a token, the tools.
- **`/docs`** runs the same flow for the Swagger UI, so nothing is ever pasted.

## Scopes

One read and one write scope per module; a token sees only the tools its scopes allow, and the rest are not listed.
A write scope implies its module's read. A client that asks for no scope gets every read scope and no write scope.
The scope list is derived from the exposed tools, so `tbo:write` does not exist.

## Writes

On MCP a write applies immediately: the server builds the same proposal the chat would, then runs it. In the chat a
write creates a confirmation card (or a ledger form) instead, which can be confirmed for 15 minutes; confirming claims
it once, re-reads the source and refuses it if the data changed. Every call is logged at `/finance/agent/logs` —
chat calls as `internal`, MCP and REST as `external` with the client's name.

## Finance

| Read (`finance:read`)  | Write (`finance:write`) |
| ---------------------- | ----------------------- |
| `portfolio_get`        | `portfolio_item_add`    |
|                        | `portfolio_item_update` |
|                        | `portfolio_item_remove` |
| `snapshots_list`       |                         |
| `snapshot_get`         |                         |
| `ledgers_list`         | `ledger_entry_add`      |
| `ledger_get`           | `ledger_entry_update`   |
| `ledger_summary`       | `ledger_entry_remove`   |
| `ledger_accounts_list` | `ledger_account_add`    |
|                        | `ledger_account_update` |
|                        | `ledger_account_remove` |
| `categories_list`      | `category_add`          |
|                        | `category_update`       |
|                        | `category_remove`       |

- **Holdings are one flat list.** `portfolio_get` returns `holdings`, each with `id`, `kind` (`local_bank`,
  `remote_bank`, `mutual_fund`), `name`, `group` (a fund's bank), `amount` in its currency (USD for a remote bank,
  otherwise PKR), `exchangeRate` and `valuePkr`. `portfolio_item_add` takes the same fields; update and remove take
  the `id`.
- **The portfolio is read from the newest ledger month**, so a changed amount becomes that account's closing balance
  and removing a holding used by past months archives it.
- **Entries name their category.** `ledger_entry_add` and `ledger_entry_update` take `category` as a name: an exact
  match wins, a single unambiguous partial match is accepted, anything else is an error listing the near misses, and
  `null` clears it. Archived categories are skipped.
- **Managing a category uses its id** from `categories_list`. Names are unique case-insensitively, and
  `category_remove` is refused while entries use it — archive instead.
- **Finalized months are read-only**, and nothing can finalize a month except the ledger page.

## Personal

| Read (`personal:read`) | Write (`personal:write`) |
| ---------------------- | ------------------------ |
| `prayers_list`         | `prayer_set`             |
| `health_list`          | `health_add`             |
|                        | `health_update`          |
|                        | `health_remove`          |
| `health_metrics_list`  | `health_metric_add`      |
|                        | `health_metric_update`   |
|                        | `health_metric_remove`   |

Health readings name their metric, which must already exist in `health_metrics_list`; an unknown name is rejected.
Metrics themselves are managed by id, and one with readings cannot be deleted — rename it instead.

## TBO

| Read (`tbo:read`) |
| ----------------- |
| `tbo_info`        |

`tbo_send_inquiry` sends real email, so it is chat-only.

## Resources

`finance://portfolio` · `finance://ledgers/{month}` · `finance://snapshots/{id}`

# MCP tools

Every tool the MCP server at `/api/mcp` exposes, by module. Each is also callable over REST at
`/api/mcp/tools/{name}`. The list comes from [`registry.ts`](../src/lib/agent/registry.ts); a tool appears there with
`mcp: true`.

A token sees only the tools its scopes allow (`<module>:read` or `<module>:write`). Writes apply immediately on MCP; in
the chat assistant the same tools create a confirmation card instead.

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

## TBO

| Read (`tbo:read`) |
| ----------------- |
| `tbo_info`        |

`tbo_send_inquiry` is chat-only, so there is no `tbo:write` scope.

## Resources

`finance://portfolio` · `finance://ledgers/{month}` · `finance://snapshots/{id}`

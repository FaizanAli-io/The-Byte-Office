# OAuth for the MCP server

How authentication to `/api/mcp` works. This is implemented; the one step left is applying migration `0010`, which
creates the three tables below.

`/api/mcp` was previously guarded by a single shared bearer token, `MCP_API_KEY`. That worked for Claude and Cursor,
which let you paste a header, but ChatGPT's connector flow offers only no-auth or OAuth, so the key could not get us
there.

**OAuth replaced it outright.** The static key is gone, not kept alongside as a fallback — there is no second way in,
and no code path that accepts a shared secret. The last section records what that removal touched.

The larger reason to do this is not ChatGPT. One static key means one level of access: anything holding it can delete
a ledger entry with no confirmation, and the only way to revoke it is to rotate the key and re-configure every client.
OAuth gives per-client credentials that can be revoked individually and **scopes**, so a connector can be granted read
access without write access. That is what closed the long-standing complaint that MCP writes bypassed the
confirmation model the docs promised: they still apply immediately on that surface, but only for a client that was
granted `finance:write`, and that grant is per client and revocable.

---

## What the SDK already provides

`@modelcontextprotocol/server` v2 ships the entire Resource Server half. These are exported from the package root:

| Export                                 | Does                                                                         |
| -------------------------------------- | ---------------------------------------------------------------------------- |
| `requireBearerAuth`                    | The gate: parses the header, verifies, enforces scopes, returns a `Response` |
| `oauthMetadataResponse`                | Serves **both** well-known documents from one call                           |
| `buildOAuthProtectedResourceMetadata`  | The RFC 9728 document, validating the issuer URL                             |
| `getOAuthProtectedResourceMetadataUrl` | The URL to advertise in the `WWW-Authenticate` challenge                     |
| `OAuthTokenVerifier`                   | The one-method interface we implement                                        |

So discovery and the 401 challenge are close to free. What is **not** provided is the Authorization Server — the
register, authorize and token endpoints. That is what this document specifies.

One trap, straight from the SDK's own doc comment: bearer verification **rejects any token whose `expiresAt` is
unset**. Our verifier must populate it.

---

## Design decisions

**Public clients only, PKCE mandatory.** ChatGPT and Claude are public clients: they cannot keep a secret, so a client
secret would be security theatre. Registration issues a `client_id` and nothing else, `token_endpoint_auth_method` is
`none`, and `code_challenge_method=S256` is required on every authorization request. A code intercepted from the
redirect is useless without the verifier.

**Access tokens are stateless; refresh tokens are stored.** An access token is an HMAC-signed string verified with no
database read, which keeps `/api/mcp` cheap and leaves the verifier edge-compatible. The cost is that an access token
cannot be revoked before it expires, so the window is bounded at **6 hours**. Refresh tokens are rows and can be
revoked instantly. This is the same trade-off already made for the finance session in
[`finance-auth.ts`](../src/lib/finance-auth.ts), for the same reasons.

Six hours is the length of a revocation delay, not a re-login interval: revoking a client's refresh token stops it
getting a new access token immediately, but the one it already holds keeps working until it expires. If you ever need
a hard cut, deleting the client row and rotating `OAUTH_SIGNING_SECRET` kills every outstanding token at once.

**One human, so no user table.** There is exactly one person. `/oauth/authorize` proves it is them by checking the
existing finance session cookie; there is no account model, no per-user consent record, and no multi-tenancy. This is
what keeps the implementation small.

**A separate signing secret.** `OAUTH_SIGNING_SECRET`, not `FINANCE_SESSION_SECRET`. Rotating it should invalidate
every MCP token without signing you out of the website, and vice versa. Different blast radius, different lifetime.

**Scopes map onto `tool.write`.** [`registry.ts`](../src/lib/agent/registry.ts) already marks every mutating tool. No
new metadata is needed — the scope check is a filter over a field that exists.

---

## Scopes

One read and one write scope per module. Splitting by module rather than having a single global pair means a
connector that only needs the portfolio never gains the ability to read prayer counts.

| Scope            | Grants                                                     |
| ---------------- | ---------------------------------------------------------- |
| `finance:read`   | Portfolio, snapshots, ledgers, and all three MCP resources |
| `finance:write`  | Add, edit and remove holdings and ledger entries           |
| `personal:read`  | Missed prayer counts and health readings                   |
| `personal:write` | Add, edit and remove prayer counts and health readings     |
| `tbo:read`       | Public company information                                 |

The list is **derived from the exposed tools**, not written down, so a scope that would grant nothing cannot be
advertised. `tbo:write` is absent for exactly that reason: `tbo_send_inquiry` sends real email and is deliberately
withheld from MCP, leaving no tool behind that scope. Withdraw another tool and its scope disappears the same way.

A write scope implies its module's read: a tool that edits a module is useless without being able to look at it
first. A client that sends no `scope` at all — which most MCP clients do — is granted every **read** scope and no
write scope.

Connecting needs no particular scope. Which tools exist is decided per tool when the server is built for the
request, so a token simply sees what it may use.

## Tables

Three new tables in the `finance` schema, following the conventions in [`schema.ts`](../src/lib/db/schema.ts):
`uuid` primary keys, `timestamp with time zone` in `date` mode, indexes on anything swept by expiry.

### `finance.oauth_clients`

One row per client that has ever registered. Registration is open to the world by design — it hands out identifiers,
not access — so expect rows from clients that never complete a flow.

| Column          | Type                      | Notes                                             |
| --------------- | ------------------------- | ------------------------------------------------- |
| `client_id`     | `uuid` PK, default random | What the client sends as `client_id`              |
| `client_name`   | `text` not null           | Shown on the consent screen. Untrusted; escape it |
| `redirect_uris` | `jsonb` not null          | `string[]`. Matched **exactly**, never by prefix  |
| `created_at`    | `timestamptz` not null    |                                                   |
| `last_used_at`  | `timestamptz` nullable    | Lets you spot and delete stale registrations      |

No `client_secret` column: public clients only.

### `finance.oauth_authorization_codes`

Single-use, short-lived. Mirrors the `magic_links` pattern in
[`finance-magic-link.ts`](../src/lib/finance-magic-link.ts) — the claim and the check happen in one statement so two
concurrent redemptions cannot both succeed.

| Column           | Type                      | Notes                                                       |
| ---------------- | ------------------------- | ----------------------------------------------------------- |
| `code`           | `uuid` PK, default random | The value handed back in the redirect                       |
| `client_id`      | `uuid` not null, FK       | `on delete cascade`                                         |
| `redirect_uri`   | `text` not null           | Must match again at the token endpoint                      |
| `code_challenge` | `text` not null           | S256 challenge; the verifier is checked against it          |
| `scopes`         | `jsonb` not null          | `string[]`, exactly what was consented to                   |
| `resource`       | `text` not null           | The RFC 8707 audience; copied into the token                |
| `expires_at`     | `timestamptz` not null    | **60 seconds.** A code is exchanged immediately or not used |
| `consumed_at`    | `timestamptz` nullable    | Set by the claiming `UPDATE`                                |

Index on `expires_at` for the opportunistic cleanup.

### `finance.oauth_refresh_tokens`

| Column       | Type                      | Notes                                              |
| ------------ | ------------------------- | -------------------------------------------------- |
| `id`         | `uuid` PK, default random |                                                    |
| `token_hash` | `text` not null unique    | SHA-256 of the token. Never store the token itself |
| `client_id`  | `uuid` not null, FK       | `on delete cascade`                                |
| `family_id`  | `uuid` not null           | Constant across a rotation chain; see below        |
| `scopes`     | `jsonb` not null          | `string[]`                                         |
| `expires_at` | `timestamptz` not null    | 30 days, reset on every rotation — see below       |
| `revoked_at` | `timestamptz` nullable    |                                                    |
| `created_at` | `timestamptz` not null    |                                                    |

**Rotation and reuse detection.** Each refresh issues a new token and revokes the old one. If a token that is already
revoked is presented, that means it leaked and was used twice, so revoke the whole `family_id` and force a new
authorization. This is about ten lines and one column; drop `family_id` if you would rather not, but rotation itself
is not optional for public clients.

**The 30 days is a sliding window, not a deadline.** The replacement token issued by a rotation gets a fresh 30 days
from the moment it is issued, so the clock measures _inactivity_, not time since you authorized. A connector that
refreshes every 6 hours resets it constantly, which means:

- you authenticate **once**, in the browser, and then not again
- you are only asked to authorize a second time if the client goes 30 days without a single request, or if you revoke
  it, delete its row, or rotate `OAUTH_SIGNING_SECRET`

There is deliberately **no absolute cap** on the chain — no "re-authorize every 90 days regardless". A cap is how a
multi-tenant provider limits the damage of a session it cannot see; here there is one user who can revoke any client
instantly from the database, so a cap would only interrupt you. Add one later by carrying an `authorized_at` on the
family and refusing to rotate past it.

---

## Endpoints

### Discovery

Both documents come from `oauthMetadataResponse(request, options)`. Nothing to write beyond the options object.

```
GET /.well-known/oauth-protected-resource/api/mcp
```

```json
{
  "resource": "https://<host>/api/mcp",
  "authorization_servers": ["https://<host>"],
  "scopes_supported": ["finance:read", "finance:write", "personal:read", "personal:write", "tbo:read"],
  "bearer_methods_supported": ["header"],
  "resource_name": "The Byte Office"
}
```

```
GET /.well-known/oauth-authorization-server
```

```json
{
  "issuer": "https://<host>",
  "authorization_endpoint": "https://<host>/oauth/authorize",
  "token_endpoint": "https://<host>/oauth/token",
  "registration_endpoint": "https://<host>/oauth/register",
  "revocation_endpoint": "https://<host>/oauth/revoke",
  "response_types_supported": ["code"],
  "grant_types_supported": ["authorization_code", "refresh_token"],
  "code_challenge_methods_supported": ["S256"],
  "token_endpoint_auth_methods_supported": ["none"],
  "scopes_supported": ["finance:read", "finance:write", "personal:read", "personal:write", "tbo:read"]
}
```

Both are public, cacheable and must **not** sit behind the finance session.

### `POST /oauth/register`

RFC 7591 Dynamic Client Registration. `application/json`.

```json
{
  "client_name": "ChatGPT",
  "redirect_uris": ["https://chatgpt.com/connector_platform_oauth_redirect"],
  "grant_types": ["authorization_code", "refresh_token"],
  "response_types": ["code"],
  "token_endpoint_auth_method": "none"
}
```

`201 Created`:

```json
{
  "client_id": "6f1c…",
  "client_id_issued_at": 1774483200,
  "client_name": "ChatGPT",
  "redirect_uris": ["https://chatgpt.com/connector_platform_oauth_redirect"],
  "grant_types": ["authorization_code", "refresh_token"],
  "response_types": ["code"],
  "token_endpoint_auth_method": "none"
}
```

Validation, all of which is required rather than defensive:

- `redirect_uris` is non-empty, and every entry is an absolute URI with **no fragment**
- every entry is `https:`, except `http://localhost` and `http://127.0.0.1` for local testing
- `token_endpoint_auth_method` is absent or `none`; reject anything else
- `grant_types` is a subset of what we support

Errors are `400` with `{"error": "invalid_redirect_uri"}` or `{"error": "invalid_client_metadata"}`.

Registration is unauthenticated, which is what the spec intends, but it is still an unbounded write. Rate-limit it,
and cap `client_name` and the number of `redirect_uris`.

### `GET /oauth/authorize`

The only endpoint a human sees. Query parameters:

| Parameter               | Required | Notes                                          |
| ----------------------- | -------- | ---------------------------------------------- |
| `response_type`         | yes      | `code`                                         |
| `client_id`             | yes      | Must exist in `oauth_clients`                  |
| `redirect_uri`          | yes      | Exact match against a registered URI           |
| `code_challenge`        | yes      |                                                |
| `code_challenge_method` | yes      | `S256`; reject `plain`                         |
| `state`                 | yes      | Opaque, echoed back verbatim                   |
| `scope`                 | no       | Space-delimited; absent means every read scope |
| `resource`              | yes      | Must equal our MCP URL                         |

Order of operations matters here:

1. Look up `client_id` and match `redirect_uri` exactly. **If either fails, render an error page — do not redirect.**
   Redirecting to an unvalidated URI is an open redirect and would leak the `state` and any error detail.
2. Any other invalid parameter is reported by redirecting to the (now validated) URI with
   `?error=invalid_request&state=…`.
3. No valid finance session → `302` to `/finance/login?next=<this full URL>`. The existing login already honours
   `next`, so the magic-link flow carries the authorization request through untouched with no new code.
4. Session present → render the consent screen: the client name and one section per requested module, listing in
   plain words what approving will grant, with writes marked. Nothing on the screen is a control — it states the
   request and offers Approve or Deny. Approving grants exactly the requested scopes, already narrowed to ones this
   server recognises; to grant less, deny and have the client ask for less.

   The buttons report themselves: the pressed one shows a spinner and "Authorizing…" or "Cancelling…" while both
   lock, because granting writes a row and then redirects, which is long enough to look like nothing happened.

### `POST /oauth/authorize`

The consent submission. Requires a valid finance session and a CSRF token minted with the consent page. On approve,
insert an `oauth_authorization_codes` row and redirect:

```
302 <redirect_uri>?code=<uuid>&state=<state>
```

On deny:

```
302 <redirect_uri>?error=access_denied&state=<state>
```

### `POST /oauth/token`

`application/x-www-form-urlencoded`, **not JSON** — this catches people out, and `jsonBody` from
[`api.ts`](../src/lib/api.ts) will not do here.

**Grant `authorization_code`:**

| Field           | Notes                                   |
| --------------- | --------------------------------------- |
| `grant_type`    | `authorization_code`                    |
| `code`          |                                         |
| `code_verifier` | SHA-256 must equal the stored challenge |
| `client_id`     | Must match the code's client            |
| `redirect_uri`  | Must match the code's `redirect_uri`    |
| `resource`      | Must match the code's `resource`        |

Claim the code with a conditional `UPDATE … WHERE consumed_at IS NULL RETURNING`, exactly as `consumeMagicLink` does.
A code that is expired, already consumed or fails any comparison is a flat `400 invalid_grant` — never say which.

**Grant `refresh_token`:** `grant_type`, `refresh_token`, `client_id`, optional `scope` for **narrowing only**.

Both answer `200`:

```json
{
  "access_token": "at.1774486800.6f1c….ZmluYW5jZTpyZWFk.9a3f…",
  "token_type": "Bearer",
  "expires_in": 21600,
  "refresh_token": "…",
  "scope": "finance:read"
}
```

Errors are RFC 6749 §5.2 shapes with `Cache-Control: no-store`: `invalid_request`, `invalid_grant`, `invalid_client`,
`unsupported_grant_type`, `invalid_scope`.

### `POST /oauth/revoke`

RFC 7009. Form-encoded `token` plus optional `token_type_hint`. Always answers `200` with an empty body, including for
an unknown token — a revocation endpoint must not be usable as a token oracle. Revoking a refresh token revokes its
whole family.

---

## Token format

Following the convention already set by `signMagicLink`: dot-delimited, HMAC-SHA-256, hex signature, verified in
constant time. The existing `sign()` and `constantTimeEqual()` helpers in `finance-auth.ts` can be reused as they are,
with a different secret and prefix.

```
at.<expiresAtMs>.<clientId>.<base64url(scopes.join(' '))>.<signature>

signature = HMAC(OAUTH_SIGNING_SECRET, "mcp:<expiresAtMs>:<clientId>:<scopes>:<resource>")
```

The `resource` is signed but not carried in the token, because there is exactly one and the verifier knows it. That is
what binds the token to this server: a token minted for a different audience cannot validate here. **This is a
requirement, not a refinement** — the MCP specification forbids accepting a token that was not issued for you, and
skipping it is the confused-deputy hole.

Verification returns the SDK's `AuthInfo`:

```ts
{
  (token, clientId, scopes, expiresAt);
} // expiresAt in SECONDS since epoch
```

Refresh tokens are 32 random bytes, base64url, stored only as a SHA-256 hash.

---

## Wiring into the existing code

**[`src/mcp/auth.ts`](../src/mcp/auth.ts)** — `verifyMcpRequest` and `unauthorizedResponse` are replaced by an
`OAuthTokenVerifier` and a `requireBearerAuth` gate. Roughly the same size as what is there now.

**[`src/mcp/http.ts`](../src/mcp/http.ts)** — the gate returns either `AuthInfo` or a ready-made `Response`:

```ts
const gate = requireBearerAuth({
  verifier,
  requiredScopes: ['finance:read'],
  resourceMetadataUrl: getOAuthProtectedResourceMetadataUrl(new URL(mcpUrl)),
});

export async function handleMcpRequest(request: Request) {
  const auth = await gate(request);
  if (auth instanceof Response) return auth;
  return handler.fetch(request, { authInfo: auth });
}
```

**[`src/mcp/server.ts`](../src/mcp/server.ts)** — this is the payoff. `createMcpHandler` takes a factory that receives
`ctx.authInfo`, so the server can be built per request with only the tools the token is allowed to use:

```ts
createMcpHandler((ctx) => createMcpServer(ctx.authInfo?.scopes ?? []));
```

`registerTools` then keeps a tool only when the token carries `scopeForTool(tool)` — its module, plus write if it
mutates. A connector does not merely get refused when it calls a tool it may not use: it never sees the tool in
`tools/list`, which is a much better experience for the model.

**[`src/app/api/mcp/tools/[name]/route.ts`](../src/app/api/mcp/tools/[name]/route.ts)** — the REST wrappers need the
same gate and the same per-tool scope check.

**[`src/middleware.ts`](../src/middleware.ts)** — one addition and one thing to be careful about:

- add `/oauth/authorize` to the matcher, so an unauthenticated authorization request redirects to the magic-link login
- `/oauth/register`, `/oauth/token`, `/oauth/revoke` and everything under `/.well-known/` must stay **out** of the
  matcher; clients fetch them with no cookie, and the current `/api/*` branch would answer a JSON 401 and break
  discovery

**`/.well-known/` routes.** No rewrite is needed: `src/app/.well-known/…/route.ts` serves correctly, verified
against a production build. The earlier concern about dot-prefixed App Router directories does not apply to this Next
version.

**`example.env`** — `OAUTH_SIGNING_SECRET`, generated the same way as the others.

**`npm run oauth:token -- "<name>"`** — mints a refresh token for a client that has no browser, such as the smoke
test or a cron job. It is not a way around consent: it needs `DATABASE_URL`, which is already total access to
everything the token could reach. It exists because the authorization code flow cannot serve a CLI by design, and
without it there would be no non-browser path in at all.

The handler's `legacy: 'stateless'` and `responseMode: 'json'` settings need no change; bearer auth is per-request.

---

## Security checklist

Each of these has been a real vulnerability in a real OAuth deployment:

- [ ] `redirect_uri` compared by exact string match, never prefix or subdomain
- [ ] An unknown `client_id` or unmatched `redirect_uri` renders an error page and does **not** redirect
- [ ] `code_challenge_method=S256` enforced; `plain` rejected
- [ ] Authorization codes single-use, claimed by a conditional `UPDATE`, and expiring in 60 seconds
- [ ] Token audience verified against this server's MCP URL on every request
- [ ] `state` echoed back unmodified; CSRF token on the consent POST
- [ ] Refresh tokens rotated on use, with reuse revoking the family
- [ ] Refresh tokens stored hashed
- [ ] `Cache-Control: no-store` on every token response
- [ ] Revocation answers `200` for unknown tokens
- [ ] `client_name` escaped on the consent page — it is attacker-controlled
- [ ] Registration rate-limited and size-capped

---

## What removing the static key touched

`MCP_API_KEY` is gone entirely, with no dual-accept period, so the verifier has one code path and no branch that
trusts a shared secret.

| File                                | Change                                                                                   |
| ----------------------------------- | ---------------------------------------------------------------------------------------- |
| `src/mcp/auth.ts`                   | Rewritten as an `OAuthTokenVerifier` built per request against the resource              |
| `src/mcp/http.ts`                   | `requireBearerAuth` gate; the server factory now receives the token's scopes             |
| `src/mcp/server.ts`, `modules/*`    | `createMcpServer(scopes)` threads scopes down to tool registration                       |
| `src/app/api/mcp/tools/[name]`      | Shares the gate and refuses a write tool without `finance:write`                         |
| `src/mcp/openapi.ts`                | `bearerAuth` replaced by an OAuth2 `authorizationCode` flow, with per-tool scopes        |
| `src/app/(workspace)/docs/page.tsx` | Registers itself as a client and runs the real flow; nothing is pasted                   |
| `public/oauth2-redirect.html`       | Swagger's redirect handler, served from our own origin so the code never leaves it       |
| `scripts/mcp-smoke.mjs`             | Checks discovery and the challenge unauthenticated, then the token exchange if given one |
| `src/middleware.ts`                 | `/oauth/authorize` added; everything else under `/oauth` and `/.well-known` stays out    |
| `example.env`, `README.md`          | `OAUTH_SIGNING_SECRET` replaces `MCP_API_KEY`                                            |

Two knock-on effects worth recording.

**`/docs` improved rather than degraded.** It used to ask you to paste a master key into a page that loads a
third-party script. It now runs the authorization code flow with PKCE, registering itself on first load and keeping
only a public `client_id`. The page that used to invite pasting a master key now holds nothing worth stealing.

**There is no longer a non-browser way in.** If `OAUTH_SIGNING_SECRET` is misconfigured on a deploy, you cannot fall
back to curl with a header. `npm run oauth:token` is the escape hatch, and it needs database access. This is the
correct trade, but it makes the smoke test load-bearing rather than a nicety.

---

## Testing

The pure parts are worth unit tests in the style of `tests/finance-auth.test.ts`, which already covers signing:

- token sign and verify round-trip; rejection of a tampered signature, a wrong secret, an expired token and a token
  for a different audience
- PKCE: a correct verifier passes, a wrong one fails
- redirect URI matching, including the near-misses — trailing slash, added query, different port, subdomain
- scope filtering: a `finance:read` token sees exactly the five read tools in `tools/list`

The flow itself is easiest to check end to end against a local server with the MCP Inspector, which performs real
discovery, registration and PKCE.

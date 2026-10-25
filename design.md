# Live Exchange Rates and Cross-Currency Transfers

## Status

All [decisions](#decisions) confirmed. Ready for implementation.

## Objective

1. **No typed exchange rates.** A foreign account is given a currency code (`USD`, `GBP`, …), never a rate. One
   server-maintained rate table supplies every PKR conversion on the site.
2. **Transfers record what actually moved.** The source account decreases by exactly the amount sent, the destination
   increases by exactly the amount received, and any difference is a separate, ordinary ledger entry:
   - an **expense** on the source account when value was lost (fees or a worse rate);
   - an **income** on the source account when value was gained (a better rate).
3. **The rate you received is written down.** For cross-currency transfers, the received rate is computed from the
   two amounts and written as the note of the cost/gain entry.
4. Adding a transfer writes both entries atomically, and the UI, API and MCP behave the same. After that, the two are
   independent entries with no link between them.

---

## Part 1: Exchange Rate Table

### Shape

A single JSON object, PKR per one unit of each currency, rounded to 2 decimals:

```json
{
  "currencies": {
    "USD": 280.92,
    "GBP": 356.4
  },
  "updated_at": "2026-10-19T09:12:44.000Z"
}
```

PKR is implicit (rate `1`) and never stored.

### Storage

The site runs on Vercel, where the file system does not persist between requests, so the object lives in Postgres:
a table `finance.exchange_rates` with one row per currency: `currency text` (primary key), `value numeric` (PKR per
unit), `updated_at timestamptz` (last successful fetch) and `checked_at timestamptz` (last attempt, successful or not).
Every row is written at once, so the timestamps agree. It is the cache, the fallback copy, and the only rate source the
rest of the code reads.

### Provider

[open.er-api.com](https://www.exchangerate-api.com/docs/free): free, no API key, includes PKR.

```text
GET https://open.er-api.com/v6/latest/PKR
→ { "result": "success", "rates": { "USD": 0.00356, "GBP": 0.00281, ... } }

PKR per unit = round(1 / rates[code], 2)
```

### Refresh Flow

```text
getExchangeRates()
      │
      ▼
 in-process copy or stored row
      │
  ┌───┴──────────────────────┐
 checked_at < 1 h ago       no row, or checked_at ≥ 1 h ago
  │                          │
  ▼                          ▼
 return it                  fetch provider (3 s timeout), set checked_at
                             │
               ┌─────────────┴─────────────┐
              ok                 network error / timeout / bad payload
               │                           │
               ▼                           ├── row exists → return it
        round, keep every                  └── no row     → error
        currency ≥ 1 PKR,                      "Exchange rates unavailable"
        upsert row
               │
               ▼
        return row

 every return carries stale = updated_at older than 1 h
```

- **At most one provider call per hour.** Every request that values money calls `getExchangeRates()`; each server
  instance keeps the last row in memory, and the provider is only contacted when the last attempt (`checked_at`) is
  over an hour old. A failed attempt also counts, so an outage costs one 3 s timeout per hour, not one per request.
- **Every supported currency is stored**, not just those in use, so a new holding's currency never forces a refresh:
  adding one checks the code against the stored table. Rates only need fetching at all when a non-PKR value is read.
- **`stale`** means the last successful fetch (`updated_at`) is over an hour old, which only happens after a failed
  refresh.
- **2-decimal rounding** is fine for USD, GBP, EUR, AED, SAR. A currency worth under 1 PKR (IDR, KRW) would round to
  nothing useful, so it is left out of the table and cannot be used; JPY (≈ 1.9) is kept at reduced precision.

### Where Rates Are Used

| Place | Rate used |
| --- | --- |
| Portfolio page and `portfolio_get` | Live table |
| Draft ledger month (account values, `toPkr`) | Live table |
| New ledger entry in a foreign account | Live rate **stamped** onto the entry when written |
| Finalized ledger month | Rates **frozen** onto its accounts at finalize |
| Snapshots | Rates **frozen** into the snapshot at creation (already true today) |

Freezing keeps history stable: a finalized month or an old snapshot does not change value every time the market
moves. Reopening a month unfreezes it; finalizing again freezes the then-current rates.

### Rate Visibility

- `GET /api/exchange-rates` returns the object plus `stale`.
- MCP tool `exchange_rates_get` (read, `finance:read`) returns the same.
- The portfolio and ledger pages show `USD/PKR 280.92 · updated 2 h ago`, in amber when `stale`.
- The rates line carries the provider's required attribution link, "Rates By Exchange Rate API".

---

## Part 2: Currency Instead of Exchange Rate

### Today

- Currency is implied by holding kind: `remote_bank` is always USD (`SHAPES` in `src/lib/accounts.ts`).
- Rates are typed in by hand: the portfolio bank form, the ledger account card ("PKR per USD"), and the MCP
  `exchangeRate` fields on holdings, ledger accounts and entries.

### After

- `holdings.currency`: ISO 4217 code, `PKR` for local banks and funds, any supported foreign code for
  `remote_bank`. Existing remote banks are backfilled to `USD`.
- `LedgerCurrency` widens from `'PKR' | 'USD'` to a validated 3-letter code string.
- Every typed exchange-rate input is removed from the UI and from MCP schemas. Where a rate is shown, it is read-only.
- `ledger_accounts.exchange_rate` becomes nullable: `null` while the month is a draft (use the live rate), set
  when the month is finalized.
- `ledger_entries.exchange_rate` is set by the server at write time from the live table; client values are ignored.
- The destination rate is used only to split a new transfer; it is not stored.

---

## Part 3: Transfers

### Inputs (UI and MCP alike)

- Source account
- Destination account
- **Amount sent**, in the source currency
- **Amount received**, in the destination currency (pre-filled with the amount sent when the currencies match)
- Date, optional note

### Calculation

Rates are PKR per unit (PKR = 1), taken from the live table at the moment of writing.

```text
transfer portion = received × destination rate ÷ source rate        (source currency, rounded to 2 dp)
difference       = sent − transfer portion

difference > 0  →  EXPENSE on the source account, amount = difference
difference < 0  →  INCOME  on the source account, amount = |difference|
difference = 0  →  no extra entry
```

The transfer entry stores `amount = transfer portion` and `destinationAmount = received`. Because the difference is
the remainder after rounding, the source account always moves by exactly the amount sent:

```text
loss:  −transfer portion − expense   = −sent
gain:  −transfer portion + income    = −sent
```

### Received Rate in the Note

Quoted in standard FX notation, `BASE/QUOTE rate` = units of QUOTE per one unit of BASE, regardless of which way
the money moved:

- **Base currency** is whichever side ranks higher in the market-convention order
  `EUR > GBP > AUD > NZD > USD > CAD > CHF > JPY`. Unlisted currencies rank below these, alphabetically. PKR always
  ranks last, so it is always the quote currency: `USD/PKR`, `GBP/PKR`, `GBP/USD`, `EUR/USD`.
- **Precision:** 2 dp when PKR is the quote currency, 4 dp otherwise.

```text
received rate = quote-side amount ÷ base-side amount
market rate   = base rate ÷ quote rate        (both PKR per unit from the live table)

note: "Received at USD/PKR 279.00; market 280.92"
```

### Categories

| Situation | Extra entry | Category |
| --- | --- | --- |
| Same currency, received < sent | Expense | `Transfer fees` |
| Different currency, value lost | Expense | `Exchange cost` |
| Different currency, value gained | Income | `Exchange gain` |
| Same currency, received > sent | Rejected: "Received can't exceed sent for a same-currency transfer" | — |

Each category is created on first use, like the existing `Reconciliation` category.

### Flow A: Same Currency (HBL → Meezan, both PKR)

```text
 sent PKR 50,000, received PKR 50,000
 └── Transfer  HBL → Meezan   PKR 50,000

 sent PKR 50,000, received PKR 49,900
 ├── Transfer  HBL → Meezan   PKR 49,900
 └── Expense   HBL            PKR 100       "Transfer fees"
```

No rate line in the form; no note is written.

### Flow B: Foreign → PKR, Value Lost (Deel USD → Personal PKR)

Live rate: USD 280.92. Sent $1,000, received PKR 279,000.

```text
 transfer portion = 279,000 × 1 ÷ 280.92 = $993.17
 difference       = 1,000 − 993.17       = $6.83   (≈ PKR 1,918.68)

 ├── Transfer  Deel → Personal   $993.17 → PKR 279,000
 └── Expense   Deel              $6.83     "Exchange cost"
                                 note: "Received at USD/PKR 279.00; market 280.92"

 Deel −$1,000 · Personal +PKR 279,000 · Expenses +PKR 1,918.68
```

### Flow C: Foreign → PKR, Value Gained

Live rate: USD 280.92. Sent $1,000, received PKR 282,000.

```text
 transfer portion = 282,000 ÷ 280.92 = $1,003.84
 difference       = 1,000 − 1,003.84 = −$3.84

 ├── Transfer  Deel → Personal   $1,003.84 → PKR 282,000
 └── Income    Deel              $3.84       "Exchange gain"
                                 note: "Received at USD/PKR 282.00; market 280.92"

 Deel −$1,000.00 · Personal +PKR 282,000 · Income +PKR 1,078.73
```

### Flow D: PKR → Foreign (Personal PKR → Deel USD)

Live rate: USD 280.92. Sent PKR 285,000, received $1,000.

```text
 transfer portion = 1,000 × 280.92 ÷ 1 = PKR 280,920
 difference       = 285,000 − 280,920   = PKR 4,080

 ├── Transfer  Personal → Deel   PKR 280,920 → $1,000
 └── Expense   Personal          PKR 4,080     "Exchange cost"
                                 note: "Received at USD/PKR 285.00; market 280.92"
```

### Flow E: Foreign → Foreign (Wise USD → Wise GBP)

Live rates: USD 280.92, GBP 356.40. Sent $500, received £390.

```text
 transfer portion = 390 × 356.40 ÷ 280.92 = $494.79
 difference       = 500 − 494.79          = $5.21

 ├── Transfer  Wise USD → Wise GBP   $494.79 → £390
 └── Expense   Wise USD              $5.21   "Exchange cost"
                                     note: "Received at GBP/USD 1.2821; market 1.2687"
```

GBP is the base, so the received rate is $500 ÷ £390 = 1.2821 and the market rate is 356.40 ÷ 280.92 = 1.2687.

### Form Preview

Before saving, the transfer form shows the same numbers the server will write:

```text
 Received at USD/PKR 279.00 · market 280.92 (updated 2 h ago)
 Exchange cost $6.83 (PKR 1,918.68) → expense on Deel
```

The preview calls the same `splitTransfer` function with the live rates the page loaded; the server recomputes with
the rates current at write time, so the saved figures are authoritative.

### Editing and Deletion

- **No link is stored.** Once added, the transfer and its cost, gain or fee entry are two ordinary entries.
- **Edit a transfer:** the amounts are saved as typed; nothing is split again and the other entry is untouched.
- **Delete a transfer:** only the transfer goes. Its cost, gain or fee entry can be edited or deleted on its own.

---

## Implementation Plan

### Phase 1: Database (one Drizzle migration)

- `finance.exchange_rates`: one row per currency, `currency text primary key` (three capital letters),
  `value numeric(18,2) not null` (> 0), `updated_at timestamptz not null`, `checked_at timestamptz not null`.
- `holdings.currency text not null default 'PKR'`, with check `currency ~ '^[A-Z]{3}$'`; backfill `remote_bank` to `USD`.
- `ledger_accounts.exchange_rate`: drop `not null` and the default; set to `null` on draft months.

### Phase 2: Rate Service

- `src/lib/exchange-rates.ts`: `getExchangeRates()` (hourly cache, fetch, round, upsert, fallback),
  `rateOf(rates, code)`, `supportedCurrencies()`, `quotePair(a, b)` (base/quote order and precision for notes and
  display).
- Attribution link on the rates line of the pages that show rates.
- `GET /api/exchange-rates` and the `exchange_rates_get` MCP tool.

### Phase 3: Currency Through the Stack

- Types: `Holding.currency`, `LedgerCurrency` as a validated string; remove `Holding.exchangeRate` from inputs.
- `src/lib/accounts.ts`: currency comes from the holding, not `SHAPES`.
- `src/lib/finance.ts` (`valuePkr`, `portfolioTotals`) and `src/lib/ledger.ts` (`toPkr`): take a rate table instead
  of reading per-row rates; finalized accounts and stamped entries keep using their stored rates.
- Ledger finalize: freeze live rates onto accounts. Reopen: clear them.
- Snapshot creation: stamp each holding with the rate used.
- UI: remove the exchange-rate inputs from the portfolio bank form, ledger account card and entry form; add a currency
  picker for remote banks; show read-only rates with their age.
- MCP: remove `exchangeRate` from `holdingFields`, `accountFields` and `ledgerEntryFields`; add `currency` to
  `portfolio_item_add` and `ledger_account_add`.

### Phase 4: Transfers

- `src/lib/ledger.ts`:
  - `splitTransfer({ sent, received, source, destination })` → `{ amount, difference? }`, the difference carrying
    its type, category and note.
- `src/lib/ledger-entries.ts`: adding a transfer goes through `splitTransfer` and writes both entries in one
  transaction; every other write saves the entry as given. The three categories are created on first use.

### Phase 5: Transfer UI

- Form: `Amount sent` / `Amount received`, received pre-filled for same currency, live preview line.
- Rows: cross-currency transfers show both sides, `$993.17 → PKR 279,000`.

### Phase 6: MCP

- `ledger_entry_add` / `ledger_entry_update` with `type: "transfer"`: `amount` = sent, `destinationAmount` =
  received, new `destinationAccountName`.
- Update `docs/mcp-documentation.md`.

### Phase 7: Existing Data

- Existing transfers stay as they are; their historical gaps remain unrecorded.
- Existing finalized months keep their typed rates as their frozen rates.
- Any backfill of historical fees is a separate one-off script, validated on a Neon branch first, never run straight
  against production.

---

## Test Plan

Unit tests mock `fetch`; nothing writes to the real database.

### Rates

- Provider success: rounding to 2 dp, currencies under 1 PKR dropped, row upserted.
- `checked_at` under an hour old: no provider call. Over an hour: one call.
- Failed attempt updates `checked_at`, so the next call waits an hour.
- Provider failure, timeout or malformed payload: stored row returned, `stale: true` once `updated_at` is over an hour
  old.
- No stored row and provider down: clear error.
- Unknown currency code rejected when adding a holding.

### Transfers

- Same currency: no difference; fee; received > sent rejected.
- Foreign → PKR loss and gain; PKR → foreign; foreign → foreign.
- Rounding: transfer portion + difference always equals sent exactly.
- Note text for each flow: base/quote order (PKR always quote, GBP before USD, unlisted alphabetical) and precision
  (2 dp vs PKR, 4 dp otherwise).
- Editing a transfer saves it as given; deleting one leaves its cost entry, which can be edited or deleted alone.
- Categories created once under concurrent requests.

### Valuation

- Draft month uses live rates; finalized month and snapshots use frozen rates.
- Finalize freezes; reopen unfreezes.

### UI and MCP

- Preview matches server output for the same rates.
- MCP add/update/get/remove behave like the HTTP API.

## Acceptance Criteria

- No exchange rate is typed anywhere in the UI or MCP.
- One rate table drives every live PKR conversion, and the site keeps working on the stored copy when the provider is
  unreachable.
- A source account moves by exactly the amount sent; a destination by exactly the amount received.
- Every cross-currency transfer with a difference is added with an `Exchange cost` or `Exchange gain` entry whose note
  states the received and market rates.
- Finalized months and snapshots do not change value when rates move.
- A new transfer and its cost or gain entry are never partially written.

## Decisions

1. **Rates freeze** on ledger finalize and on snapshot creation; reopening a month unfreezes it.
2. **No link between the transfer and its cost or gain entry.** Rates are used once, to split a new transfer; edits
   and deletes treat each entry on its own.
3. **Categories:** `Exchange cost` and `Exchange gain` for cross-currency differences; `Transfer fees` for a
   same-currency shortfall.
4. **Provider:** open.er-api.com, free and keyless, with the "Rates By Exchange Rate API" attribution link on the rates
   line of the pages that show rates.
5. **Refresh cadence:** the provider is called at most once an hour. Its data only changes once a day, so hourly is
   plenty.
6. **Notation:** standard FX `BASE/QUOTE` quoting (`USD/PKR 279.00`, `GBP/USD 1.2821`) everywhere a rate is shown
   or written.

import { isUuid } from '@/lib/db/ids';
import { DATE_PATTERN, eligibleAccounts, isHoldType, isMonth, monthBounds } from '@/lib/ledger';
import { isCurrencyCode, PKR } from '@/lib/fx';
import { HOLDING_LABELS } from '@/lib/finance';
import { HOLDING_KINDS, type HoldingInput, type HoldingKind } from '@/types/finance';
import { LEDGER_ENTRY_TYPES, type LedgerAccount, type LedgerEntry, type LedgerDraft } from '@/types/ledger';

// The first problem with one holding, named so the person can find the row: "Wise: enter a currency code".
// The portfolio editor and the holding tools share it.
export function holdingError(holding: Record<string, unknown>, seen = new Set<string>()) {
  const { id, kind, name, group, amount, currency } = holding;
  if (!(HOLDING_KINDS as readonly unknown[]).includes(kind)) return 'A holding has an unknown kind';
  const label = validName(name) ? name.trim() : '';
  if (!label) return `Every ${HOLDING_LABELS[kind as HoldingKind].toLowerCase()} needs a name`;
  if (id !== undefined && id !== null) {
    if (typeof id !== 'string' || !id.trim()) return `${label}: invalid id`;
    if (seen.has(id)) return `${label}: listed twice`;
    seen.add(id);
  }
  if (kind === 'mutual_fund' && !validName(group)) return `${label}: a fund needs its bank`;
  if (!validMoney(amount)) return `${label}: the amount must be a number, zero or more`;
  if (kind === 'remote_bank') {
    if (currency === PKR) return `${label}: a remote bank holds a foreign currency, not PKR`;
    if (!isCurrencyCode(currency)) return `${label}: enter a three-letter currency code, such as USD`;
  } else if (currency !== undefined && currency !== PKR) {
    return `${label}: only remote banks hold a foreign currency`;
  }
  return null;
}

export function parsePortfolio(value: unknown): HoldingInput[] | string {
  if (!isRecord(value) || !Array.isArray(value.holdings)) return 'Invalid portfolio data';
  const seen = new Set<string>();
  for (const holding of value.holdings) {
    const error = isRecord(holding) ? holdingError(holding, seen) : 'Invalid portfolio data';
    if (error) return error;
  }
  return (value.holdings as HoldingInput[]).map((holding) => ({
    ...(holding.id ? { id: holding.id } : {}),
    ...normalHolding(holding),
  }));
}

// A valid holding with the fields its kind does not use fixed: no bank outside funds, PKR outside remote banks.
export const normalHolding = ({ kind, name, group, currency, amount }: HoldingInput) => ({
  kind,
  name: name.trim(),
  group: kind === 'mutual_fund' ? group!.trim() : null,
  currency: kind === 'remote_bank' ? currency : PKR,
  amount,
});

export function parseSnapshotInput(value: unknown): HoldingInput[] | string {
  if (!isRecord(value)) return 'Invalid snapshot';
  return parsePortfolio(value.data);
}

export function validateLedger(body: LedgerDraft, categoryIds: ReadonlySet<string> = new Set()) {
  if (!body || !isMonth(body.month)) return 'Invalid month';
  if (!['draft', 'finalized'].includes(body.status)) return 'Invalid status';
  if (Number.isNaN(new Date(body.updatedAt).getTime())) return 'updatedAt is required: reload the month and try again';
  if (!Array.isArray(body.accounts) || !Array.isArray(body.entries)) {
    return 'Accounts and entries are required';
  }

  const ids = new Set(body.accounts.map((account) => account.id));
  if (ids.size !== body.accounts.length) return 'Account IDs must be unique';
  const links = body.accounts.flatMap((account) => (account.holdingId === undefined ? [] : [account.holdingId]));
  if (links.some((id) => typeof id !== 'string' || !isUuid(id))) return 'Invalid portfolio link';
  if (new Set(links).size !== links.length) return 'Each portfolio holding can have only one account';

  for (const account of body.accounts) {
    if (!account.id || !validName(account.name)) {
      return 'Every account needs a name';
    }
    if (!['bank', 'fund'].includes(account.type)) return 'Invalid account type';
    if (!isCurrencyCode(account.currency) || (account.type === 'fund' && account.currency !== PKR)) {
      return 'Invalid currency';
    }
    if (!validMoney(account.openingBalance)) return 'Account balances must be valid';
    if (account.type === 'fund' && account.openingCostBasis !== undefined && !validMoney(account.openingCostBasis)) {
      return 'Fund cost basis must be valid';
    }
    if (account.actualClosingBalance !== undefined && !validMoney(account.actualClosingBalance)) {
      return 'Actual closing balances must be valid';
    }
  }

  if (body.status === 'finalized' && body.accounts.some((account) => account.actualClosingBalance === undefined)) {
    return 'Enter an actual closing balance for every account before finalizing';
  }

  const bounds = monthBounds(body.month);
  const entryIds = new Set(body.entries.map((entry) => entry.id));
  if (entryIds.size !== body.entries.length) return 'Entry IDs must be unique';

  for (const entry of body.entries as LedgerEntry[]) {
    const error = validateLedgerEntry(entry, body.accounts, bounds, categoryIds);
    if (error) return error;

    if (entry.type === 'transfer' && entry.destinationAccountId) {
      const source = body.accounts.find((account) => account.id === entry.accountId);
      const destination = body.accounts.find((account) => account.id === entry.destinationAccountId);
      if (source?.currency !== destination?.currency && entry.destinationAmount === undefined) {
        return 'Cross-currency transfers need a destination amount';
      }
    }
  }

  return null;
}

function validName(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function validMoney(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

export function validPositiveNumber(value: unknown): value is number {
  return validMoney(value) && value > 0;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validateLedgerEntry(
  entry: LedgerEntry,
  accounts: LedgerAccount[],
  bounds: { min: string; max: string },
  categoryIds: ReadonlySet<string>
) {
  const accountIds = new Set(accounts.map((account) => account.id));
  if (!(LEDGER_ENTRY_TYPES as readonly string[]).includes(entry.type)) {
    return 'Invalid entry type';
  }
  if (!entry.id || !DATE_PATTERN.test(entry.date) || entry.date < bounds.min || entry.date > bounds.max) {
    return 'Every entry must have a valid date in this month';
  }
  if (!accountIds.has(entry.accountId) || !validPositiveNumber(entry.amount)) {
    return 'Every entry needs a valid account and positive amount';
  }
  if (
    entry.type === 'transfer' &&
    (!entry.destinationAccountId ||
      !accountIds.has(entry.destinationAccountId) ||
      entry.destinationAccountId === entry.accountId)
  ) {
    return 'Transfers need two different valid accounts';
  }
  if (isHoldType(entry.type) && !eligibleAccounts(accounts, entry.type).some((item) => item.id === entry.accountId)) {
    return 'Held funds must sit in a bank account';
  }
  if (entry.counterparty !== undefined && !validName(entry.counterparty)) {
    return 'Counterparty must be a name';
  }
  if (entry.categoryId !== undefined && !categoryIds.has(entry.categoryId)) {
    return 'Unknown category';
  }
  if (entry.destinationAmount !== undefined && !validPositiveNumber(entry.destinationAmount)) {
    return 'Destination amount must be positive';
  }
  return null;
}

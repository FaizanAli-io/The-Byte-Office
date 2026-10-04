import { z } from 'zod/v4';
import { isUuid } from '@/lib/db/ids';
import { eligibleAccounts, isHoldType, isMonth, monthBounds } from '@/lib/ledger';
import { HOLDING_KINDS, type Holding } from '@/types/finance';
import {
  CATEGORY_KINDS,
  LEDGER_ENTRY_TYPES,
  type LedgerAccount,
  type LedgerEntry,
  type LedgerDraft,
} from '@/types/ledger';

const categoryName = z.string().trim().min(1, 'A category needs a name').max(60, 'Category name is too long');
const categoryKind = z.enum(CATEGORY_KINDS);

export const categoryInputSchema = z.object({
  name: categoryName,
  kind: categoryKind.default('both'),
});

export const categoryUpdateSchema = z.object({
  id: z.string().min(1, 'id is required'),
  name: categoryName.optional(),
  kind: categoryKind.optional(),
  sortOrder: z.int().nonnegative().optional(),
  archived: z.boolean().optional(),
});

export function parsePortfolio(value: unknown): Holding[] | null {
  if (!isRecord(value) || !Array.isArray(value.holdings)) return null;
  const ids = new Set<string>();
  const valid = value.holdings.every(
    (holding) =>
      isRecord(holding) &&
      validHoldingId(holding.id, ids) &&
      (HOLDING_KINDS as readonly unknown[]).includes(holding.kind) &&
      validName(holding.name) &&
      (holding.kind !== 'mutual_fund' || validName(holding.group)) &&
      validMoney(holding.amount) &&
      (holding.kind !== 'remote_bank' || validPositiveNumber(holding.exchangeRate))
  );
  if (!valid) return null;
  return (value.holdings as Holding[]).map((holding) => ({
    ...(holding.id ? { id: holding.id } : {}),
    kind: holding.kind,
    name: holding.name.trim(),
    group: holding.kind === 'mutual_fund' ? holding.group!.trim() : null,
    amount: holding.amount,
    exchangeRate: holding.kind === 'remote_bank' ? holding.exchangeRate : 1,
  }));
}

function validHoldingId(value: unknown, seen: Set<string>) {
  if (value === undefined || value === null) return true;
  if (typeof value !== 'string' || !value.trim() || seen.has(value)) return false;
  seen.add(value);
  return true;
}

export function validateSnapshotInput(value: unknown) {
  if (!isRecord(value)) return 'Invalid snapshot';
  if (!parsePortfolio(value.data)) return 'Invalid portfolio data';
  if (!validMoney(value.grandTotal)) return 'Invalid portfolio total';
  return null;
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
    if (!['PKR', 'USD'].includes(account.currency)) return 'Invalid currency';
    if (
      !validMoney(account.openingBalance) ||
      !validMoney(account.exchangeRate) ||
      (account.currency === 'USD' && account.exchangeRate === 0)
    ) {
      return 'Account balances and exchange rates must be valid';
    }
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

export function validName(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function validMoney(value: unknown): value is number {
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
  if (!entry.id || !/^\d{4}-\d{2}-\d{2}$/.test(entry.date) || entry.date < bounds.min || entry.date > bounds.max) {
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
  if (entry.exchangeRate !== undefined && !validPositiveNumber(entry.exchangeRate)) {
    return 'Entry exchange rate must be positive';
  }
  return null;
}

import { ApiError } from '@/lib/api';
import { fingerprint } from '@/lib/agent/action-utils';
import { entryTypeSchema } from '@/lib/agent/fields';
import { isRecord, validPositiveNumber, validateLedger } from '@/lib/finance-validation';
import { eligibleAccounts, monthBounds } from '@/lib/ledger';
import type { HoldingKind } from '@/types/finance';
import type { LedgerAccount, LedgerCategory, LedgerEntry, MonthlyLedger } from '@/types/ledger';
import type { AgentActionPayload, LedgerEntryFormState, HoldingInput } from '@/lib/agent/types';

export const serialFor = (index: number) => String(index + 1).padStart(4, '0');

export function resolveEntryId(ledger: MonthlyLedger, args: Record<string, unknown>) {
  if (args.entrySerial !== undefined && args.entryId !== undefined) {
    throw new ApiError('Specify entrySerial or entryId, not both');
  }
  if (args.entrySerial !== undefined) {
    const entry = ledger.entries[Number(args.entrySerial) - 1];
    if (!entry) throw new ApiError('Ledger entry serial not found', 404);
    return entry.id;
  }
  if (args.entryId === undefined) throw new ApiError('entrySerial or entryId is required');
  return args.entryId as string;
}

export function definedFields<K extends string>(args: Record<string, unknown>, keys: readonly K[]) {
  return Object.fromEntries(keys.filter((key) => args[key] !== undefined).map((key) => [key, args[key]])) as Partial<
    Record<K, unknown>
  >;
}

export function resolveAccountId(accounts: LedgerAccount[], accountName: unknown) {
  if (typeof accountName !== 'string' || !accountName.trim()) return undefined;
  const requested = accountName.trim().toLowerCase();
  const matches = accounts.filter((account) => {
    const name = account.name.toLowerCase();
    if (name.includes(requested) || requested.includes(name)) return true;
    const initials = name
      .split(/[^a-z0-9]+/)
      .filter(Boolean)
      .map((word) => word[0])
      .join('');
    return initials.includes(requested);
  });
  return matches.length === 1 ? matches[0].id : undefined;
}

export function assertLedger(next: MonthlyLedger, categoryIds: ReadonlySet<string>) {
  const error = validateLedger(next, categoryIds);
  if (error) throw new ApiError(error);
}

export function ledgerFingerprint(ledger: MonthlyLedger) {
  return fingerprint({
    updatedAt: new Date(ledger.updatedAt).toISOString(),
    entries: ledger.entries,
  });
}

export function ledgerStructureFingerprint(ledger: MonthlyLedger) {
  return fingerprint({
    month: ledger.month,
    status: ledger.status,
    accounts: ledger.accounts.map(({ id, type, currency, exchangeRate }) => ({
      id,
      type,
      currency,
      exchangeRate,
    })),
  });
}

export const holdingLabel = (kind: HoldingKind) => kind.replace('_', ' ');

// Field types and ranges are checked by the tool schema; only the rules between fields live here.
export function parseHolding(args: Record<string, unknown>, current?: HoldingInput): HoldingInput {
  const merged = { ...current, ...args } as Partial<HoldingInput>;
  const kind = current?.kind ?? merged.kind!;
  if (kind === 'mutual_fund' && !merged.group) throw new ApiError('group is required for a mutual fund');
  if (kind === 'remote_bank' && !merged.exchangeRate) {
    throw new ApiError('exchangeRate is required for a remote bank');
  }
  return {
    kind,
    name: merged.name!,
    group: kind === 'mutual_fund' ? merged.group! : null,
    amount: merged.amount!,
    exchangeRate: kind === 'remote_bank' ? merged.exchangeRate! : 1,
  };
}

export function parseLedgerEntry(args: Record<string, unknown>, base: Partial<LedgerEntry>): LedgerEntry {
  const carriedString = (key: 'destinationAccountId' | 'categoryId' | 'counterparty' | 'note') =>
    args[key] === null ? undefined : args[key] === undefined ? base[key] : requireString(args[key], key);
  const carriedNumber = (key: 'destinationAmount' | 'exchangeRate') =>
    args[key] === null ? undefined : args[key] === undefined ? base[key] : requirePositive(args[key], key);

  return {
    id: requireString(args.id ?? base.id, 'id'),
    date: requireString(args.date ?? base.date, 'date'),
    type: requireEntryType(args.type ?? base.type),
    accountId: requireString(args.accountId ?? base.accountId, 'accountId'),
    destinationAccountId: carriedString('destinationAccountId'),
    amount: requirePositive(args.amount ?? base.amount, 'amount'),
    destinationAmount: carriedNumber('destinationAmount'),
    exchangeRate: carriedNumber('exchangeRate'),
    categoryId: carriedString('categoryId'),
    counterparty: carriedString('counterparty'),
    note: carriedString('note'),
  };
}

function requireEntryType(value: unknown) {
  if (!isEntryType(value)) throw new ApiError('Invalid ledger entry type');
  return value;
}

export function requireString(value: unknown, key: string) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new ApiError(`${key} is required`);
  }
  return value.trim();
}

function requirePositive(value: unknown, key: string) {
  if (!validPositiveNumber(value)) {
    throw new ApiError(`${key} must be a positive number`);
  }
  return value;
}

export function applyEntryOverride(payload: AgentActionPayload, override: unknown): AgentActionPayload {
  if (
    !isRecord(override) ||
    (payload.actionType !== 'ledger_entry_add' && payload.actionType !== 'ledger_entry_update')
  ) {
    return payload;
  }
  return { ...payload, entry: { ...payload.entry, ...override, id: payload.entry.id } } as AgentActionPayload;
}

export function ledgerForm(
  kind: LedgerEntryFormState['kind'],
  month: string,
  accounts: LedgerAccount[],
  categoriesList: LedgerCategory[],
  entry: LedgerEntryFormState['entry']
): LedgerEntryFormState {
  return {
    kind,
    month,
    accounts: accounts.map(({ id, name, currency, type, exchangeRate }) => ({
      id,
      name,
      currency,
      type,
      exchangeRate,
    })),
    categories: categoriesList,
    entry,
  };
}

export function defaultEntryDate(month: string, requested?: string) {
  const bounds = monthBounds(month);
  if (requested && requested >= bounds.min && requested <= bounds.max) {
    return requested;
  }
  const today = new Date().toISOString().slice(0, 10);
  if (today >= bounds.min && today <= bounds.max) return today;
  return bounds.min;
}

export function isEntryType(value: unknown): value is LedgerEntry['type'] {
  return entryTypeSchema.safeParse(value).success;
}

export function firstAccountId(accounts: Pick<LedgerAccount, 'id' | 'type'>[], type: LedgerEntry['type']) {
  return eligibleAccounts(accounts, type)[0]?.id ?? accounts[0]?.id ?? '';
}

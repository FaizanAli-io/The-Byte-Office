import { AgentActionError } from '@/lib/agent/action-utils';
import { entryTypeSchema, itemTypeSchema } from '@/lib/agent/registry';
import { isRecord, validMoney, validName, validPositiveNumber, validateLedger } from '@/lib/finance-validation';
import { eligibleAccounts, monthBounds } from '@/lib/ledger';
import type { LedgerAccount, LedgerCategory, LedgerEntry, MonthlyLedger } from '@/types/ledger';
import { fingerprint } from '@/lib/agent/repository';
import type {
  AgentActionPayload,
  LedgerEntryFormState,
  PortfolioItemInput,
  PortfolioItemType,
} from '@/lib/agent/types';

/**
 * Pure helpers behind `actions.ts`: argument parsing, the ledger and portfolio
 * fingerprints used for staleness checks, and the defaults applied when the
 * assistant leaves a field out. Nothing here touches the database.
 */

export function resolveEntryId(ledger: MonthlyLedger, args: Record<string, unknown>) {
  const hasSerial = args.entrySerial !== undefined;
  const hasId = args.entryId !== undefined;
  if (hasSerial && hasId) {
    throw new AgentActionError('Specify entrySerial or entryId, not both');
  }
  if (hasSerial) {
    const serial = requireString(args.entrySerial, 'entrySerial');
    if (!/^\d+$/.test(serial)) {
      throw new AgentActionError('entrySerial must contain only digits');
    }
    const index = Number(serial) - 1;
    const entry = ledger.entries[index];
    if (!Number.isSafeInteger(index) || index < 0 || !entry) {
      throw new AgentActionError('Ledger entry serial not found', 404);
    }
    return entry.id;
  }
  return requireString(args.entryId, 'entrySerial or entryId');
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

export function optionalAccountId(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export function optionalPositive(value: unknown) {
  return validPositiveNumber(value) ? value : undefined;
}

export function optionalString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export function assertLedgerWithEntries(
  ledger: MonthlyLedger,
  entries: LedgerEntry[],
  categoryIds: ReadonlySet<string>
) {
  const error = validateLedger({ ...ledger, entries }, categoryIds);
  if (error) throw new AgentActionError(error);
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

export function assertLedgerStructure(ledger: MonthlyLedger, sourceFingerprint: string | null) {
  if (ledgerStructureFingerprint(ledger) !== sourceFingerprint) {
    throw new AgentActionError('The ledger accounts changed after this proposal. Ask the assistant to try again.', 409);
  }
}

/**
 * One field spec per holding type serves both the create and the update path:
 * an update simply falls back to the stored row for anything the caller left
 * out, so the two used to be the same list written twice.
 */
const HOLDING_FIELDS = {
  local_bank: { name: requireName, amountPkr: requireMoney },
  remote_bank: { name: requireName, amountUsd: requireMoney, exchangeRate: requirePositive },
  mutual_fund: { bankName: requireName, fundName: requireName, value: requireMoney },
} as const;

function parseHolding(
  itemType: PortfolioItemType,
  args: Record<string, unknown>,
  current: Record<string, unknown> = {}
) {
  const fields: Record<string, (value: unknown, key: string) => string | number> = HOLDING_FIELDS[itemType];
  return Object.fromEntries(Object.entries(fields).map(([key, check]) => [key, check(args[key] ?? current[key], key)]));
}

export function parsePortfolioItem(args: Record<string, unknown>): PortfolioItemInput {
  const itemType = parseItemType(args.itemType);
  return { itemType, ...parseHolding(itemType, args) } as PortfolioItemInput;
}

export function parsePortfolioUpdate(
  itemType: PortfolioItemType,
  args: Record<string, unknown>,
  current: Record<string, unknown>
) {
  return parseHolding(itemType, args, current);
}

export function parseLedgerEntry(args: Record<string, unknown>, base: Partial<LedgerEntry>): LedgerEntry {
  // Named apart from the exported `optionalString`, which takes a value
  // rather than a key and means something different.
  const carriedString = (key: 'categoryId' | 'counterparty' | 'note') =>
    args[key] === null ? undefined : args[key] === undefined ? base[key] : requireString(args[key], key);
  const carriedNumber = (key: 'destinationAmount' | 'exchangeRate') =>
    args[key] === null ? undefined : args[key] === undefined ? base[key] : requirePositive(args[key], key);
  const destinationAccountId =
    args.destinationAccountId === null
      ? undefined
      : args.destinationAccountId === undefined
        ? base.destinationAccountId
        : requireString(args.destinationAccountId, 'destinationAccountId');

  return {
    id: requireString(args.id ?? base.id, 'id'),
    date: requireString(args.date ?? base.date, 'date'),
    type: requireEntryType(args.type ?? base.type),
    accountId: requireString(args.accountId ?? base.accountId, 'accountId'),
    destinationAccountId,
    amount: requirePositive(args.amount ?? base.amount, 'amount'),
    destinationAmount: carriedNumber('destinationAmount'),
    exchangeRate: carriedNumber('exchangeRate'),
    categoryId: carriedString('categoryId'),
    counterparty: carriedString('counterparty'),
    note: carriedString('note'),
  };
}

export function parseItemType(value: unknown): PortfolioItemType {
  const parsed = itemTypeSchema.safeParse(value);
  if (!parsed.success) throw new AgentActionError('Invalid itemType');
  return parsed.data;
}

function requireEntryType(value: unknown): LedgerEntry['type'] {
  const parsed = entryTypeSchema.safeParse(value);
  if (!parsed.success) throw new AgentActionError('Invalid ledger entry type');
  return parsed.data;
}

export function requireRecord(value: unknown) {
  if (!isRecord(value)) throw new AgentActionError('Invalid tool arguments');
  return value;
}

export function requireString(value: unknown, key: string) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new AgentActionError(`${key} is required`);
  }
  return value.trim();
}

function requireName(value: unknown, key: string) {
  if (!validName(value)) throw new AgentActionError(`${key} is required`);
  return value.trim();
}

function requireMoney(value: unknown, key: string) {
  if (!validMoney(value)) {
    throw new AgentActionError(`${key} must be a non-negative number`);
  }
  return value;
}

function requirePositive(value: unknown, key: string) {
  if (!validPositiveNumber(value)) {
    throw new AgentActionError(`${key} must be a positive number`);
  }
  return value;
}

export function portfolioLabel(type: PortfolioItemType) {
  return type.replace('_', ' ');
}

export function applyEntryOverride(payload: AgentActionPayload, override: unknown): AgentActionPayload {
  if (
    !isRecord(override) ||
    (payload.actionType !== 'ledger_entry_add' && payload.actionType !== 'ledger_entry_update')
  ) {
    return payload;
  }
  if (payload.actionType === 'ledger_entry_add') {
    return {
      ...payload,
      entry: {
        ...payload.entry,
        ...override,
        id: payload.entry.id,
      },
    };
  }
  return {
    ...payload,
    entry: {
      ...payload.entry,
      ...override,
      id: payload.entryId,
    },
  };
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

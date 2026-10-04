import { randomUUID } from 'crypto';
import { AgentActionError } from '@/lib/agent/action-utils';
import type { ActionPreview, AgentActionPayload, AgentActionType, LedgerAccountChanges } from '@/lib/agent/types';
import { accountStats, entryUsesAccount } from '@/lib/ledger';
import type { LedgerAccount, MonthlyLedger } from '@/types/ledger';
import { requireString, resolveAccountId } from './action-parsing';

type AccountActionType = 'ledger_account_add' | 'ledger_account_update' | 'ledger_account_remove';
export type AccountPayload = Extract<AgentActionPayload, { actionType: AccountActionType }>;

const CHANGE_KEYS = ['name', 'openingBalance', 'exchangeRate', 'actualClosingBalance', 'openingCostBasis'] as const;

export function isAccountAction(actionType: AgentActionType): actionType is AccountActionType {
  return actionType.startsWith('ledger_account_');
}

export function accountBalances(ledger: MonthlyLedger) {
  return ledger.accounts.map((account) => {
    const stats = accountStats(account, ledger.entries);
    return {
      ...account,
      expectedClosingBalance: stats.expected,
      difference: stats.difference,
      ...(account.type === 'fund' ? { netInvested: stats.netInvested, gainLoss: stats.gainLoss } : {}),
    };
  });
}

export function planAccountAction(
  actionType: AccountActionType,
  args: Record<string, unknown>,
  ledger: MonthlyLedger
): { payload: AccountPayload; preview: ActionPreview } {
  const month = ledger.month;

  if (actionType === 'ledger_account_add') {
    const currency = args.currency === 'USD' ? 'USD' : 'PKR';
    if (currency === 'USD' && args.exchangeRate === undefined) {
      throw new AgentActionError('exchangeRate is required for a USD account');
    }
    const account = {
      id: randomUUID(),
      name: requireString(args.name, 'name'),
      type: args.type === 'fund' ? 'fund' : 'bank',
      currency,
      openingBalance: args.openingBalance ?? 0,
      exchangeRate: currency === 'PKR' ? 1 : args.exchangeRate,
      ...(args.openingCostBasis == null ? {} : { openingCostBasis: args.openingCostBasis }),
      ...(args.actualClosingBalance == null ? {} : { actualClosingBalance: args.actualClosingBalance }),
    } as LedgerAccount;
    return {
      payload: { actionType, month, account },
      preview: { title: `Add account "${account.name}"`, after: account },
    };
  }

  const account = findAccount(ledger, args);
  if (actionType === 'ledger_account_remove') {
    return {
      payload: { actionType, month, accountId: account.id },
      preview: { title: `Remove account "${account.name}"`, before: account },
    };
  }

  const changes: LedgerAccountChanges = Object.fromEntries(
    CHANGE_KEYS.filter((key) => args[key] !== undefined).map((key) => [key, args[key]])
  );
  if (account.currency === 'PKR' && changes.exchangeRate !== undefined) {
    throw new AgentActionError('PKR accounts have no exchange rate');
  }
  if (!Object.keys(changes).length) {
    throw new AgentActionError(`Nothing to change: pass one of ${CHANGE_KEYS.join(', ')}`);
  }
  return {
    payload: { actionType, month, accountId: account.id, changes },
    preview: { title: `Update account "${account.name}"`, before: account, after: withChanges(account, changes) },
  };
}

export function applyAccountAction(payload: AccountPayload, ledger: MonthlyLedger): LedgerAccount[] {
  const { accounts } = ledger;
  if (payload.actionType === 'ledger_account_add') {
    if (accounts.some((account) => account.id === payload.account.id)) {
      throw new AgentActionError('This account was already added.', 409);
    }
    return [...accounts, payload.account];
  }

  if (!accounts.some((account) => account.id === payload.accountId)) {
    throw new AgentActionError('Ledger account no longer exists', 409);
  }
  if (payload.actionType === 'ledger_account_remove') {
    if (ledger.entries.some((entry) => entryUsesAccount(entry, payload.accountId))) {
      throw new AgentActionError('Delete entries for this account before removing it.', 409);
    }
    return accounts.filter((account) => account.id !== payload.accountId);
  }
  return accounts.map((account) =>
    account.id === payload.accountId ? withChanges(account, payload.changes) : account
  );
}

function withChanges(account: LedgerAccount, changes: LedgerAccountChanges): LedgerAccount {
  const next: Record<string, unknown> = { ...account, ...changes };
  for (const key of CHANGE_KEYS) if (next[key] === null) delete next[key];
  return next as unknown as LedgerAccount;
}

function findAccount(ledger: MonthlyLedger, args: Record<string, unknown>) {
  const id = typeof args.accountId === 'string' ? args.accountId : resolveAccountId(ledger.accounts, args.accountName);
  const account = ledger.accounts.find((item) => item.id === id);
  if (!account) {
    throw new AgentActionError(
      'Account not found. Call ledger_accounts_list for ids, or use a name that matches one account.',
      404
    );
  }
  return account;
}

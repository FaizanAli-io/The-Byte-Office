import { randomUUID } from 'crypto';
import { accountStats, isMonth } from '@/lib/ledger';
import { validateLedger } from '@/lib/finance-validation';
import {
  createLedger,
  listCategories,
  loadFinanceDoc,
  loadLedger,
  loadPreviousFinalizedLedger,
  listLedgerSummaries,
  saveLedger,
} from '@/lib/db/queries';
import { ApiError, apiRoute, created, found, jsonBody, searchParam } from '@/lib/api';
import type { FinanceDoc } from '@/types/finance';
import type { LedgerAccount, MonthlyLedger, MonthlyLedgerPayload } from '@/types/ledger';

export const GET = apiRoute('GET /api/ledger', 'Failed to load ledger', async (req: Request) => {
  const month = searchParam(req, 'month');
  if (!month) return listLedgerSummaries();
  if (!isMonth(month)) throw new ApiError('Invalid month');
  return found(await loadLedger(month), 'Ledger not found');
});

export const POST = apiRoute('POST /api/ledger', 'Failed to create ledger', async (req: Request) => {
  const { month, importFinance = false } = await jsonBody<{ month?: string; importFinance?: boolean }>(req);
  if (!month || !isMonth(month)) throw new ApiError('Invalid month');

  const existing = await loadLedger(month);
  if (existing) return existing;

  let accounts: LedgerAccount[] = [];
  if (importFinance) {
    accounts = accountsFromFinance(await loadFinanceDoc());
  } else {
    const previous = await loadPreviousFinalizedLedger(month);
    if (previous) accounts = carryAccounts(previous);
  }

  return created(await createLedger({ month, accounts }));
});

export const PUT = apiRoute('PUT /api/ledger', 'Failed to save ledger', async (req: Request) => {
  const body = await jsonBody<MonthlyLedgerPayload>(req);
  const categoryIds = new Set((await listCategories()).map((category) => category.id));
  const validationError = validateLedger(body, categoryIds);
  if (validationError) throw new ApiError(validationError);

  const existing = found(await loadLedger(body.month), 'Ledger not found');
  if (existing.status === 'finalized' && body.status === 'finalized') {
    throw new ApiError('Reopen this month before editing it', 409);
  }
  return saveLedger(existing, body);
});

function accountsFromFinance(finance: FinanceDoc): LedgerAccount[] {
  const local: LedgerAccount[] = finance.localBanks.map((bank) => ({
    id: randomUUID(),
    name: bank.name || 'Local bank',
    type: 'bank',
    currency: 'PKR',
    openingBalance: bank.amountPkr,
    exchangeRate: 1,
  }));
  const remote: LedgerAccount[] = finance.remoteBanks.map((bank) => ({
    id: randomUUID(),
    name: bank.name || 'Remote bank',
    type: 'bank',
    currency: 'USD',
    openingBalance: bank.amountUsd,
    exchangeRate: bank.exchangeRate,
  }));
  const funds: LedgerAccount[] = finance.mutualFunds.flatMap((group) => {
    const bank = Object.keys(group)[0];
    return (group[bank] ?? []).map((fund) => ({
      id: randomUUID(),
      name: `${bank} · ${fund.fund || 'Fund'}`,
      type: 'fund' as const,
      currency: 'PKR' as const,
      openingBalance: fund.value,
      openingCostBasis: fund.value,
      exchangeRate: 1,
    }));
  });
  return [...local, ...remote, ...funds];
}

function carryAccounts(ledger: MonthlyLedger): LedgerAccount[] {
  return ledger.accounts.map((account) => ({
    ...account,
    openingBalance: account.actualClosingBalance ?? account.openingBalance,
    openingCostBasis: account.type === 'fund' ? accountStats(account, ledger.entries).netInvested : undefined,
    actualClosingBalance: undefined,
  }));
}

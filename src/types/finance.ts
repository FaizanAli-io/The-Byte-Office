/**
 * `id` is the Postgres row UUID. It is present on everything loaded from the
 * database and absent on rows the editor has just created. `saveFinanceDoc`
 * uses it to update in place instead of replacing the row, which is what keeps
 * the IDs the finance agent proposes actions against stable across saves.
 */
export interface FinanceFund {
  id?: string;
  fund: string;
  value: number;
}

export interface FinanceRemoteBank {
  id?: string;
  name: string;
  amountUsd: number;
  exchangeRate: number;
}

export interface FinanceLocalBank {
  id?: string;
  name: string;
  amountPkr: number;
}

export interface FinanceDoc {
  _id?: string;
  name: string;
  mutualFunds: {
    [bank: string]: FinanceFund[];
  }[];
  remoteBanks: FinanceRemoteBank[];
  localBanks: FinanceLocalBank[];
}

export interface FinanceSnapshot {
  _id?: string;
  timestamp: Date;
  data: Omit<FinanceDoc, '_id'>;
  grandTotal: number;
}

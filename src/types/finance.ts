export interface FinanceDoc {
  _id?: string;
  name: string;
  mutualFunds: {
    [bank: string]: {
      fund: string;
      value: number;
    }[];
  }[];
  remoteBanks: {
    name: string;
    amountUsd: number;
    exchangeRate: number;
  }[];
  localBanks: {
    name: string;
    amountPkr: number;
  }[];
}

export interface FinanceSnapshot {
  _id?: string;
  timestamp: Date;
  data: Omit<FinanceDoc, "_id">;
  grandTotal: number;
}

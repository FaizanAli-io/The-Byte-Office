import { ObjectId } from "mongodb";

export interface FinanceDoc {
  _id?: ObjectId;
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

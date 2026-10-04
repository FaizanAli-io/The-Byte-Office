export const HOLDING_KINDS = ['local_bank', 'remote_bank', 'mutual_fund'] as const;
export type HoldingKind = (typeof HOLDING_KINDS)[number];

export interface Holding {
  id?: string;
  kind: HoldingKind;
  name: string;
  group: string | null;
  amount: number;
  exchangeRate: number;
}

export type SnapshotHolding = Omit<Holding, 'id'>;

export interface FinanceSnapshot {
  _id?: string;
  timestamp: Date;
  data: { holdings: SnapshotHolding[] };
  grandTotal: number;
}

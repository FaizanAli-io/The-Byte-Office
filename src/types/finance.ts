export const HOLDING_KINDS = ['local_bank', 'remote_bank', 'mutual_fund'] as const;
export type HoldingKind = (typeof HOLDING_KINDS)[number];

export interface Holding {
  id?: string;
  kind: HoldingKind;
  name: string;
  group: string | null;
  // ISO 4217 code: PKR except for remote banks. Fixed once the holding exists.
  currency: string;
  amount: number;
  // PKR per unit, read-only: the live rate, or the rate frozen into a snapshot.
  exchangeRate: number;
}

export type HoldingInput = Omit<Holding, 'id' | 'exchangeRate'> & { id?: string };

// Snapshots taken before currencies existed carry no currency; their remote banks are USD.
export type SnapshotHolding = Omit<Holding, 'id' | 'currency'> & { currency?: string };

export interface FinanceSnapshot {
  id: string;
  timestamp: Date;
  data: { holdings: SnapshotHolding[] };
  grandTotal: number;
}

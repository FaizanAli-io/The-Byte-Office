import { FinanceDoc } from "@/types/finance";

type ElementOf<T> = T extends (infer U)[] ? U : never;

export type SectionMap = {
  mutualFunds: ElementOf<FinanceDoc["mutualFunds"]>;
  remoteBanks: ElementOf<FinanceDoc["remoteBanks"]>;
  localBanks: ElementOf<FinanceDoc["localBanks"]>;
};

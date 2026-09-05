import { randomUUID } from "crypto";
import { accountStats, isMonth } from "@/lib/ledger";
import { validateLedger } from "@/lib/finance-validation";
import {
  createLedger,
  loadFinanceDoc,
  loadLedger,
  loadPreviousFinalizedLedger,
  listLedgerSummaries,
  saveLedger,
} from "@/lib/db/queries";
import type { FinanceDoc } from "@/types/finance";
import type {
  LedgerAccount,
  MonthlyLedger,
  MonthlyLedgerPayload,
} from "@/types/ledger";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    const month = new URL(req.url).searchParams.get("month");

    if (!month) {
      return NextResponse.json(await listLedgerSummaries());
    }

    if (!isMonth(month)) return error("Invalid month", 400);
    const ledger = await loadLedger(month);
    return ledger ? NextResponse.json(ledger) : error("Ledger not found", 404);
  } catch (cause) {
    console.error("GET /api/ledger error:", cause);
    return error("Failed to load ledger", 500);
  }
}

export async function POST(req: Request) {
  try {
    const { month, importFinance = false } = (await req.json()) as {
      month?: string;
      importFinance?: boolean;
    };
    if (!month || !isMonth(month)) return error("Invalid month", 400);

    const existing = await loadLedger(month);
    if (existing) return NextResponse.json(existing);

    let accounts: LedgerAccount[] = [];
    if (importFinance) {
      accounts = accountsFromFinance(await loadFinanceDoc());
    } else {
      const previous = await loadPreviousFinalizedLedger(month);
      if (previous) accounts = carryAccounts(previous);
    }

    const ledger = await createLedger({ month, accounts });
    return NextResponse.json(ledger, { status: 201 });
  } catch (cause) {
    console.error("POST /api/ledger error:", cause);
    return error("Failed to create ledger", 500);
  }
}

export async function PUT(req: Request) {
  try {
    const body = (await req.json()) as MonthlyLedgerPayload;
    const validationError = validateLedger(body);
    if (validationError) return error(validationError, 400);

    const existing = await loadLedger(body.month);
    if (!existing) return error("Ledger not found", 404);
    if (existing.status === "finalized" && body.status === "finalized") {
      return error("Reopen this month before editing it", 409);
    }

    return NextResponse.json(await saveLedger(existing, body));
  } catch (cause) {
    console.error("PUT /api/ledger error:", cause);
    return error("Failed to save ledger", 500);
  }
}

function accountsFromFinance(finance: FinanceDoc): LedgerAccount[] {
  const local: LedgerAccount[] = finance.localBanks.map((bank) => ({
    id: randomUUID(),
    name: bank.name || "Local bank",
    type: "bank",
    currency: "PKR",
    openingBalance: bank.amountPkr,
    exchangeRate: 1,
  }));
  const remote: LedgerAccount[] = finance.remoteBanks.map((bank) => ({
    id: randomUUID(),
    name: bank.name || "Remote bank",
    type: "bank",
    currency: "USD",
    openingBalance: bank.amountUsd,
    exchangeRate: bank.exchangeRate,
  }));
  const funds: LedgerAccount[] = finance.mutualFunds.flatMap((group) => {
    const bank = Object.keys(group)[0];
    return (group[bank] ?? []).map((fund) => ({
      id: randomUUID(),
      name: `${bank} · ${fund.fund || "Fund"}`,
      type: "fund" as const,
      currency: "PKR" as const,
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
    openingCostBasis:
      account.type === "fund"
        ? accountStats(account, ledger.entries).netInvested
        : undefined,
    actualClosingBalance: undefined,
  }));
}

function error(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

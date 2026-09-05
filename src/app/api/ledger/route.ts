import { randomUUID } from "crypto";
import { accountStats, isMonth, monthBounds } from "@/lib/ledger";
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
  LedgerEntry,
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

function validateLedger(body: MonthlyLedgerPayload) {
  if (!body || !isMonth(body.month)) return "Invalid month";
  if (!["draft", "finalized"].includes(body.status)) return "Invalid status";
  if (!Array.isArray(body.accounts) || !Array.isArray(body.entries)) {
    return "Accounts and entries are required";
  }
  const ids = new Set(body.accounts.map((account) => account.id));
  if (ids.size !== body.accounts.length) return "Account IDs must be unique";
  for (const account of body.accounts) {
    if (!account.id || !account.name.trim())
      return "Every account needs a name";
    if (!["bank", "fund"].includes(account.type)) return "Invalid account type";
    if (!["PKR", "USD"].includes(account.currency)) return "Invalid currency";
    if (
      !validNumber(account.openingBalance) ||
      !validNumber(account.exchangeRate) ||
      (account.currency === "USD" && account.exchangeRate === 0)
    ) {
      return "Account balances and exchange rates must be valid";
    }
    if (
      account.type === "fund" &&
      account.openingCostBasis !== undefined &&
      !validNumber(account.openingCostBasis)
    ) {
      return "Fund cost basis must be valid";
    }
    if (
      account.actualClosingBalance !== undefined &&
      !validNumber(account.actualClosingBalance)
    ) {
      return "Actual closing balances must be valid";
    }
  }
  if (
    body.status === "finalized" &&
    body.accounts.some((account) => account.actualClosingBalance === undefined)
  ) {
    return "Enter an actual closing balance for every account before finalizing";
  }
  const bounds = monthBounds(body.month);
  const entryIds = new Set(body.entries.map((entry) => entry.id));
  if (entryIds.size !== body.entries.length) return "Entry IDs must be unique";
  for (const entry of body.entries as LedgerEntry[]) {
    if (
      ![
        "income",
        "expense",
        "transfer",
        "fund_contribution",
        "fund_withdrawal",
      ].includes(entry.type)
    ) {
      return "Invalid entry type";
    }
    if (
      !entry.id ||
      !/^\d{4}-\d{2}-\d{2}$/.test(entry.date) ||
      entry.date < bounds.min ||
      entry.date > bounds.max
    ) {
      return "Every entry must have a valid date in this month";
    }
    if (
      !ids.has(entry.accountId) ||
      !validNumber(entry.amount) ||
      entry.amount <= 0
    ) {
      return "Every entry needs a valid account and positive amount";
    }
    if (
      entry.type === "transfer" &&
      (!entry.destinationAccountId ||
        !ids.has(entry.destinationAccountId) ||
        entry.destinationAccountId === entry.accountId)
    ) {
      return "Transfers need two different valid accounts";
    }
    if (entry.type === "transfer" && entry.destinationAccountId) {
      const source = body.accounts.find(
        (account) => account.id === entry.accountId,
      );
      const destination = body.accounts.find(
        (account) => account.id === entry.destinationAccountId,
      );
      if (
        source?.currency !== destination?.currency &&
        entry.destinationAmount === undefined
      ) {
        return "Cross-currency transfers need a destination amount";
      }
    }
    if (
      entry.destinationAmount !== undefined &&
      (!validNumber(entry.destinationAmount) || entry.destinationAmount === 0)
    ) {
      return "Destination amount must be positive";
    }
    if (
      entry.exchangeRate !== undefined &&
      (!validNumber(entry.exchangeRate) || entry.exchangeRate === 0)
    ) {
      return "Entry exchange rate must be positive";
    }
  }
  return null;
}

function validNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function error(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

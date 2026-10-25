// Pure currency maths shared by the server and the transfer form preview. Rates are PKR per one unit.

export const PKR = 'PKR';

export type RateTable = Record<string, number>;

export const isCurrencyCode = (value: unknown): value is string =>
  typeof value === 'string' && /^[A-Z]{3}$/.test(value);

export const round2 = (value: number) => Math.round(value * 100) / 100;

export const rateOf = (rates: RateTable, code: string): number | undefined => (code === PKR ? 1 : rates[code]);

// Market convention for which currency is the base of a pair; PKR always quotes.
const BASE_ORDER = ['EUR', 'GBP', 'AUD', 'NZD', 'USD', 'CAD', 'CHF', 'JPY'];
const rank = (code: string) => (code === PKR ? Infinity : BASE_ORDER.indexOf(code) + 1 || BASE_ORDER.length + 1);

export function quotePair(a: string, b: string) {
  const aFirst = rank(a) < rank(b) || (rank(a) === rank(b) && a < b);
  const [base, quote] = aFirst ? [a, b] : [b, a];
  return { base, quote, digits: quote === PKR ? 2 : 4 };
}

// "USD/PKR 279.00": units of the quote currency per unit of the base.
export function formatQuote(pair: ReturnType<typeof quotePair>, value: number) {
  return `${pair.base}/${pair.quote} ${value.toFixed(pair.digits)}`;
}

export type TransferSide = { currency: string; rate: number };

// The rate a cross-currency transfer achieved, and the market rate, both quoted base/quote.
function transferQuotes(sent: number, received: number, source: TransferSide, destination: TransferSide) {
  const pair = quotePair(source.currency, destination.currency);
  const baseIsSource = pair.base === source.currency;
  return {
    pair,
    receivedRate: baseIsSource ? received / sent : sent / received,
    marketRate: baseIsSource ? source.rate / destination.rate : destination.rate / source.rate,
  };
}

export const TRANSFER_CATEGORIES = {
  fees: { name: 'Transfer fees', kind: 'expense' },
  cost: { name: 'Exchange cost', kind: 'expense' },
  gain: { name: 'Exchange gain', kind: 'income' },
} as const;

export type TransferSplit = {
  amount: number;
  difference?: {
    type: 'income' | 'expense';
    amount: number;
    category: keyof typeof TRANSFER_CATEGORIES;
    note?: string;
  };
};

// Splits what left the source into the part that arrived and a cost or gain, so the source moves by exactly `sent`.
export function splitTransfer(input: {
  sent: number;
  received: number;
  source: TransferSide;
  destination: TransferSide;
}): TransferSplit | { error: string } {
  const { sent, received, source, destination } = input;
  const same = source.currency === destination.currency;
  if (same && received > sent) return { error: "Received can't exceed sent for a same-currency transfer" };

  const amount = same ? received : round2((received * destination.rate) / source.rate);
  if (amount <= 0) return { error: 'The amount received is too small to record' };
  const difference = round2(sent - amount);
  if (difference === 0) return { amount };
  if (same) return { amount, difference: { type: 'expense', amount: difference, category: 'fees' } };

  const { pair, receivedRate, marketRate } = transferQuotes(sent, received, source, destination);
  return {
    amount,
    difference: {
      type: difference > 0 ? 'expense' : 'income',
      amount: Math.abs(difference),
      category: difference > 0 ? 'cost' : 'gain',
      note: `Received at ${formatQuote(pair, receivedRate)}; market ${marketRate.toFixed(pair.digits)}`,
    },
  };
}

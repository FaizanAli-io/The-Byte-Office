/**
 * Money is held as an integer number of minor units — paisa for PKR, cents for
 * USD — everywhere inside the application.
 *
 * The reason is that sums of integers are exact. The previous representation
 * read Postgres `numeric` into a JavaScript float, so every reduce in
 * `expectedBalance` and `ledgerSummary` accumulated a little error, and
 * `variancePct` compares the result against a 0.0001 epsilon: a reconciliation
 * that balanced to the paisa could still report a difference.
 *
 * Postgres `numeric` was never the problem — it is exact. The columns stay
 * `numeric(18, 2)` and are read as strings, which this module converts without
 * ever passing through a float.
 *
 * Two places convert, and only two:
 *
 *   - the UI, where a person types and reads rupees
 *   - the assistant's tools, so the model keeps talking in rupees
 *
 * Exchange rates are ratios rather than money and stay decimal. A conversion
 * rounds once, explicitly, at the point of multiplication.
 */

/** An integer count of minor units. The alias is documentation, not enforcement. */
export type Minor = number;

export const MINOR_UNITS_PER_MAJOR = 100;
const DECIMALS = 2;

/** Rupees (or dollars) to minor units. Accepts what a number input produces. */
export function toMinor(major: number): Minor {
  if (!Number.isFinite(major)) return 0;
  // Scale first, then round: 19.99 * 100 is 1998.9999... in binary floating
  // point, and truncation would lose a paisa on values like this.
  return Math.round(major * MINOR_UNITS_PER_MAJOR);
}

/** Minor units back to a decimal, for display and for number inputs. */
export function toMajor(minor: Minor): number {
  return minor / MINOR_UNITS_PER_MAJOR;
}

/**
 * Parses the decimal string Postgres returns for a `numeric` column.
 *
 * Deliberately string arithmetic: `Number('429079.99') * 100` is 42907998.99999
 * and would need rounding to recover, whereas concatenating the digits is
 * exact for every value the column can hold.
 */
export function parseMinor(value: string | number | null | undefined): Minor {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return toMinor(value);

  const trimmed = value.trim();
  const negative = trimmed.startsWith('-');
  const [whole = '0', fraction = ''] = trimmed.replace(/^[+-]/, '').split('.');

  // Round rather than truncate when the column somehow holds more precision.
  const kept = fraction.slice(0, DECIMALS).padEnd(DECIMALS, '0');
  const rounded = Number(fraction[DECIMALS] ?? '0') >= 5 ? 1 : 0;

  const magnitude = Number(`${whole}${kept}`) + rounded;
  return negative ? -magnitude : magnitude;
}

/** Formats minor units as the decimal string a `numeric` column expects. */
export function serializeMinor(minor: Minor): string {
  const sign = minor < 0 ? '-' : '';
  const digits = String(Math.abs(Math.round(minor))).padStart(DECIMALS + 1, '0');
  return `${sign}${digits.slice(0, -DECIMALS)}.${digits.slice(-DECIMALS)}`;
}

/**
 * Converts between currencies at a rate, rounding once to the nearest minor
 * unit. The rate is an ordinary decimal; rounding the single product keeps the
 * result exact to the paisa without needing arbitrary precision.
 */
export function convertMinor(amount: Minor, rate: number): Minor {
  if (!Number.isFinite(rate)) return amount;
  return Math.round(amount * rate);
}

export function sumMinor(values: Minor[]): Minor {
  return values.reduce((total, value) => total + value, 0);
}

/** Human-readable money. PKR is shown whole; USD keeps its cents. */
export function formatMinor(minor: Minor, currency: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: currency === 'PKR' ? 0 : DECIMALS,
  }).format(toMajor(minor));
}

/**
 * The argument and preview keys that hold money.
 *
 * The assistant and MCP clients talk in rupees, because that is what a person
 * says and what the model reasons about. These two helpers are the boundary
 * where that becomes the internal representation, and where a confirmation
 * preview turns back into something readable.
 */
const MONEY_KEYS = [
  'amountPkr',
  'amountUsd',
  'value',
  'amount',
  'destinationAmount',
  'openingBalance',
  'openingCostBasis',
  'actualClosingBalance',
  'grandTotal',
] as const;

function mapMoneyKeys(input: unknown, convert: (value: number) => number): unknown {
  if (Array.isArray(input)) return input.map((item) => mapMoneyKeys(item, convert));
  if (typeof input !== 'object' || input === null || input instanceof Date) return input;

  return Object.fromEntries(
    Object.entries(input as Record<string, unknown>).map(([key, value]) => {
      if ((MONEY_KEYS as readonly string[]).includes(key) && typeof value === 'number') {
        return [key, convert(value)];
      }
      return [key, mapMoneyKeys(value, convert)];
    })
  );
}

/** Tool arguments arrive in rupees; everything inside works in minor units. */
export function argsToMinor<T>(args: T): T {
  return mapMoneyKeys(args, toMinor) as T;
}

/** Confirmation previews are read by a person, so they show rupees. */
export function previewToMajor<T>(preview: T): T {
  return mapMoneyKeys(preview, toMajor) as T;
}

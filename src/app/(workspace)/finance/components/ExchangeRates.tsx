'use client';

import { exchangeRatesApi, type ExchangeRates } from '@/lib/api-client';
import { formatQuote, PKR, quotePair } from '@/lib/fx';
import { useLoad } from './useLoad';

export const useExchangeRates = () => useLoad(exchangeRatesApi.load, []).data;

function age(updatedAt: string) {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(updatedAt).getTime()) / 60000));
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  return hours < 48 ? `${hours} h ago` : `${Math.round(hours / 24)} days ago`;
}

export const pkrQuote = (currency: string, rate: number) => formatQuote(quotePair(currency, PKR), rate);

// "USD/PKR 280.92 · updated 2 h ago", amber when the latest refresh failed, with the provider's attribution.
export function ExchangeRatesNote({ rates, currencies }: { rates: ExchangeRates | null; currencies: string[] }) {
  const shown = [...new Set(currencies)].filter((code) => code !== PKR && rates?.currencies[code] !== undefined);
  if (!rates || !shown.length) return null;
  return (
    <p className={`text-xs ${rates.stale ? 'text-amber-300' : 'text-slate-500'}`}>
      {shown.map((code) => pkrQuote(code, rates.currencies[code])).join(' · ')} · updated {age(rates.updatedAt)}
      {rates.stale ? ' (refresh failed, using the last stored rates)' : ''} ·{' '}
      <a
        href="https://www.exchangerate-api.com"
        target="_blank"
        rel="noreferrer"
        className="underline decoration-dotted hover:text-slate-300"
      >
        Rates By Exchange Rate API
      </a>
    </p>
  );
}

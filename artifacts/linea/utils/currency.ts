export const CURRENCIES: Record<string, string> = {
  GB: 'GBP', US: 'USD', PR: 'USD', AU: 'AUD', AT: 'EUR',
  CA: 'CAD', FI: 'EUR', FR: 'EUR', IL: 'ILS', MX: 'MXN',
};
export function money(amount: number, currency: string, usage = false): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency', currency, currencyDisplay: 'symbol',
    minimumFractionDigits: 2, maximumFractionDigits: usage ? 6 : 2,
  }).format(amount);
}

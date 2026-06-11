const LOCALE = 'es-DO';

const formatters = new Map();

function currencyFormatter(currency) {
  if (!formatters.has(currency)) {
    let formatter = null;
    try {
      formatter = new Intl.NumberFormat(LOCALE, { style: 'currency', currency });
    } catch {
      // Unknown ISO code — fall back to "CODE 1,234.00"
    }
    formatters.set(currency, formatter);
  }
  return formatters.get(currency);
}

export function fmtNumber(n) {
  return Number(n ?? 0).toLocaleString(LOCALE, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function fmtMoney(n, currency = 'DOP') {
  const formatter = currencyFormatter(currency);
  return formatter ? formatter.format(Number(n ?? 0)) : `${currency} ${fmtNumber(n)}`;
}

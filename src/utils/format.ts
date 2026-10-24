export function formatINR(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatNumber(val: number): string {
  return new Intl.NumberFormat('en-IN').format(val);
}

export function formatPct(pct: number): string {
  return `${pct.toFixed(1)}%`;
}

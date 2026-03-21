export function toCents(value: number) {
  const normalized = Number.isFinite(value) ? value : 0;
  return Math.round(normalized * 100);
}

export function fromCents(cents: number) {
  return Number((cents / 100).toFixed(2));
}

export function addMoney(...values: number[]) {
  const totalCents = values.reduce((acc, value) => acc + toCents(value), 0);
  return fromCents(totalCents);
}


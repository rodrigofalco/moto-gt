export function ordinal(n: number): string {
  const s = Math.abs(n) % 100;
  if (s >= 11 && s <= 13) return `${n}th`;
  switch (Math.abs(n) % 10) {
    case 1: return `${n}st`;
    case 2: return `${n}nd`;
    case 3: return `${n}rd`;
    default: return `${n}th`;
  }
}

export function formatMoney(n: number): string {
  if (n < 0) return `(${formatMoney(-n)})`;
  return `$${n.toLocaleString('en-US')}`;
}

export function formatSigned(n: number): string {
  return n >= 0 ? `+${n}` : String(n);
}

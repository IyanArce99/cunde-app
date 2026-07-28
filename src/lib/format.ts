export function eur(n: number, decimals = 2): string {
  return n.toFixed(decimals).replace('.', ',') + ' €';
}

export function eurConSigno(n: number, decimals = 2): string {
  const signo = n > 0 ? '+' : n < 0 ? '−' : '';
  return signo + eur(Math.abs(n), decimals);
}

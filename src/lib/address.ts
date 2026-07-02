// Stacks address comparison helpers. c32-encoded addresses are uppercase after the
// ST/SP prefix, but to be defensive against any case/whitespace drift between what a
// wallet returns, what's stored, and what's compared, always compare through eqAddr.

export function normalizeAddr(a?: string | null): string {
  return (a || "").trim().toUpperCase();
}

export function eqAddr(a?: string | null, b?: string | null): boolean {
  const na = normalizeAddr(a);
  return na.length > 0 && na === normalizeAddr(b);
}

export function includesAddr(list: string[] | undefined | null, a?: string | null): boolean {
  if (!Array.isArray(list)) return false;
  return list.some((x) => eqAddr(x, a));
}

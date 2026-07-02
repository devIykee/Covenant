// Single source of truth for USDCx amount conversion + display.
// USDCx has 6 decimals: 1 USDCx = 1,000,000 micro-units. All amounts are stored
// and moved as micro-unit strings; humans see whole USDCx. Never hand-roll * / 1e6
// or append "k" — use these helpers so create, deposit, cards, dashboard, detail,
// and settlement can never drift out of sync.

const MICRO = 1_000_000;

// Whole USDCx (human) -> micro string.
export function toMicro(human: string | number): string {
  const n = typeof human === "string" ? Number(human) : human;
  if (!Number.isFinite(n) || n < 0) return "0";
  return BigInt(Math.round(n * MICRO)).toString();
}

// Micro (string | bigint | number) -> whole USDCx number.
export function fromMicro(micro: string | bigint | number | null | undefined): number {
  if (micro === null || micro === undefined || micro === "") return 0;
  return Number(micro) / MICRO;
}

// Micro -> display string in whole USDCx, e.g. "1", "1,500", "0.5". No "k" abbrev.
export function formatUsdcx(micro: string | bigint | number | null | undefined, opts?: { decimals?: number }): string {
  const v = fromMicro(micro);
  const decimals = opts?.decimals ?? (Number.isInteger(v) ? 0 : 2);
  return v.toLocaleString(undefined, { maximumFractionDigits: decimals, minimumFractionDigits: 0 });
}

// Percent (0..100) that `rasiedMicro` is of `goalMicro`, clamped.
export function pctOf(raisedMicro: string | bigint | number, goalMicro: string | bigint | number): number {
  const g = fromMicro(goalMicro);
  if (g <= 0) return 0;
  return Math.min(100, Math.max(0, (fromMicro(raisedMicro) / g) * 100));
}

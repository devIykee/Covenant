import { ExternalLink } from "lucide-react";
import { getExplorerTxUrl, getExplorerAddressUrl, getExplorerUrl } from "@/src/lib/flowvault";

type Kind = "auto" | "address" | "contract" | "tx";

interface ExplorerLinkProps {
  value: string;
  kind?: Kind;
  /** Text to show instead of the truncated value (e.g. "Custodian"). */
  label?: string;
  /** Truncate the value like ST1PQ…GZGM / d31b9c…d141 (default true). */
  truncate?: boolean;
  showIcon?: boolean;
  className?: string;
}

function truncateMiddle(v: string, head = 6, tail = 4): string {
  const s = (v || "").replace(/^0x/, "");
  if (s.length <= head + tail + 1) return v;
  return `${v.slice(0, head)}…${v.slice(-tail)}`;
}

function urlFor(value: string, kind: Kind): string {
  switch (kind) {
    case "tx":
      return getExplorerTxUrl(value);
    case "address":
    case "contract":
      return getExplorerAddressUrl(value);
    default:
      return getExplorerUrl(value);
  }
}

/**
 * The single place that renders a clickable Stacks-explorer link for any address,
 * contract principal, or transaction id. Replaces all ad-hoc explorer URL building.
 */
export function ExplorerLink({ value, kind = "auto", label, truncate = true, showIcon = true, className = "" }: ExplorerLinkProps) {
  if (!value) return <span className="text-[var(--on-surface-variant)]">—</span>;
  const href = urlFor(value, kind);
  const text = label ?? (truncate ? truncateMiddle(value) : value);
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      title={`View ${value} on the Stacks explorer (testnet)`}
      className={`inline-flex items-center gap-1 font-data-sm text-[var(--ink)] underline decoration-[var(--ink)]/30 hover:decoration-[var(--ink)] break-all ${className}`}
    >
      {text}
      {showIcon && <ExternalLink size={11} className="shrink-0 opacity-60" />}
    </a>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Nav } from "@/src/components/Nav";
import { GuidedTour, type TourStep } from "@/src/components/GuidedTour";
import { toast } from "sonner";
import Link from "next/link";

const DETAIL_TOUR: TourStep[] = [
  { selector: "#tour-timeline", title: "The lifecycle", body: "This timeline tracks the covenant from created → funded → locked → resolved. Each step logs its on-chain transaction." },
  { selector: "#tour-custodian", title: "Live vault balance", body: "The escrow custodian's real FlowVault balance, read live from the contract. 'Locked' funds can't be withdrawn until the deadline block." },
  { selector: "#tour-invest", title: "How investors fund it", body: "Investors send USDCx to the custodian address here. Each contribution is tracked with its real transfer transaction." },
  { selector: "#tour-judgepanel", title: "Independent judges", body: "The judges you invited attest whether the milestone was met. 2-of-N agreement is required — this is what protects investors." },
  { selector: "#tour-actions", title: "Custodian actions", body: "Pool the raised funds into FlowVault (locks them on-chain), then Resolve to release 80/20 on success or refund on failure. Every step produces an explorer link." },
];
import { request, connect, getLocalStorage } from "@stacks/connect";
import { Cl } from "@stacks/transactions";
import { 
  FLOWVAULT_TOKEN_CONTRACT_ADDRESS, 
  FLOWVAULT_TOKEN_CONTRACT_NAME, 
  FLOWVAULT_NETWORK,
  getExplorerTxUrl 
} from "@/src/lib/flowvault";

interface Project {
  id: string;
  title: string;
  description: string;
  fundingGoal: string;
  milestoneDescription: string;
  deadlineBlock: number;
  status: string;
  builderAddress: string;
  treasuryAddress: string;
  pooledTxid?: string;
  pooledExplorerUrl?: string;
  withdrawTxid?: string;
  withdrawExplorerUrl?: string;
}

interface Contribution {
  id: string;
  principal: string;
  amount: string;
  depositTxid?: string;
  depositExplorerUrl?: string;
}

interface Attestation {
  judge: string;
  vote: string;
}

export default function ProjectDetail() {
  const params = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [attestations, setAttestations] = useState<Attestation[]>([]);
  const [vaultState, setVaultState] = useState<any>(null);
  const [custodianAddress, setCustodianAddress] = useState<string>("");
  const [backAmount, setBackAmount] = useState("1000");
  const [isBacking, setIsBacking] = useState(false);
  const [loading, setLoading] = useState(true);

  const [custodianBalance, setCustodianBalance] = useState<string | null>(null);
  const [isCheckingBalance, setIsCheckingBalance] = useState(false);
  const [copiedCustodian, setCopiedCustodian] = useState(false);

  const [connectedAddr, setConnectedAddr] = useState<string | null>(null);
  const [isAttesting, setIsAttesting] = useState(false);
  const [pageUrl, setPageUrl] = useState("");
  const [linkCopied, setLinkCopied] = useState(false);
  const [judgeInput, setJudgeInput] = useState("");
  const [isAppointing, setIsAppointing] = useState(false);

  const projectId = params.id;

  // Judges are invited per-project by the builder (independent verifiers). Funds
  // release only when 2-of-N attest MET, so investors don't have to trust the builder.
  const invitedJudges: string[] = (() => {
    try {
      return JSON.parse((project as any)?.judges || "[]");
    } catch {
      return [];
    }
  })();
  const youAreJudge = !!connectedAddr && invitedJudges.includes(connectedAddr);
  const youAreInvestor = !!connectedAddr && contributions.some((c) => c.principal === connectedAddr);
  const canAppointJudges = youAreInvestor && ["CREATED", "BACKING_OPEN"].includes(project?.status || "");

  async function handleAppointJudges(addresses: string[]) {
    if (!connectedAddr) { toast.error("Connect your wallet."); return; }
    const clean = addresses.map((a) => a.trim()).filter(Boolean);
    if (clean.length === 0) { toast.error("Enter a judge address."); return; }
    setIsAppointing(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/judges`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ investor: connectedAddr, judges: clean }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to appoint judges");
      toast.success("Judge(s) appointed.");
      setJudgeInput("");
      await loadProject();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setIsAppointing(false);
    }
  }

  // Pick up the connected wallet + this page's shareable URL (the judge invite link).
  useEffect(() => {
    if (typeof window === "undefined") return;
    setConnectedAddr(localStorage.getItem("covenant-address"));
    setPageUrl(window.location.href);
  }, []);

  function copyInviteLink() {
    const url = pageUrl || (typeof window !== "undefined" ? window.location.href : "");
    navigator.clipboard?.writeText(url);
    setLinkCopied(true);
    toast.success("Invite link copied — send it to your judges");
    setTimeout(() => setLinkCopied(false), 1500);
  }


  async function loadProject() {
    try {
      const res = await fetch(`/api/projects/${projectId}`);
      if (!res.ok) throw new Error("Project not found");
      const data = await res.json();
      setProject(data.project);
      setContributions(data.contributions || []);
      setAttestations(data.attestations || []);
    } catch (e: any) {
      toast.error("Failed to load project");
    }
  }

  async function loadCustodian() {
    const res = await fetch("/api/escrow/address");
    const data = await res.json();
    setCustodianAddress(data.address || "ST...");
  }

  const copyCustodian = async () => {
    if (!custodianAddress) return;
    await navigator.clipboard.writeText(custodianAddress);
    setCopiedCustodian(true);
    setTimeout(() => setCopiedCustodian(false), 1600);
  };

  async function checkCustodianBalance() {
    if (!custodianAddress) return;
    setIsCheckingBalance(true);
    try {
      const res = await fetch(`https://api.testnet.hiro.so/extended/v1/address/${custodianAddress}/balances`);
      const data = await res.json();
      // Find USDCx fungible token balance
      const tokenKey = `${process.env.NEXT_PUBLIC_FLOWVAULT_TOKEN_CONTRACT_ADDRESS || 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM'}.${process.env.NEXT_PUBLIC_FLOWVAULT_TOKEN_CONTRACT_NAME || 'usdcx'}::usdcx`;
      const ftEntry = data.fungible_tokens?.[tokenKey] || 
                      Object.values(data.fungible_tokens || {}).find((f: any) => 
                        (f as any).symbol?.toLowerCase().includes('usdc') || 
                        (f as any).name?.toLowerCase().includes('usdc')
                      );
      const raw = ftEntry ? (ftEntry as any).balance : '0';
      const formatted = (parseInt(raw) / 1_000_000).toFixed(2);
      setCustodianBalance(formatted);
    } catch (e) {
      setCustodianBalance('0.00');
    } finally {
      setIsCheckingBalance(false);
    }
  }

  async function pollVaultState() {
    try {
      const res = await fetch(`/api/vault/state?projectId=${projectId}`);
      const data = await res.json();
      setVaultState(data);
    } catch {}
  }

  useEffect(() => {
    if (!projectId) return;
    setLoading(true);
    Promise.all([loadProject(), loadCustodian(), pollVaultState()]).finally(() => setLoading(false));

    // Poll vault state
    const interval = setInterval(pollVaultState, 8000);
    return () => clearInterval(interval);
  }, [projectId]);

  const totalRaised = contributions.reduce((s, c) => s + BigInt(c.amount), BigInt(0));
  const goal = project ? BigInt(project.fundingGoal) : BigInt(0);
  const progress = goal > BigInt(0) ? Math.min(Number((totalRaised * BigInt(100)) / goal), 100) : 0;

  // Simple status timeline
  const timelineSteps = [
    { label: "Created", status: "CREATED" },
    { label: "Backing Open", status: "BACKING_OPEN" },
    { label: "Pooled / Locked", status: "POOLED_LOCKED" },
    { label: "Dispute Window", status: "DISPUTE_WINDOW" },
    { label: "Resolved", status: "RESOLVED_SUCCESS" },
  ];

  const currentStatusIdx = timelineSteps.findIndex((s) => s.status === project?.status) || 0;

  // Helper to connect wallet and get STX address
  async function ensureWalletAddress(): Promise<string> {
    try {
      // Try to use existing session if available via request
      const res = await request("stx_getAddresses" as any, {});
      // @stacks/connect types vary; try common shapes
      const addr = (res as any)?.addresses?.[0]?.address || (res as any)?.stxAddress || (res as any)?.result?.[0]?.address;
      if (addr && addr.startsWith("ST")) return addr;
    } catch (_) {}

    // Fallback: open the wallet with @stacks/connect v8 connect()
    await connect();
    const stx = getLocalStorage()?.addresses?.stx?.[0]?.address;
    if (stx && stx.startsWith("ST")) return stx;
    throw new Error("Wallet address required — set your wallet to Testnet and reconnect.");
  }

  // Perform real SIP-010 USDCx transfer from user's wallet to custodian
  async function performUsdcxTransfer(amountMicro: string, custodian: string, sender: string) {
    const contract = `${FLOWVAULT_TOKEN_CONTRACT_ADDRESS}.${FLOWVAULT_TOKEN_CONTRACT_NAME}`;

    const functionArgs = [
      Cl.uint(BigInt(amountMicro)),
      Cl.principal(sender),
      Cl.principal(custodian),
      Cl.none(),
    ];

    const txOptions: any = {
      contract,
      functionName: "transfer",
      functionArgs,
      network: FLOWVAULT_NETWORK,
      postConditionMode: "allow", // allow for demo; in prod use exact post conditions
    };

    const result = await request("stx_callContract", txOptions);

    const txid = (result as any)?.txid || (result as any)?.transactionId || (result as any)?.txId || "";
    if (!txid) throw new Error("Transfer submitted but no txid returned");

    const explorerUrl = getExplorerTxUrl(txid);
    return { txid, explorerUrl };
  }

  // Back the project with REAL on-chain USDCx transfer
  async function handleBackProject() {
    if (!project || !custodianAddress) return;

    const amountMicro = (parseFloat(backAmount) * 1_000_000).toString();
    if (!amountMicro || parseFloat(backAmount) <= 0) {
      toast.error("Enter a valid amount");
      return;
    }

    setIsBacking(true);
    try {
      // 1. Ensure we have the user's real STX principal
      // Prefer connected wallet from localStorage (set by Nav)
      const saved = typeof window !== 'undefined' ? localStorage.getItem('covenant-address') : null;
      const sender = saved && saved.startsWith('ST') ? saved : await ensureWalletAddress();
      toast.info(`Using wallet: ${sender.slice(0, 8)}...`);

      // 2. Execute the actual SIP-010 transfer (this is the on-chain user tx)
      const transferResult = await performUsdcxTransfer(amountMicro, custodianAddress, sender);
      toast.success(`Transfer sent! TX: ${transferResult.txid.slice(0, 10)}...`);

      // 3. Record in our DB with the real tx details
      const recordRes = await fetch(`/api/projects/${projectId}/back`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: amountMicro,
          principal: sender,
          depositTxid: transferResult.txid,
          depositExplorerUrl: transferResult.explorerUrl,
        }),
      });

      if (!recordRes.ok) {
        const err = await recordRes.json().catch(() => ({}));
        throw new Error(err.error || "Failed to record contribution after transfer");
      }

      toast.success("Contribution recorded. View the tx on the explorer.");

      // Open the user's transfer tx
      window.open(transferResult.explorerUrl, "_blank");

      await loadProject();
    } catch (err: any) {
      toast.error(err.message || "Backing failed. Make sure your wallet has USDCx on testnet and you are connected.");
      console.error(err);
    } finally {
      setIsBacking(false);
    }
  }

  async function handleJudgeAttest(vote: "MET" | "NOT_MET") {
    if (!connectedAddr) {
      toast.error("Connect your wallet to attest.");
      return;
    }
    if (!youAreJudge) {
      toast.error("Your connected wallet isn't an invited judge for this covenant.");
      return;
    }
    const judge = connectedAddr;
    setIsAttesting(true);
    try {
      // The judge signs the exact vote with their wallet; the server verifies the
      // signature against their address before recording it (trustless attestation).
      const message = `Covenant ${projectId} milestone: ${vote}`;
      const signed: any = await request("stx_signMessage", { message });
      const signature = signed?.signature || signed?.result?.signature;
      const publicKey = signed?.publicKey || signed?.result?.publicKey;
      if (!signature || !publicKey) throw new Error("Wallet did not return a signature.");

      const res = await fetch(`/api/projects/${projectId}/attest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ judge, vote, signature, publicKey }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Attestation failed");
      }
      const data = await res.json().catch(() => ({}));
      toast.success(`Vote signed & verified: "${vote}". ${data.metCount ?? 0} of ${data.totalJudges ?? "?"} say MET.`);
      await loadProject();
    } catch (e: any) {
      if (/reject|cancel|deny/i.test(e?.message || "")) toast.error("Signature cancelled.");
      else toast.error(e.message);
    } finally {
      setIsAttesting(false);
    }
  }

  // Resolution trigger (custodian action)
  async function handleResolve(success: boolean) {
    try {
      const res = await fetch(`/api/projects/${projectId}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ success }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`Resolution recorded. ${data.txids ? "On-chain txs logged." : ""}`);
      await loadProject();
      await pollVaultState();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  if (loading || !project) {
    return <div className="min-h-screen flex items-center justify-center">Loading covenant...</div>;
  }

  const raisedDisplay = (Number(totalRaised) / 1e6).toFixed(0);
  const goalDisplay = (Number(goal) / 1e6).toFixed(0);

  return (
    <div className="min-h-screen flex flex-col">
      <Nav />

      <main className="flex-grow max-w-[1200px] mx-auto w-full px-6 py-8">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <div className="text-xs font-label-caps text-[var(--on-surface-variant)]">AGREEMENT ID: {project.id.slice(0, 12).toUpperCase()}</div>
            <h1 className="font-display-lg text-3xl md:text-[32px] tracking-tight">{project.title}</h1>
            <p className="text-[var(--on-surface-variant)] mt-1">Builder: <span className="font-data-sm text-[var(--ink)]">{project.builderAddress.slice(0, 8)}...</span></p>
          </div>
          <div>
            <span className={
              project.status.includes("RESOLVED") ? "stamp-resolved" : 
              project.status.includes("LOCKED") ? "stamp-locked" : "stamp-open"
            } style={{ padding: "6px 14px", fontSize: "11px" }}>
              {project.status.replace("_", " ")}
            </span>
          </div>
        </div>

        <div className="rule-line-major mb-8" />

        {/* Bento: Timeline + Vault + Judges */}
        <div className="grid md:grid-cols-12 gap-6 mb-10">
          {/* Timeline */}
          <div id="tour-timeline" className="md:col-span-4 border border-[var(--ink)]/10 p-6 bg-white dark:bg-[#121720] dark:border-white/10">
            <div className="font-label-caps text-xs text-[var(--on-surface-variant)] mb-4">AGREEMENT TIMELINE</div>
            <div className="space-y-6 relative pl-5">
              {timelineSteps.map((step, idx) => (
                <div key={idx} className="timeline-item flex gap-3">
                  <div className={`timeline-dot mt-1 ${idx <= currentStatusIdx ? "active" : ""}`} />
                  <div className="text-sm">
                    <div className={idx <= currentStatusIdx ? "font-medium" : "text-[var(--on-surface-variant)]"}>{step.label}</div>
                    <div className="font-data-sm text-xs text-[var(--on-surface-variant)]">
                      {idx === 2 && project.pooledTxid ? <a href={project.pooledExplorerUrl} target="_blank" className="explorer-link underline">TX logged</a> : "—"}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Vault + Judges */}
          <div className="md:col-span-8 flex flex-col gap-6">
            <div id="tour-custodian" className="border border-[var(--ink)]/10 p-6 bg-white dark:bg-[#121720] dark:border-white/10 flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="font-label-caps text-xs text-[var(--on-surface-variant)]">LIVE VAULT BALANCE (CUSTODIAN)</div>
                <div className="text-3xl font-data-lg mt-1 tracking-tight">
                  {vaultState?.unlocked ? (Number(vaultState.unlocked) / 1e6).toFixed(0) : raisedDisplay} USDCx
                </div>
                <div className="text-xs text-[var(--on-surface-variant)] mt-1">Locked: {vaultState?.locked ? (Number(vaultState.locked)/1e6).toFixed(0) : "—"}</div>
              </div>
              <div className="min-w-[260px]">
                <div className="font-label-caps text-xs text-[var(--on-surface-variant)] flex items-center gap-2">
                  CUSTODIAN ADDRESS
                  <button 
                    onClick={copyCustodian} 
                    className="text-[10px] px-1.5 py-px rounded border border-[var(--ink)]/20 hover:bg-[var(--ink)]/5 flex items-center gap-1"
                    title="Copy address"
                  >
                    {copiedCustodian ? 'COPIED!' : 'COPY'}
                  </button>
                </div>
                <div className="font-data-sm bg-[var(--surface-container-low)] dark:bg-[#1a202e] px-2 py-1 text-[var(--ink)] dark:text-[#e8ebf5] inline-block mt-1 break-all text-[11px]">
                  {custodianAddress}
                  <a href={`https://explorer.hiro.so/address/${custodianAddress}?chain=testnet`} target="_blank" className="ml-2 inline text-[var(--on-surface-variant)] hover:text-[var(--ink)]">↗</a>
                </div>

                <div className="mt-2 flex items-center gap-2">
                  <button 
                    onClick={checkCustodianBalance} 
                    disabled={isCheckingBalance}
                    className="text-[10px] px-2 py-1 border border-[var(--ink)]/20 rounded hover:bg-[var(--ink)]/5 disabled:opacity-60"
                  >
                    {isCheckingBalance ? 'CHECKING...' : 'CHECK BALANCE'}
                  </button>
                  {custodianBalance !== null && (
                    <span className="font-data-sm text-xs text-[var(--brass)]">{custodianBalance} USDCx</span>
                  )}
                </div>
              </div>
            </div>

            {/* Judge Attestation Panel — invited independent verifiers */}
            <div id="tour-judgepanel" className="border border-[var(--ink)]/10 p-6 bg-white dark:bg-[#121720] dark:border-white/10">
              {(() => {
                const threshold = Math.min(2, invitedJudges.length || 2);
                const metCount = attestations.filter(a => a.vote === "MET" && invitedJudges.includes(a.judge)).length;
                return (
                  <>
                    <div className="flex justify-between mb-1">
                      <div className="font-label-caps text-xs text-[var(--on-surface-variant)]">MILESTONE ATTESTATION ({threshold}-of-{invitedJudges.length || "—"})</div>
                      <div className="text-xs px-2 py-0.5 bg-[var(--surface-container-low)] text-[var(--ink)]">{metCount} MET</div>
                    </div>
                    <p className="text-[11px] text-[var(--on-surface-variant)] mb-4">
                      Judges are appointed by <strong className="text-[var(--ink)]">investors</strong> (not the builder). Funds only release when <strong className="text-[var(--ink)]">{threshold} of {invitedJudges.length || "N"}</strong> attest MET.
                    </p>

                    {/* Investors appoint judges (only investors, only before lock) */}
                    {canAppointJudges && (
                      <div className="mb-4 border border-[var(--ink)]/15 rounded-sm p-3 bg-[var(--surface-container-low)]">
                        <div className="font-label-caps text-[10px] text-[var(--on-surface-variant)] mb-1.5">APPOINT A JUDGE (INVESTORS ONLY)</div>
                        <div className="flex items-center gap-2">
                          <input
                            value={judgeInput}
                            onChange={(e) => setJudgeInput(e.target.value)}
                            placeholder="ST… judge address"
                            className="flex-1 min-w-0 bg-transparent border border-[var(--ink)]/15 rounded px-2 py-1.5 text-xs font-data-sm"
                          />
                          <button type="button" disabled={isAppointing} onClick={() => handleAppointJudges([judgeInput])} className="btn-primary text-[10px] px-3 py-1.5 shrink-0 disabled:opacity-50">ADD</button>
                        </div>
                        <button type="button" disabled={isAppointing || (!!connectedAddr && invitedJudges.includes(connectedAddr))} onClick={() => handleAppointJudges([connectedAddr as string])} className="mt-2 text-[10px] underline text-[var(--on-surface-variant)] hover:text-[var(--ink)] disabled:opacity-40">
                          + Add myself as a judge
                        </button>
                      </div>
                    )}

                    {invitedJudges.length === 0 ? (
                      <div className="text-sm text-[var(--on-surface-variant)] border border-dashed border-[var(--ink)]/20 rounded p-4">
                        {youAreInvestor
                          ? "No judges appointed yet — add the judges who will verify this milestone above."
                          : "No judges appointed yet. After you invest, you can appoint the judges who verify this milestone."}
                      </div>
                    ) : (
                      <>
                        <div className="space-y-1 text-sm mb-5">
                          {invitedJudges.map((j, i) => {
                            const att = attestations.find(a => a.judge === j);
                            const isYou = connectedAddr === j;
                            return (
                              <div key={i} className="flex justify-between py-2 rule-line-minor items-center text-xs gap-2">
                                <span className="flex items-center gap-2 min-w-0">
                                  <span className="font-label-caps text-[10px] text-[var(--on-surface-variant)] shrink-0">JUDGE {i + 1}</span>
                                  <span className="font-data-sm truncate">{j.slice(0, 10)}…{j.slice(-4)}</span>
                                  {isYou && <span className="text-[9px] px-1.5 py-0.5 rounded bg-[var(--brass)]/20 text-[var(--brass)] font-bold shrink-0">YOU</span>}
                                </span>
                                <span className={att ? (att.vote === "MET" ? "text-[var(--brass)] font-medium shrink-0" : "text-[var(--signet)] font-medium shrink-0") : "text-[var(--on-surface-variant)] shrink-0"}>
                                  {att ? att.vote : "PENDING"}
                                </span>
                              </div>
                            );
                          })}
                        </div>

                        {/* Judge invite link — always visible so the builder can share it */}
                        <div className="mb-4 border border-[var(--ink)]/15 rounded-sm p-3 bg-[var(--surface-container-low)]">
                          <div className="font-label-caps text-[10px] text-[var(--on-surface-variant)] mb-1.5">JUDGE INVITE LINK — SEND THIS TO YOUR JUDGES</div>
                          <div className="flex items-center gap-2">
                            <input
                              readOnly
                              value={pageUrl}
                              onFocus={(e) => e.currentTarget.select()}
                              className="flex-1 min-w-0 bg-transparent border border-[var(--ink)]/15 rounded px-2 py-1.5 text-xs font-data-sm text-[var(--ink)]"
                            />
                            <button type="button" onClick={copyInviteLink} className="btn-primary text-[10px] px-3 py-1.5 shrink-0">
                              {linkCopied ? "COPIED" : "COPY"}
                            </button>
                          </div>
                          <p className="text-[10px] text-[var(--on-surface-variant)] mt-2">
                            An invited judge opens this link, connects their wallet, and attests. {youAreJudge
                              ? "You're an invited judge — cast your vote below."
                              : "Your connected wallet isn't on the judge list."}
                          </p>
                        </div>

                        {youAreJudge ? (
                          <>
                            <p className="text-[11px] text-[var(--on-surface-variant)] mb-2">
                              Attesting as <span className="font-data-sm text-[var(--ink)]">{connectedAddr?.slice(0, 10)}…{connectedAddr?.slice(-4)}</span>. Your wallet will sign the vote and the server verifies the signature.
                            </p>
                            <div className="flex gap-3">
                              <button onClick={() => handleJudgeAttest("NOT_MET")} disabled={isAttesting} className="btn-secondary flex-1 text-sm py-2 disabled:opacity-50">{isAttesting ? "SIGNING…" : "ATTEST: NOT MET"}</button>
                              <button onClick={() => handleJudgeAttest("MET")} disabled={isAttesting} className="btn-primary flex-1 text-sm py-2 disabled:opacity-50">{isAttesting ? "SIGNING…" : "ATTEST: MET"}</button>
                            </div>
                          </>
                        ) : (
                          <div className="border border-dashed border-[var(--ink)]/20 rounded-sm p-3 text-[11px] text-[var(--on-surface-variant)]">
                            Only invited judges can attest. Connect one of the invited judge wallets (top-right) to sign a vote.
                          </div>
                        )}
                      </>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        </div>

        {/* Back this project section */}
        {project.status === "CREATED" || project.status === "BACKING_OPEN" ? (
          <div id="tour-invest" className="border border-[var(--ink)]/10 p-6 mb-8 max-w-lg">
            <div className="font-label-caps text-xs mb-2">TRANSACTION SETUP</div>
            <h3 className="font-headline-md mb-4">Invest in this Covenant</h3>

            <div className="mb-4">
              <div className="text-xs font-label-caps mb-1">SEND USDCx TO CUSTODIAN</div>
              <div className="font-data-sm break-all bg-[var(--surface-container-low)] p-2 text-sm">{custodianAddress}</div>
            </div>

            <label className="text-xs font-label-caps block mb-1">CONTRIBUTION AMOUNT (USDCx)</label>
            <input
              type="number"
              value={backAmount}
              onChange={(e) => setBackAmount(e.target.value)}
              className="input-line w-full py-2 mb-4 text-lg font-data-lg"
            />

            <button onClick={handleBackProject} disabled={isBacking} className="btn-primary w-full disabled:opacity-60">
              {isBacking ? "RECORDING..." : "RECORD CONTRIBUTION"}
            </button>
            <p className="text-[10px] mt-3 text-[var(--on-surface-variant)]">After recording, perform a standard USDCx SIP-010 transfer to the custodian. Paste txid if prompted in future.</p>
          </div>
        ) : null}

        {/* Investor Ledger */}
        <div className="border border-[var(--ink)]/10 mb-8 overflow-hidden">
          <div className="p-4 bg-white dark:bg-[#121720] border-b border-[var(--ink)]/10 dark:border-white/10">
            <div className="font-label-caps text-xs">INVESTOR LEDGER • {contributions.length} CONTRIBUTIONS</div>
          </div>
          <div className="overflow-x-auto bg-white dark:bg-[#121720]">
            <table className="w-full text-left data-table">
              <thead>
                <tr className="border-b border-[var(--ink)]/10 bg-[var(--surface-container-low)]/40">
                  <th className="p-3 text-xs">PRINCIPAL</th>
                  <th className="p-3 text-xs text-right">AMOUNT (USDCx)</th>
                  <th className="p-3 text-xs text-right">TIMESTAMP</th>
                  <th className="p-3 text-xs text-center">TX</th>
                </tr>
              </thead>
              <tbody className="text-sm font-data-sm">
                {contributions.length === 0 && <tr><td colSpan={4} className="p-8 text-center text-[var(--on-surface-variant)]">No investors yet.</td></tr>}
                {contributions.map((c, idx) => (
                  <tr key={idx} className="border-b border-[var(--ink)]/10 hover:bg-[var(--parchment)]">
                    <td className="p-3 font-mono text-xs text-[var(--ink)]">{c.principal}</td>
                    <td className="p-3 text-right">{(Number(c.amount) / 1e6).toFixed(0)}</td>
                    <td className="p-3 text-right text-[var(--on-surface-variant)] text-xs">{new Date().toISOString().slice(0, 16)}</td>
                    <td className="p-3 text-center">
                      {c.depositExplorerUrl ? <a href={c.depositExplorerUrl} target="_blank" className="explorer-link">↗</a> : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pool + Resolution Controls */}
        <div id="tour-actions" className="border border-[var(--ink)]/10 p-6 bg-white dark:bg-[#121720] dark:border-white/10 mb-8">
          <div className="font-label-caps text-xs mb-3">CUSTODIAN ACTIONS (PRIMARY FLOW)</div>

          {(() => {
            const poolBlockReason =
              contributions.length === 0
                ? "No investors have deposited yet."
                : invitedJudges.length === 0
                ? "Investors must appoint at least one judge before pooling."
                : "";
            return (
              <>
                <div className="flex flex-wrap gap-3 mb-3">
                  <button
                    disabled={!!poolBlockReason}
                    title={poolBlockReason}
                    onClick={async () => {
                      const r = await fetch(`/api/projects/${projectId}/pool`, { method: "POST" });
                      const d = await r.json();
                      if (r.ok) { toast.success("Pooled to FlowVault"); window.open(d.explorerUrl, "_blank"); }
                      else toast.error(d.error);
                      await loadProject();
                    }}
                    className="btn-secondary text-sm py-2 disabled:opacity-40">POOL INTO FLOWVAULT (LOCK 100%)</button>

                  <button onClick={() => handleResolve(true)} className="btn-primary text-sm py-2">RESOLVE SUCCESS — 80% BUILDER / 20% PRO-RATA</button>
                  <button onClick={() => handleResolve(false)} className="btn-secondary text-sm py-2">RESOLVE FAILURE — 100% REFUND</button>
                </div>
                {poolBlockReason && <p className="text-xs mb-1 text-[var(--signet)]">{poolBlockReason}</p>}
              </>
            );
          })()}

          <p className="text-xs mt-1 text-[var(--on-surface-variant)]">Pool executes set-routing-rules + deposit on custodian vault. Resolution calls withdraw then distributes. All txs logged.</p>

          {project.pooledExplorerUrl && <a href={project.pooledExplorerUrl} target="_blank" className="text-xs underline block mt-1">Pooled tx: {project.pooledTxid?.slice(0,10)} ↗</a>}
          {project.withdrawExplorerUrl && (
            <a href={project.withdrawExplorerUrl} target="_blank" className="block mt-1 text-xs underline">Withdraw tx ↗</a>
          )}
        </div>

        {/* Milestone details */}
        <div className="text-sm">
          <div className="font-label-caps text-xs text-[var(--on-surface-variant)]">MILESTONE</div>
          <div className="mt-1">{project.milestoneDescription}</div>
        </div>
      </main>

      <GuidedTour steps={DETAIL_TOUR} storageKey="covenant-detail-tour-v1" />
    </div>
  );
}

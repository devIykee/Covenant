"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Nav } from "@/src/components/Nav";
import { toast } from "sonner";
import Link from "next/link";
import { request, showConnect } from "@stacks/connect";
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

  const projectId = params.id;

  // Hardcoded demo judges for multisig 2-of-3 (global for demo)
  const JUDGES = [
    "ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5",
    "ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG",
    "ST2JHG361ZXG51QTKY2NQCVBPPRRE2KZB1HR05NNC",
  ];

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

    // Fallback: show connect
    return new Promise((resolve, reject) => {
      showConnect({
        appDetails: {
          name: "Covenant",
          icon: (typeof window !== "undefined" ? window.location.origin : "") + "/globe.svg",
        },
        onFinish: (payload: any) => {
          const userData = payload?.userSession?.loadUserData?.();
          const addr = userData?.profile?.stxAddress?.testnet || 
                       userData?.profile?.stxAddress?.mainnet ||
                       userData?.identityAddress;
          if (addr && addr.startsWith("ST")) {
            resolve(addr);
          } else {
            // Last resort: ask user to paste or use a demo
            const manual = prompt("Connected! Paste your STX testnet address (ST...) to continue:");
            if (manual && manual.startsWith("ST")) resolve(manual);
            else reject(new Error("Wallet address required"));
          }
        },
        onCancel: () => reject(new Error("Wallet connection cancelled")),
      });
    });
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
      const sender = await ensureWalletAddress();
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
    // This is demo only - restricted by address match in real.
    const judge = JUDGES[0]; // demo use first
    try {
      // In full implementation: use @stacks/connect signMessage + send to server for verification
      const message = `Covenant ${projectId} milestone: ${vote}`;
      const res = await fetch(`/api/projects/${projectId}/attest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ judge, vote, signature: "demo-signature-" + Date.now(), message }),
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success(`Attested: ${vote}`);
      await loadProject();
    } catch (e: any) {
      toast.error(e.message);
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
            <div className="text-xs font-label-caps text-[#424848]">AGREEMENT ID: {project.id.slice(0, 12).toUpperCase()}</div>
            <h1 className="font-display-lg text-3xl md:text-[32px] tracking-tight">{project.title}</h1>
            <p className="text-[#424848] mt-1">Builder: <span className="font-data-sm text-[#0B1D1D]">{project.builderAddress.slice(0, 8)}...</span></p>
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
          <div className="md:col-span-4 border border-[#0B1D1D]/10 p-6 bg-white">
            <div className="font-label-caps text-xs text-[#424848] mb-4">AGREEMENT TIMELINE</div>
            <div className="space-y-6 relative pl-5">
              {timelineSteps.map((step, idx) => (
                <div key={idx} className="timeline-item flex gap-3">
                  <div className={`timeline-dot mt-1 ${idx <= currentStatusIdx ? "active" : ""}`} />
                  <div className="text-sm">
                    <div className={idx <= currentStatusIdx ? "font-medium" : "text-[#424848]"}>{step.label}</div>
                    <div className="font-data-sm text-xs text-[#424848]">
                      {idx === 2 && project.pooledTxid ? <a href={project.pooledExplorerUrl} target="_blank" className="explorer-link underline">TX logged</a> : "—"}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Vault + Judges */}
          <div className="md:col-span-8 flex flex-col gap-6">
            <div className="border border-[#0B1D1D]/10 p-6 bg-white flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="font-label-caps text-xs text-[#424848]">LIVE VAULT BALANCE (CUSTODIAN)</div>
                <div className="text-3xl font-data-lg mt-1 tracking-tight">
                  {vaultState?.unlocked ? (Number(vaultState.unlocked) / 1e6).toFixed(0) : raisedDisplay} USDCx
                </div>
                <div className="text-xs text-[#424848] mt-1">Locked: {vaultState?.locked ? (Number(vaultState.locked)/1e6).toFixed(0) : "—"}</div>
              </div>
              <div>
                <div className="font-label-caps text-xs text-[#424848]">CUSTODIAN ADDRESS</div>
                <div className="font-data-sm bg-[#F0F3FF] px-2 py-1 text-[#0B1D1D] inline-block mt-1 break-all text-xs">
                  {custodianAddress}
                  <a href={`https://explorer.hiro.so/address/${custodianAddress}?chain=testnet`} target="_blank" className="ml-2 inline text-[#424848] hover:text-[#0B1D1D]">↗</a>
                </div>
              </div>
            </div>

            {/* Judge Attestation Panel (matches design) */}
            <div className="border border-[#0B1D1D]/10 p-6 bg-white">
              <div className="flex justify-between mb-4">
                <div className="font-label-caps text-xs text-[#424848]">JUDGE ATTESTATION STATUS (2-of-3)</div>
                <div className="text-xs px-2 py-0.5 bg-[#F0F3FF] text-[#0B1D1D]">{attestations.length} / 3</div>
              </div>

              <div className="space-y-1 text-sm mb-6">
                {JUDGES.map((j, i) => {
                  const att = attestations.find(a => a.judge === j);
                  return (
                    <div key={i} className="flex justify-between py-2 rule-line-minor items-center text-xs">
                      <span className="font-data-sm">{j.slice(0, 12)}...</span>
                      <span className={att ? "text-[#B79438] font-medium" : "text-[#424848]"}>
                        {att ? `ATTESTED (${att.vote})` : "PENDING"}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="flex gap-3">
                <button onClick={() => handleJudgeAttest("NOT_MET")} className="btn-secondary flex-1 text-sm py-2">ATTEST: NOT MET</button>
                <button onClick={() => handleJudgeAttest("MET")} className="btn-primary flex-1 text-sm py-2">ATTEST: MET</button>
              </div>
              <p className="text-[10px] text-[#424848] mt-3">Judge panel is demo-restricted. Real app verifies signatures server-side.</p>
            </div>
          </div>
        </div>

        {/* Back this project section */}
        {project.status === "CREATED" || project.status === "BACKING_OPEN" ? (
          <div className="border border-[#0B1D1D]/10 p-6 mb-8 max-w-lg">
            <div className="font-label-caps text-xs mb-2">TRANSACTION SETUP</div>
            <h3 className="font-headline-md mb-4">Back this Covenant</h3>

            <div className="mb-4">
              <div className="text-xs font-label-caps mb-1">SEND USDCx TO CUSTODIAN</div>
              <div className="font-data-sm break-all bg-[#F0F3FF] p-2 text-sm">{custodianAddress}</div>
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
            <p className="text-[10px] mt-3 text-[#424848]">After recording, perform a standard USDCx SIP-010 transfer to the custodian. Paste txid if prompted in future.</p>
          </div>
        ) : null}

        {/* Backer Ledger */}
        <div className="border border-[#0B1D1D]/10 mb-8 overflow-hidden">
          <div className="p-4 bg-white border-b border-[#0B1D1D]/10">
            <div className="font-label-caps text-xs">BACKER LEDGER • {contributions.length} CONTRIBUTIONS</div>
          </div>
          <div className="overflow-x-auto bg-white">
            <table className="w-full text-left data-table">
              <thead>
                <tr className="border-b border-[#0B1D1D]/10 bg-[#F0F3FF]/40">
                  <th className="p-3 text-xs">PRINCIPAL</th>
                  <th className="p-3 text-xs text-right">AMOUNT (USDCx)</th>
                  <th className="p-3 text-xs text-right">TIMESTAMP</th>
                  <th className="p-3 text-xs text-center">TX</th>
                </tr>
              </thead>
              <tbody className="text-sm font-data-sm">
                {contributions.length === 0 && <tr><td colSpan={4} className="p-8 text-center text-[#424848]">No backers yet.</td></tr>}
                {contributions.map((c, idx) => (
                  <tr key={idx} className="border-b border-[#0B1D1D]/10 hover:bg-[#F9F7F2]">
                    <td className="p-3 font-mono text-xs text-[#0B1D1D]">{c.principal}</td>
                    <td className="p-3 text-right">{(Number(c.amount) / 1e6).toFixed(0)}</td>
                    <td className="p-3 text-right text-[#424848] text-xs">{new Date().toISOString().slice(0, 16)}</td>
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
        <div className="border border-[#0B1D1D]/10 p-6 bg-white mb-8">
          <div className="font-label-caps text-xs mb-3">CUSTODIAN ACTIONS (PRIMARY FLOW)</div>

          <div className="flex flex-wrap gap-3 mb-3">
            <button 
              onClick={async () => {
                const r = await fetch(`/api/projects/${projectId}/pool`, { method: "POST" });
                const d = await r.json();
                if (r.ok) { toast.success("Pooled to FlowVault"); window.open(d.explorerUrl, "_blank"); }
                else toast.error(d.error);
                await loadProject();
              }} 
              className="btn-secondary text-sm py-2">POOL INTO FLOWVAULT (LOCK 100%)</button>

            <button onClick={() => handleResolve(true)} className="btn-primary text-sm py-2">RESOLVE SUCCESS — 80% BUILDER / 20% PRO-RATA</button>
            <button onClick={() => handleResolve(false)} className="btn-secondary text-sm py-2">RESOLVE FAILURE — 100% REFUND</button>
          </div>

          <p className="text-xs mt-1 text-[#424848]">Pool executes set-routing-rules + deposit on custodian vault. Resolution calls withdraw then distributes. All txs logged.</p>

          {project.pooledExplorerUrl && <a href={project.pooledExplorerUrl} target="_blank" className="text-xs underline block mt-1">Pooled tx: {project.pooledTxid?.slice(0,10)} ↗</a>}
          {project.withdrawExplorerUrl && (
            <a href={project.withdrawExplorerUrl} target="_blank" className="block mt-1 text-xs underline">Withdraw tx ↗</a>
          )}
        </div>

        {/* Milestone details */}
        <div className="text-sm">
          <div className="font-label-caps text-xs text-[#424848]">MILESTONE</div>
          <div className="mt-1">{project.milestoneDescription}</div>
        </div>
      </main>
    </div>
  );
}

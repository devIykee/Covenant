"use client";

import Link from "next/link";
import { useState } from "react";
import { Wallet } from "lucide-react";

interface NavProps {
  showMyCovenants?: boolean;
}

export function Nav({ showMyCovenants = true }: NavProps) {
  const [isConnecting, setIsConnecting] = useState(false);

  const connectWallet = async () => {
    setIsConnecting(true);
    try {
      const { showConnect } = await import("@stacks/connect");
      showConnect({
        appDetails: {
          name: "Covenant",
          icon: "https://covenant.flow-vault.dev/icon.png", // placeholder
        },
        onFinish: () => {
          window.location.reload();
        },
        onCancel: () => {
          setIsConnecting(false);
        },
      });
    } catch (e) {
      console.error(e);
      setIsConnecting(false);
    }
  };

  return (
    <nav className="bg-[#F9F7F2] border-b border-[#0B1D1D]/10 sticky top-0 z-50">
      <div className="max-w-[1200px] mx-auto flex justify-between items-center px-6 py-4">
        <Link href="/" className="text-2xl font-bold tracking-tighter text-[#0B1D1D]">
          COVENANT
        </Link>

        <div className="hidden md:flex items-center gap-8">
          <Link href="/#vaults" className="font-label-caps text-xs tracking-[0.08em] text-[#424848] hover:text-[#0B1D1D] transition-colors">
            VAULTS
          </Link>
          {showMyCovenants && (
            <Link href="/projects" className="font-label-caps text-xs tracking-[0.08em] text-[#0B1D1D] border-b-2 border-[#0B1D1D] pb-0.5">
              MY COVENANTS
            </Link>
          )}
          <Link href="/#docs" className="font-label-caps text-xs tracking-[0.08em] text-[#424848] hover:text-[#0B1D1D] transition-colors">
            DOCS
          </Link>
        </div>

        <button
          onClick={connectWallet}
          disabled={isConnecting}
          className="wallet-btn text-xs disabled:opacity-60"
        >
          {isConnecting ? "CONNECTING..." : "CONNECT WALLET"}
        </button>
      </div>
    </nav>
  );
}

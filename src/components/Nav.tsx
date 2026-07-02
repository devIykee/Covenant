"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { Wallet, Sun, Moon, Copy, Check } from "lucide-react";

interface NavProps {
  showMyCovenants?: boolean;
}

export function Nav({ showMyCovenants = true }: NavProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  // Load saved address + theme on mount (auto-detect)
  useEffect(() => {
    const saved = localStorage.getItem('covenant-address');
    if (saved) setAddress(saved);

    const savedTheme = localStorage.getItem('covenant-theme') as 'light' | 'dark' | null;
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const initialTheme = savedTheme || (prefersDark ? 'dark' : 'light');
    setTheme(initialTheme);
    document.documentElement.classList.toggle('dark', initialTheme === 'dark');
  }, []);

  const saveAddress = (addr: string) => {
    setAddress(addr);
    localStorage.setItem('covenant-address', addr);
  };

  const connectWallet = async () => {
    setIsConnecting(true);
    try {
      const { showConnect } = await import("@stacks/connect");
      showConnect({
        appDetails: {
          name: "Covenant",
          icon: "https://covenant.flow-vault.dev/icon.png",
        },
        onFinish: (payload: any) => {
          const userData = payload?.userSession?.loadUserData?.();
          const stx = userData?.profile?.stxAddress?.testnet || 
                      userData?.profile?.stxAddress?.mainnet;
          if (stx) {
            saveAddress(stx);
          }
          setIsConnecting(false);
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

  const disconnect = () => {
    setAddress(null);
    localStorage.removeItem('covenant-address');
  };

  const copyAddress = async () => {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('covenant-theme', newTheme);
    document.documentElement.classList.toggle('dark', newTheme === 'dark');
  };

  const displayAddress = address 
    ? `${address.slice(0, 6)}...${address.slice(-4)}` 
    : null;

  return (
    <nav className="bg-[var(--parchment)] border-b border-[var(--ink)]/10 sticky top-0 z-50">
      <div className="max-w-[1200px] mx-auto flex justify-between items-center px-6 py-4">
        <Link href="/" className="text-2xl font-bold tracking-tighter text-[var(--ink)]">
          COVENANT
          <span className="ml-2 text-[10px] font-mono px-1.5 py-0.5 rounded bg-[var(--ink)]/10 text-[var(--ink)]">TESTNET</span>
        </Link>

        <div className="hidden md:flex items-center gap-8">
          <Link href="/#vaults" className="font-label-caps text-xs tracking-[0.08em] text-[var(--on-surface-variant)] hover:text-[var(--ink)] transition-colors">
            VAULTS
          </Link>
          {showMyCovenants && (
            <Link href="/projects" className="font-label-caps text-xs tracking-[0.08em] text-[var(--ink)] border-b-2 border-[var(--ink)] pb-0.5">
              MY COVENANTS
            </Link>
          )}
          <Link href="/#docs" className="font-label-caps text-xs tracking-[0.08em] text-[var(--on-surface-variant)] hover:text-[var(--ink)] transition-colors">
            DOCS
          </Link>
        </div>

        <div className="flex items-center gap-3">
          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded hover:bg-[var(--ink)]/10 transition-colors text-[var(--ink)]"
            aria-label="Toggle dark mode"
          >
            {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
          </button>

          {/* Wallet Section */}
          {address ? (
            <div className="flex items-center gap-2 bg-[var(--surface-container-low)] border border-[var(--ink)]/15 rounded px-3 py-1.5 text-xs font-data-sm">
              <Wallet size={14} className="text-[var(--brass)]" />
              <span className="text-[var(--ink)] font-medium">{displayAddress}</span>
              <button onClick={copyAddress} className="ml-1 p-1 hover:text-[var(--brass)] transition-colors" title="Copy address">
                {copied ? <Check size={13} /> : <Copy size={13} />}
              </button>
              <button 
                onClick={disconnect}
                className="ml-2 text-[10px] text-[var(--on-surface-variant)] hover:text-[var(--ink)] underline"
              >
                DISCONNECT
              </button>
            </div>
          ) : (
            <button
              onClick={connectWallet}
              disabled={isConnecting}
              className="wallet-btn text-xs disabled:opacity-60 flex items-center gap-2"
            >
              <Wallet size={14} />
              {isConnecting ? "CONNECTING..." : "CONNECT WALLET"}
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}

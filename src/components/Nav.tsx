"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Wallet, Sun, Moon, Copy, Check, Menu, X } from "lucide-react";

interface NavProps {
  showMyCovenants?: boolean;
}

export function Nav({ showMyCovenants = true }: NavProps) {
  const pathname = usePathname();
  const isActive = (prefix: string) => pathname === prefix || pathname.startsWith(prefix + "/");
  const [isConnecting, setIsConnecting] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [menuOpen, setMenuOpen] = useState(false);

  // Load saved address + theme on mount (auto-detect)
  useEffect(() => {
    // Restore from our own cache, then reconcile with @stacks/connect storage.
    const saved = localStorage.getItem('covenant-address');
    if (saved) setAddress(saved);
    (async () => {
      try {
        const { isConnected, getLocalStorage } = await import("@stacks/connect");
        if (isConnected()) {
          const stx = getLocalStorage()?.addresses?.stx?.[0]?.address;
          if (stx) saveAddress(stx);
        }
      } catch {
        /* ignore */
      }
    })();

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
      // @stacks/connect v8: connect() opens the wallet modal, persists to storage,
      // and returns the selected addresses. (v7's showConnect no longer exists.)
      const { connect, getLocalStorage } = await import("@stacks/connect");
      await connect();
      const stx = getLocalStorage()?.addresses?.stx?.[0]?.address;
      if (stx) {
        saveAddress(stx);
      } else {
        toast.error("Connected, but no Stacks address was returned. Set your wallet to Testnet and try again.");
      }
    } catch (e: any) {
      // User cancelling the modal also throws — keep it quiet unless it's a real error.
      if (e?.message && !/reject|cancel|close/i.test(e.message)) {
        console.error(e);
        toast.error("Could not connect wallet. Is a Stacks wallet (Xverse/Leather) installed?");
      }
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnect = async () => {
    try {
      const { disconnect: disconnectWallet } = await import("@stacks/connect");
      disconnectWallet();
    } catch {
      /* ignore */
    }
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
          <Link
            href="/vaults"
            className={`font-label-caps text-xs tracking-[0.08em] pb-0.5 transition-colors ${
              isActive("/vaults")
                ? "text-[var(--ink)] border-b-2 border-[var(--ink)]"
                : "text-[var(--on-surface-variant)] hover:text-[var(--ink)]"
            }`}
          >
            VAULTS
          </Link>
          <Link
            href="/projects"
            className={`font-label-caps text-xs tracking-[0.08em] pb-0.5 transition-colors ${
              isActive("/projects")
                ? "text-[var(--ink)] border-b-2 border-[var(--ink)]"
                : "text-[var(--on-surface-variant)] hover:text-[var(--ink)]"
            }`}
          >
            MY COVENANTS
          </Link>
          <Link
            href="/docs"
            className={`font-label-caps text-xs tracking-[0.08em] pb-0.5 transition-colors ${
              isActive("/docs")
                ? "text-[var(--ink)] border-b-2 border-[var(--ink)]"
                : "text-[var(--on-surface-variant)] hover:text-[var(--ink)]"
            }`}
          >
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

          {/* Mobile menu toggle */}
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="md:hidden p-2 rounded hover:bg-[var(--ink)]/10 transition-colors text-[var(--ink)]"
            aria-label="Toggle menu"
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X size={18} /> : <Menu size={18} />}
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

      {/* Mobile dropdown menu */}
      {menuOpen && (
        <div className="md:hidden border-t border-[var(--ink)]/10 bg-[var(--parchment)] px-6 py-4 flex flex-col gap-4">
          <Link href="/vaults" onClick={() => setMenuOpen(false)} className={`font-label-caps text-sm tracking-[0.08em] ${isActive("/vaults") ? "text-[var(--brass)]" : "text-[var(--ink)]"}`}>
            VAULTS
          </Link>
          <Link href="/projects" onClick={() => setMenuOpen(false)} className={`font-label-caps text-sm tracking-[0.08em] ${isActive("/projects") ? "text-[var(--brass)]" : "text-[var(--ink)]"}`}>
            MY COVENANTS
          </Link>
          <Link href="/docs" onClick={() => setMenuOpen(false)} className={`font-label-caps text-sm tracking-[0.08em] ${isActive("/docs") ? "text-[var(--brass)]" : "text-[var(--ink)]"}`}>
            DOCS
          </Link>
        </div>
      )}
    </nav>
  );
}

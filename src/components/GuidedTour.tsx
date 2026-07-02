"use client";

import { useEffect, useState, useCallback } from "react";
import { X, ArrowLeft, ArrowRight, HelpCircle } from "lucide-react";

export interface TourStep {
  selector: string; // CSS selector of the element to highlight
  title: string;
  body: string;
}

interface GuidedTourProps {
  steps: TourStep[];
  storageKey: string; // localStorage key so it only auto-runs once
  autoStart?: boolean;
}

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

/**
 * Lightweight spotlight tour: dims the page, highlights one element at a time,
 * and shows a popover explaining what it is and what to do. Auto-runs once per
 * browser (tracked via storageKey); can be replayed with the floating "?" button.
 */
export function GuidedTour({ steps, storageKey, autoStart = true }: GuidedTourProps) {
  const [active, setActive] = useState(false);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);

  const measure = useCallback(() => {
    const step = steps[index];
    if (!step) return;
    const el = document.querySelector(step.selector) as HTMLElement | null;
    if (!el) {
      setRect(null);
      return;
    }
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    const r = el.getBoundingClientRect();
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
  }, [steps, index]);

  // Auto-start once
  useEffect(() => {
    if (!autoStart) return;
    try {
      if (!localStorage.getItem(storageKey)) {
        const t = setTimeout(() => setActive(true), 500);
        return () => clearTimeout(t);
      }
    } catch {
      /* ignore */
    }
  }, [autoStart, storageKey]);

  // Re-measure when active/step changes, and on resize/scroll
  useEffect(() => {
    if (!active) return;
    measure();
    const onChange = () => measure();
    window.addEventListener("resize", onChange);
    window.addEventListener("scroll", onChange, true);
    const t = setInterval(measure, 300); // keep aligned as layout settles
    return () => {
      window.removeEventListener("resize", onChange);
      window.removeEventListener("scroll", onChange, true);
      clearInterval(t);
    };
  }, [active, measure]);

  const finish = () => {
    setActive(false);
    setIndex(0);
    try {
      localStorage.setItem(storageKey, "1");
    } catch {
      /* ignore */
    }
  };

  const start = () => {
    setIndex(0);
    setActive(true);
  };

  const next = () => (index < steps.length - 1 ? setIndex(index + 1) : finish());
  const prev = () => setIndex(Math.max(0, index - 1));

  // Floating replay button (always available)
  const replayButton = (
    <button
      onClick={start}
      className="fixed bottom-6 right-6 z-40 flex items-center gap-2 px-4 py-2.5 rounded-full bg-[var(--ink)] text-[var(--parchment)] shadow-lg hover:opacity-90 transition-opacity text-xs font-label-caps"
      aria-label="Show me around"
    >
      <HelpCircle size={16} />
      SHOW ME AROUND
    </button>
  );

  if (!active) return replayButton;

  const step = steps[index];
  const pad = 8;

  // Popover placement: below the target if room, otherwise above.
  const spaceBelow = rect ? window.innerHeight - (rect.top + rect.height) : 0;
  const placeBelow = !rect || spaceBelow > 220;
  const popoverTop = rect
    ? placeBelow
      ? rect.top + rect.height + pad + 6
      : Math.max(12, rect.top - pad - 6 - 190)
    : window.innerHeight / 2 - 90;
  const popoverLeft = rect
    ? Math.min(Math.max(12, rect.left), window.innerWidth - 340)
    : window.innerWidth / 2 - 160;

  return (
    <>
      {/* Spotlight: transparent hole over the target with a giant dimming shadow */}
      {rect && (
        <div
          className="fixed z-[60] pointer-events-none rounded-md"
          style={{
            top: rect.top - pad,
            left: rect.left - pad,
            width: rect.width + pad * 2,
            height: rect.height + pad * 2,
            boxShadow: "0 0 0 9999px rgba(6, 12, 12, 0.62)",
            border: "2px solid var(--brass)",
            transition: "all 0.2s ease",
          }}
        />
      )}
      {/* Backdrop click-catcher (skip on click outside) */}
      <div className="fixed inset-0 z-[59]" onClick={finish} />

      {/* Popover */}
      <div
        className="fixed z-[61] w-[320px] max-w-[calc(100vw-24px)] bg-[var(--parchment)] border border-[var(--ink)]/20 rounded-md shadow-2xl p-5"
        style={{ top: popoverTop, left: popoverLeft }}
        role="dialog"
      >
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="font-label-caps text-[10px] text-[var(--on-surface-variant)]">
            STEP {index + 1} / {steps.length}
          </div>
          <button onClick={finish} className="text-[var(--on-surface-variant)] hover:text-[var(--ink)]" aria-label="Close tour">
            <X size={16} />
          </button>
        </div>
        <h4 className="font-headline-md text-base mb-1.5 text-[var(--ink)]">{step.title}</h4>
        <p className="text-sm text-[var(--on-surface-variant)] mb-4">{step.body}</p>
        <div className="flex items-center justify-between">
          <button onClick={finish} className="text-xs text-[var(--on-surface-variant)] underline hover:text-[var(--ink)]">
            Skip
          </button>
          <div className="flex items-center gap-2">
            {index > 0 && (
              <button onClick={prev} className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1">
                <ArrowLeft size={13} /> Back
              </button>
            )}
            <button onClick={next} className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1">
              {index === steps.length - 1 ? "Done" : "Next"}
              {index < steps.length - 1 && <ArrowRight size={13} />}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

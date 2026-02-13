'use client';

import { useEffect, useCallback, useState } from 'react';
import { useTroutStore } from '@/lib/store';
import type { TroutData } from '@/types';

const TIER_LABELS: Record<number, string> = {
  1: 'Minnow',
  2: 'Fingerling',
  3: 'Yearling',
  4: 'Adult',
  5: 'Trophy',
  6: 'Legendary',
};

export default function TroutTooltip() {
  const selectedTrout = useTroutStore((s) => s.selectedTrout);
  const troutMap = useTroutStore((s) => s.troutMap);
  const setSelectedTrout = useTroutStore((s) => s.setSelectedTrout);
  const [copied, setCopied] = useState(false);
  const [following, setFollowing] = useState(false);

  const trout: TroutData | undefined = selectedTrout
    ? troutMap.get(selectedTrout)
    : undefined;

  // Dismiss on Escape
  useEffect(() => {
    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setSelectedTrout(null);
      }
    }
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [setSelectedTrout]);

  // Dismiss on click outside
  const handleBackdropClick = useCallback(() => {
    setSelectedTrout(null);
  }, [setSelectedTrout]);

  const copyAddress = useCallback(async () => {
    if (!trout) return;
    try {
      await navigator.clipboard.writeText(trout.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select text approach is not available in overlay
    }
  }, [trout]);

  const toggleFollow = useCallback(() => {
    if (!following && trout) {
      const { setCamera } = useTroutStore.getState();
      setCamera({ targetX: trout.x, targetY: trout.y, targetZoom: 2 });
    }
    setFollowing((prev) => !prev);
  }, [following, trout]);

  // Follow loop: continuously pan camera to trout position
  useEffect(() => {
    if (!following || !selectedTrout) return;
    const interval = setInterval(() => {
      const state = useTroutStore.getState();
      const t = state.troutMap.get(selectedTrout);
      if (t) {
        state.setCamera({ targetX: t.x, targetY: t.y });
      }
    }, 200);
    return () => clearInterval(interval);
  }, [following, selectedTrout]);

  if (!trout || !selectedTrout) return null;

  return (
    <>
      {/* Invisible click catcher */}
      <div
        className="fixed inset-0 z-20"
        onClick={handleBackdropClick}
      />

      {/* Tooltip panel */}
      <div
        className="fixed top-4 right-4 z-30 w-72 bg-black/70 backdrop-blur-md rounded-lg border border-white/10 p-4 font-mono text-sm pointer-events-auto md:top-16"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-white font-bold truncate flex-1">
            {trout.displayName ?? shortenAddress(trout.address)}
          </h3>
          <button
            onClick={() => setSelectedTrout(null)}
            className="text-white/40 hover:text-white ml-2 text-lg leading-none"
            aria-label="Close"
          >
            x
          </button>
        </div>

        {/* Address */}
        <button
          onClick={copyAddress}
          className="w-full text-left text-white/60 text-xs bg-white/5 rounded px-2 py-1 hover:bg-white/10 transition truncate mb-3"
          title="Click to copy"
        >
          {copied ? 'Copied!' : trout.address}
        </button>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <StatItem label="Balance" value={trout.balance.toLocaleString()} />
          <StatItem label="Days Held" value={trout.daysHeld.toString()} />
          <StatItem label="Rank" value={`#${trout.rank}`} />
          <StatItem label="Tier" value={TIER_LABELS[trout.tier] ?? `Tier ${trout.tier}`} />
        </div>

        {/* Score */}
        <div className="text-white/40 text-xs mb-3">
          Score: {trout.score.toFixed(2)}
        </div>

        {/* Follow button */}
        <button
          onClick={toggleFollow}
          className={`w-full py-1.5 rounded text-xs font-bold transition ${
            following
              ? 'bg-emerald-600 text-white hover:bg-emerald-500'
              : 'bg-white/10 text-white/70 hover:bg-white/20 hover:text-white'
          }`}
        >
          {following ? 'Following' : 'Follow this trout'}
        </button>
      </div>
    </>
  );
}

function StatItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white/5 rounded px-2 py-1.5">
      <div className="text-white/40 text-[10px] uppercase tracking-wider">{label}</div>
      <div className="text-white text-xs mt-0.5">{value}</div>
    </div>
  );
}

function shortenAddress(addr: string): string {
  return addr.slice(0, 4) + '...' + addr.slice(-4);
}

'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import useSWR from 'swr';
import { useTroutStore } from '@/lib/store';
import type { LeaderboardEntry, LeaderboardResponse } from '@/types';

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`API error: ${r.status}`);
    return r.json();
  });

export default function SearchBar() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const setSelectedTrout = useTroutStore((s) => s.setSelectedTrout);
  const setSearchQuery = useTroutStore((s) => s.setSearchQuery);
  const troutMap = useTroutStore((s) => s.troutMap);

  const debouncedQuery = useDebounce(query, 300);

  const { data } = useSWR<LeaderboardResponse>(
    debouncedQuery.length >= 2
      ? `/api/leaderboard?search=${encodeURIComponent(debouncedQuery)}&limit=8`
      : null,
    fetcher,
    { keepPreviousData: true }
  );

  const results = data?.entries ?? [];

  const handleSelect = useCallback(
    (entry: LeaderboardEntry) => {
      setSelectedTrout(entry.address);
      setSearchQuery(entry.address);

      // Pan camera to trout if we have its position
      const trout = troutMap.get(entry.address);
      if (trout) {
        const { setCamera } = useTroutStore.getState();
        setCamera({ targetX: trout.x, targetY: trout.y, targetZoom: 2 });
      }

      setQuery('');
      setOpen(false);
    },
    [setSelectedTrout, setSearchQuery, troutMap]
  );

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setFocused(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close on Escape
  useEffect(() => {
    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setFocused(false);
        setOpen(false);
        inputRef.current?.blur();
      }
    }
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, []);

  if (!open) {
    return (
      <button
        onClick={() => {
          setOpen(true);
          setTimeout(() => inputRef.current?.focus(), 50);
        }}
        className="bg-black/40 backdrop-blur-sm text-white/80 text-sm px-3 py-1.5 rounded-md font-mono hover:bg-black/60 transition"
      >
        Search...
      </button>
    );
  }

  return (
    <div ref={containerRef} className="relative w-64 md:w-80">
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setFocused(true)}
        placeholder="Search by address or name..."
        className="w-full bg-black/60 backdrop-blur-sm text-white text-sm px-3 py-1.5 rounded-md font-mono placeholder:text-white/40 outline-none border border-white/10 focus:border-emerald-500/50 transition"
      />
      <button
        onClick={() => {
          setOpen(false);
          setQuery('');
        }}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/80 text-xs font-mono"
      >
        ESC
      </button>

      {focused && results.length > 0 && (
        <div className="absolute top-full mt-1 left-0 right-0 bg-black/80 backdrop-blur-md rounded-md border border-white/10 overflow-hidden z-50 max-h-64 overflow-y-auto">
          {results.map((entry) => (
            <button
              key={entry.address}
              onClick={() => handleSelect(entry)}
              className="w-full text-left px-3 py-2 text-sm font-mono hover:bg-white/10 transition flex items-center justify-between gap-2"
            >
              <span className="text-white truncate">
                {entry.displayName ?? shortenAddress(entry.address)}
              </span>
              <span className="text-white/40 text-xs flex-shrink-0">
                #{entry.rank}
              </span>
            </button>
          ))}
        </div>
      )}

      {focused && debouncedQuery.length >= 2 && results.length === 0 && (
        <div className="absolute top-full mt-1 left-0 right-0 bg-black/80 backdrop-blur-md rounded-md border border-white/10 p-3 z-50">
          <p className="text-white/40 text-sm font-mono text-center">
            No trouts found
          </p>
        </div>
      )}
    </div>
  );
}

function shortenAddress(addr: string): string {
  return addr.slice(0, 4) + '...' + addr.slice(-4);
}

function useDebounce(value: string, delay: number): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

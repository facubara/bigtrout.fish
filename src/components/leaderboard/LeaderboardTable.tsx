'use client';

import { useState, useRef, useEffect } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import type { LeaderboardResponse, LeaderboardEntry } from '@/types';

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`API error: ${r.status}`);
    return r.json();
  });

const TIER_LABELS: Record<number, string> = {
  1: 'Minnow',
  2: 'Fingerling',
  3: 'Yearling',
  4: 'Adult',
  5: 'Trophy',
  6: 'Legendary',
};

const TIER_COLORS: Record<number, string> = {
  1: 'text-sky-300',
  2: 'text-teal-300',
  3: 'text-green-300',
  4: 'text-yellow-300',
  5: 'text-orange-300',
  6: 'text-red-300',
};

export default function LeaderboardTable() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);

  // Reset page when search changes
  const prevSearch = useRef(debouncedSearch);
  useEffect(() => {
    if (prevSearch.current !== debouncedSearch) {
      prevSearch.current = debouncedSearch;
      setPage(1);
    }
  }, [debouncedSearch]);

  const queryString = buildQueryString(page, debouncedSearch);
  const { data, isLoading, error } = useSWR<LeaderboardResponse>(
    `/api/leaderboard${queryString}`,
    fetcher,
    { keepPreviousData: true }
  );

  const entries = data?.entries ?? [];
  const totalPages = data?.totalPages ?? 1;
  const totalEntries = data?.totalEntries ?? 0;

  return (
    <div className="w-full">
      {/* Search */}
      <div className="mb-4 flex items-center gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by address or name..."
          className="flex-1 bg-white/5 text-white text-sm px-3 py-2 rounded-md font-mono placeholder:text-white/30 outline-none border border-white/10 focus:border-emerald-500/50 transition"
        />
        <span className="text-white/40 text-xs font-mono flex-shrink-0">
          {totalEntries.toLocaleString()} total
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-white/10">
        <table className="w-full text-sm font-mono">
          <thead>
            <tr className="bg-white/5 text-white/60 text-xs uppercase tracking-wider">
              <th className="text-left px-4 py-3 w-16">Rank</th>
              <th className="text-left px-4 py-3">Name / Address</th>
              <th className="text-right px-4 py-3 hidden sm:table-cell">Tokens</th>
              <th className="text-right px-4 py-3 hidden md:table-cell">Days</th>
              <th className="text-right px-4 py-3">Score</th>
              <th className="text-center px-4 py-3 hidden sm:table-cell">Tier</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && entries.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-white/40">
                  Loading...
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-red-400">
                  Failed to load leaderboard
                </td>
              </tr>
            ) : entries.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-white/40">
                  No trouts found
                </td>
              </tr>
            ) : (
              entries.map((entry) => (
                <LeaderboardRow key={entry.address} entry={entry} />
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="bg-white/5 text-white/60 px-3 py-1.5 rounded text-xs font-mono hover:bg-white/10 transition disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Prev
          </button>
          <span className="text-white/40 text-xs font-mono">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="bg-white/5 text-white/60 px-3 py-1.5 rounded text-xs font-mono hover:bg-white/10 transition disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

function LeaderboardRow({ entry }: { entry: LeaderboardEntry }) {
  return (
    <tr className="border-t border-white/5 hover:bg-white/5 transition">
      <td className="px-4 py-3 text-white/60">#{entry.rank}</td>
      <td className="px-4 py-3">
        <Link
          href={`/?trout=${entry.address}`}
          className="hover:text-emerald-400 transition"
        >
          <span className="text-white">
            {entry.displayName ?? shortenAddress(entry.address)}
          </span>
          {entry.displayName && (
            <span className="text-white/30 text-xs ml-2 hidden lg:inline">
              {shortenAddress(entry.address)}
            </span>
          )}
        </Link>
      </td>
      <td className="px-4 py-3 text-right text-white/70 hidden sm:table-cell">
        {entry.balance.toLocaleString()}
      </td>
      <td className="px-4 py-3 text-right text-white/70 hidden md:table-cell">
        {entry.daysHeld}
      </td>
      <td className="px-4 py-3 text-right text-white/90">
        {entry.score.toFixed(1)}
      </td>
      <td className="px-4 py-3 text-center hidden sm:table-cell">
        <span className={`text-xs ${TIER_COLORS[entry.tier] ?? 'text-white/50'}`}>
          {TIER_LABELS[entry.tier] ?? `T${entry.tier}`}
        </span>
      </td>
    </tr>
  );
}

function buildQueryString(page: number, search: string): string {
  const params = new URLSearchParams();
  params.set('page', page.toString());
  params.set('limit', '50');
  if (search.trim()) {
    params.set('search', search.trim());
  }
  return `?${params.toString()}`;
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

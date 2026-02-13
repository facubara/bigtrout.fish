import Link from 'next/link';
import LeaderboardTable from '@/components/leaderboard/LeaderboardTable';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Leaderboard - Big Trout Fish',
  description: 'See the biggest trouts. Rankings by trout size across all token holders.',
};

export default function LeaderboardPage() {
  return (
    <div className="min-h-screen bg-[#0a0f14] text-white font-[family-name:var(--font-mono)]">
      {/* Header */}
      <header className="border-b border-white/10 bg-black/30 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-white/60 hover:text-white text-sm font-mono transition"
            >
              &larr; Back
            </Link>
            <h1 className="text-white font-bold text-lg font-mono">
              Leaderboard
            </h1>
          </div>
          <Link
            href="/"
            className="text-emerald-400/80 hover:text-emerald-400 text-sm font-mono transition"
          >
            View River
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-5xl mx-auto px-4 py-6">
        <LeaderboardTable />
      </main>
    </div>
  );
}

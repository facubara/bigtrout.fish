'use client';

import { useTroutStore } from '@/lib/store';

export default function StatsBar() {
  const isLoading = useTroutStore((s) => s.isLoading);
  const totalCount = useTroutStore((s) => s.totalCount);
  const quality = useTroutStore((s) => s.quality);

  return (
    <div className="pointer-events-auto">
      <div className="bg-black/40 backdrop-blur-sm text-white/70 text-xs px-3 py-1.5 rounded-md font-mono">
        {isLoading ? (
          <span className="animate-pulse">Counting trouts...</span>
        ) : (
          <>
            <span className="text-white/90">
              {totalCount.toLocaleString()}
            </span>{' '}
            trouts swimming
            <QualityBadge quality={quality} />
          </>
        )}
      </div>
    </div>
  );
}

function QualityBadge({ quality }: { quality: string }) {
  const colors: Record<string, string> = {
    low: 'text-yellow-400/60',
    medium: 'text-blue-400/60',
    high: 'text-emerald-400/60',
  };

  return (
    <span className={`ml-2 ${colors[quality] ?? 'text-white/40'}`}>
      [{quality}]
    </span>
  );
}

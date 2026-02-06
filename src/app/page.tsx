"use client";

import dynamic from "next/dynamic";
import { useTroutStore } from "@/lib/store";
import { useDeviceCapability } from "@/hooks/useDeviceCapability";

// Lazy-load TroutScene to avoid SSR issues with PixiJS
const TroutScene = dynamic(
  () => import("@/components/canvas/TroutScene"),
  { ssr: false }
);

export default function Home() {
  useDeviceCapability();

  const isLoading = useTroutStore((s) => s.isLoading);
  const totalCount = useTroutStore((s) => s.totalCount);
  const quality = useTroutStore((s) => s.quality);

  return (
    <main className="relative w-screen h-screen overflow-hidden">
      {/* PixiJS canvas (fullscreen background) */}
      <TroutScene />

      {/* UI Overlay */}
      <div className="fixed inset-0 pointer-events-none z-10">
        {/* Top bar */}
        <div className="flex items-center justify-between p-4">
          <div className="pointer-events-auto">
            <h1 className="text-white font-mono text-lg font-bold drop-shadow-lg">
              Big Trout Fish
            </h1>
          </div>

          <div className="flex items-center gap-3 pointer-events-auto">
            <button className="bg-black/40 backdrop-blur-sm text-white/80 text-sm px-3 py-1.5 rounded-md font-mono hover:bg-black/60 transition">
              Search...
            </button>
            <button className="bg-emerald-600/80 backdrop-blur-sm text-white text-sm px-3 py-1.5 rounded-md font-mono hover:bg-emerald-500/80 transition">
              Find My Trout
            </button>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="absolute bottom-0 left-0 right-0 p-4 flex items-end justify-between">
          <div className="pointer-events-auto">
            <div className="bg-black/40 backdrop-blur-sm text-white/70 text-xs px-3 py-1.5 rounded-md font-mono">
              {isLoading ? (
                "Counting trouts..."
              ) : (
                <>
                  {totalCount.toLocaleString()} trouts swimming
                  <span className="text-white/40 ml-2">[{quality}]</span>
                </>
              )}
            </div>
          </div>

          <div className="pointer-events-auto flex flex-col gap-1">
            <button className="bg-black/40 backdrop-blur-sm text-white w-8 h-8 rounded-md font-mono text-lg hover:bg-black/60 transition flex items-center justify-center">
              +
            </button>
            <button className="bg-black/40 backdrop-blur-sm text-white w-8 h-8 rounded-md font-mono text-lg hover:bg-black/60 transition flex items-center justify-center">
              -
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}

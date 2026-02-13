"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useDeviceCapability } from "@/hooks/useDeviceCapability";
import SearchBar from "@/components/overlay/SearchBar";
import TroutTooltip from "@/components/overlay/TroutTooltip";
import WalletConnect from "@/components/overlay/WalletConnect";
import StatsBar from "@/components/overlay/StatsBar";
import ScreenshotButton from "@/components/overlay/ScreenshotButton";
import ZoomControls from "@/components/overlay/ZoomControls";
import NamingModal from "@/components/overlay/NamingModal";

// Lazy-load TroutScene to avoid SSR issues with PixiJS
const TroutScene = dynamic(
  () => import("@/components/canvas/TroutScene"),
  { ssr: false }
);

export default function Home() {
  useDeviceCapability();

  return (
    <main className="relative w-screen h-screen overflow-hidden">
      {/* PixiJS canvas (fullscreen background) */}
      <TroutScene />

      {/* UI Overlay */}
      <div className="fixed inset-0 pointer-events-none z-10">
        {/* Top bar */}
        <div className="flex items-center justify-between p-4">
          <div className="pointer-events-auto flex items-center gap-3">
            <h1 className="text-white font-mono text-lg font-bold drop-shadow-lg">
              Big Trout Fish
            </h1>
            <Link
              href="/leaderboard"
              className="bg-black/40 backdrop-blur-sm text-white/70 text-xs px-2 py-1 rounded font-mono hover:bg-black/60 hover:text-white/90 transition hidden md:inline-block"
            >
              Leaderboard
            </Link>
          </div>

          <div className="flex items-center gap-3 pointer-events-auto">
            <SearchBar />
            <WalletConnect />
          </div>
        </div>

        {/* Bottom bar */}
        <div className="absolute bottom-0 left-0 right-0 p-4 flex items-end justify-between">
          <div className="flex items-center gap-2">
            <StatsBar />
            <ScreenshotButton />
          </div>

          <ZoomControls />
        </div>
      </div>

      {/* Floating overlays (outside the pointer-events-none container) */}
      <TroutTooltip />
      <NamingModal />
    </main>
  );
}

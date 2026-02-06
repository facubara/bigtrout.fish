"use client";

import { useEffect } from "react";
import { useTroutStore } from "@/lib/store";
import type { QualityLevel } from "@/types";

export function useDeviceCapability() {
  const setQuality = useTroutStore((s) => s.setQuality);

  useEffect(() => {
    const cores = navigator.hardwareConcurrency ?? 4;
    const memory = (navigator as unknown as { deviceMemory?: number }).deviceMemory;
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    const screenWidth = window.innerWidth;

    let quality: QualityLevel;
    if (isMobile || cores <= 2 || screenWidth < 768) {
      quality = "low";
    } else if (cores <= 4 || (memory !== undefined && memory <= 4)) {
      quality = "medium";
    } else {
      quality = "high";
    }

    setQuality(quality);
  }, [setQuality]);
}

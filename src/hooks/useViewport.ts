"use client";

import { useEffect, useCallback } from "react";
import { useTroutStore } from "@/lib/store";
import { getVisibleBounds, type Camera } from "@/components/canvas/Camera";
import type { AABB } from "@/types";

/**
 * Hook that syncs the camera state from the store to the Web Worker viewport.
 * Also handles deep link navigation for ?trout=address.
 */
export function useViewport(
  worker: Worker | null,
  cameraRef: React.RefObject<Camera | null>
) {
  const selectedTrout = useTroutStore((s) => s.selectedTrout);
  const setSelectedTrout = useTroutStore((s) => s.setSelectedTrout);
  const troutMap = useTroutStore((s) => s.troutMap);

  // Handle deep link: ?trout=address
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const troutAddr = params.get("trout");
    if (troutAddr) {
      setSelectedTrout(troutAddr);
    }
  }, [setSelectedTrout]);

  // When a trout is selected and camera is available, navigate to it
  useEffect(() => {
    if (!selectedTrout || !cameraRef.current) return;
    const trout = troutMap.get(selectedTrout);
    if (trout) {
      const cam = cameraRef.current;
      cam.targetX = trout.x;
      cam.targetY = trout.y;
      if (cam.targetZoom < 1.5) cam.targetZoom = 1.5;
    }
  }, [selectedTrout, troutMap, cameraRef]);

  // Send viewport bounds to worker when camera updates
  const sendViewport = useCallback(
    (bounds: AABB) => {
      if (worker) {
        worker.postMessage({ type: "SET_VIEWPORT", payload: bounds });
      }
    },
    [worker]
  );

  return { sendViewport };
}

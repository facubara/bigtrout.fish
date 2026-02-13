'use client';

import { useCallback } from 'react';
import { useTroutStore } from '@/lib/store';

import { ZOOM_MIN, ZOOM_MAX } from '@/components/canvas/Camera';

const ZOOM_STEP = 0.25;

export default function ZoomControls() {
  const setCamera = useTroutStore((s) => s.setCamera);
  const camera = useTroutStore((s) => s.camera);

  const zoomIn = useCallback(() => {
    const next = Math.min(camera.targetZoom + ZOOM_STEP, ZOOM_MAX);
    setCamera({ targetZoom: next });
  }, [camera.targetZoom, setCamera]);

  const zoomOut = useCallback(() => {
    const next = Math.max(camera.targetZoom - ZOOM_STEP, ZOOM_MIN);
    setCamera({ targetZoom: next });
  }, [camera.targetZoom, setCamera]);

  return (
    <div className="pointer-events-auto flex flex-col gap-1">
      <button
        onClick={zoomIn}
        className="bg-black/40 backdrop-blur-sm text-white w-8 h-8 rounded-md font-mono text-lg hover:bg-black/60 transition flex items-center justify-center active:scale-95"
        aria-label="Zoom in"
      >
        +
      </button>
      <button
        onClick={zoomOut}
        className="bg-black/40 backdrop-blur-sm text-white w-8 h-8 rounded-md font-mono text-lg hover:bg-black/60 transition flex items-center justify-center active:scale-95"
        aria-label="Zoom out"
      >
        -
      </button>
    </div>
  );
}

"use client";

import { useEffect, useRef, useCallback } from "react";

/**
 * Hook that manages the Web Worker lifecycle for the trout simulation.
 * Returns a ref to the Worker for TroutScene to use,
 * plus functions to load trout data into it.
 */
export function useSimulation() {
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  const initWorker = useCallback((worldWidth: number, worldHeight: number): Worker => {
    if (workerRef.current) {
      workerRef.current.terminate();
    }

    const worker = new Worker(
      new URL("../workers/trout-simulation.worker.ts", import.meta.url)
    );
    worker.postMessage({
      type: "INIT",
      payload: { worldWidth, worldHeight },
    });
    workerRef.current = worker;
    return worker;
  }, []);

  return { workerRef, initWorker };
}

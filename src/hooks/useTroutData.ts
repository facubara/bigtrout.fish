"use client";

import { useEffect, useCallback, useRef } from "react";
import useSWR from "swr";
import { useTroutStore } from "@/lib/store";
import type { TroutsResponse, StatsResponse } from "@/types";

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`API error: ${r.status}`);
    return r.json();
  });

export function useTroutData(worker: Worker | null) {
  const setTrouts = useTroutStore((s) => s.setTrouts);
  const addTrouts = useTroutStore((s) => s.addTrouts);
  const setTotalCount = useTroutStore((s) => s.setTotalCount);
  const setLoading = useTroutStore((s) => s.setLoading);
  const loadedRef = useRef(false);

  // Fetch stats for total count
  const { data: stats } = useSWR<StatsResponse>("/api/stats", fetcher, {
    refreshInterval: 60_000,
  });

  useEffect(() => {
    if (stats?.totalHolders) {
      setTotalCount(stats.totalHolders);
    }
  }, [stats, setTotalCount]);

  // Load all trout data in pages
  const loadAllTrouts = useCallback(async () => {
    if (!worker || loadedRef.current) return;
    loadedRef.current = true;
    setLoading(true);

    let cursor: string | null = null;
    let allTrouts: TroutsResponse["trouts"] = [];

    try {
      do {
        const url = cursor
          ? `/api/trouts?limit=1000&cursor=${cursor}`
          : "/api/trouts?limit=1000";
        const res = await fetch(url);
        if (!res.ok) break;
        const data: TroutsResponse = await res.json();

        if (data.trouts && data.trouts.length > 0) {
          allTrouts = allTrouts.concat(data.trouts);
          addTrouts(data.trouts);

          // Stream to worker as we receive batches
          worker.postMessage({
            type: "LOAD_TROUTS",
            payload: data.trouts,
          });
        }

        cursor = data.nextCursor;
      } while (cursor);

      setTrouts(allTrouts);
    } finally {
      setLoading(false);
    }
  }, [worker, setTrouts, addTrouts, setLoading]);

  useEffect(() => {
    loadAllTrouts();
  }, [loadAllTrouts]);

  return { stats, isLoading: useTroutStore((s) => s.isLoading) };
}

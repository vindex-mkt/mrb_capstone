"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const SERVER_TIME_SYNC_INTERVAL_MS = 30_000;
const TIMER_TICK_INTERVAL_MS = 1_000;

type SynchronizedTimer = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalSeconds: number | null;
  isExpired: boolean;
  isSynced: boolean;
  syncError: string | null;
};

function parseServerTime(value: unknown): number | null {
  const parsed = typeof value === "number"
    ? value
    : typeof value === "string" && value.trim() !== ""
      ? Number(value)
      : Number.NaN;

  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

export function useSynchronizedTimer(endsAt: string | null): SynchronizedTimer {
  const [supabase] = useState(createClient);
  const [serverNowMs, setServerNowMs] = useState<number | null>(null);
  const [isSynced, setIsSynced] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  useEffect(() => {
    let isCurrent = true;
    let syncInProgress = false;
    let serverOffsetMs: number | null = null;

    const updateServerNow = () => {
      if (serverOffsetMs === null || !isCurrent) return;
      setServerNowMs(serverOffsetMs + performance.now());
    };

    const synchronize = async () => {
      if (syncInProgress || !isCurrent) return;
      syncInProgress = true;
      const requestStartedAt = performance.now();

      try {
        const { data, error } = await supabase.rpc("get_server_time");
        const responseReceivedAt = performance.now();
        if (error) throw error;

        const serverTimeMs = parseServerTime(data);
        if (serverTimeMs === null) {
          throw new Error("La RPC get_server_time devolvió un timestamp inválido.");
        }

        if (!isCurrent) return;
        const midpoint = (requestStartedAt + responseReceivedAt) / 2;
        serverOffsetMs = serverTimeMs - midpoint;
        setIsSynced(true);
        setSyncError(null);
        updateServerNow();
      } catch (error) {
        if (!isCurrent) return;
        const message = error instanceof Error ? error.message : "Error desconocido";
        console.error("No se pudo sincronizar la hora con Supabase:", error);
        setSyncError(message);
      } finally {
        syncInProgress = false;
      }
    };

    void synchronize();
    const timerInterval = window.setInterval(updateServerNow, TIMER_TICK_INTERVAL_MS);
    const syncInterval = window.setInterval(() => void synchronize(), SERVER_TIME_SYNC_INTERVAL_MS);

    return () => {
      isCurrent = false;
      window.clearInterval(timerInterval);
      window.clearInterval(syncInterval);
    };
  }, [supabase]);

  const endTimeMs = endsAt ? Date.parse(endsAt) : Number.NaN;
  const totalSeconds = isSynced && serverNowMs !== null && Number.isFinite(endTimeMs)
    ? Math.max(0, Math.floor((endTimeMs - serverNowMs) / 1_000))
    : null;

  return {
    days: totalSeconds === null ? 0 : Math.floor(totalSeconds / 86_400),
    hours: totalSeconds === null ? 0 : Math.floor((totalSeconds % 86_400) / 3_600),
    minutes: totalSeconds === null ? 0 : Math.floor((totalSeconds % 3_600) / 60),
    seconds: totalSeconds === null ? 0 : totalSeconds % 60,
    totalSeconds,
    isExpired: totalSeconds === 0,
    isSynced,
    syncError,
  };
}

"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";

export function useAuctionCountdown(endsAt: string | null) {
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);

  useEffect(() => {
    const endsAtMs = endsAt ? new Date(endsAt).getTime() : Number.NaN;
    if (!Number.isFinite(endsAtMs)) {
      setRemainingSeconds(null);
      return;
    }

    const updateCountdown = () => {
      setRemainingSeconds(Math.max(0, Math.floor((endsAtMs - Date.now()) / 1000)));
    };

    updateCountdown();
    const interval = window.setInterval(updateCountdown, 1000);
    return () => window.clearInterval(interval);
  }, [endsAt]);

  return remainingSeconds;
}

function formatCountdown(seconds: number) {
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  const remainingSeconds = seconds % 60;
  const pad = (value: number) => String(value).padStart(2, "0");

  return {
    text: `${days}d ${pad(hours)}h ${pad(minutes)}m ${pad(remainingSeconds)}s`,
    label: `${days} días, ${hours} horas, ${minutes} minutos y ${remainingSeconds} segundos`,
  };
}

export function AuctionCountdown({
  endsAt,
  showStatus = false,
}: {
  endsAt: string | null;
  showStatus?: boolean;
}) {
  const remainingSeconds = useAuctionCountdown(endsAt);
  const isClosed = remainingSeconds === 0;
  const isUrgent = remainingSeconds !== null && remainingSeconds > 0 && remainingSeconds <= 180;
  const formatted = remainingSeconds === null ? null : formatCountdown(remainingSeconds);
  const hasValidEnd = Boolean(endsAt && Number.isFinite(new Date(endsAt).getTime()));

  return (
    <div className="flex flex-wrap items-center gap-2">
      {showStatus && (
        <Badge
          variant={isUrgent || isClosed || !hasValidEnd ? "destructive" : "secondary"}
          aria-live="polite"
        >
          {isClosed
            ? "Finalizada"
            : !hasValidEnd
              ? "Cierre no disponible"
              : isUrgent
                ? "Por finalizar"
                : "En vivo"}
        </Badge>
      )}
      <time
        dateTime={endsAt ?? undefined}
        aria-label={formatted?.label ?? "Fecha de cierre no disponible"}
        className={`font-mono tabular-nums ${
          isUrgent || isClosed ? "font-semibold text-destructive" : "text-foreground"
        }`}
      >
        {formatted?.text ?? (hasValidEnd ? "Calculando..." : "Fecha de cierre no disponible")}
      </time>
    </div>
  );
}

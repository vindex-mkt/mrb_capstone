"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import ProductGallery from "@/components/ProductGallery";
import FavoriteButton from "@/components/FavoriteButton";
import ProductReviews from "@/components/reviews/ProductReviews";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuctionRealtime } from "@/hooks/useAuctionRealtime";
import { useSynchronizedTimer } from "@/hooks/useSynchronizedTimer";
import { createClient } from "@/lib/supabase/client";
import {
  ANTI_SNIPING_WINDOW_MS,
  formatAuctionAmount,
  getAuctionBidLimits,
  getProductImage,
  type AuctionBid,
  type AuctionProduct,
} from "@/lib/product-utils";

function formatBidTime(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Hora no disponible";
  return new Intl.DateTimeFormat("es-CL", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

export default function AuctionRoom({
  initialProduct,
  initialBids,
  initialWinnerName,
}: {
  initialProduct: AuctionProduct;
  initialBids: AuctionBid[];
  initialWinnerName: string | null;
}) {
  const { product, bids, isConnected, realtimeError, showExtensionNotice, refreshAuctionProduct } = useAuctionRealtime(
    initialProduct.id,
    initialProduct,
    initialBids,
  );
  const [supabase] = useState(createClient);
  const {
    days,
    hours,
    minutes,
    seconds,
    totalSeconds,
    isExpired,
    isSynced,
    syncError,
  } = useSynchronizedTimer(product.auction_ends_at);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [bidAmount, setBidAmount] = useState(() => {
    const limits = getAuctionBidLimits(initialProduct);
    return limits === null ? "" : String(limits.minimum);
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bidError, setBidError] = useState<string | null>(null);
  const [bidMessage, setBidMessage] = useState<string | null>(null);
  const [winnerName, setWinnerName] = useState(initialWinnerName);
  const [winnerError, setWinnerError] = useState<string | null>(null);
  const bidLimits = useMemo(() => getAuctionBidLimits(product), [product]);
  const minimumBid = bidLimits?.minimum ?? null;
  const maximumBid = bidLimits?.maximum ?? null;
  const currentAmount = product.current_bid ?? product.starting_price;
  const isClosed = isExpired;
  const canPlaceBids = isSynced && totalSeconds !== null && totalSeconds > 0;
  const isAntiSnipingWindow = canPlaceBids && totalSeconds !== null && totalSeconds <= 180;
  const seller = Array.isArray(product.seller) ? product.seller[0] : product.seller;
  const galleryImages = product.images?.length ? product.images : [getProductImage(product)];
  const padTimer = (value: number) => String(value).padStart(2, "0");

  useEffect(() => {
    let isCurrent = true;
    const loadUser = async () => {
      try {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (!isCurrent) return;
        if (error) throw error;
        setCurrentUserId(user?.id ?? null);
      } catch (error) {
        if (!isCurrent) return;
        const message = error instanceof Error ? error.message : "Error desconocido";
        console.error("No se pudo verificar la sesión para pujar:", message);
        setAuthError("No se pudo verificar tu sesión. Vuelve a cargar la página.");
      }
    };

    void loadUser();
    return () => {
      isCurrent = false;
    };
  }, [supabase]);

  useEffect(() => {
    if (!product.winner_id) {
      setWinnerName(null);
      setWinnerError(null);
      return;
    }

    const winnerId = product.winner_id;
    if (product.winner_id === initialProduct.winner_id && initialWinnerName) {
      setWinnerName(initialWinnerName);
      setWinnerError(null);
      return;
    }

    let isCurrent = true;
    const loadWinner = async () => {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", winnerId)
          .maybeSingle();
        if (!isCurrent) return;
        if (error) throw error;
        setWinnerName(data?.full_name ?? null);
        setWinnerError(null);
      } catch (error) {
        if (!isCurrent) return;
        const message = error instanceof Error ? error.message : "Error desconocido";
        console.error("No se pudo cargar el perfil del ganador:", message);
        setWinnerError("No fue posible cargar el nombre del ganador.");
      }
    };

    void loadWinner();
    return () => {
      isCurrent = false;
    };
  }, [initialProduct.winner_id, initialWinnerName, product.winner_id, supabase]);

  useEffect(() => {
    if (bidLimits === null) {
      setBidAmount("");
      return;
    }

    setBidAmount((current) =>
      current === "" ||
      !Number.isSafeInteger(Number(current)) ||
      Number(current) < bidLimits.minimum ||
      Number(current) > bidLimits.maximum
        ? String(bidLimits.minimum)
        : current,
    );
  }, [bidLimits]);

  const submitBid = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBidError(null);
    setBidMessage(null);

    const amount = Number(bidAmount);
    if (!canPlaceBids) {
      setBidError("Espera a que se sincronice la hora del servidor antes de pujar.");
      return;
    }

    if (
      !Number.isSafeInteger(amount) ||
      bidLimits === null ||
      amount < bidLimits.minimum ||
      amount > bidLimits.maximum
    ) {
      setBidError(
        !Number.isSafeInteger(amount)
          ? "Ingresa un monto entero válido en pesos chilenos."
          : bidLimits === null
            ? "Esta subasta no tiene un rango válido de pujas. Revisa el precio inicial y el incremento mínimo."
            : amount < bidLimits.minimum
              ? `La puja mínima es ${formatAuctionAmount(bidLimits.minimum)}.`
              : `La puja máxima para este turno es ${formatAuctionAmount(bidLimits.maximum)}.`,
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.rpc("place_bid", {
        p_product_id: product.id,
        p_bid_amount: amount,
      });
      if (error) throw error;
      const wasInAntiSnipingWindow = isSynced &&
        totalSeconds !== null &&
        totalSeconds <= ANTI_SNIPING_WINDOW_MS / 1_000;
      const { auctionEnd, error: syncError } = await refreshAuctionProduct();
      const previousEndMs = product.auction_ends_at ? Date.parse(product.auction_ends_at) : Number.NaN;
      const refreshedEndMs = auctionEnd ? Date.parse(auctionEnd) : Number.NaN;

      if (syncError) {
        setBidMessage("Puja confirmada. No se pudo sincronizar el temporizador; actualiza la sala.");
      } else if (
        wasInAntiSnipingWindow &&
        (!Number.isFinite(refreshedEndMs) || refreshedEndMs <= previousEndMs)
      ) {
        setBidError("La puja se confirmó, pero Supabase no extendió el cierre. Revisa el trigger anti-sniping de la base de datos.");
      } else {
        setBidMessage("Puja confirmada y estado de la subasta sincronizado.");
      }
    } catch (error) {
      const errorData = typeof error === "object" && error !== null
        ? error as Record<string, unknown>
        : {};
      const message = typeof errorData.message === "string"
        ? errorData.message
        : error instanceof Error
          ? error.message
          : "Ocurrió un error inesperado.";
      const errorContext = [errorData.code, errorData.details, errorData.hint]
        .filter((value): value is string => typeof value === "string" && value.trim() !== "");
      const diagnosticMessage = [message, ...errorContext].join(" | ");
      console.error("No se pudo registrar la puja:", error);
      setBidError(`No se pudo confirmar tu puja: ${diagnosticMessage}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const quickIncrements = [5_000, 10_000, 25_000];

  return (
    <section className="container-site py-8 sm:py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-muted-foreground">
          <Link href="/" className="hover:text-foreground">Inicio</Link>
          <span className="mx-2">/</span>
          <Link href="/subastas" className="hover:text-foreground">Subastas</Link>
          <span className="mx-2">/</span>
          <span className="text-foreground">{product.name ?? "Detalle"}</span>
        </div>
        <Badge variant={isConnected ? "secondary" : "outline"} aria-live="polite">
          {isConnected ? "Conectado en vivo" : "Conectando sala"}
        </Badge>
      </div>

      {realtimeError && (
        <p role="alert" className="mb-5 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {realtimeError}
        </p>
      )}
      {showExtensionNotice && (
        <p role="status" className="animate-in fade-in slide-in-from-top-1 mb-5 rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-sm font-medium text-emerald-800 duration-300">
          ¡Tiempo extendido +5 min por puja tardía!
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(340px,0.85fr)] lg:items-start">
        <div className="space-y-6">
          <ProductGallery images={galleryImages} alt={product.name ?? "Producto en subasta"} />
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Descripción</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-line leading-7 text-muted-foreground">
                {product.description ?? "Este producto aún no tiene descripción disponible."}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Información del producto</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p><span className="font-medium text-foreground">Condición:</span> <span className="text-muted-foreground">{product.condition ?? "No especificada"}</span></p>
              <p><span className="font-medium text-foreground">Vendedor:</span> <span className="text-muted-foreground">{seller?.full_name ?? "Vendedor Vindex"}</span></p>
            </CardContent>
          </Card>
          <ProductReviews
            productId={product.id}
            sellerId={product.seller_id}
            storeId={product.store_id}
            isAuction
            winnerId={product.winner_id}
            auctionClosed={isClosed}
          />
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardDescription>Subasta en vivo</CardDescription>
                  <CardTitle className="mt-1 text-2xl">{product.name ?? "Subasta"}</CardTitle>
                </div>
                <Badge variant={isClosed || isAntiSnipingWindow ? "destructive" : "secondary"}>
                  {isClosed
                    ? "Subasta Finalizada"
                    : !isSynced
                      ? "Sincronizando hora"
                      : canPlaceBids
                        ? "En vivo"
                        : "Cierre no disponible"}
                </Badge>
                <FavoriteButton productId={product.id} productName={product.name ?? "Subasta"} variant="label" />
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="rounded-2xl bg-muted/60 p-4">
                <p className="text-sm text-muted-foreground">Oferta más alta</p>
                <p className="mt-1 text-3xl font-extrabold tracking-tight text-foreground">
                  {formatAuctionAmount(currentAmount)}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Rango para tu próxima puja:{" "}
                  <span className="font-semibold text-foreground">
                    {bidLimits === null
                      ? "No disponible"
                      : `${formatAuctionAmount(bidLimits.minimum)} - ${formatAuctionAmount(bidLimits.maximum)}`}
                  </span>
                </p>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">Tiempo restante</p>
                {!isSynced ? (
                  <div
                    aria-label="Sincronizando temporizador"
                    role="status"
                    className="h-6 w-48 animate-pulse rounded bg-muted"
                  />
                ) : totalSeconds === null ? (
                  <p role="alert" className="text-sm text-destructive">Fecha de cierre no disponible.</p>
                ) : (
                  <p
                    aria-label={`${days} días, ${hours} horas, ${minutes} minutos y ${seconds} segundos`}
                    className={`font-mono tabular-nums ${
                      isAntiSnipingWindow || isClosed ? "font-semibold text-destructive" : "text-foreground"
                    }`}
                  >
                    {days}d {padTimer(hours)}h {padTimer(minutes)}m {padTimer(seconds)}s
                  </p>
                )}
                {isAntiSnipingWindow && (
                  <Badge variant="destructive">
                    Zona Anti-sniping: las pujas añaden +5 min
                  </Badge>
                )}
                {syncError && (
                  <p role="alert" className="text-xs text-destructive">
                    No se pudo sincronizar la hora del servidor; se reintentará automáticamente.
                  </p>
                )}
              </div>

              {isClosed ? (
                <div className="rounded-xl border border-border bg-muted/40 p-4">
                  <p className="font-semibold text-foreground">Subasta Finalizada</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {product.winner_id
                      ? `Ganador: ${winnerName ?? "Ganador registrado"}.`
                      : "No se registró un ganador para esta subasta."}
                  </p>
                  {winnerError && <p role="alert" className="mt-1 text-sm text-destructive">{winnerError}</p>}
                </div>
              ) : !isSynced ? (
                <p role="status" className="rounded-xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
                  Sincronizando la hora del servidor antes de habilitar las pujas.
                </p>
              ) : !canPlaceBids ? (
                <p role="alert" className="rounded-xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
                  No es posible pujar porque la fecha de cierre no está disponible.
                </p>
              ) : (
                <form onSubmit={submitBid} className="space-y-4">
                  <fieldset disabled={!currentUserId || isSubmitting || bidLimits === null || !canPlaceBids} className="space-y-4">
                    <div>
                      <label htmlFor="bid-amount" className="mb-2 block text-sm font-medium text-foreground">
                        Tu oferta (CLP)
                      </label>
                      <Input
                        id="bid-amount"
                        name="amount"
                        type="number"
                        min={minimumBid ?? undefined}
                        max={maximumBid ?? undefined}
                        step="1"
                        inputMode="numeric"
                        value={bidAmount}
                        onChange={(event) => setBidAmount(event.target.value)}
                        className="h-11"
                        required
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {quickIncrements.map((increment) => {
                        const amount = (minimumBid ?? 0) + increment;
                        return (
                          <Button
                            key={increment}
                            type="button"
                            variant="outline"
                            disabled={maximumBid === null || amount > maximumBid}
                            onClick={() => setBidAmount(String(amount))}
                          >
                            +{formatAuctionAmount(increment)}
                          </Button>
                        );
                      })}
                    </div>
                    <Button type="submit" className="h-11 w-full" disabled={isSubmitting}>
                      {isSubmitting ? "Confirmando puja..." : "Confirmar puja"}
                    </Button>
                  </fieldset>
                  {bidLimits === null && (
                    <p role="alert" className="text-sm text-destructive">
                      El incremento mínimo no permite una puja dentro del límite de 50% sobre la oferta vigente.
                    </p>
                  )}
                  {!currentUserId && (
                    <p className="text-sm text-muted-foreground">
                      <Link href="/login" className="font-medium text-brand-700 hover:text-brand-800">Inicia sesión</Link> para participar.
                    </p>
                  )}
                  {authError && <p role="alert" className="text-sm text-destructive">{authError}</p>}
                  {bidError && <p role="alert" className="text-sm text-destructive">{bidError}</p>}
                  {bidMessage && <p role="status" className="text-sm text-emerald-700">{bidMessage}</p>}
                </form>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-xl">Pujas recientes</CardTitle>
                  <CardDescription className="mt-1">Las ofertas nuevas aparecen automáticamente.</CardDescription>
                </div>
                <Badge variant="outline">{bids.length}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              {bids.length === 0 ? (
                <p className="py-5 text-center text-sm text-muted-foreground">Aún no hay pujas. ¡Sé el primero!</p>
              ) : (
                <ol className="divide-y divide-border">
                  {bids.map((bid) => {
                    const isOwnBid = bid.bidder_id === currentUserId;
                    return (
                      <li
                        key={bid.id}
                        className={`animate-in fade-in slide-in-from-top-1 flex items-center justify-between gap-3 py-3 duration-300 ${
                          isOwnBid ? "rounded-lg bg-emerald-50 px-3" : ""
                        }`}
                      >
                        <div className="min-w-0">
                          <p className={`truncate text-sm font-semibold ${isOwnBid ? "text-emerald-800" : "text-foreground"}`}>
                            {isOwnBid
                              ? "Tu puja"
                              : bid.bidder_name || `Postor ${bid.bidder_id}`}
                          </p>
                          <time dateTime={bid.created_at} className="text-xs text-muted-foreground">
                            {formatBidTime(bid.created_at)}
                          </time>
                        </div>
                        <p className={`shrink-0 font-bold ${isOwnBid ? "text-emerald-800" : "text-foreground"}`}>
                          {formatAuctionAmount(bid.amount)}
                        </p>
                      </li>
                    );
                  })}
                </ol>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}

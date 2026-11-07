"use client";

import { useState } from "react";
import { CreditCard, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { featuredPlans, startAdvertisingPayment } from "@/lib/advertising";

const formatClp = (value: number) =>
  new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(value);

export default function ProductAdvertisingControl({
  productId,
  isFeatured,
  featuredUntil,
}: {
  productId: number;
  isFeatured: boolean;
  featuredUntil: string | null;
}) {
  const [durationDays, setDurationDays] = useState(7);
  const [processing, setProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const isPromotionActive = isFeatured && featuredUntil !== null && new Date(featuredUntil).getTime() > Date.now();
  const selectedPlan = featuredPlans.find((plan) => plan.days === durationDays) ?? featuredPlans[2];

  const handlePromote = async () => {
    if (processing) return;
    setProcessing(true);
    setErrorMessage(null);
    try {
      await startAdvertisingPayment(productId, durationDays);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "No se pudo iniciar el pago de publicidad.");
      setProcessing(false);
    }
  };

  return (
    <div className="mt-4 space-y-3 rounded-md border border-border bg-muted/30 p-3">
      <div className="flex items-start gap-2">
        <Sparkles className="mt-0.5 size-4 text-brand-700" aria-hidden="true" />
        <div>
          <p className="text-sm font-semibold text-foreground">
            {isPromotionActive ? "Publicidad activa" : "Promocionar publicación"}
          </p>
          {isPromotionActive && (
            <p className="mt-1 text-xs text-muted-foreground">
              Destacado hasta {new Date(featuredUntil!).toLocaleString("es-CL")}. Puedes extenderlo con otro plan.
            </p>
          )}
        </div>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <select
          aria-label="Duración de la publicidad"
          value={durationDays}
          onChange={(event) => setDurationDays(Number(event.target.value))}
          disabled={processing}
          className="h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm text-foreground"
        >
          {featuredPlans.map((plan) => (
            <option key={plan.days} value={plan.days}>
              {plan.days} {plan.days === 1 ? "día" : "días"} — {formatClp(plan.price)}
            </option>
          ))}
        </select>
        <Button type="button" onClick={() => void handlePromote()} disabled={processing}>
          <CreditCard aria-hidden="true" />
          {processing ? "Conectando..." : `Pagar ${formatClp(selectedPlan.price)} con Webpay`}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Solo se cobrará después de confirmar que la publicación está activa. El destacado se habilita al aprobarse el pago.
      </p>
      {errorMessage && (
        <p role="alert" className="text-sm text-red-700">
          {errorMessage} La publicación permanece activa y sin destacar.
        </p>
      )}
    </div>
  );
}

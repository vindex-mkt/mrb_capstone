"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, CircleX, LoaderCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useCartStore } from "@/lib/store/useCartStore";

type ResultState =
  | "loading"
  | "processing"
  | "approved"
  | "partial"
  | "rejected"
  | "communication_error"
  | "invalid"
  | "authentication_required";

type PaidItem = {
  product_id: number;
  quantity: number;
};

type PaymentStatusResponse = {
  orderId?: number;
  paymentStatus?: string;
  paidItems?: unknown;
  message?: string;
};

const wait = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const parsePaidItems = (value: unknown): PaidItem[] => {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (
      typeof item !== "object"
      || item === null
      || !("product_id" in item)
      || !("quantity" in item)
      || typeof item.product_id !== "number"
      || typeof item.quantity !== "number"
      || !Number.isSafeInteger(item.product_id)
      || !Number.isSafeInteger(item.quantity)
      || item.quantity <= 0
    ) return [];
    return [{ product_id: item.product_id, quantity: item.quantity }];
  });
};

const mapPaymentStatus = (status: string | undefined): ResultState => {
  if (status === "authorized") return "approved";
  if (status === "partially_authorized") return "partial";
  if (status === "rejected" || status === "cancelled") return "rejected";
  if (status === "payment_review" || status === "communication_error") return "communication_error";
  if (["created", "initiated", "processing"].includes(status ?? "")) return "processing";
  return "loading";
};

export default function WebpayResult({
  orderId: initialOrderId,
  returnState,
}: {
  orderId: string | null;
  returnState: string | null;
}) {
  const [state, setState] = useState<ResultState>("loading");
  const [orderId, setOrderId] = useState<number | null>(
    initialOrderId && /^\d+$/.test(initialOrderId) ? Number(initialOrderId) : null,
  );
  const [message, setMessage] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const syncPaidItems = (items: PaidItem[]) => {
      const cart = useCartStore.getState();
      for (const item of items) {
        const remaining = cart.items.find((cartItem) => cartItem.id === item.product_id)?.quantity;
        if (remaining !== undefined) cart.updateQuantity(item.product_id, remaining - item.quantity);
      }
    };

    const loadStatus = async (id: number) => {
      for (let attempt = 0; attempt < 6; attempt += 1) {
        const statusResponse = await fetch(`/api/payments/webpay/status?order_id=${id}`, { cache: "no-store" });
        const statusData = await statusResponse.json() as PaymentStatusResponse;
        if (!statusResponse.ok) {
          throw new Error(statusData.message ?? "No pudimos consultar el estado del pago.");
        }

        const nextState = mapPaymentStatus(statusData.paymentStatus);
        if (nextState !== "loading" && nextState !== "processing") {
          syncPaidItems(parsePaidItems(statusData.paidItems));
          setOrderId(id);
          setState(nextState);
          window.history.replaceState(null, "", `/checkout/result?order_id=${id}`);
          return;
        }
        if (attempt < 5) await wait(1200);
      }

      setOrderId(id);
      setState("processing");
      window.history.replaceState(null, "", `/checkout/result?order_id=${id}`);
    };

    const run = async () => {
      if (initialOrderId && /^\d+$/.test(initialOrderId)) {
        try {
          await loadStatus(Number(initialOrderId));
        } catch (statusError) {
          setMessage(statusError instanceof Error ? statusError.message : "No pudimos consultar el pago.");
          setState("communication_error");
        }
        return;
      }

      if (returnState === "communication_error") {
        setState("communication_error");
        return;
      }
      if (returnState) {
        setState("invalid");
        return;
      }

      try {
        const commitResponse = await fetch("/api/payments/webpay/commit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
          cache: "no-store",
        });
        const commitData = await commitResponse.json() as {
          state?: string;
          orderId?: number;
        };

        if (commitData.state === "authentication_required") {
          setState("authentication_required");
          return;
        }
        if (commitData.state === "invalid_token") {
          setState("invalid");
          return;
        }
        if (
          typeof commitData.orderId !== "number"
          || !Number.isSafeInteger(commitData.orderId)
        ) {
          setState("communication_error");
          return;
        }

        await loadStatus(commitData.orderId);
      } catch (commitError) {
        setMessage(commitError instanceof Error ? commitError.message : "No pudimos confirmar el resultado con Transbank.");
        setState("communication_error");
      }
    };

    void run();
  }, [initialOrderId, orderId, returnState, state]);

  const copy = {
    loading: {
      title: "Verificando el pago",
      description: "Estamos confirmando el resultado con Transbank. No cierres esta página.",
    },
    processing: {
      title: "Pago en proceso",
      description: "Transbank todavía está procesando esta compra. Consulta nuevamente en unos momentos; no inicies otro pago.",
    },
    approved: {
      title: "Pago aprobado",
      description: "Transbank confirmó las subtransacciones de tu compra.",
    },
    partial: {
      title: "Pago parcialmente autorizado",
      description: "Una tienda fue autorizada y otra fue rechazada. No se realizará un reintento ni un reembolso automático; cualquier compensación requiere revisión manual.",
    },
    rejected: {
      title: "Pago rechazado o cancelado",
      description: "No se confirmó el pago. Tu carrito se mantiene para que puedas revisarlo.",
    },
    communication_error: {
      title: "No pudimos confirmar el pago",
      description: "El resultado requiere revisión antes de volver a intentarlo. No inicies otro pago para esta orden.",
    },
    invalid: {
      title: "No se encontró una confirmación válida",
      description: "El token no es válido, venció o no corresponde a una compra de tu cuenta. No se marcó la orden como pagada.",
    },
    authentication_required: {
      title: "Inicia sesión para confirmar tu compra",
      description: "Vuelve a iniciar sesión con la cuenta que comenzó el pago y abre nuevamente esta página.",
    },
  }[state];

  const StatusIcon = state === "loading" || state === "processing"
    ? LoaderCircle
    : state === "approved"
      ? CheckCircle2
      : state === "rejected" || state === "invalid"
        ? CircleX
        : AlertTriangle;

  return (
    <main className="min-h-[60vh] bg-background">
      <section className="container-site py-10 sm:py-12">
        <Card className="mx-auto max-w-2xl border-border bg-surface">
          <CardHeader className="items-center text-center">
            <StatusIcon
              className={`size-12 ${
                state === "approved" ? "text-emerald-700" :
                  state === "loading" || state === "processing" ? "animate-spin text-brand-700" :
                    state === "rejected" || state === "invalid" ? "text-red-700" : "text-amber-700"
              }`}
              aria-hidden="true"
            />
            <CardTitle className="text-2xl">{copy.title}</CardTitle>
            <CardDescription className="max-w-xl">{copy.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 text-center">
            {orderId !== null && (
              <p className="text-sm text-muted-foreground">Orden #{orderId}</p>
            )}
            {message && <p role="alert" className="text-sm text-red-700">{message}</p>}
            <div className="flex flex-wrap justify-center gap-3">
              {state === "authentication_required" && (
                <Link href="/login?next=%2Fcheckout%2Fresult" className="btn btn-primary inline-flex min-h-10 items-center px-5">
                  Iniciar sesión
                </Link>
              )}
              {state === "approved" && (
                <Link href="/profile" className="btn btn-primary inline-flex min-h-10 items-center px-5">
                  Ir a Mis Compras
                </Link>
              )}
              <Link href="/cart" className="btn btn-outline inline-flex min-h-10 items-center px-5">
                Volver al carrito
              </Link>
            </div>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}

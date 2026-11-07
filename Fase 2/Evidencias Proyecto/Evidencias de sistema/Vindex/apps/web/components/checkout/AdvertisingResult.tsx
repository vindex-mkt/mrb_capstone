"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, CircleX, LoaderCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type ResultState =
  | "loading"
  | "processing"
  | "authorized"
  | "rejected"
  | "cancelled"
  | "payment_review"
  | "communication_error"
  | "invalid_token"
  | "authentication_required";

const wait = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const parseState = (value: unknown): ResultState | null => {
  if (typeof value !== "string") return null;
  if (value === "error") return "communication_error";
  if ([
    "loading",
    "processing",
    "authorized",
    "rejected",
    "cancelled",
    "payment_review",
    "communication_error",
    "invalid_token",
    "authentication_required",
  ].includes(value)) return value as ResultState;
  if (value === "initiated" || value === "created") return "processing";
  return null;
};

export default function AdvertisingResult({
  transactionId,
}: {
  transactionId: string | null;
}) {
  const [state, setState] = useState<ResultState>("loading");
  const [productId, setProductId] = useState<number | null>(null);
  const started = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (started.current === transactionId) return;
    started.current = transactionId;

    const loadStatus = async (id: string) => {
      for (let attempt = 0; attempt < 6; attempt += 1) {
        const response = await fetch(`/api/payments/advertising/status?transaction_id=${encodeURIComponent(id)}`, {
          cache: "no-store",
        });
        const data = await response.json() as { state?: unknown; productId?: unknown };
        const nextState = parseState(data.state);
        if (!response.ok) {
          if (response.status === 401) {
            setState("authentication_required");
            return;
          }
          throw new Error("No pudimos consultar el estado del pago de publicidad.");
        }
        if (typeof data.productId === "number") setProductId(data.productId);
        if (nextState && nextState !== "processing" && nextState !== "loading") {
          setState(nextState);
          return;
        }
        if (attempt < 5) await wait(1000);
      }
      setState("processing");
    };

    const run = async () => {
      if (!transactionId || !/^[0-9a-f-]{36}$/i.test(transactionId)) {
        setState("invalid_token");
        return;
      }

      try {
        const response = await fetch("/api/payments/advertising/commit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
          cache: "no-store",
        });
        const data = await response.json() as {
          state?: unknown;
          transactionId?: unknown;
          productId?: unknown;
        };
        const commitState = parseState(data.state);
        if (typeof data.productId === "number") setProductId(data.productId);
        if (commitState === "authentication_required") {
          setState("authentication_required");
          return;
        }
        if (commitState && commitState !== "invalid_token") {
          if (commitState === "processing") {
            await loadStatus(transactionId);
            return;
          }
          setState(commitState);
          return;
        }
        await loadStatus(transactionId);
      } catch {
        setState("communication_error");
      }
    };

    void run();
  }, [productId, state, transactionId]);

  const copy = {
    loading: {
      title: "Verificando el pago",
      description: "Estamos confirmando el resultado de publicidad con Transbank.",
    },
    processing: {
      title: "Pago en proceso",
      description: "El resultado aún se está procesando. No inicies otro pago para esta publicación.",
    },
    authorized: {
      title: "Publicidad activada",
      description: "Transbank autorizó el pago y el producto quedó destacado.",
    },
    rejected: {
      title: "Pago rechazado",
      description: "El producto continúa publicado, pero no se destacó. Puedes volver al perfil para intentarlo nuevamente.",
    },
    cancelled: {
      title: "Pago cancelado",
      description: "El producto continúa publicado, pero no se destacó ni se confirmó un cobro.",
    },
    payment_review: {
      title: "Pago en revisión",
      description: "No pudimos verificar con seguridad el resultado. El producto continúa publicado sin destacar; no vuelvas a pagar hasta revisar la operación.",
    },
    communication_error: {
      title: "No pudimos confirmar el pago",
      description: "El producto continúa publicado sin destacar. No inicies otro pago hasta revisar el estado de la transacción.",
    },
    invalid_token: {
      title: "No se encontró un pago válido",
      description: "La referencia de pago no existe o no corresponde a tu cuenta.",
    },
    authentication_required: {
      title: "Inicia sesión para continuar",
      description: "Vuelve a iniciar sesión con la cuenta que inició el pago.",
    },
  }[state];

  const StatusIcon = state === "loading" || state === "processing"
    ? LoaderCircle
    : state === "authorized"
      ? CheckCircle2
      : state === "rejected" || state === "cancelled" || state === "invalid_token"
        ? CircleX
        : AlertTriangle;

  return (
    <main className="min-h-[60vh] bg-background">
      <section className="container-site py-10 sm:py-12">
        <Card className="mx-auto max-w-2xl border-border bg-surface">
          <CardHeader className="items-center text-center">
            <StatusIcon
              className={`size-12 ${
                state === "authorized" ? "text-emerald-700" :
                  state === "loading" || state === "processing" ? "animate-spin text-brand-700" :
                    state === "rejected" || state === "cancelled" || state === "invalid_token" ? "text-red-700" : "text-amber-700"
              }`}
              aria-hidden="true"
            />
            <CardTitle className="text-2xl">{copy.title}</CardTitle>
            <CardDescription className="max-w-xl">{copy.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 text-center">
            {productId !== null && <p className="text-sm text-muted-foreground">Producto #{productId}</p>}
            <div className="flex flex-wrap justify-center gap-3">
              {state === "authentication_required" && (
                <Link
                  href={`/login?next=${encodeURIComponent(`/advertising/result?transaction_id=${transactionId ?? ""}`)}`}
                  className="btn btn-primary inline-flex min-h-10 items-center px-5"
                >
                  Iniciar sesión
                </Link>
              )}
              <Link href="/profile" className="btn btn-primary inline-flex min-h-10 items-center px-5">
                Volver al perfil
              </Link>
            </div>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}

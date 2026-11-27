"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, CircleX, LoaderCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type PaymentState =
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

const terminalStates: PaymentState[] = [
  "authorized",
  "rejected",
  "cancelled",
  "payment_review",
  "communication_error",
  "invalid_token",
  "authentication_required",
];

const isPaymentState = (value: unknown): value is PaymentState =>
  typeof value === "string"
  && [
    "processing",
    "authorized",
    "rejected",
    "cancelled",
    "payment_review",
    "communication_error",
    "invalid_token",
    "authentication_required",
  ].includes(value);

const formatCLP = (amount: number) =>
  new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(amount);

export default function WalletPaymentResult({
  transactionId,
  returnState,
}: {
  transactionId: string | null;
  returnState: string | null;
}) {
  const [state, setState] = useState<PaymentState>("loading");
  const [amount, setAmount] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const showState = (nextState: PaymentState, nextAmount: unknown) => {
      setState(nextState);
      if (typeof nextAmount === "number" && Number.isSafeInteger(nextAmount)) {
        setAmount(nextAmount);
      }
      if (nextState === "authorized") {
        window.dispatchEvent(new Event("vindex:wallet-updated"));
      }
    };

    const loadStatus = async (id: string) => {
      for (let attempt = 0; attempt < 6; attempt += 1) {
        const response = await fetch(
          `/api/payments/wallet/status?transaction_id=${encodeURIComponent(id)}`,
          { cache: "no-store" },
        );
        const data = await response.json() as { state?: unknown; amount?: unknown };
        const nextState = isPaymentState(data.state) ? data.state : null;
        if (!response.ok) {
          if (response.status === 401) {
            showState("authentication_required", null);
            return;
          }
          if (response.status === 404 || nextState === "invalid_token") {
            showState("invalid_token", null);
            return;
          }
          throw new Error("No pudimos consultar el estado de la recarga.");
        }
        if (typeof data.amount === "number" && Number.isSafeInteger(data.amount)) {
          setAmount(data.amount);
        }
        if (nextState && terminalStates.includes(nextState)) {
          showState(nextState, data.amount);
          return;
        }
        if (attempt < 5) await wait(1000);
      }
      setState("processing");
    };

    const run = async () => {
      if (!transactionId || !/^[0-9a-f-]{36}$/i.test(transactionId)) {
        setState(returnState === "communication_error" ? "communication_error" : "invalid_token");
        return;
      }

      try {
        const response = await fetch("/api/payments/wallet/commit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
          cache: "no-store",
        });
        const data = await response.json() as {
          state?: unknown;
          transactionId?: unknown;
          amount?: unknown;
          message?: unknown;
        };
        const nextState = isPaymentState(data.state) ? data.state : null;
        if (!response.ok && response.status !== 202) {
          if (response.status === 401) {
            setState("authentication_required");
            return;
          }
          if (nextState === "invalid_token") {
            await loadStatus(transactionId);
            return;
          }
          if (nextState === "payment_review" || nextState === "communication_error") {
            await loadStatus(transactionId);
            return;
          }
          throw new Error(typeof data.message === "string" ? data.message : "No pudimos confirmar el pago.");
        }

        if (typeof data.amount === "number" && Number.isSafeInteger(data.amount)) {
          setAmount(data.amount);
        }
        if (nextState && terminalStates.includes(nextState)) {
          showState(nextState, data.amount);
          return;
        }
        await loadStatus(transactionId);
      } catch (error) {
        try {
          await loadStatus(transactionId);
        } catch {
          setMessage(error instanceof Error ? error.message : "No pudimos confirmar el pago con Transbank.");
          setState("communication_error");
        }
      }
    };

    void run();
  }, [amount, message, returnState, state, transactionId]);

  const copy = {
    loading: {
      title: "Verificando el pago",
      description: "Estamos confirmando la recarga con Transbank. No cierres esta página.",
    },
    processing: {
      title: "Pago en proceso",
      description: "Transbank aún está procesando el resultado. No inicies otra recarga hasta revisar esta operación.",
    },
    authorized: {
      title: "Recarga aprobada",
      description: "Transbank autorizó el pago y el saldo ya fue abonado a tu billetera.",
    },
    rejected: {
      title: "Pago rechazado",
      description: "Transbank no autorizó el pago. No se agregó saldo a tu billetera.",
    },
    cancelled: {
      title: "Recarga cancelada",
      description: "La operación fue cancelada y no se agregó saldo a tu billetera.",
    },
    payment_review: {
      title: "Pago en revisión",
      description: "No pudimos validar de forma segura la respuesta. El saldo no se abonará hasta resolver la revisión; no vuelvas a pagar todavía.",
    },
    communication_error: {
      title: "No pudimos confirmar el pago",
      description: "La operación requiere revisión antes de iniciar otra recarga. Consulta nuevamente en unos momentos.",
    },
    invalid_token: {
      title: "No se encontró una recarga válida",
      description: "La referencia no existe, venció o no corresponde a tu cuenta.",
    },
    authentication_required: {
      title: "Inicia sesión para continuar",
      description: "Vuelve a iniciar sesión con la cuenta que comenzó la recarga.",
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
            {amount !== null && (
              <p className="text-sm text-muted-foreground">
                Monto de la recarga: <strong className="text-foreground">{formatCLP(amount)}</strong>
              </p>
            )}
            {message && <p role="alert" className="text-sm text-red-700">{message}</p>}
            <div className="flex flex-wrap justify-center gap-3">
              {state === "authentication_required" && (
                <Link
                  href={`/login?next=${encodeURIComponent(`/wallet/resultado?transaction_id=${transactionId ?? ""}`)}`}
                  className="btn btn-primary inline-flex min-h-10 items-center px-5"
                >
                  Iniciar sesión
                </Link>
              )}
              <Link href="/wallet" className="btn btn-primary inline-flex min-h-10 items-center px-5">
                Ver mi billetera
              </Link>
            </div>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}

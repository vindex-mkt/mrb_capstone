"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, RefreshCw, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatProductPrice } from "@/lib/formatters";
import { useToast } from "@/components/ToastProvider";

type PendingPayment = {
  orderId: number;
  orderStatus: string;
  paymentStatus: string;
  createdAt: string;
  total: number;
  resolutionMessage?: string | null;
};

type PendingPaymentsResponse = {
  payments?: PendingPayment[];
  message?: string;
};

type ResolvePaymentResponse = {
  state?: "retryable" | "resume" | "pending";
  orderId?: number;
  message?: string;
};

const paymentStatusLabel = (status: string) => {
  switch (status) {
    case "created": return "Preparando pago";
    case "initiated": return "Esperando confirmación";
    case "processing": return "Confirmando con Webpay";
    case "communication_error": return "Confirmación pendiente";
    case "payment_review": return "Requiere conciliación";
    case "authorized": return "Pago autorizado, recuperando confirmación";
    default: return "Pago pendiente";
  }
};

export default function PendingWebpayPayments() {
  const router = useRouter();
  const { showToast } = useToast();
  const [payments, setPayments] = useState<PendingPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeOrderId, setActiveOrderId] = useState<number | null>(null);

  const loadPayments = useCallback(async () => {
    setLoadError(null);
    try {
      const response = await fetch("/api/payments/webpay/pending", { cache: "no-store" });
      const result = await response.json() as PendingPaymentsResponse;
      if (!response.ok || !Array.isArray(result.payments)) {
        throw new Error(result.message ?? "No pudimos consultar los pagos pendientes.");
      }
      setPayments(result.payments);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPayments();
    const intervalId = window.setInterval(() => void loadPayments(), 60_000);
    return () => window.clearInterval(intervalId);
  }, [loadPayments]);

  const resolvePayment = async (payment: PendingPayment, action: "retry" | "cancel") => {
    setActiveOrderId(payment.orderId);
    try {
      const response = await fetch(`/api/payments/webpay/pending/${payment.orderId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
        cache: "no-store",
      });
      const result = await response.json() as ResolvePaymentResponse;
      if (!response.ok && result.state !== "resume") {
        throw new Error(result.message ?? "No se pudo resolver el intento Webpay.");
      }

      if (result.state === "resume" && typeof result.orderId === "number") {
        showToast("Transbank autorizó el pago. Estamos recuperando la confirmación.", "info");
        router.push(`/checkout/result?order_id=${result.orderId}&resume=1`);
        return;
      }

      if (result.state === "retryable") {
        showToast(result.message ?? "El intento anterior se cerró.", "success");
        await loadPayments();
        if (action === "retry") router.push("/checkout");
        return;
      }

      showToast(result.message ?? "El pago todavía no tiene un resultado definitivo.", "info");
      await loadPayments();
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "No se pudo resolver el intento Webpay.",
        "error",
      );
    } finally {
      setActiveOrderId(null);
    }
  };

  return (
    <section className="mb-6 rounded-xl border border-amber-200 bg-amber-50/60 p-4 sm:p-5" aria-labelledby="pending-webpay-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 id="pending-webpay-title" className="flex items-center gap-2 font-semibold text-foreground">
            <AlertCircle className="size-5 text-amber-700" aria-hidden="true" />
            Pagos pendientes
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            En integración, los intentos pendientes se cancelan automáticamente al cumplir cinco minutos.
          </p>
        </div>
        {!loading && (
          <Button type="button" variant="outline" size="sm" onClick={() => void loadPayments()}>
            <RefreshCw className="mr-2 size-4" aria-hidden="true" />
            Actualizar
          </Button>
        )}
      </div>

      {loading ? (
        <p role="status" className="mt-4 text-sm text-muted-foreground">Consultando pagos pendientes...</p>
      ) : loadError ? (
        <p role="alert" className="mt-4 text-sm text-red-700">{loadError}</p>
      ) : payments.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">No tienes pagos Webpay pendientes.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {payments.map((payment) => (
            <li key={payment.orderId} className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-foreground">Orden #{payment.orderId}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {new Date(payment.createdAt).toLocaleString("es-CL")} · {formatProductPrice(payment.total)}
                </p>
                <p className="mt-1 text-sm font-medium text-amber-800">{paymentStatusLabel(payment.paymentStatus)}</p>
                {payment.resolutionMessage && (
                  <p className="mt-1 text-sm text-muted-foreground">{payment.resolutionMessage}</p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={activeOrderId !== null}
                  onClick={() => void resolvePayment(payment, "retry")}
                >
                  {activeOrderId === payment.orderId ? "Verificando..." : "Reintentar pago"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={activeOrderId !== null}
                  onClick={() => void resolvePayment(payment, "cancel")}
                >
                  <XCircle className="mr-2 size-4" aria-hidden="true" />
                  Cancelar intento
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

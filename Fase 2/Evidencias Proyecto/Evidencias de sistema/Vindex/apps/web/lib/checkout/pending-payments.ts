import type { createSupabaseAdminClient } from "@/lib/supabase/server";
import {
  classifyMallTransactionStatus,
  validateMallCommitResponse,
} from "@/lib/checkout/payment-validation";
import { isPendingPaymentExpired } from "@/lib/checkout/pending-payment-expiration";
import { assertIntegrationMallCredentials, createMallTransaction, isRecord } from "@/lib/checkout/webpay";

type AdminClient = ReturnType<typeof createSupabaseAdminClient>;

const ACTIVE_PAYMENT_STATUSES = [
  "created",
  "initiated",
  "processing",
  "payment_review",
  "communication_error",
] as const;

type PendingPayment = {
  id: string;
  order_id: number;
  mall_buy_order: string;
  transbank_token: string | null;
  status: string;
  created_at: string;
  total_amount: number;
};

type PendingPaymentResolution =
  | { state: "retryable"; message: string }
  | { state: "authorized"; token: string; message: string }
  | { state: "pending"; message: string };

export async function listBuyerPendingPayments(
  admin: AdminClient,
  buyerId: string,
  expireStalePayments = false,
) {
  const { data: orders, error: ordersError } = await admin
    .from("orders")
    .select("id, total, status")
    .eq("buyer_id", buyerId)
    .eq("payment_method", "webpay_plus_mall")
    .order("created_at", { ascending: false })
    .limit(200);
  if (ordersError) throw ordersError;
  if (!orders || orders.length === 0) return [];

  const { data: transactions, error: transactionsError } = await admin
    .from("payment_transactions")
    .select("id, order_id, mall_buy_order, transbank_token, status, created_at, total_amount")
    .in("order_id", orders.map((order) => order.id))
    .in("status", [...ACTIVE_PAYMENT_STATUSES])
    .order("created_at", { ascending: false });
  if (transactionsError) throw transactionsError;

  const rows = (transactions ?? []) as PendingPayment[];
  if (rows.length === 0) return [];

  const buyerOrders = new Map((orders ?? []).map((order) => [order.id, order]));
  const pendingPayments = [];
  for (const transaction of rows) {
    const order = buyerOrders.get(transaction.order_id);
    if (!order) continue;

    let paymentStatus = transaction.status;
    let resolutionMessage: string | null = null;
    if (expireStalePayments && isPendingPaymentExpired(transaction.created_at)) {
      try {
        const resolution = await resolveBuyerPendingPayment(admin, buyerId, transaction.order_id, "retry");
        if (resolution.state === "retryable") continue;
        if (resolution.state === "authorized") paymentStatus = "authorized";
        if (resolution.state === "pending") resolutionMessage = resolution.message;
      } catch (error) {
        console.error(
          `No se pudo conciliar automáticamente el pago vencido de la orden ${transaction.order_id}:`,
          error instanceof Error ? error.message : "error desconocido",
        );
        resolutionMessage = "No se pudo cancelar automáticamente el intento vencido. Verifica la migración de expiración en Supabase.";
      }
    }

    pendingPayments.push({
      orderId: transaction.order_id,
      orderStatus: order.status,
      paymentStatus,
      createdAt: transaction.created_at,
      total: Number(order.total),
      resolutionMessage,
    });
  }
  return pendingPayments;
}

export async function resolveBuyerPendingPayment(
  admin: AdminClient,
  buyerId: string,
  orderId: number,
  action: "retry" | "cancel",
): Promise<PendingPaymentResolution> {
  const { data: order, error: orderError } = await admin
    .from("orders")
    .select("id, status, payment_method")
    .eq("id", orderId)
    .eq("buyer_id", buyerId)
    .eq("payment_method", "webpay_plus_mall")
    .maybeSingle();
  if (orderError) throw orderError;
  if (!order) return { state: "pending", message: "No encontramos un pago pendiente de tu cuenta." };

  const { data: transaction, error: transactionError } = await admin
    .from("payment_transactions")
    .select("id, order_id, mall_buy_order, transbank_token, status, created_at, total_amount")
    .eq("order_id", orderId)
    .maybeSingle();
  if (transactionError) throw transactionError;
  if (!transaction) return { state: "pending", message: "Esta orden no tiene una transacción Webpay pendiente." };

  const payment = transaction as PendingPayment;
  if (!ACTIVE_PAYMENT_STATUSES.includes(payment.status as typeof ACTIVE_PAYMENT_STATUSES[number])) {
    return { state: "pending", message: "Este pago ya fue procesado y no requiere reintento." };
  }

  const expired = isPendingPaymentExpired(payment.created_at);
  if (expired) {
    assertIntegrationMallCredentials();
    const { data, error } = await admin.rpc("expire_integration_webpay_checkout", {
      p_user_id: buyerId,
      p_order_id: orderId,
    });
    if (error) throw error;
    if (!isRecord(data) || data.success !== true) {
      return {
        state: "pending",
        message: "No pudimos cancelar automáticamente el pago vencido. Actualiza la página o inténtalo nuevamente.",
      };
    }

    return {
      state: "retryable",
      message: "El intento de integración superó cinco minutos y se canceló automáticamente. Puedes volver a pagar.",
    };
  }

  if (payment.status === "created" && !payment.transbank_token) {
    return {
      state: "pending",
      message: "Webpay todavía está preparando este intento. Espera hasta que cumpla cinco minutos.",
    };
  }

  if (!payment.transbank_token) {
    return {
      state: "pending",
      message: "El resultado de este pago no está confirmado. No iniciamos otro cobro para evitar duplicarlo.",
    };
  }

  const { data: subtransactions, error: subtransactionsError } = await admin
    .from("payment_subtransactions")
    .select("amount, commerce_code, child_buy_order")
    .eq("payment_transaction_id", payment.id);
  if (subtransactionsError) throw subtransactionsError;
  if (!subtransactions || subtransactions.length === 0) {
    return { state: "pending", message: "Faltan datos de conciliación. El pago requiere revisión." };
  }

  const webpay = createMallTransaction();
  const providerStatus: unknown = await webpay.status(payment.transbank_token);
  if (!isRecord(providerStatus) || !Array.isArray(providerStatus.details)) {
    return { state: "pending", message: "Transbank no devolvió un estado verificable. Conservamos el intento sin liberar stock." };
  }

  const expected = {
    mallBuyOrder: payment.mall_buy_order,
    details: subtransactions.map((detail) => ({
      amount: Number(detail.amount),
      commerceCode: detail.commerce_code,
      buyOrder: detail.child_buy_order,
    })),
  };
  const validated = validateMallCommitResponse(expected, providerStatus);
  const classification = classifyMallTransactionStatus(validated.results);
  if (classification === "unresolved") {
    return { state: "pending", message: "El estado de Transbank no coincide con la orden. El pago quedó protegido para revisión." };
  }

  if (classification === "authorized") {
    return {
      state: "authorized",
      token: payment.transbank_token,
      message: "Transbank confirma que el pago fue autorizado. Estamos recuperando la confirmación.",
    };
  }

  if (
    classification !== "rejected"
    && !(action === "cancel" && classification === "not_authorized")
  ) {
    return {
      state: "pending",
      message: "Transbank todavía informa un intento en curso o no autorizado de forma definitiva. No se inició otro cobro.",
    };
  }

  const finalStatus = action === "cancel" || classification === "not_authorized"
    ? "cancelled"
    : "rejected";
  const { data, error } = await admin.rpc("resolve_failed_webpay_checkout", {
    p_user_id: buyerId,
    p_order_id: orderId,
    p_final_status: finalStatus,
    p_provider_response: providerStatus,
  });
  if (error) throw error;
  if (!isRecord(data) || data.success !== true) {
    return { state: "pending", message: "No pudimos registrar el resultado de Transbank. El pago permanece protegido." };
  }

  return {
    state: "retryable",
    message: action === "cancel"
      ? "El pago no fue autorizado; el intento se canceló y puedes volver al checkout."
      : "Transbank rechazó el intento; ya puedes volver al checkout y pagar de nuevo.",
  };
}

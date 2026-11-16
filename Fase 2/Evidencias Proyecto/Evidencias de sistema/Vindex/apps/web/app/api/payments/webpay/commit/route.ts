import { NextRequest, NextResponse } from "next/server";
import { validateMallCommitResponse } from "@/lib/checkout/payment-validation";
import {
  CANCEL_TOKEN_COOKIE,
  createMallTransaction,
  getPublicOrigin,
  isRecord,
  RETURN_TOKEN_COOKIE,
} from "@/lib/checkout/webpay";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const noCacheJson = (body: Record<string, unknown>, status = 200) =>
  NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });

type ExpectedDetail = {
  amount: number;
  commerceCode: string;
  buyOrder: string;
};

const parseClaim = (value: unknown) => {
  if (!isRecord(value)) return null;
  if (
    typeof value.state !== "string"
    || typeof value.order_id !== "number"
  ) return null;

  const details: ExpectedDetail[] = [];
  if (value.state === "claimed") {
    if (
      typeof value.transaction_id !== "string"
      || typeof value.mall_buy_order !== "string"
      || !Array.isArray(value.details)
    ) return null;

    for (const detail of value.details) {
      if (
        !isRecord(detail)
        || typeof detail.amount !== "number"
        || !Number.isSafeInteger(detail.amount)
        || typeof detail.commerceCode !== "string"
        || typeof detail.buyOrder !== "string"
      ) return null;
      details.push({
        amount: detail.amount,
        commerceCode: detail.commerceCode,
        buyOrder: detail.buyOrder,
      });
    }
    if (details.length < 1 || details.length > 2) return null;
  }

  return {
    state: value.state,
    orderId: value.order_id,
    transactionId: typeof value.transaction_id === "string" ? value.transaction_id : null,
    mallBuyOrder: typeof value.mall_buy_order === "string" ? value.mall_buy_order : null,
    paymentStatus: typeof value.payment_status === "string" ? value.payment_status : null,
    details,
  };
};

const isSameOrigin = (request: NextRequest) => {
  try {
    const origin = request.headers.get("origin");
    if (origin && origin !== getPublicOrigin(request.url)) return false;
    return request.headers.get("sec-fetch-site") !== "cross-site";
  } catch {
    return false;
  }
};

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return noCacheJson({ state: "error", message: "Solicitud no permitida." }, 403);

  const authClient = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await authClient.auth.getUser();
  if (authError || !user) {
    return noCacheJson({ state: "authentication_required" }, 401);
  }

  const token = request.cookies.get(RETURN_TOKEN_COOKIE)?.value;
  const cancelledToken = request.cookies.get(CANCEL_TOKEN_COOKIE)?.value;
  const activeToken = token ?? cancelledToken;
  const response = (body: Record<string, unknown>, status = 200) => {
    const result = noCacheJson(body, status);
    result.cookies.set(RETURN_TOKEN_COOKIE, "", { path: "/api/payments/webpay/commit", maxAge: 0 });
    result.cookies.set(CANCEL_TOKEN_COOKIE, "", { path: "/api/payments/webpay/commit", maxAge: 0 });
    return result;
  };

  if (!activeToken) return noCacheJson({ state: "invalid_token" }, 400);

  let adminClient: ReturnType<typeof createSupabaseAdminClient>;
  try {
    adminClient = createSupabaseAdminClient();
  } catch {
    console.error("Falta configurar la clave de servidor de Supabase para Webpay.");
    return noCacheJson({ state: "error", message: "El servidor de pagos no está configurado todavía." }, 503);
  }
  if (cancelledToken) {
    const { data, error } = await adminClient.rpc("cancel_webpay_checkout", {
      p_user_id: user.id,
      p_token: cancelledToken,
    });
    if (error) {
      console.error("No se pudo registrar la cancelación de Webpay:", error.message);
      return response({ state: "error" }, 500);
    }
    const result = isRecord(data) ? data : null;
    if (!result?.success || typeof result.order_id !== "number") {
      return response({ state: "invalid_token" }, 404);
    }
    return response({
      state: "processed",
      orderId: result.order_id,
      paymentStatus: typeof result.payment_status === "string" ? result.payment_status : "cancelled",
    });
  }
  if (!token) return response({ state: "invalid_token" }, 400);

  let mallTransaction: ReturnType<typeof createMallTransaction>;
  try {
    mallTransaction = createMallTransaction();
  } catch (configurationError) {
    console.error(
      "La configuración de Webpay no está disponible para confirmar el pago:",
      configurationError instanceof Error ? configurationError.message : "error desconocido",
    );
    return noCacheJson({ state: "error" }, 503);
  }

  const { data: claimData, error: claimError } = await adminClient.rpc("claim_webpay_commit", {
    p_user_id: user.id,
    p_token: token,
  });
  if (claimError) {
    console.error("No se pudo reclamar la confirmación de Webpay:", claimError.message);
    return noCacheJson({ state: "error" }, 500);
  }

  const claim = parseClaim(claimData);
  if (!claim || !isRecord(claimData) || claimData.success !== true) {
    return response({ state: "invalid_token" }, 404);
  }
  if (claim.state === "processed" || claim.state === "already_processing") {
    return response({
      state: claim.state,
      orderId: claim.orderId,
      paymentStatus: claim.paymentStatus,
    });
  }
  if (
    claim.state !== "claimed"
    || !claim.transactionId
    || !claim.mallBuyOrder
  ) {
    return response({ state: "error" }, 409);
  }

  try {
    const responseFromTransbank: unknown = await mallTransaction.commit(token);
    const validated = validateMallCommitResponse(
      { mallBuyOrder: claim.mallBuyOrder, details: claim.details },
      responseFromTransbank,
    );
    const rawResponse = JSON.parse(JSON.stringify(validated.rawResponse)) as unknown;
    const { data: finalData, error: finalizeError } = await adminClient.rpc("finalize_webpay_commit", {
      p_user_id: user.id,
      p_transaction_id: claim.transactionId,
      p_results: validated.results,
      p_raw_response: rawResponse,
    });

    if (finalizeError) {
      console.error("No se pudo guardar el resultado de Webpay:", finalizeError.message);
      const { error: reviewError } = await adminClient.rpc("record_webpay_communication_error", {
        p_user_id: user.id,
        p_transaction_id: claim.transactionId,
      });
      if (reviewError) console.error("No se pudo marcar el pago para revisión manual:", reviewError.message);
      return response({ state: "communication_error", orderId: claim.orderId }, 502);
    }

    const finalResult = isRecord(finalData) ? finalData : null;
    if (!finalResult?.success) {
      return response({ state: "communication_error", orderId: claim.orderId }, 502);
    }

    return response({
      state: typeof finalResult.state === "string" ? finalResult.state : "processed",
      orderId: typeof finalResult.order_id === "number" ? finalResult.order_id : claim.orderId,
      paymentStatus: typeof finalResult.payment_status === "string" ? finalResult.payment_status : "payment_review",
    });
  } catch (commitError) {
    console.error(
      "La confirmación de Webpay no pudo completarse; requiere revisión antes de reintentar:",
      commitError instanceof Error ? commitError.message : "error desconocido",
    );
    const { error: reviewError } = await adminClient.rpc("record_webpay_communication_error", {
      p_user_id: user.id,
      p_transaction_id: claim.transactionId,
    });
    if (reviewError) console.error("No se pudo marcar el pago para revisión manual:", reviewError.message);
    return response({ state: "communication_error", orderId: claim.orderId }, 502);
  }
}

import { NextRequest, NextResponse } from "next/server";
import { validateAdvertisingCommitResponse } from "@/lib/checkout/advertising-validation";
import { createAdvertisingTransaction, getPublicOrigin, isRecord } from "@/lib/checkout/webpay";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const RETURN_TOKEN_COOKIE = "vindex_ad_return_token";
const CANCEL_TOKEN_COOKIE = "vindex_ad_cancel_token";
const CANCEL_ORDER_COOKIE = "vindex_ad_cancel_order";

const json = (body: Record<string, unknown>, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

const isSameOrigin = (request: NextRequest) => {
  try {
    const origin = request.headers.get("origin");
    if (origin && origin !== getPublicOrigin(request.url)) return false;
    return request.headers.get("sec-fetch-site") !== "cross-site";
  } catch {
    return false;
  }
};

const isCommitClaim = (value: unknown): value is {
  state: string;
  transaction_id: string;
  product_id: number;
  buy_order?: string;
  amount?: number;
  payment_status?: string;
} => isRecord(value)
  && typeof value.state === "string"
  && typeof value.transaction_id === "string"
  && typeof value.product_id === "number";

const clearCookies = (response: NextResponse) => {
  for (const name of [RETURN_TOKEN_COOKIE, CANCEL_TOKEN_COOKIE, CANCEL_ORDER_COOKIE]) {
    response.cookies.set(name, "", {
      path: "/api/payments/advertising/commit",
      maxAge: 0,
    });
  }
  return response;
};

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return json({ state: "error", message: "Solicitud no permitida." }, 403);

  const authClient = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await authClient.auth.getUser();
  if (authError || !user) return json({ state: "authentication_required" }, 401);

  const token = request.cookies.get(RETURN_TOKEN_COOKIE)?.value;
  const cancelToken = request.cookies.get(CANCEL_TOKEN_COOKIE)?.value ?? null;
  const cancelOrder = request.cookies.get(CANCEL_ORDER_COOKIE)?.value ?? null;
  const withClearedCookies = (body: Record<string, unknown>, status = 200) =>
    clearCookies(json(body, status));

  let adminClient: ReturnType<typeof createSupabaseAdminClient>;
  try {
    adminClient = createSupabaseAdminClient();
  } catch {
    console.error("Falta configurar la clave de servidor de Supabase para pagos de publicidad.");
    return json({ state: "error", message: "El servidor de pagos no está configurado todavía." }, 503);
  }

  if (cancelToken || cancelOrder) {
    const { data, error } = await adminClient.rpc("cancel_product_ad_payment", {
      p_user_id: user.id,
      p_token: cancelToken,
      p_buy_order: cancelOrder,
    });
    if (error) {
      console.error("No se pudo registrar la cancelación del pago de publicidad:", error.message);
      return withClearedCookies({ state: "communication_error" }, 500);
    }
    const result = isRecord(data) ? data : null;
    if (!result?.success) return withClearedCookies({ state: "invalid_token" }, 400);
    return withClearedCookies({
      state: typeof result.payment_status === "string" ? result.payment_status : "cancelled",
      transactionId: typeof result.transaction_id === "string" ? result.transaction_id : null,
      productId: typeof result.product_id === "number" ? result.product_id : null,
    });
  }

  if (!token) return json({ state: "invalid_token" }, 400);

  const { data: claimData, error: claimError } = await adminClient.rpc("claim_product_ad_commit", {
    p_user_id: user.id,
    p_token: token,
  });
  if (claimError) {
    console.error("No se pudo reservar la confirmación de publicidad:", claimError.message);
    return withClearedCookies({ state: "communication_error" }, 500);
  }
  if (!isCommitClaim(claimData) || claimData.state === "not_found") {
    return withClearedCookies({ state: "invalid_token" }, 400);
  }

  if (claimData.state === "processed") {
    return withClearedCookies({
      state: claimData.payment_status ?? "payment_review",
      transactionId: claimData.transaction_id,
      productId: claimData.product_id,
    });
  }
  if (claimData.state !== "claimed") {
    return json({
      state: "processing",
      transactionId: claimData.transaction_id,
      productId: claimData.product_id,
    }, 202);
  }
  if (
    typeof claimData.buy_order !== "string"
    || typeof claimData.amount !== "number"
    || !Number.isSafeInteger(claimData.amount)
  ) {
    console.error("Supabase devolvió datos inválidos al confirmar publicidad.");
    return withClearedCookies({ state: "payment_review" }, 500);
  }

  let responseFromTransbank: unknown;
  try {
    responseFromTransbank = await createAdvertisingTransaction().commit(token);
  } catch (transbankError) {
    const { error } = await adminClient.rpc("record_product_ad_communication_error", {
      p_user_id: user.id,
      p_transaction_id: claimData.transaction_id,
    });
    if (error) console.error("No se pudo registrar el error de comunicación de publicidad:", error.message);
    console.error(
      "Falló la confirmación de Webpay para publicidad:",
      transbankError instanceof Error ? transbankError.message : "error desconocido",
    );
    return withClearedCookies({ state: "communication_error" }, 502);
  }

  const paymentStatus = validateAdvertisingCommitResponse(
    responseFromTransbank,
    claimData.buy_order,
    claimData.amount,
  );
  const authorizationCode = isRecord(responseFromTransbank)
    && typeof responseFromTransbank.authorization_code === "string"
    ? responseFromTransbank.authorization_code
    : null;

  const { data: finalData, error: finalizeError } = await adminClient.rpc("finalize_product_ad_payment", {
    p_user_id: user.id,
    p_transaction_id: claimData.transaction_id,
    p_payment_status: paymentStatus,
    p_response: isRecord(responseFromTransbank) ? responseFromTransbank : { invalid_response: true },
    p_authorization_code: authorizationCode,
  });
  if (finalizeError || !isRecord(finalData) || finalData.success !== true) {
    console.error("No se pudo registrar el resultado de publicidad:", finalizeError?.message ?? "respuesta RPC inválida");
    const { error: reviewError } = await adminClient.rpc("record_product_ad_communication_error", {
      p_user_id: user.id,
      p_transaction_id: claimData.transaction_id,
    });
    if (reviewError) console.error("No se pudo bloquear el reintento de publicidad:", reviewError.message);
    return withClearedCookies({
      state: "payment_review",
      transactionId: claimData.transaction_id,
      productId: claimData.product_id,
    }, 500);
  }

  return withClearedCookies({
    state: typeof finalData.payment_status === "string" ? finalData.payment_status : "payment_review",
    transactionId: claimData.transaction_id,
    productId: claimData.product_id,
  });
}

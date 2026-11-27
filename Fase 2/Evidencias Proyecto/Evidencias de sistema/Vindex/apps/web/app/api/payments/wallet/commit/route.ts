import { NextRequest, NextResponse } from "next/server";
import { validateWebpayTransactionResponse } from "@/lib/checkout/advertising-validation";
import {
  createWebpayPlusTransaction,
  getPublicOrigin,
  isRecord,
} from "@/lib/checkout/webpay";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const RETURN_TOKEN_COOKIE = "vindex_wallet_return_token";
const CANCEL_TOKEN_COOKIE = "vindex_wallet_cancel_token";
const CANCEL_ORDER_COOKIE = "vindex_wallet_cancel_order";

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

const clearCookies = (response: NextResponse) => {
  for (const name of [RETURN_TOKEN_COOKIE, CANCEL_TOKEN_COOKIE, CANCEL_ORDER_COOKIE]) {
    response.cookies.set(name, "", {
      path: "/api/payments/wallet/commit",
      maxAge: 0,
    });
  }
  return response;
};

const markForReview = async (
  adminClient: ReturnType<typeof createSupabaseAdminClient>,
  userId: string,
  transactionId: string,
) => {
  const { error } = await adminClient.rpc("mark_wallet_topup_review", {
    p_user_id: userId,
    p_transaction_id: transactionId,
  });
  if (error) console.error("No se pudo marcar la recarga Wallet para revisión:", error.message);
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
    console.error("Falta configurar la clave de servidor de Supabase para confirmar recargas.");
    return json({ state: "error", message: "El servidor de pagos no está configurado." }, 503);
  }

  if (cancelToken || cancelOrder) {
    const { data, error } = await adminClient.rpc("cancel_wallet_topup", {
      p_user_id: user.id,
      p_token: cancelToken,
      p_buy_order: cancelOrder,
    });
    if (error) {
      console.error("No se pudo registrar la cancelación de la recarga Wallet:", error.message);
      return withClearedCookies({ state: "communication_error" }, 500);
    }
    const result = isRecord(data) ? data : null;
    if (!result?.success) return withClearedCookies({ state: "invalid_token" }, 400);
    return withClearedCookies({
      state: typeof result.payment_status === "string" ? result.payment_status : "cancelled",
      transactionId: typeof result.transaction_id === "string" ? result.transaction_id : null,
      amount: typeof result.amount === "number" ? result.amount : null,
    });
  }

  if (!token) return json({ state: "invalid_token" }, 400);

  const { data: claimData, error: claimError } = await adminClient.rpc("claim_wallet_topup_commit", {
    p_user_id: user.id,
    p_token: token,
  });
  if (claimError) {
    console.error("No se pudo reservar la confirmación de la recarga Wallet:", claimError.message);
    return withClearedCookies({ state: "communication_error" }, 500);
  }

  const claim = isRecord(claimData) ? claimData : null;
  if (
    !claim
    || claim.success !== true
    || typeof claim.state !== "string"
    || typeof claim.transaction_id !== "string"
    || !/^[0-9a-f-]{36}$/i.test(claim.transaction_id)
    || typeof claim.amount !== "number"
    || !Number.isSafeInteger(claim.amount)
  ) {
    return withClearedCookies({ state: "invalid_token" }, 404);
  }

  if (claim.state === "processed") {
    return withClearedCookies({
      state: typeof claim.payment_status === "string" ? claim.payment_status : "payment_review",
      transactionId: claim.transaction_id,
      amount: claim.amount,
    });
  }
  if (claim.state !== "claimed") {
    return withClearedCookies({
      state: "processing",
      transactionId: claim.transaction_id,
      amount: claim.amount,
    }, 202);
  }
  if (typeof claim.buy_order !== "string") {
    await markForReview(adminClient, user.id, claim.transaction_id);
    return withClearedCookies({ state: "payment_review", transactionId: claim.transaction_id }, 500);
  }

  let transaction: ReturnType<typeof createWebpayPlusTransaction>;
  try {
    transaction = createWebpayPlusTransaction();
  } catch (configurationError) {
    await markForReview(adminClient, user.id, claim.transaction_id);
    console.error(
      "No se pudo configurar Webpay para confirmar la recarga:",
      configurationError instanceof Error ? configurationError.message : "error desconocido",
    );
    return withClearedCookies({ state: "communication_error", transactionId: claim.transaction_id }, 503);
  }

  let transbankResponse: unknown;
  try {
    transbankResponse = await transaction.commit(token);
  } catch (transbankError) {
    await markForReview(adminClient, user.id, claim.transaction_id);
    console.error(
      "Falló la confirmación Webpay de la recarga:",
      transbankError instanceof Error ? transbankError.message : "error desconocido",
    );
    return withClearedCookies({ state: "communication_error", transactionId: claim.transaction_id }, 502);
  }

  const paymentStatus = validateWebpayTransactionResponse(
    transbankResponse,
    claim.buy_order,
    claim.amount,
  );
  const providerResponse = isRecord(transbankResponse)
    ? {
      buy_order: transbankResponse.buy_order,
      amount: transbankResponse.amount,
      response_code: transbankResponse.response_code,
      status: transbankResponse.status,
    }
    : { invalid_response: true };
  const authorizationCode = isRecord(transbankResponse)
    && typeof transbankResponse.authorization_code === "string"
    ? transbankResponse.authorization_code
    : null;

  const { data: finalData, error: finalizeError } = await adminClient.rpc("finalize_wallet_topup", {
    p_user_id: user.id,
    p_transaction_id: claim.transaction_id,
    p_payment_status: paymentStatus,
    p_response: providerResponse,
    p_authorization_code: authorizationCode,
  });
  if (finalizeError || !isRecord(finalData) || finalData.success !== true) {
    console.error("No se pudo registrar la confirmación de la recarga:", finalizeError?.message ?? "respuesta RPC inválida");
    await markForReview(adminClient, user.id, claim.transaction_id);
    return withClearedCookies({
      state: "payment_review",
      transactionId: claim.transaction_id,
      amount: claim.amount,
    }, 500);
  }

  return withClearedCookies({
    state: typeof finalData.payment_status === "string" ? finalData.payment_status : "payment_review",
    transactionId: claim.transaction_id,
    amount: claim.amount,
  });
}

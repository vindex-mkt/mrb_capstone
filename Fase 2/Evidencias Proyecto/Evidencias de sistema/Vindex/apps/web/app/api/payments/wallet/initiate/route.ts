import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  createWebpayPlusTransaction,
  getPublicOrigin,
  isRecord,
  isValidIntegrationRedirect,
} from "@/lib/checkout/webpay";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const MAX_TOPUP_AMOUNT = 999_999_999;

const isSameOrigin = (request: NextRequest) => {
  try {
    const origin = request.headers.get("origin");
    if (origin && origin !== getPublicOrigin(request.url)) return false;
    return request.headers.get("sec-fetch-site") !== "cross-site";
  } catch {
    return false;
  }
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
  if (!isSameOrigin(request)) {
    return NextResponse.json({ message: "Solicitud no permitida." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "El monto de la recarga no es válido." }, { status: 400 });
  }
  if (
    !isRecord(body)
    || typeof body.amount !== "number"
    || !Number.isSafeInteger(body.amount)
    || body.amount <= 0
    || body.amount > MAX_TOPUP_AMOUNT
  ) {
    return NextResponse.json({
      message: `Ingresa un monto entero entre $1 y $${MAX_TOPUP_AMOUNT.toLocaleString("es-CL")} CLP.`,
    }, { status: 400 });
  }

  const authClient = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await authClient.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ message: "Inicia sesión para ingresar saldo." }, { status: 401 });
  }

  let adminClient: ReturnType<typeof createSupabaseAdminClient>;
  let transaction: ReturnType<typeof createWebpayPlusTransaction>;
  let origin: string;
  try {
    adminClient = createSupabaseAdminClient();
    transaction = createWebpayPlusTransaction();
    origin = getPublicOrigin(request.url);
  } catch (configurationError) {
    console.error(
      "No se pudo configurar Webpay para la recarga Wallet:",
      configurationError instanceof Error ? configurationError.message : "error desconocido",
    );
    return NextResponse.json({ message: "Webpay no está configurado en el servidor." }, { status: 503 });
  }

  const { data, error } = await adminClient.rpc("create_wallet_topup", {
    p_user_id: user.id,
    p_amount: body.amount,
  });
  if (error) {
    if (error.message.includes("PENDING_WALLET_TOPUP_EXISTS")) {
      return NextResponse.json({
        message: "Ya tienes una recarga pendiente o en revisión. Confirma su estado antes de iniciar otra.",
      }, { status: 409 });
    }
    if (error.message.includes("INVALID_WALLET_TOPUP_AMOUNT")) {
      return NextResponse.json({ message: "El monto de la recarga está fuera del rango permitido." }, { status: 400 });
    }
    console.error("No se pudo preparar la recarga Wallet:", error.message);
    return NextResponse.json({ message: "No pudimos preparar la recarga." }, { status: 500 });
  }

  const payment = isRecord(data) ? data : null;
  if (
    !payment
    || typeof payment.transaction_id !== "string"
    || !/^[0-9a-f-]{36}$/i.test(payment.transaction_id)
    || typeof payment.buy_order !== "string"
    || !/^W[a-f0-9]{20}$/i.test(payment.buy_order)
    || typeof payment.amount !== "number"
    || !Number.isSafeInteger(payment.amount)
    || payment.amount !== body.amount
  ) {
    console.error("Supabase devolvió datos inválidos para la recarga Wallet.");
    if (payment && typeof payment.transaction_id === "string") {
      await markForReview(adminClient, user.id, payment.transaction_id);
    }
    const transactionId = payment
      && typeof payment.transaction_id === "string"
      && /^[0-9a-f-]{36}$/i.test(payment.transaction_id)
      ? payment.transaction_id
      : null;
    return NextResponse.json({
      message: "No pudimos preparar el pago de forma segura.",
      transactionId,
    }, { status: 500 });
  }

  const transactionId = payment.transaction_id;
  try {
    const returnUrl = new URL("/api/payments/wallet/return", origin);
    returnUrl.searchParams.set("transaction_id", transactionId);
    const response: unknown = await transaction.create(
      payment.buy_order,
      randomUUID(),
      payment.amount,
      returnUrl.toString(),
    );

    if (
      !isRecord(response)
      || typeof response.token !== "string"
      || !isValidIntegrationRedirect(response.url)
    ) {
      await markForReview(adminClient, user.id, transactionId);
      return NextResponse.json({
        message: "Transbank no devolvió una URL de pago válida. La recarga quedó en revisión.",
        transactionId,
      }, { status: 502 });
    }

    const { error: saveError } = await adminClient.rpc("save_wallet_topup_token", {
      p_user_id: user.id,
      p_transaction_id: transactionId,
      p_token: response.token,
    });
    if (saveError) {
      await markForReview(adminClient, user.id, transactionId);
      console.error("No se pudo asociar el token Webpay a la recarga:", saveError.message);
      return NextResponse.json({
        message: "No pudimos guardar de forma segura la referencia del pago. La recarga quedó en revisión.",
        transactionId,
      }, { status: 500 });
    }

    return NextResponse.json({
      paymentUrl: response.url,
      token: response.token,
      transactionId,
    });
  } catch (transbankError) {
    await markForReview(adminClient, user.id, transactionId);
    console.error(
      "Falló el inicio de Webpay para la recarga Wallet:",
      transbankError instanceof Error ? transbankError.message : "error desconocido",
    );
    return NextResponse.json({
      message: "No se pudo conectar con Transbank. La recarga quedó pendiente de revisión.",
      transactionId,
    }, { status: 502 });
  }
}

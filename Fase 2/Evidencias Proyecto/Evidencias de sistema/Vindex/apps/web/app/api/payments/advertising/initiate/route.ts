import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { featuredPlans } from "@/lib/advertising";
import { createAdvertisingTransaction, getPublicOrigin, isRecord, isValidIntegrationRedirect } from "@/lib/checkout/webpay";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const isSameOrigin = (request: NextRequest) => {
  try {
    const origin = request.headers.get("origin");
    if (origin && origin !== getPublicOrigin(request.url)) return false;
    return request.headers.get("sec-fetch-site") !== "cross-site";
  } catch {
    return false;
  }
};

const parsePayment = (value: unknown) => {
  if (!isRecord(value)) return null;
  if (
    typeof value.transaction_id !== "string"
    || typeof value.product_id !== "number"
    || typeof value.buy_order !== "string"
    || typeof value.duration_days !== "number"
    || typeof value.amount !== "number"
    || !Number.isSafeInteger(value.amount)
  ) return null;
  return {
    transactionId: value.transaction_id,
    productId: value.product_id,
    buyOrder: value.buy_order,
    durationDays: value.duration_days,
    amount: value.amount,
  };
};

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ message: "Solicitud no permitida." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "La solicitud de publicidad no es válida." }, { status: 400 });
  }

  if (
    !isRecord(body)
    || typeof body.productId !== "number"
    || !Number.isSafeInteger(body.productId)
    || body.productId <= 0
    || typeof body.durationDays !== "number"
    || !featuredPlans.some((plan) => plan.days === body.durationDays)
  ) {
    return NextResponse.json({ message: "Selecciona un producto publicado y un plan de publicidad válido." }, { status: 400 });
  }

  let origin: string;
  let transaction: ReturnType<typeof createAdvertisingTransaction>;
  try {
    origin = getPublicOrigin(request.url);
    transaction = createAdvertisingTransaction();
  } catch (configurationError) {
    console.error(
      "La configuración sandbox de Webpay para publicidad no es válida:",
      configurationError instanceof Error ? configurationError.message : "error desconocido",
    );
    return NextResponse.json({ message: "La publicidad con Webpay requiere credenciales de integración configuradas en el servidor." }, { status: 503 });
  }

  const authClient = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await authClient.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ message: "Inicia sesión para pagar publicidad." }, { status: 401 });
  }

  let adminClient: ReturnType<typeof createSupabaseAdminClient>;
  try {
    adminClient = createSupabaseAdminClient();
  } catch {
    console.error("Falta configurar la clave de servidor de Supabase para pagos de publicidad.");
    return NextResponse.json({ message: "El servidor de pagos no está configurado todavía." }, { status: 503 });
  }

  const { data, error } = await adminClient.rpc("create_product_ad_payment", {
    p_user_id: user.id,
    p_product_id: body.productId,
    p_duration_days: body.durationDays,
  });
  if (error) {
    const knownError = ["PENDING_AD_PAYMENT_EXISTS", "PUBLISHED_PRODUCT_NOT_FOUND", "INVALID_AD_PLAN"]
      .find((code) => error.message.includes(code));
    const message = knownError === "PENDING_AD_PAYMENT_EXISTS"
      ? "Este producto ya tiene un pago de publicidad pendiente o que requiere revisión."
      : knownError === "PUBLISHED_PRODUCT_NOT_FOUND"
        ? "Solo puedes promocionar productos tuyos que ya estén publicados."
        : knownError === "INVALID_AD_PLAN"
          ? "El plan de publicidad seleccionado no es válido."
          : "No pudimos preparar el pago de publicidad.";
    if (!knownError) {
      console.error("No se pudo preparar el pago de publicidad:", error.message);
    }
    const status = knownError === "PENDING_AD_PAYMENT_EXISTS" || knownError === "PUBLISHED_PRODUCT_NOT_FOUND"
      ? 409
      : knownError === "INVALID_AD_PLAN"
        ? 400
        : 500;
    return NextResponse.json({ message }, { status });
  }

  const payment = parsePayment(data);
  const plan = featuredPlans.find(({ days }) => days === body.durationDays);
  if (
    !payment
    || !plan
    || payment.productId !== body.productId
    || payment.durationDays !== body.durationDays
    || payment.amount !== plan.price
    || !/^[0-9a-f-]{36}$/i.test(payment.transactionId)
    || !/^[A][a-f0-9]{20}$/i.test(payment.buyOrder)
  ) {
    console.error("Supabase devolvió datos inválidos para el pago de publicidad.");
    if (isRecord(data) && typeof data.transaction_id === "string") {
      const { error: failError } = await adminClient.rpc("fail_product_ad_payment", {
        p_user_id: user.id,
        p_transaction_id: data.transaction_id,
      });
      if (failError) console.error("No se pudo liberar el intento de publicidad inválido:", failError.message);
    }
    return NextResponse.json({ message: "No pudimos preparar el pago de forma segura." }, { status: 500 });
  }

  const markFailed = async () => {
    const { error: failError } = await adminClient.rpc("fail_product_ad_payment", {
      p_user_id: user.id,
      p_transaction_id: payment.transactionId,
    });
    if (failError) console.error("No se pudo cerrar el intento de publicidad:", failError.message);
  };

  try {
    const returnUrl = new URL("/api/payments/advertising/return", origin);
    returnUrl.searchParams.set("transaction_id", payment.transactionId);
    const response: unknown = await transaction.create(
      payment.buyOrder,
      randomUUID(),
      payment.amount,
      returnUrl.toString(),
    );

    if (
      !isRecord(response)
      || typeof response.token !== "string"
      || !isValidIntegrationRedirect(response.url)
    ) {
      await markFailed();
      return NextResponse.json({ message: "Transbank no devolvió una URL sandbox válida para la publicidad." }, { status: 502 });
    }

    const { error: saveError } = await adminClient.rpc("save_product_ad_token", {
      p_user_id: user.id,
      p_transaction_id: payment.transactionId,
      p_token: response.token,
    });
    if (saveError) {
      await markFailed();
      console.error("No se pudo asociar el token Webpay al pago de publicidad:", saveError.message);
      return NextResponse.json({ message: "No pudimos guardar de forma segura la referencia del pago." }, { status: 500 });
    }

    return NextResponse.json({
      paymentUrl: response.url,
      token: response.token,
      transactionId: payment.transactionId,
    });
  } catch (transbankError) {
    await markFailed();
    console.error(
      "Falló el inicio de Webpay para publicidad:",
      transbankError instanceof Error ? transbankError.message : "error desconocido",
    );
    return NextResponse.json({ message: "No se pudo conectar con Transbank. El producto sigue publicado, sin promoción." }, { status: 502 });
  }
}

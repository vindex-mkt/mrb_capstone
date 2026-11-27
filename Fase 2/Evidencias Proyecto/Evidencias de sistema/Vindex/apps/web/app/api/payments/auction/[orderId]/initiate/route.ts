import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  createMallDetails,
  createMallTransaction,
  getPublicOrigin,
  getTestChildCommerceCodes,
  isRecord,
  isValidIntegrationRedirect,
} from "@/lib/checkout/webpay";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type PaymentDetail = {
  amount: number;
  commerceCode: string;
  buyOrder: string;
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

const parsePayment = (value: unknown) => {
  if (!isRecord(value) || !Array.isArray(value.details)) return null;

  const details: PaymentDetail[] = [];
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

  if (
    typeof value.transaction_id !== "string"
    || typeof value.mall_buy_order !== "string"
    || typeof value.total_amount !== "number"
    || !Number.isSafeInteger(value.total_amount)
    || details.length !== 1
    || details[0]?.amount !== value.total_amount
  ) return null;

  return {
    transactionId: value.transaction_id,
    mallBuyOrder: value.mall_buy_order,
    totalAmount: value.total_amount,
    details,
  };
};

const mapPaymentError = (message: string) => {
  if (message.includes("AUCTION_ORDER_NOT_FOUND")) {
    return { status: 404, message: "No encontramos una compra de subasta pendiente en tu cuenta." };
  }
  if (message.includes("AUCTION_PAYMENT_WINDOW_CLOSED")) {
    return { status: 410, message: "El plazo de 24 horas para pagar esta subasta ya venció." };
  }
  if (message.includes("PENDING_PAYMENT_EXISTS")) {
    return { status: 409, message: "Ya existe un intento Webpay pendiente para esta compra. Revísalo en Mis compras." };
  }
  return { status: 500, message: "No pudimos preparar el pago de la subasta. Inténtalo nuevamente." };
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> },
) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ message: "Solicitud no permitida." }, { status: 403 });
  }

  const orderId = Number((await params).orderId);
  if (!Number.isSafeInteger(orderId) || orderId <= 0) {
    return NextResponse.json({ message: "El identificador de compra no es válido." }, { status: 400 });
  }

  const authClient = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await authClient.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ message: "Inicia sesión para pagar la subasta." }, { status: 401 });
  }

  let adminClient: ReturnType<typeof createSupabaseAdminClient>;
  let origin: string;
  let mallTransaction: ReturnType<typeof createMallTransaction>;
  let commerceCode: string;
  try {
    adminClient = createSupabaseAdminClient();
    origin = getPublicOrigin(request.url);
    mallTransaction = createMallTransaction();
    commerceCode = getTestChildCommerceCodes()[0] ?? "";
  } catch (configurationError) {
    console.error(
      "La configuración Webpay no está disponible para el pago de subasta:",
      configurationError instanceof Error ? configurationError.message : "error desconocido",
    );
    return NextResponse.json({ message: "Webpay está disponible únicamente con credenciales de integración configuradas en el servidor." }, { status: 503 });
  }

  const { data, error } = await adminClient.rpc("create_auction_payment_transaction", {
    p_user_id: user.id,
    p_order_id: orderId,
    p_commerce_code: commerceCode,
  });
  if (error) {
    const mappedError = mapPaymentError(error.message);
    if (mappedError.status === 500) {
      console.error("No se pudo crear el intento de pago de subasta:", error.message);
    }
    return NextResponse.json({ message: mappedError.message }, { status: mappedError.status });
  }

  const payment = parsePayment(data);
  if (!payment) {
    console.error("La base de datos devolvió detalles inválidos para el pago de subasta.");
    return NextResponse.json({ message: "No pudimos preparar el pago de forma segura." }, { status: 500 });
  }

  const failInitiation = async () => {
    const { error: failError } = await adminClient.rpc("fail_auction_payment_initiation", {
      p_user_id: user.id,
      p_transaction_id: payment.transactionId,
    });
    if (failError) {
      console.error("No se pudo cerrar el intento fallido de pago de subasta:", failError.message);
    }
  };

  try {
    const response: unknown = await mallTransaction.create(
      payment.mallBuyOrder,
      randomUUID(),
      new URL("/api/payments/webpay/return", origin).toString(),
      createMallDetails(payment.details),
    );

    if (
      !isRecord(response)
      || typeof response.token !== "string"
      || !isValidIntegrationRedirect(response.url)
    ) {
      await failInitiation();
      return NextResponse.json({ message: "Transbank no devolvió una URL de integración válida." }, { status: 502 });
    }

    const { error: saveTokenError } = await adminClient.rpc("save_webpay_token", {
      p_user_id: user.id,
      p_transaction_id: payment.transactionId,
      p_token: response.token,
    });
    if (saveTokenError) {
      await failInitiation();
      console.error("No se pudo asociar el token Webpay al pago de subasta:", saveTokenError.message);
      return NextResponse.json({ message: "No pudimos guardar de forma segura la referencia del pago." }, { status: 500 });
    }

    return NextResponse.json({
      paymentUrl: response.url,
      token: response.token,
    });
  } catch (transbankError) {
    await failInitiation();
    console.error(
      "Falló el inicio de Webpay para el pago de subasta:",
      transbankError instanceof Error ? transbankError.message : "error desconocido",
    );
    return NextResponse.json({ message: "No se pudo conectar con Transbank. Tu compra sigue disponible dentro del plazo." }, { status: 502 });
  }
}

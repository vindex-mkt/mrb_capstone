import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createMallDetails, createMallTransaction, getPublicOrigin, getTestChildCommerceCodes, isRecord, isValidIntegrationRedirect } from "@/lib/checkout/webpay";
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

const checkoutError = (message: string) => {
  if (message.includes("CART_SELLER_LIMIT")) {
    return {
      status: 409,
      message: "Por limitaciones del ambiente de pruebas de Transbank, actualmente solo puedes comprar productos de hasta dos vendedores diferentes en una misma compra.",
    };
  }
  if (message.includes("CART_EMPTY")) return { status: 400, message: "Tu carrito está vacío." };
  if (message.includes("PRODUCT_UNAVAILABLE")) {
    return { status: 409, message: "Uno o más productos ya no están disponibles o no tienen stock suficiente." };
  }
  if (message.includes("PENDING_PAYMENT_EXISTS")) {
    return { status: 409, message: "Ya tienes un pago pendiente de confirmación. Espera el resultado antes de iniciar otro." };
  }
  if (message.includes("INVALID_CLP_AMOUNT")) {
    return { status: 400, message: "Los precios deben estar expresados en pesos chilenos enteros para pagar con Webpay." };
  }
  return { status: 500, message: "No pudimos preparar el pago. Inténtalo nuevamente más tarde." };
};

type CheckoutDetails = {
  amount: number;
  commerceCode: string;
  buyOrder: string;
};

const parseCheckout = (value: unknown) => {
  if (!isRecord(value) || !Array.isArray(value.details)) return null;
  const details: CheckoutDetails[] = [];

  for (const detail of value.details) {
    if (
      !isRecord(detail)
      || typeof detail.amount !== "number"
      || !Number.isSafeInteger(detail.amount)
      || typeof detail.commerceCode !== "string"
      || typeof detail.buyOrder !== "string"
    ) {
      return null;
    }
    details.push({
      amount: detail.amount,
      commerceCode: detail.commerceCode,
      buyOrder: detail.buyOrder,
    });
  }

  if (
    typeof value.transaction_id !== "string"
    || typeof value.order_id !== "number"
    || typeof value.mall_buy_order !== "string"
    || typeof value.total_amount !== "number"
    || !Number.isSafeInteger(value.total_amount)
    || details.length < 1
    || details.length > 2
    || details.reduce((sum, detail) => sum + detail.amount, 0) !== value.total_amount
    || new Set(details.map((detail) => detail.commerceCode)).size !== details.length
  ) {
    return null;
  }

  return {
    transactionId: value.transaction_id,
    orderId: value.order_id,
    mallBuyOrder: value.mall_buy_order,
    totalAmount: value.total_amount,
    details,
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
    return NextResponse.json({ message: "La solicitud de pago no es válida." }, { status: 400 });
  }

  if (
    !isRecord(body)
    || typeof body.shippingAddress !== "string"
    || typeof body.shippingMethod !== "string"
    || !["standard", "pickup"].includes(body.shippingMethod)
  ) {
    return NextResponse.json({ message: "Completa los datos de envío antes de pagar." }, { status: 400 });
  }

  let origin: string;
  let mallTransaction: ReturnType<typeof createMallTransaction>;
  try {
    origin = getPublicOrigin(request.url);
    mallTransaction = createMallTransaction();
  } catch (configurationError) {
    console.error(
      "La configuración de Webpay Plus Mall no es válida:",
      configurationError instanceof Error ? configurationError.message : "error desconocido",
    );
    return NextResponse.json({ message: "Webpay está disponible únicamente con credenciales de integración configuradas en el servidor." }, { status: 503 });
  }

  const authClient = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await authClient.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ message: "Inicia sesión para continuar con el pago." }, { status: 401 });
  }

  let adminClient: ReturnType<typeof createSupabaseAdminClient>;
  try {
    adminClient = createSupabaseAdminClient();
  } catch {
    console.error("Falta configurar la clave de servidor de Supabase para Webpay.");
    return NextResponse.json({ message: "El servidor de pagos no está configurado todavía." }, { status: 503 });
  }

  const { data: cart, error: cartError } = await adminClient
    .from("carts")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (cartError) {
    console.error("No se pudo verificar el carrito antes de iniciar Webpay:", cartError.message);
    return NextResponse.json({ message: "No pudimos verificar tu carrito. Inténtalo nuevamente." }, { status: 500 });
  }

  if (cart) {
    const { data: cartItems, error: cartItemsError } = await adminClient
      .from("cart_items")
      .select("product_id")
      .eq("cart_id", cart.id);
    if (cartItemsError) {
      console.error("No se pudieron verificar los productos del carrito antes de iniciar Webpay:", cartItemsError.message);
      return NextResponse.json({ message: "No pudimos verificar tu carrito. Inténtalo nuevamente." }, { status: 500 });
    }

    const productIds = (cartItems ?? []).map((item) => item.product_id);
    if (productIds.length > 0) {
      const { data: products, error: productsError } = await adminClient
        .from("products")
        .select("seller_id")
        .in("id", productIds);
      if (productsError) {
        console.error("No se pudieron verificar los vendedores del carrito antes de iniciar Webpay:", productsError.message);
        return NextResponse.json({ message: "No pudimos verificar tu carrito. Inténtalo nuevamente." }, { status: 500 });
      }

      if ((products ?? []).some((product) => product.seller_id === user.id)) {
        return NextResponse.json({ message: "No puedes comprar tus propios productos." }, { status: 409 });
      }
    }
  }

  const { data: checkoutData, error: createError } = await adminClient.rpc("create_webpay_checkout", {
    p_user_id: user.id,
    p_shipping_address: body.shippingAddress,
    p_shipping_method: body.shippingMethod,
    p_child_commerce_codes: getTestChildCommerceCodes(),
  });
  if (createError) {
    const mappedError = checkoutError(createError.message);
    if (mappedError.status === 500) console.error("No se pudo preparar checkout Webpay:", createError.message);
    return NextResponse.json({ message: mappedError.message }, { status: mappedError.status });
  }

  const checkout = parseCheckout(checkoutData);
  if (!checkout) {
    console.error("La base de datos devolvió detalles inválidos para Webpay.");
    if (isRecord(checkoutData) && typeof checkoutData.transaction_id === "string") {
      const { error } = await adminClient.rpc("fail_webpay_checkout", {
        p_user_id: user.id,
        p_transaction_id: checkoutData.transaction_id,
      });
      if (error) console.error("No se pudo liberar stock tras invalidar el checkout:", error.message);
    }
    return NextResponse.json({ message: "No pudimos preparar el pago de forma segura." }, { status: 500 });
  }

  const markCheckoutFailed = async () => {
    const { error } = await adminClient.rpc("fail_webpay_checkout", {
      p_user_id: user.id,
      p_transaction_id: checkout.transactionId,
    });
    if (error) console.error("No se pudo liberar la reserva de stock del checkout Webpay:", error.message);
  };

  try {
    const returnUrl = new URL("/api/payments/webpay/return", origin).toString();
    const details = createMallDetails(checkout.details);
    const response: unknown = await mallTransaction.create(
      checkout.mallBuyOrder,
      randomUUID(),
      returnUrl,
      details,
    );

    if (
      !isRecord(response)
      || typeof response.token !== "string"
      || !isValidIntegrationRedirect(response.url)
    ) {
      await markCheckoutFailed();
      return NextResponse.json({ message: "Transbank no devolvió una URL de integración válida." }, { status: 502 });
    }

    const { error: saveTokenError } = await adminClient.rpc("save_webpay_token", {
      p_user_id: user.id,
      p_transaction_id: checkout.transactionId,
      p_token: response.token,
    });
    if (saveTokenError) {
      await markCheckoutFailed();
      console.error("No se pudo asociar el token Webpay al checkout:", saveTokenError.message);
      return NextResponse.json({ message: "No pudimos guardar de forma segura la referencia del pago." }, { status: 500 });
    }

    return NextResponse.json({
      paymentUrl: response.url,
      token: response.token,
      orderId: checkout.orderId,
    });
  } catch (transbankError) {
    await markCheckoutFailed();
    console.error(
      "Falló el inicio de Webpay Plus Mall:",
      transbankError instanceof Error ? transbankError.message : "error desconocido",
    );
    return NextResponse.json({ message: "No se pudo conectar con Transbank. Tu carrito se mantuvo sin cobrar." }, { status: 502 });
  }
}

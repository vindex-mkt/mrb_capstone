import { NextRequest, NextResponse } from "next/server";
import { isRecord } from "@/lib/checkout/webpay";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const authClient = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await authClient.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ message: "Inicia sesión para consultar esta compra." }, { status: 401 });
  }

  const orderId = Number(request.nextUrl.searchParams.get("order_id"));
  if (!Number.isSafeInteger(orderId) || orderId <= 0) {
    return NextResponse.json({ message: "El identificador de compra no es válido." }, { status: 400 });
  }

  let adminClient: ReturnType<typeof createSupabaseAdminClient>;
  try {
    adminClient = createSupabaseAdminClient();
  } catch {
    console.error("Falta configurar la clave de servidor de Supabase para Webpay.");
    return NextResponse.json({ message: "El servidor de pagos no está configurado todavía." }, { status: 503 });
  }
  const { data, error } = await adminClient.rpc("get_webpay_payment_status", {
    p_user_id: user.id,
    p_order_id: orderId,
  });
  if (error) {
    console.error("No se pudo cargar el estado Webpay:", error.message);
    return NextResponse.json({ message: "No pudimos consultar el estado del pago." }, { status: 500 });
  }

  if (!isRecord(data) || data.success !== true) {
    return NextResponse.json({ message: "No encontramos esta compra." }, { status: 404 });
  }

  return NextResponse.json({
    orderId: data.order_id,
    paymentStatus: data.payment_status,
    orderStatus: data.order_status,
    paidItems: data.paid_items,
  }, {
    headers: { "Cache-Control": "no-store" },
  });
}

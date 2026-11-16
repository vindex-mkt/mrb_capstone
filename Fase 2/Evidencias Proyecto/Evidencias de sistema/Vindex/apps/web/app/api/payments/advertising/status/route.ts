import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";
import { isRecord } from "@/lib/checkout/webpay";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const transactionId = request.nextUrl.searchParams.get("transaction_id");
  if (!transactionId || !/^[0-9a-f-]{36}$/i.test(transactionId)) {
    return NextResponse.json({ message: "La referencia de pago no es válida." }, { status: 400 });
  }

  const authClient = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await authClient.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ state: "authentication_required" }, { status: 401 });
  }

  let adminClient: ReturnType<typeof createSupabaseAdminClient>;
  try {
    adminClient = createSupabaseAdminClient();
  } catch {
    console.error("Falta configurar la clave de servidor de Supabase para consultar publicidad.");
    return NextResponse.json({ state: "error" }, { status: 503 });
  }

  const { data, error } = await adminClient.rpc("get_product_ad_payment_status", {
    p_user_id: user.id,
    p_transaction_id: transactionId,
  });
  if (error) {
    console.error("No se pudo consultar el pago de publicidad:", error.message);
    return NextResponse.json({ state: "error" }, { status: 500 });
  }
  if (!isRecord(data) || data.success !== true || typeof data.payment_status !== "string") {
    return NextResponse.json({ state: "invalid_token" }, { status: 404 });
  }

  return NextResponse.json({
    transactionId: data.transaction_id,
    productId: data.product_id,
    state: data.payment_status,
  }, { headers: { "Cache-Control": "no-store" } });
}

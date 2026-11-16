import { NextResponse } from "next/server";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";
import { listBuyerPendingPayments } from "@/lib/checkout/pending-payments";

export const runtime = "nodejs";

export async function GET() {
  const authClient = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await authClient.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ message: "Inicia sesión para consultar pagos pendientes." }, { status: 401 });
  }

  try {
    const adminClient = createSupabaseAdminClient();
    const payments = await listBuyerPendingPayments(adminClient, user.id, true);
    return NextResponse.json({ payments }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error(
      "No se pudieron cargar los pagos Webpay pendientes:",
      error instanceof Error ? error.message : "error desconocido",
    );
    return NextResponse.json({ message: "No pudimos cargar tus pagos pendientes." }, { status: 500 });
  }
}

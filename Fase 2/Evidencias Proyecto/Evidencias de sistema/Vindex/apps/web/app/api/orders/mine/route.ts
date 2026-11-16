import { NextResponse } from "next/server";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET() {
  const authClient = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await authClient.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ message: "Inicia sesión para consultar tus compras." }, { status: 401 });
  }

  try {
    const adminClient = createSupabaseAdminClient();
    const { data: orders, error: ordersError } = await adminClient
      .from("orders")
      .select("id, status, created_at, total, shipping_address, delivery_status, shipping_method")
      .eq("buyer_id", user.id)
      .order("created_at", { ascending: false });
    if (ordersError) throw ordersError;

    const orderIds = (orders ?? []).map((order) => order.id);
    const { data: chats, error: chatsError } = orderIds.length > 0
      ? await adminClient
        .from("order_seller_chats")
        .select("order_id, seller_id, conversation_id, seller_replied_at")
        .in("order_id", orderIds)
      : { data: [], error: null };
    if (chatsError) throw chatsError;

    return NextResponse.json(
      { orders: orders ?? [], chats: chats ?? [] },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error(
      "No se pudieron cargar las compras del comprador:",
      error instanceof Error ? error.message : "error desconocido",
    );
    return NextResponse.json({ message: "No pudimos cargar tus compras." }, { status: 500 });
  }
}

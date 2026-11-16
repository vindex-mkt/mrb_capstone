import { NextRequest, NextResponse } from "next/server";
import { getPublicOrigin } from "@/lib/checkout/webpay";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type PickupChat = {
  conversation_id?: number;
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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> },
) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ message: "Solicitud no permitida." }, { status: 403 });
  }

  const { orderId: rawOrderId } = await params;
  if (!/^\d+$/.test(rawOrderId) || !Number.isSafeInteger(Number(rawOrderId)) || Number(rawOrderId) <= 0) {
    return NextResponse.json({ message: "El identificador de la orden no es válido." }, { status: 400 });
  }

  const authClient = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await authClient.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ message: "Inicia sesión con la cuenta que realizó la compra." }, { status: 401 });
  }

  let adminClient: ReturnType<typeof createSupabaseAdminClient>;
  try {
    adminClient = createSupabaseAdminClient();
  } catch {
    console.error("Falta configurar la clave de servidor de Supabase para coordinar una compra.");
    return NextResponse.json({ message: "El servidor de compras no está configurado todavía." }, { status: 503 });
  }

  const { data: order, error: orderError } = await adminClient
    .from("orders")
    .select("id, buyer_id, status, shipping_method")
    .eq("id", Number(rawOrderId))
    .maybeSingle();
  if (orderError) {
    console.error("No se pudo verificar la orden para coordinar la entrega:", orderError.message);
    return NextResponse.json({ message: "No pudimos verificar la orden." }, { status: 500 });
  }
  if (!order || order.buyer_id !== user.id || order.status !== "paid") {
    return NextResponse.json({ message: "La orden todavía no está pagada o no pertenece a tu cuenta." }, { status: 409 });
  }
  if (order.shipping_method !== "pickup") {
    return NextResponse.json({ redirect: false });
  }

  const { data, error } = await adminClient.rpc("ensure_pickup_order_chats", {
    p_order_id: Number(rawOrderId),
    p_buyer_id: user.id,
  });
  if (error) {
    console.error("No se pudieron iniciar los chats para coordinar la entrega:", error.message);
    return NextResponse.json({ message: "No pudimos iniciar el chat de coordinación." }, { status: 500 });
  }

  if (
    typeof data !== "object"
    || data === null
    || !("success" in data)
    || data.success !== true
    || !("conversations" in data)
    || !Array.isArray(data.conversations)
  ) {
    return NextResponse.json({ message: "La orden todavía no está pagada o no requiere coordinación." }, { status: 409 });
  }

  const conversations = data.conversations as PickupChat[];
  const firstConversation = conversations.find((chat) =>
    typeof chat.conversation_id === "number" && Number.isSafeInteger(chat.conversation_id),
  );
  if (!firstConversation?.conversation_id) {
    return NextResponse.json({ message: "La compra no tiene vendedores para coordinar." }, { status: 409 });
  }

  return NextResponse.json({ conversationId: firstConversation.conversation_id });
}

import { NextResponse } from "next/server";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const paidOrderStatuses = ["paid", "completed", "delivered"];
const pageSize = 1000;

export async function GET() {
  const authClient = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await authClient.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ message: "Inicia sesión para consultar el dashboard." }, { status: 401 });
  }

  const { data: profile, error: profileError } = await authClient
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    console.error("No se pudo verificar el rol para el dashboard:", profileError.message);
    return NextResponse.json({ message: "No pudimos verificar tus permisos." }, { status: 500 });
  }
  if (profile?.role !== "admin") {
    return NextResponse.json({ message: "Tu usuario no tiene permisos de administrador." }, { status: 403 });
  }

  let adminClient: ReturnType<typeof createSupabaseAdminClient>;
  try {
    adminClient = createSupabaseAdminClient();
  } catch (error) {
    console.error("No se pudo configurar el acceso administrativo del dashboard:", error);
    return NextResponse.json({ message: "El servidor no tiene configurado el acceso a las estadísticas." }, { status: 503 });
  }

  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));
  const monthStartIso = monthStart.toISOString();
  const countLabels = [
    "productos publicados",
    "productos pendientes",
    "ofertas activas",
    "subastas activas",
    "pedidos pagados",
    "pedidos pendientes",
    "entregas pendientes",
    "pujas",
    "usuarios",
    "tiendas",
    "favoritos",
    "reseñas",
    "conversaciones",
    "mensajes",
  ];

  try {
    const countResults = await Promise.all([
      adminClient.from("products").select("id", { count: "exact", head: true })
        .eq("moderation_status", "approved").in("status", ["active", "true"]),
      adminClient.from("products").select("id", { count: "exact", head: true })
        .eq("moderation_status", "pending_review"),
      adminClient.from("products").select("id", { count: "exact", head: true })
        .eq("moderation_status", "approved").in("status", ["active", "true"])
        .not("discount_price", "is", null).gt("offer_ends_at", now.toISOString()),
      adminClient.from("products").select("id", { count: "exact", head: true })
        .eq("moderation_status", "approved").in("status", ["active", "true"])
        .eq("is_auction", true).gt("auction_ends_at", now.toISOString()),
      adminClient.from("orders").select("id", { count: "exact", head: true })
        .in("status", paidOrderStatuses),
      adminClient.from("orders").select("id", { count: "exact", head: true })
        .eq("status", "pending"),
      adminClient.from("orders").select("id", { count: "exact", head: true })
        .in("status", paidOrderStatuses).neq("delivery_status", "completed"),
      adminClient.from("bids").select("id", { count: "exact", head: true }),
      adminClient.from("profiles").select("id", { count: "exact", head: true }),
      adminClient.from("stores").select("id", { count: "exact", head: true }),
      adminClient.from("favorites").select("id", { count: "exact", head: true }),
      adminClient.from("reviews").select("id", { count: "exact", head: true }),
      adminClient.from("conversations").select("id", { count: "exact", head: true }),
      adminClient.from("messages").select("id", { count: "exact", head: true }),
    ]);

    const unavailableMetrics: string[] = [];
    countResults.forEach((result, index) => {
      if (!result.error) return;
      const label = countLabels.at(index) ?? "métrica desconocida";
      unavailableMetrics.push(label);
      console.error(`No se pudo consultar la métrica ${label}:`, result.status, result.statusText, result.error.message || "Error sin detalles.");
    });

    const salesRows: Array<{ created_at: string; subtotal: number | string; buyer_id: string }> = [];
    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await adminClient
        .from("orders")
        .select("created_at, subtotal, buyer_id")
        .in("status", paidOrderStatuses)
        .gte("created_at", monthStartIso)
        .order("created_at", { ascending: true })
        .range(offset, offset + pageSize - 1);

      if (error) {
        throw new Error(`No se pudieron consultar las ventas mensuales: ${error.message || error.code || "error sin detalles"}`);
      }
      salesRows.push(...data);
      if (data.length < pageSize) break;
    }

    const months = Array.from({ length: 6 }, (_, index) => {
      const date = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + index, 1));
      return {
        key: `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`,
        label: new Intl.DateTimeFormat("es-CL", { month: "short", timeZone: "UTC" }).format(date),
        sales: 0,
        orders: 0,
        buyerIds: new Set<string>(),
      };
    });

    for (const order of salesRows) {
      const key = order.created_at.slice(0, 7);
      const month = months.find((entry) => entry.key === key);
      if (!month) continue;
      month.sales += Number(order.subtotal);
      month.orders += 1;
      month.buyerIds.add(order.buyer_id);
    }

    const count = (index: number) => {
      const result = countResults.at(index);
      return result?.error ? null : result?.count ?? 0;
    };
    return NextResponse.json({
      generatedAt: now.toISOString(),
      unavailableMetrics,
      productsPublished: count(0),
      productsPending: count(1),
      activeOffers: count(2),
      activeAuctions: count(3),
      completedOrders: count(4),
      pendingOrders: count(5),
      pendingDeliveries: count(6),
      bids: count(7),
      users: count(8),
      stores: count(9),
      favorites: count(10),
      reviews: count(11),
      conversations: count(12),
      messages: count(13),
      salesByMonth: months.map(({ label, sales, orders, buyerIds }) => ({
        label,
        sales,
        orders,
        buyers: buyerIds.size,
      })),
    }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const errorRecord = typeof error === "object" && error !== null
      ? error as { message?: unknown; details?: unknown; hint?: unknown; code?: unknown }
      : null;
    const details = [
      error instanceof Error ? error.message : errorRecord?.message,
      errorRecord?.details,
      errorRecord?.hint,
      errorRecord?.code,
    ].filter((part): part is string => typeof part === "string" && part.length > 0).join(" ");
    console.error("No se pudieron cargar las estadísticas del dashboard:", details);
    return NextResponse.json({
      message: process.env.NODE_ENV === "development"
        ? details || "Error desconocido."
        : "No pudimos cargar las estadísticas del marketplace.",
    }, { status: 500 });
  }
}

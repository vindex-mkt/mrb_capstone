import { NextRequest, NextResponse } from "next/server";
import { getFinancePeriodRange, type FinancePeriod } from "@/lib/admin/finance-period";
import { calculateMarketplaceFinancials } from "@/lib/checkout/commission";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const pageSize = 1000;
const historyLimit = 100;

type PageResult<T> = {
  data: T[] | null;
  error: { message: string } | null;
};

type CommissionRow = {
  id: number;
  order_id: number;
  order_item_id: number;
  base_amount: number | string;
  commission_amount: number | string;
  status: "pending_settlement" | "collected" | "reversed";
  created_at: string;
  collected_at: string | null;
};

type PromotionRow = {
  id: string;
  product_id: number;
  duration_days: number;
  amount: number | string;
  status: string;
  created_at: string;
  authorized_at: string | null;
};

async function fetchAllPages<T>(
  loadPage: (from: number, to: number) => Promise<PageResult<T>>,
  label: string,
) {
  const rows: T[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await loadPage(offset, offset + pageSize - 1);
    if (error) throw new Error(`${label}: ${error.message}`);
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) return rows;
  }
}

function toAmount(value: number | string) {
  const amount = Number(value);
  if (!Number.isSafeInteger(amount) || amount < 0) {
    throw new Error("La base de datos devolvió un monto financiero fuera de rango.");
  }
  return amount;
}

function getPeriod(value: string | null): FinancePeriod | null {
  if (!value || value === "month") return "month";
  if (value === "day" || value === "year") return value;
  return null;
}

export async function GET(request: NextRequest) {
  const period = getPeriod(request.nextUrl.searchParams.get("period"));
  if (!period) {
    return NextResponse.json({ message: "El período debe ser day, month o year." }, { status: 400 });
  }

  const authClient = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await authClient.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ message: "Inicia sesión para consultar los ingresos." }, { status: 401 });
  }

  const { data: profile, error: profileError } = await authClient
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    console.error("No se pudo verificar el rol para el resumen financiero:", profileError.message);
    return NextResponse.json({ message: "No pudimos verificar tus permisos." }, { status: 500 });
  }
  if (profile?.role !== "admin") {
    return NextResponse.json({ message: "Tu usuario no tiene permisos de administrador." }, { status: 403 });
  }

  let adminClient: ReturnType<typeof createSupabaseAdminClient>;
  try {
    adminClient = createSupabaseAdminClient();
  } catch (error) {
    console.error("No se pudo configurar el acceso administrativo financiero:", error);
    return NextResponse.json({ message: "El servidor no tiene configurado el acceso a los ingresos." }, { status: 503 });
  }

  const range = getFinancePeriodRange(period);
  try {
    const [generatedCommissions, collectedCommissions, createdPromotions, authorizedPromotions] = await Promise.all([
      fetchAllPages<CommissionRow>(
        async (from, to) => await adminClient.from("order_commissions")
          .select("id, order_id, order_item_id, base_amount, commission_amount, status, created_at, collected_at")
          .gte("created_at", range.start)
          .lt("created_at", range.end)
          .order("created_at", { ascending: false })
          .range(from, to),
        "No se pudieron consultar las comisiones generadas",
      ),
      fetchAllPages<CommissionRow>(
        async (from, to) => await adminClient.from("order_commissions")
          .select("id, order_id, order_item_id, base_amount, commission_amount, status, created_at, collected_at")
          .eq("status", "collected")
          .gte("collected_at", range.start)
          .lt("collected_at", range.end)
          .order("collected_at", { ascending: false })
          .range(from, to),
        "No se pudieron consultar las comisiones cobradas",
      ),
      fetchAllPages<PromotionRow>(
        async (from, to) => await adminClient.from("product_ad_transactions")
          .select("id, product_id, duration_days, amount, status, created_at, authorized_at")
          .gte("created_at", range.start)
          .lt("created_at", range.end)
          .order("created_at", { ascending: false })
          .range(from, to),
        "No se pudieron consultar el historial de promociones",
      ),
      fetchAllPages<PromotionRow>(
        async (from, to) => await adminClient.from("product_ad_transactions")
          .select("id, product_id, duration_days, amount, status, created_at, authorized_at")
          .eq("status", "authorized")
          .gte("authorized_at", range.start)
          .lt("authorized_at", range.end)
          .order("authorized_at", { ascending: false })
          .range(from, to),
        "No se pudieron consultar las promociones autorizadas",
      ),
    ]);

    const pendingCommissions = generatedCommissions
      .filter(({ status }) => status === "pending_settlement")
      .reduce((total, row) => total + toAmount(row.commission_amount), 0);
    const commissionsGeneratedTotal = generatedCommissions
      .filter(({ status }) => status !== "reversed")
      .reduce((total, row) => total + toAmount(row.commission_amount), 0);
    const commissionsCollectedTotal = collectedCommissions
      .filter(({ status }) => status === "collected")
      .reduce((total, row) => total + toAmount(row.commission_amount), 0);
    const promotionIncome = authorizedPromotions
      .reduce((total, row) => total + toAmount(row.amount), 0);
    const accruedFinancials = calculateMarketplaceFinancials(
      generatedCommissions
        .filter(({ status }) => status !== "reversed")
        .map((row) => ({ unitPrice: toAmount(row.base_amount), quantity: 1 })),
    );
    const collectedFinancials = calculateMarketplaceFinancials(
      collectedCommissions
        .filter(({ status }) => status === "collected")
        .map((row) => ({ unitPrice: toAmount(row.base_amount), quantity: 1 })),
    );

    const historyByKey = new Map<string, {
      id: string;
      type: "commission" | "promotion";
      date: string;
      description: string;
      reference: string;
      baseAmount: number | null;
      amount: number;
      status: string;
    }>();

    for (const row of generatedCommissions) {
      historyByKey.set(`commission-generated-${row.id}`, {
        id: `commission-generated-${row.id}`,
        type: "commission",
        date: row.created_at,
        description: "Comisión generada",
        reference: `Orden #${row.order_id} · Línea #${row.order_item_id}`,
        baseAmount: toAmount(row.base_amount),
        amount: toAmount(row.commission_amount),
        status: row.status,
      });
    }

    for (const row of collectedCommissions) {
      if (!row.collected_at) continue;
      historyByKey.set(`commission-collected-${row.id}`, {
        id: `commission-collected-${row.id}`,
        type: "commission",
        date: row.collected_at,
        description: "Comisión cobrada",
        reference: `Orden #${row.order_id} · Línea #${row.order_item_id}`,
        baseAmount: toAmount(row.base_amount),
        amount: toAmount(row.commission_amount),
        status: row.status,
      });
    }

    const promotionRows = new Map<string, PromotionRow>();
    for (const row of [...createdPromotions, ...authorizedPromotions]) promotionRows.set(row.id, row);
    for (const row of promotionRows.values()) {
      historyByKey.set(`promotion-${row.id}`, {
        id: `promotion-${row.id}`,
        type: "promotion",
        date: row.authorized_at ?? row.created_at,
        description: row.status === "authorized" ? "Promoción pagada" : "Pago de promoción",
        reference: `Producto #${row.product_id} · ${row.duration_days} días`,
        baseAmount: null,
        amount: toAmount(row.amount),
        status: row.status,
      });
    }

    const history = [...historyByKey.values()]
      .sort((left, right) => right.date.localeCompare(left.date))
      .slice(0, historyLimit);

    return NextResponse.json({
      period,
      periodLabel: range.label,
      range: { start: range.start, end: range.end },
      summary: {
        commissionsGenerated: commissionsGeneratedTotal,
        commissionsCollected: commissionsCollectedTotal,
        commissionsPending: pendingCommissions,
        salesGross: accruedFinancials.salesGross,
        vindexCommissionAccruedGross: accruedFinancials.vindexCommissionGross,
        sellerVindexCommissionEstimate: accruedFinancials.sellerVindexCommission,
        buyerVindexCommissionEstimate: accruedFinancials.buyerVindexCommission,
        operationalCostsGross: accruedFinancials.operationalCostsGross,
        sellerOperationalCost: accruedFinancials.sellerOperationalCost,
        buyerOperationalCost: accruedFinancials.buyerOperationalCost,
        vindexVatAssumedEstimate: accruedFinancials.vindexVatEstimate,
        vindexNetAfterVatEstimate: accruedFinancials.vindexNetAfterVatEstimate,
        sellerNetEstimate: accruedFinancials.sellerNetEstimate,
        vindexCommissionCollectedNetAfterVatEstimate: collectedFinancials.vindexNetAfterVatEstimate,
        promotionsAuthorizedInSandbox: promotionIncome,
        totalRecordedIncome: commissionsCollectedTotal + promotionIncome,
      },
      history,
      historyLimit,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido.";
    console.error("No se pudieron cargar los ingresos del dashboard:", message);
    return NextResponse.json({
      message: process.env.NODE_ENV === "development"
        ? message
        : "No pudimos cargar los ingresos del marketplace.",
    }, { status: 500 });
  }
}

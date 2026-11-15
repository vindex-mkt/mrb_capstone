"use client";

import { useEffect, useState } from "react";

type Period = "day" | "month" | "year";

type FinanceHistoryItem = {
  id: string;
  type: "commission" | "promotion";
  date: string;
  description: string;
  reference: string;
  baseAmount: number | null;
  amount: number;
  status: string;
};

type FinanceResponse = {
  period: Period;
  periodLabel: string;
  summary: {
    commissionsGenerated: number;
    commissionsCollected: number;
    commissionsPending: number;
    salesGross: number;
    vindexCommissionAccruedGross: number;
    sellerVindexCommissionEstimate: number;
    buyerVindexCommissionEstimate: number;
    operationalCostsGross: number;
    sellerOperationalCost: number;
    buyerOperationalCost: number;
    vindexVatAssumedEstimate: number;
    vindexNetAfterVatEstimate: number;
    sellerNetEstimate: number;
    vindexCommissionCollectedNetAfterVatEstimate: number;
    promotionsAuthorizedInSandbox: number;
    totalRecordedIncome: number;
  };
  history: FinanceHistoryItem[];
  historyLimit: number;
};

const currencyFormatter = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

const dateFormatter = new Intl.DateTimeFormat("es-CL", {
  dateStyle: "short",
  timeStyle: "short",
});

function isFinanceResponse(value: unknown): value is FinanceResponse {
  if (typeof value !== "object" || value === null) return false;
  const result = value as Partial<FinanceResponse>;
  const summary = result.summary;
  const moneyFields = [
    summary?.commissionsGenerated,
    summary?.commissionsCollected,
    summary?.commissionsPending,
    summary?.salesGross,
    summary?.vindexCommissionAccruedGross,
    summary?.sellerVindexCommissionEstimate,
    summary?.buyerVindexCommissionEstimate,
    summary?.operationalCostsGross,
    summary?.sellerOperationalCost,
    summary?.buyerOperationalCost,
    summary?.vindexVatAssumedEstimate,
    summary?.vindexNetAfterVatEstimate,
    summary?.sellerNetEstimate,
    summary?.vindexCommissionCollectedNetAfterVatEstimate,
    summary?.promotionsAuthorizedInSandbox,
    summary?.totalRecordedIncome,
  ];

  return ["day", "month", "year"].includes(result.period ?? "")
    && typeof result.periodLabel === "string"
    && moneyFields.every((amount) => typeof amount === "number" && Number.isSafeInteger(amount) && amount >= 0)
    && Array.isArray(result.history)
    && result.history.every((item) =>
      typeof item.id === "string"
      && (item.type === "commission" || item.type === "promotion")
      && typeof item.date === "string"
      && typeof item.description === "string"
      && typeof item.reference === "string"
      && (item.baseAmount === null || typeof item.baseAmount === "number")
      && typeof item.amount === "number"
      && typeof item.status === "string",
    )
    && typeof result.historyLimit === "number";
}

function statusLabel(status: string) {
  switch (status) {
    case "pending_settlement": return "Pendiente de liquidación";
    case "collected": return "Cobrada";
    case "reversed": return "Revertida";
    case "authorized": return "Autorizada (sandbox)";
    case "rejected": return "Rechazada";
    case "cancelled": return "Cancelada";
    case "payment_review": return "En revisión";
    case "communication_error": return "Error de comunicación";
    case "created": return "Creada";
    case "initiated": return "Iniciada";
    case "processing": return "En proceso";
    default: return status;
  }
}

function SummaryCard({ title, amount, detail }: { title: string; amount: number; detail: string }) {
  return (
    <article className="rounded-2xl border border-border bg-surface p-4 shadow-card">
      <p className="text-sm font-medium text-muted-foreground">{title}</p>
      <p className="mt-2 text-xl font-bold tracking-tight text-foreground">{currencyFormatter.format(amount)}</p>
      <p className="mt-2 text-xs text-muted-foreground">{detail}</p>
    </article>
  );
}

export default function FinanceRevenuePanel() {
  const [period, setPeriod] = useState<Period>("month");
  const [data, setData] = useState<FinanceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let current = true;
    setData(null);
    setLoading(true);
    setError("");

    const loadFinance = async () => {
      try {
        const response = await fetch(`/api/admin/finance?period=${period}`, { cache: "no-store" });
        const result: unknown = await response.json();
        if (!response.ok) {
          const message = typeof result === "object" && result !== null && "message" in result
            ? String(result.message)
            : "No se pudieron cargar los ingresos.";
          throw new Error(message);
        }
        if (!isFinanceResponse(result)) throw new Error("El servidor devolvió datos financieros inválidos.");
        if (current) setData(result);
      } catch (loadError) {
        if (current) setError(loadError instanceof Error ? loadError.message : "No se pudieron cargar los ingresos.");
      } finally {
        if (current) setLoading(false);
      }
    };

    void loadFinance();
    return () => {
      current = false;
    };
  }, [period]);

  return (
    <section aria-labelledby="finance-revenue-heading" className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="finance-revenue-heading" className="text-xl font-semibold text-foreground">Ingresos de Vindex</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Comisiones registradas y promociones pagadas, separadas de las ventas brutas de los vendedores.
          </p>
        </div>
        <label className="grid gap-1 text-sm font-medium text-foreground">
          Período
          <select
            aria-label="Período de ingresos"
            className="min-h-10 rounded-lg border border-border bg-surface px-3 text-sm text-foreground"
            value={period}
            onChange={(event) => setPeriod(event.target.value as Period)}
          >
            <option value="day">Día actual</option>
            <option value="month">Mes actual</option>
            <option value="year">Año actual</option>
          </select>
        </label>
      </div>

      {error && (
        <p role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </p>
      )}
      {loading && <p role="status" className="text-sm text-muted-foreground">Cargando ingresos...</p>}

      {data && !loading && !error && (
        <>
          <p className="text-xs text-muted-foreground">{data.periodLabel} · montos en CLP</p>
          <h3 className="text-sm font-semibold text-foreground">Modelo financiero estimado sobre ventas confirmadas</h3>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <SummaryCard
              title="Ventas brutas"
              amount={data.summary.salesGross}
              detail="Precio original de productos, sin envío"
            />
            <SummaryCard
              title="Comisión Vindex bruta"
              amount={data.summary.vindexCommissionAccruedGross}
              detail="5% devengado sobre ventas brutas"
            />
            <SummaryCard
              title="Parte vendedor · Vindex"
              amount={data.summary.sellerVindexCommissionEstimate}
              detail="50% de la comisión Vindex"
            />
            <SummaryCard
              title="Parte comprador · Vindex"
              amount={data.summary.buyerVindexCommissionEstimate}
              detail="50% de la comisión Vindex"
            />
            <SummaryCard
              title="Costos operacionales"
              amount={data.summary.operationalCostsGross}
              detail="1,7% por cada lado de la operación"
            />
            <SummaryCard
              title="Costos operacionales · vendedor"
              amount={data.summary.sellerOperationalCost}
              detail="1,7% del precio original"
            />
            <SummaryCard
              title="Costos operacionales · comprador"
              amount={data.summary.buyerOperationalCost}
              detail="1,7% del precio original"
            />
            <SummaryCard
              title="IVA asumido por Vindex"
              amount={data.summary.vindexVatAssumedEstimate}
              detail="19% de la comisión bruta; no se cobra al comprador ni al vendedor"
            />
            <SummaryCard
              title="Ingreso Vindex después del IVA"
              amount={data.summary.vindexNetAfterVatEstimate}
              detail="Estimación devengada; no implica que se haya recaudado"
            />
            <SummaryCard
              title="Neto estimado vendedores"
              amount={data.summary.sellerNetEstimate}
              detail="Ventas menos las participaciones del vendedor; sin envío"
            />
          </div>

          <h3 className="text-sm font-semibold text-foreground">Estado real del ledger</h3>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard
              title="Comisiones devengadas"
              amount={data.summary.commissionsGenerated}
              detail="Registradas en el ledger; no significa dinero recibido"
            />
            <SummaryCard
              title="Comisiones cobradas"
              amount={data.summary.commissionsCollected}
              detail="Solo filas con estado collected"
            />
            <SummaryCard
              title="Pendientes de liquidación"
              amount={data.summary.commissionsPending}
              detail="Devengadas, todavía no cobradas"
            />
            <SummaryCard
              title="Neto estimado de comisiones cobradas"
              amount={data.summary.vindexCommissionCollectedNetAfterVatEstimate}
              detail="Comisión cobrada menos el IVA estimado de Vindex"
            />
            <SummaryCard
              title="Promociones pagadas"
              amount={data.summary.promotionsAuthorizedInSandbox}
              detail="Autorizaciones de Webpay en sandbox"
            />
            <SummaryCard
              title="Ingresos Vindex registrados"
              amount={data.summary.totalRecordedIncome}
              detail="Comisiones cobradas + promociones autorizadas en sandbox"
            />
          </div>

          <p className="rounded-xl bg-brand-50 p-4 text-xs leading-5 text-brand-800">
            Las participaciones del comprador y del vendedor, y los costos operacionales, son estimaciones derivadas de las ventas confirmadas.
            No representan cobros ni liquidaciones. La RPC actual de Webpay Plus Mall mantiene sus montos y debe actualizarse en Supabase
            antes de recaudar las nuevas participaciones. Las promociones autorizadas son transacciones sandbox y no equivalen a dinero real recibido.
          </p>

          <div className="overflow-x-auto rounded-2xl border border-border bg-surface shadow-card">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-border bg-brand-50/60 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-3">Fecha</th>
                  <th scope="col" className="px-4 py-3">Movimiento</th>
                  <th scope="col" className="px-4 py-3">Referencia</th>
                  <th scope="col" className="px-4 py-3">Base de comisión</th>
                  <th scope="col" className="px-4 py-3">Monto</th>
                  <th scope="col" className="px-4 py-3">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.history.map((entry) => (
                  <tr key={entry.id}>
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                      {dateFormatter.format(new Date(entry.date))}
                    </td>
                    <td className="px-4 py-3 font-medium text-foreground">{entry.description}</td>
                    <td className="px-4 py-3 text-muted-foreground">{entry.reference}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {entry.baseAmount === null ? "—" : currencyFormatter.format(entry.baseAmount)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-semibold text-foreground">
                      {currencyFormatter.format(entry.amount)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{statusLabel(entry.status)}</td>
                  </tr>
                ))}
                {data.history.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                      No hay comisiones ni pagos de promociones en este período.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {data.history.length >= data.historyLimit && (
              <p className="border-t border-border px-4 py-3 text-xs text-muted-foreground">
                Mostrando los {data.historyLimit} movimientos más recientes del período.
              </p>
            )}
          </div>
        </>
      )}
    </section>
  );
}

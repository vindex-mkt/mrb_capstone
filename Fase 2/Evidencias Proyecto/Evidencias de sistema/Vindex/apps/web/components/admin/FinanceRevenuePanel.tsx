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
    vindexNetAfterVatPlusAdvertisingEstimate: number;
    sellerNetEstimate: number;
    vindexCommissionCollectedNetAfterVatEstimate: number;
    promotionsAuthorizedInSandbox: number;
    totalRecordedIncome: number;
  };
  history: FinanceHistoryItem[];
};

const currencyFormatter = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

const dateFormatter = new Intl.DateTimeFormat("es-CL", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Santiago",
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
    summary?.vindexNetAfterVatPlusAdvertisingEstimate,
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
    );
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
  const [showAllHistory, setShowAllHistory] = useState(false);

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
            onChange={(event) => {
              setPeriod(event.target.value as Period);
              setShowAllHistory(false);
            }}
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
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard
              title="Ventas brutas"
              amount={data.summary.salesGross}
              detail=""
            />
            <SummaryCard
              title="Comisión Vindex bruta"
              amount={data.summary.vindexCommissionAccruedGross}
              detail=""
            />
            <SummaryCard
              title="Comisión Vindex · distribución 50/50"
              amount={data.summary.vindexCommissionAccruedGross}
              detail={`Comprador ${currencyFormatter.format(data.summary.buyerVindexCommissionEstimate)} · Vendedor ${currencyFormatter.format(data.summary.sellerVindexCommissionEstimate)}`}
            />
            <SummaryCard
              title="Costos operacionales"
              amount={data.summary.operationalCostsGross}
              detail={`Vendedor ${currencyFormatter.format(data.summary.sellerOperationalCost)} · Comprador ${currencyFormatter.format(data.summary.buyerOperationalCost)} (1,7% por lado)`}
            />
            <SummaryCard
              title="IVA asumido por Vindex"
              amount={data.summary.vindexVatAssumedEstimate}
              detail="19% de la comisión"
            />
            <SummaryCard
              title="Utilidad neta estimada"
              amount={data.summary.vindexNetAfterVatPlusAdvertisingEstimate}
              detail="Comisión después del IVA + publicidad"
            />
            <SummaryCard
              title="Neto estimado vendedores"
              amount={data.summary.sellerNetEstimate}
              detail=""
            />
          </div>

          <h3 className="text-sm font-semibold text-foreground">Resumen de movimientos</h3>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard
              title="Comisiones reservadas"
              amount={data.summary.commissionsGenerated}
              detail=""
            />
            <SummaryCard
              title="Comisiones cobradas"
              amount={data.summary.commissionsCollected}
              detail=""
            />
            <SummaryCard
              title="Pendientes de liquidación"
              amount={data.summary.commissionsPending}
              detail=""
            />
            <SummaryCard
              title="Neto estimado de comisiones cobradas"
              amount={data.summary.vindexCommissionCollectedNetAfterVatEstimate}
              detail=""
            />
            <SummaryCard
              title="Promociones pagadas"
              amount={data.summary.promotionsAuthorizedInSandbox}
              detail=""
            />
            <SummaryCard
              title="Ingresos Vindex registrados"
              amount={data.summary.totalRecordedIncome}
              detail=""
            />
          </div>
          {/* 
          <p className="rounded-xl bg-brand-50 p-4 text-xs leading-5 text-brand-800">
            Las participaciones del comprador y del vendedor, y los costos operacionales, son estimaciones derivadas de las ventas confirmadas.
            No representan cobros ni liquidaciones. La RPC actual de Webpay Plus Mall mantiene sus montos y debe actualizarse en Supabase
            antes de recaudar las nuevas participaciones. La utilidad neta estimada suma la comisión de Vindex después del IVA y los montos de publicidad autorizados;
            la publicidad se suma en monto bruto, sin cálculo separado de IVA, y sigue en sandbox: no equivale a dinero real recibido. Tampoco es un resultado contable
            ni descuenta costos operacionales reales.
          </p>
          */}
          <div className="max-h-[28rem] overflow-auto rounded-2xl border border-border bg-surface shadow-card">
            <table id="finance-history" className="w-full min-w-[760px] text-left text-sm">
              <thead className="sticky top-0 z-10 border-b border-border bg-brand-50 text-xs uppercase tracking-wide text-muted-foreground">
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
                {(showAllHistory ? data.history : data.history.slice(0, 4)).map((entry) => (
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
          </div>
          {data.history.length > 4 && (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                {showAllHistory
                  ? `Mostrando ${data.history.length} movimientos del período.`
                  : `Mostrando los 4 movimientos más recientes de ${data.history.length}.`}
              </p>
              <button
                type="button"
                aria-controls="finance-history"
                aria-expanded={showAllHistory}
                className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-brand-700 transition hover:border-brand-300 hover:bg-brand-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                onClick={() => setShowAllHistory((current) => !current)}
              >
                {showAllHistory ? "Mostrar solo los 4 más recientes" : "Ver todos"}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

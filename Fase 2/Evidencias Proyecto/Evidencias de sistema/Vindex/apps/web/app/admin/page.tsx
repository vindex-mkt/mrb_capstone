"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  IconBolt,
  IconCart,
  IconHeart,
  IconMessageCircle,
  IconShieldCheck,
  IconStar,
  IconStore,
  IconTag,
  IconUser,
  IconWallet,
  type IconProps,
} from "@/components/icons";
import FinanceRevenuePanel from "@/components/admin/FinanceRevenuePanel";

type DashboardStats = {
  generatedAt: string;
  unavailableMetrics: string[];
  netProfitEstimate: number | null;
  productsPublished: number | null;
  productsPending: number | null;
  activeOffers: number | null;
  activeAuctions: number | null;
  completedOrders: number | null;
  pendingOrders: number | null;
  pendingDeliveries: number | null;
  bids: number | null;
  users: number | null;
  stores: number | null;
  favorites: number | null;
  reviews: number | null;
  conversations: number | null;
  messages: number | null;
  salesByMonth: Array<{
    label: string;
    sales: number;
    orders: number;
    buyers: number;
  }>;
};

const currencyFormatter = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat("es-CL");

function isDashboardStats(value: unknown): value is DashboardStats {
  if (typeof value !== "object" || value === null) return false;

  const stats = value as Partial<DashboardStats>;
  const numericFields: Array<keyof DashboardStats> = [
    "productsPublished",
    "productsPending",
    "activeOffers",
    "activeAuctions",
    "completedOrders",
    "pendingOrders",
    "pendingDeliveries",
    "bids",
    "users",
    "stores",
    "favorites",
    "reviews",
    "conversations",
    "messages",
  ];

  return typeof stats.generatedAt === "string"
    && Array.isArray(stats.unavailableMetrics)
    && stats.unavailableMetrics.every((metric) => typeof metric === "string")
    && (stats.netProfitEstimate === null
      || (typeof stats.netProfitEstimate === "number"
        && Number.isSafeInteger(stats.netProfitEstimate)
        && stats.netProfitEstimate >= 0))
    && numericFields.every((field) => typeof stats[field] === "number" || stats[field] === null)
    && Array.isArray(stats.salesByMonth)
    && stats.salesByMonth.every((month) =>
      typeof month.label === "string"
      && typeof month.sales === "number"
      && typeof month.orders === "number"
      && typeof month.buyers === "number",
    );
}

function MetricCard({
  title,
  value,
  detail,
  icon: Icon,
}: {
  title: string;
  value: string;
  detail: string;
  icon: React.ComponentType<IconProps>;
}) {
  return (
    <article className="rounded-2xl border border-border bg-surface p-5 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-foreground">{value}</p>
        </div>
        <span className="rounded-xl bg-brand-50 p-2.5 text-brand-700">
          <Icon aria-hidden="true" className="h-5 w-5" />
        </span>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">{detail}</p>
    </article>
  );
}

function SalesChart({ months }: { months: DashboardStats["salesByMonth"] }) {
  const maxSales = Math.max(...months.map((month) => month.sales), 1);
  const chartWidth = 600;
  const barWidth = 52;
  const gap = (chartWidth - barWidth * months.length) / (months.length * 2);

  return (
    <div className="overflow-x-auto">
      <svg
        aria-label="Ventas brutas por mes durante los últimos seis meses"
        className="h-auto min-w-[540px] w-full"
        role="img"
        viewBox="0 0 600 230"
      >
        <line x1="0" x2="600" y1="180" y2="180" className="stroke-border" />
        {months.map((month, index) => {
          const height = Math.max((month.sales / maxSales) * 132, month.sales > 0 ? 4 : 0);
          const x = gap + index * (barWidth + gap * 2);
          const y = 176 - height;

          return (
            <g key={month.label}>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={height}
                rx="6"
                className="fill-brand-600"
              >
                <title>
                  {`${month.label}: ${currencyFormatter.format(month.sales)}, ${numberFormatter.format(month.orders)} pedidos, ${numberFormatter.format(month.buyers)} compradores`}
                </title>
              </rect>
              <text x={x + barWidth / 2} y="203" textAnchor="middle" className="fill-muted-foreground text-[12px]">
                {month.label}
              </text>
              <text x={x + barWidth / 2} y="222" textAnchor="middle" className="fill-foreground text-[10px]">
                {numberFormatter.format(month.orders)} pedidos
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [loginRequired, setLoginRequired] = useState(false);

  useEffect(() => {
    let current = true;

    const loadDashboard = async () => {
      try {
        const response = await fetch("/api/admin/dashboard", { cache: "no-store" });
        const result: unknown = await response.json();

        if (!response.ok) {
          if (response.status === 401) setLoginRequired(true);
          const message =
            typeof result === "object" && result !== null && "message" in result
              ? String(result.message)
              : "No se pudieron cargar las estadísticas.";
          throw new Error(message);
        }

        if (!isDashboardStats(result)) throw new Error("El servidor devolvió datos de dashboard inválidos.");
        if (current) setStats(result);
      } catch (loadError) {
        if (current) {
          setError(loadError instanceof Error ? loadError.message : "No se pudieron cargar las estadísticas.");
        }
      } finally {
        if (current) setLoading(false);
      }
    };

    void loadDashboard();
    return () => {
      current = false;
    };
  }, []);

  if (loading) {
    return (
      <section className="container-site py-12">
        <p role="status" className="text-sm text-muted-foreground">Cargando estadísticas del marketplace...</p>
      </section>
    );
  }

  if (error || !stats) {
    return (
      <section className="container-site space-y-4 py-12">
        <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-800">
          {error || "No hay datos disponibles para mostrar."}
        </div>
        {loginRequired && <Link href="/login?next=%2Fadmin" className="link-more">Iniciar sesión como administrador</Link>}
      </section>
    );
  }

  const currentMonth = stats.salesByMonth[stats.salesByMonth.length - 1];
  const formatCount = (value: number | null) =>
    value === null ? "No disponible" : numberFormatter.format(value);
  const secondaryMetrics: Array<{
    title: string;
    value: number | null;
    detail: string;
    icon: React.ComponentType<IconProps>;
    href?: string;
  }> = [
    { title: "Usuarios", value: stats.users, detail: "", icon: IconUser },
    { title: "Tiendas", value: stats.stores, detail: "", icon: IconStore },
    { title: "Subastas activas", value: stats.activeAuctions, detail: "", icon: IconBolt },
    { title: "Pujas en subastas", value: stats.bids, detail: "", icon: IconTag },
    { title: "Pendientes de moderación", value: stats.productsPending, detail: "", icon: IconShieldCheck, href: "/admin/moderation" },
    { title: "Favoritos", value: stats.favorites, detail: "", icon: IconHeart },
    { title: "Reseñas", value: stats.reviews, detail: "", icon: IconStar },
    {
      title: "Conversaciones",
      value: stats.conversations,
      detail: stats.messages === null ? "Mensajes no disponibles" : `${formatCount(stats.messages)} mensajes enviados`,
      icon: IconMessageCircle,
    },
  ];

  return (
    <main className="container-site space-y-8 py-8 sm:py-10">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          {/* 
          <p className="eyebrow">Business Intelligence</p>
          */}
          <h1 className="text-3xl font-bold text-foreground">Dashboard del marketplace</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Indicadores de catálogo, ventas, actividad de compradores y vendedores.
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          Actualizado {new Date(stats.generatedAt).toLocaleString("es-CL")}
        </p>
      </header>

      <section aria-label="Indicadores principales" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard
          title="Productos publicados"
          value={formatCount(stats.productsPublished)}
          detail={``}
          icon={IconTag}
        />
        <MetricCard
          title="Ventas brutas del mes"
          value={currencyFormatter.format(currentMonth?.sales ?? 0)}
          detail={`${numberFormatter.format(currentMonth?.orders ?? 0)} pedidos pagados este mes`}
          icon={IconWallet}
        />
        <MetricCard
          title="Utilidad neta estimada"
          value={stats.netProfitEstimate === null ? "No disponible" : currencyFormatter.format(stats.netProfitEstimate)}
          detail={""}
          icon={IconWallet}
        />
        <MetricCard
          title="Pedidos pagados"
          value={formatCount(stats.completedOrders)}
          detail=""
          icon={IconCart}
        />
        <MetricCard
          title="Ofertas activas"
          value={formatCount(stats.activeOffers)}
          detail=""
          icon={IconBolt}
        />
      </section>

      <FinanceRevenuePanel />

      {stats.unavailableMetrics.length > 0 && (
        <p role="status" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          Algunas métricas no están disponibles: {stats.unavailableMetrics.join(", ")}.
        </p>
      )}

      <section className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(280px,1fr)]">
        <article className="rounded-2xl border border-border bg-surface p-5 shadow-card sm:p-6">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-foreground">Evolución de ventas</h2>
            <p className="mt-1 text-sm text-muted-foreground">Ventas brutas mensuales durante los últimos seis meses</p>
          </div>
          <SalesChart months={stats.salesByMonth} />
        </article>

        <article className="rounded-2xl border border-border bg-surface p-5 shadow-card sm:p-6">
          <h2 className="text-lg font-semibold text-foreground">Operación pendiente</h2>
          <p className="mt-1 text-sm text-muted-foreground">Pedidos que requieren seguimiento</p>
          <dl className="mt-5 space-y-4">
            <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
              <dt className="text-sm text-muted-foreground">Pedidos sin pago confirmado</dt>
              <dd className="font-semibold text-foreground">{formatCount(stats.pendingOrders)}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-sm text-muted-foreground">Entregas pendientes</dt>
              <dd className="font-semibold text-foreground">{formatCount(stats.pendingDeliveries)}</dd>
            </div>
          </dl>
        </article>
      </section>

      <section aria-label="Indicadores complementarios" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {secondaryMetrics.map(({ title, value, detail, icon: Icon, href }) => {
          const content = (
            <>
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-muted-foreground">{title}</p>
                <Icon aria-hidden="true" className="h-5 w-5 text-brand-700" />
              </div>
              <p className="mt-3 text-2xl font-bold text-foreground">{formatCount(value)}</p>
              <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
            </>
          );

          return href ? (
            <Link key={title} href={href} className="rounded-2xl border border-border bg-surface p-4 shadow-card transition hover:border-brand-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
              {content}
            </Link>
          ) : (
            <article key={title} className="rounded-2xl border border-border bg-surface p-4 shadow-card">
              {content}
            </article>
          );
        })}
      </section>
    </main>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconWallet } from "@/components/icons";
import { useWallet } from "@/hooks/useWallet";

const formatCLP = (amount: number) =>
  new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(amount);

export default function WalletNavButton() {
  const pathname = usePathname();
  const { userId, balances, loading, error } = useWallet();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <div
      className="relative"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setOpen(false);
        }
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") setOpen(false);
      }}
    >
      <button
        type="button"
        className="icon-btn h-10 w-10"
        aria-label="Abrir billetera Vindex"
        aria-expanded={open}
        aria-controls="wallet-nav-panel"
        onClick={() => setOpen((current) => !current)}
      >
        <IconWallet className="h-5 w-5" />
      </button>
      <div
        id="wallet-nav-panel"
        data-open={open}
        className="invisible absolute right-0 top-full z-50 mt-2 w-[min(20rem,calc(100vw-2rem))] translate-y-1 rounded-2xl border border-border bg-surface p-4 opacity-0 shadow-pop transition data-[open=true]:visible data-[open=true]:translate-y-0 data-[open=true]:opacity-100"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-foreground">Billetera Vindex</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {userId ? "Tu saldo disponible" : "Inicia sesión para ver tu saldo"}
            </p>
          </div>
          <IconWallet className="h-5 w-5 shrink-0 text-brand-700" />
        </div>

        {!userId && error && (
          <p role="alert" className="mt-3 text-sm text-red-700">
            No se pudo validar la sesión: {error}
          </p>
        )}

        {userId && (
          <div className="mt-4 rounded-xl bg-brand-50 p-3">
            {loading ? (
              <p role="status" className="text-sm text-muted-foreground">Cargando saldo...</p>
            ) : error ? (
              <p role="alert" className="text-sm text-red-700">
                No se pudo cargar el saldo: {error}
              </p>
            ) : balances ? (
              <>
                <p className="text-2xl font-extrabold tracking-tight text-foreground">
                  {formatCLP(balances.available)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatCLP(balances.locked)} retenidos en garantías
                </p>
              </>
            ) : null}
          </div>
        )}

        <div className="mt-4 grid grid-cols-2 gap-2">
          <Link
            href={userId ? "/wallet#depositar" : "/login"}
            onClick={() => setOpen(false)}
            className="btn btn-primary min-h-10 px-3 text-xs"
          >
            Ingresar saldo
          </Link>
          <Link
            href={userId ? "/wallet#retirar" : "/login"}
            onClick={() => setOpen(false)}
            className="btn btn-outline min-h-10 px-3 text-xs"
          >
            Retirar saldo
          </Link>
        </div>
        <Link
          href={userId ? "/wallet" : "/login"}
          onClick={() => setOpen(false)}
          className="mt-3 flex min-h-10 items-center justify-center rounded-xl px-3 text-sm font-semibold text-brand-700 transition hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
        >
          Ver detalle de la billetera
        </Link>
      </div>
    </div>
  );
}

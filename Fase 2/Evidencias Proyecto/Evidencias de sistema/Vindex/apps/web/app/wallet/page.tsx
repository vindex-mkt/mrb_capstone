"use client";

import { useState } from "react";
import Link from "next/link";
import { Dialog } from "@base-ui/react/dialog";
import { ArrowDownToLine, ArrowUpFromLine, Check, CreditCard, LockKeyhole, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IconArrowRight, IconWallet } from "@/components/icons";
import { useWallet } from "@/hooks/useWallet";

const formatCLP = (amount: number) =>
  new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(amount);

export default function WalletPage() {
  const { userId, balances, loading, error } = useWallet();
  const [depositOpen, setDepositOpen] = useState(false);
  const [depositAmount, setDepositAmount] = useState("10000");
  const [paymentMethod, setPaymentMethod] = useState<"webpay" | "mercadopago">("webpay");
  const [depositProcessing, setDepositProcessing] = useState(false);
  const [depositComplete, setDepositComplete] = useState(false);
  const [depositError, setDepositError] = useState<string | null>(null);
  const parsedDepositAmount = Number(depositAmount);
  const validDepositAmount = Number.isSafeInteger(parsedDepositAmount) && parsedDepositAmount > 0;

  const openDeposit = () => {
    setDepositAmount("10000");
    setPaymentMethod("webpay");
    setDepositError(null);
    setDepositComplete(false);
    setDepositOpen(true);
  };

  const handleDeposit = async () => {
    if (depositProcessing) return;
    if (!validDepositAmount) {
      setDepositError("Ingresa un monto válido en pesos chilenos.");
      return;
    }

    setDepositError(null);
    setDepositProcessing(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 900));
      setDepositComplete(true);
    } catch {
      setDepositError("No se pudo completar la simulación de pago. Intenta nuevamente.");
    } finally {
      setDepositProcessing(false);
    }
  };

  return (
    <main className="min-h-screen bg-background pb-16">
      <section className="bg-brand-950 py-10 text-white sm:py-14">
        <div className="container-site">
          <Link href="/" className="text-sm font-medium text-brand-100 transition hover:text-white">
            Inicio
          </Link>
          <div className="mt-6 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="eyebrow !text-brand-200">Finanzas personales</p>
              <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">
                Mi billetera
              </h1>
              <p className="mt-2 max-w-xl text-sm leading-6 text-brand-100 sm:text-base">
                Administra tus créditos y revisa las garantías reservadas para tus subastas.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={openDeposit} className="btn btn-light min-h-11 px-4">
                <ArrowDownToLine className="h-4 w-4" aria-hidden="true" />
                Ingresar saldo
              </button>
              <a href="#retirar" className="btn min-h-11 border border-white/30 bg-white/10 px-4 text-white hover:bg-white/20">
                <ArrowUpFromLine className="h-4 w-4" aria-hidden="true" />
                Retirar saldo
              </a>
            </div>
          </div>
        </div>
      </section>

      <div className="container-site">
        {!userId && !loading && error && (
          <p role="alert" className="mt-8 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            No se pudo validar la sesión: {error}
          </p>
        )}

        {!userId && !loading && (
          <section className="card mt-8 p-5 sm:p-8" aria-labelledby="wallet-sign-in">
            <h2 id="wallet-sign-in" className="text-xl font-bold text-foreground">
              Inicia sesión para consultar tu billetera
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              El saldo y las garantías son privados y solo están disponibles para la cuenta autenticada.
            </p>
            <Link href="/login" className="btn btn-primary mt-5 min-h-11 px-5">
              Iniciar sesión
            </Link>
          </section>
        )}

        {userId && (
          <>
            <section className="mt-8 grid gap-4 md:grid-cols-2" aria-label="Resumen de saldo">
              <article className="card p-5 sm:p-7">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-muted-foreground">Saldo disponible</p>
                    <p className="mt-3 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
                      {loading ? "Cargando..." : error ? "No disponible" : balances ? formatCLP(balances.available) : "—"}
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">Listo para utilizar o retirar</p>
                  </div>
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-700">
                    <IconWallet className="h-6 w-6" />
                  </span>
                </div>
              </article>
              <article className="card border-brand-200 bg-brand-50/70 p-5 sm:p-7">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-muted-foreground">Saldo congelado</p>
                    <p className="mt-3 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
                      {loading ? "Cargando..." : error ? "No disponible" : balances ? formatCLP(balances.locked) : "—"}
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">Reservado como garantía de subastas</p>
                  </div>
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white text-brand-700">
                    <LockKeyhole className="h-6 w-6" aria-hidden="true" />
                  </span>
                </div>
              </article>
            </section>

            {error && (
              <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                No se pudo consultar la billetera: {error}. Verifica que el esquema de billetera esté aplicado y que las políticas RLS permitan consultar tu propio saldo.
              </p>
            )}
          </>
        )}

        <section className="py-10 sm:py-12" aria-labelledby="wallet-how-it-works">
          <div className="section-head">
            <div>
              <p className="eyebrow">Simple y transparente</p>
              <h2 id="wallet-how-it-works" className="section-title mt-1">Cómo funciona tu billetera</h2>
            </div>
            <p className="max-w-md text-sm leading-6 text-muted-foreground">
              1 crédito equivale a $1 CLP. Los créditos se reservan al participar en una subasta.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <article className="card p-5">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-700">
                <ArrowDownToLine className="h-5 w-5" aria-hidden="true" />
              </span>
              <h3 className="mt-4 font-bold text-foreground">Carga tus créditos</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                El saldo se expresa en pesos chilenos y puede utilizarse para las garantías de subasta.
              </p>
            </article>
            <article className="card p-5">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-700">
                <LockKeyhole className="h-5 w-5" aria-hidden="true" />
              </span>
              <h3 className="mt-4 font-bold text-foreground">La garantía se congela</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                La garantía se reserva al pujar por primera vez. Ese monto no se puede usar en otra subasta ni retirar mientras esté retenido.
              </p>
            </article>
            <article className="card p-5">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-700">
                <ShieldCheck className="h-5 w-5" aria-hidden="true" />
              </span>
              <h3 className="mt-4 font-bold text-foreground">Se libera o se aplica</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Si no ganas, la garantía se libera. Si ganas, se descuenta del precio final; no pagar a tiempo puede implicar perderla.
              </p>
            </article>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2" aria-label="Operaciones de billetera">
          <article id="depositar" className="card scroll-mt-28 p-5 sm:p-7">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-50 text-brand-700">
              <ArrowDownToLine className="h-5 w-5" aria-hidden="true" />
            </span>
            <h2 className="mt-4 text-xl font-bold text-foreground">Ingresar saldo</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Las recargas mediante transferencia o pasarela de pago todavía no están conectadas a la plataforma.
              No se realizará ningún cobro desde esta página.
            </p>
            <button type="button" onClick={openDeposit} className="btn btn-primary mt-5 min-h-11 px-5">
              Ingresar saldo
            </button>
          </article>
          <article id="retirar" className="card scroll-mt-28 p-5 sm:p-7">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-50 text-brand-700">
              <ArrowUpFromLine className="h-5 w-5" aria-hidden="true" />
            </span>
            <h2 className="mt-4 text-xl font-bold text-foreground">Retirar saldo</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Los retiros estarán disponibles cuando se implemente el flujo seguro de solicitud y desembolso.
              El saldo congelado no se puede retirar mientras respalde una garantía activa.
            </p>
            <button type="button" disabled className="btn btn-outline mt-5 min-h-11 px-5">
              Retirar saldo próximamente
            </button>
          </article>
        </section>

        <section className="mt-6 flex items-start gap-3 rounded-2xl border border-border bg-surface p-4 sm:p-5">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-brand-700" aria-hidden="true" />
          <div>
            <h2 className="text-sm font-bold text-foreground">Tus garantías están protegidas</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              El saldo retenido se mantiene separado del disponible. La liberación y aplicación de garantías dependen de las funciones de base de datos definidas para el cierre de cada subasta.
            </p>
          </div>
        </section>

        <div className="mt-6">
          <Link href="/subastas" className="link-more">
            Explorar subastas <IconArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      <Dialog.Root
        open={depositOpen}
        onOpenChange={(open) => {
          if (!depositProcessing) setDepositOpen(open);
        }}
      >
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" />
          <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 space-y-4 overflow-y-auto rounded-2xl border border-border bg-surface p-5 text-foreground shadow-xl sm:p-6">
            {depositComplete ? (
              <>
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700">
                    <Check className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div className="space-y-1">
                    <Dialog.Title className="text-lg font-semibold">Simulación completada</Dialog.Title>
                    <Dialog.Description className="text-sm text-muted-foreground">
                      La recarga de {formatCLP(parsedDepositAmount)} se simuló con {paymentMethod === "webpay" ? "Webpay Plus" : "Mercado Pago"}.
                    </Dialog.Description>
                  </div>
                </div>
                <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-900">
                  No se realizó un cobro real ni se abonó saldo a tu billetera. La integración de recargas aún está pendiente.
                </p>
                <div className="flex justify-end">
                  <Button type="button" onClick={() => setDepositOpen(false)}>Entendido</Button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700">
                    <CreditCard className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div className="space-y-1">
                    <Dialog.Title className="text-lg font-semibold">Ingresar saldo</Dialog.Title>
                    <Dialog.Description className="text-sm text-muted-foreground">
                      Pago simulado: no se solicitarán datos de tarjeta ni se realizará un cobro real.
                    </Dialog.Description>
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="wallet-deposit-amount" className="text-sm font-medium text-foreground">
                    Monto a ingresar (CLP)
                  </label>
                  <input
                    id="wallet-deposit-amount"
                    type="number"
                    min="1"
                    step="1"
                    inputMode="numeric"
                    value={depositAmount}
                    onChange={(event) => {
                      setDepositAmount(event.target.value);
                      setDepositError(null);
                    }}
                    className="input h-11 px-3"
                    aria-invalid={Boolean(depositError)}
                    disabled={depositProcessing}
                  />
                </div>

                <fieldset className="space-y-2">
                  <legend className="text-sm font-medium text-foreground">Medio de pago</legend>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-border p-3 has-[:checked]:border-brand-600 has-[:checked]:bg-brand-50/70">
                      <input
                        type="radio"
                        name="wallet-payment"
                        value="webpay"
                        checked={paymentMethod === "webpay"}
                        onChange={() => setPaymentMethod("webpay")}
                        className="accent-brand-600"
                        disabled={depositProcessing}
                      />
                      <span>
                        <span className="block font-semibold text-foreground">Webpay Plus</span>
                        <span className="text-xs text-muted-foreground">Transbank · Simulado</span>
                      </span>
                    </label>
                    <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-border p-3 has-[:checked]:border-brand-600 has-[:checked]:bg-brand-50/70">
                      <input
                        type="radio"
                        name="wallet-payment"
                        value="mercadopago"
                        checked={paymentMethod === "mercadopago"}
                        onChange={() => setPaymentMethod("mercadopago")}
                        className="accent-brand-600"
                        disabled={depositProcessing}
                      />
                      <span>
                        <span className="block font-semibold text-foreground">Mercado Pago</span>
                        <span className="text-xs text-muted-foreground">Simulado</span>
                      </span>
                    </label>
                  </div>
                </fieldset>

                <div className="flex justify-between gap-3 rounded-xl border border-border bg-muted/40 p-3 text-sm">
                  <span className="font-semibold text-foreground">Total de la simulación</span>
                  <span className="font-extrabold text-foreground">
                    {validDepositAmount ? formatCLP(parsedDepositAmount) : "—"}
                  </span>
                </div>

                {depositError && (
                  <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                    {depositError}
                  </p>
                )}

                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <Button type="button" variant="outline" onClick={() => setDepositOpen(false)} disabled={depositProcessing}>
                    Cancelar
                  </Button>
                  <Button type="button" onClick={() => void handleDeposit()} disabled={depositProcessing || !validDepositAmount}>
                    {depositProcessing ? "Procesando pago..." : `Simular recarga de ${validDepositAmount ? formatCLP(parsedDepositAmount) : "saldo"}`}
                  </Button>
                </div>
              </>
            )}
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </main>
  );
}

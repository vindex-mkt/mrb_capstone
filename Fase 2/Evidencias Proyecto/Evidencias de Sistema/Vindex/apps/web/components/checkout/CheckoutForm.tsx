"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CreditCard, MapPin, Store, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { formatProductPrice } from "@/lib/formatters";
import { useCartStore } from "@/lib/store/useCartStore";
import { getMerchantKey, MAX_CART_MERCHANTS_MESSAGE } from "@/lib/checkout/merchant";

type Address = {
  region: string;
  city: string;
  commune: string;
  street: string;
  street_number: string;
};

const emptyAddress: Address = {
  region: "",
  city: "",
  commune: "",
  street: "",
  street_number: "",
};

const isCompleteAddress = (address: Address) =>
  Object.values(address).every((value) => value.trim().length > 0);

const getCheckoutErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  if (typeof error !== "object" || error === null || !("message" in error)) return "Error desconocido";

  const message = typeof error.message === "string" ? error.message : "Error desconocido";
  const details = "details" in error && typeof error.details === "string" ? error.details : null;
  return details ? `${message} (${details})` : message;
};

export default function CheckoutForm() {
  const router = useRouter();
  const [supabase] = useState(createClient);
  const items = useCartStore((state) => state.items);
  const hasHydrated = useCartStore((state) => state.hasHydrated);
  const subtotal = useCartStore((state) => state.getTotal());
  const [profileAddress, setProfileAddress] = useState<Address | null>(null);
  const [address, setAddress] = useState<Address>(emptyAddress);
  const [addressChoice, setAddressChoice] = useState<"saved" | "new">("new");
  const [shipping, setShipping] = useState<"standard" | "pickup">("standard");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let current = true;

    const loadCheckout = async () => {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (!current) return;
      if (authError) {
        setErrorMessage(`No se pudo verificar tu sesión: ${authError.message}`);
        setLoading(false);
        return;
      }
      if (!user) {
        router.replace("/login");
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("region, city, commune, street, street_number")
        .eq("id", user.id)
        .maybeSingle();

      if (!current) return;
      if (error) {
        setErrorMessage(`No se pudo cargar tu dirección guardada: ${error.message}`);
      } else if (data) {
        const savedAddress: Address = {
          region: typeof data.region === "string" ? data.region : "",
          city: typeof data.city === "string" ? data.city : "",
          commune: typeof data.commune === "string" ? data.commune : "",
          street: typeof data.street === "string" ? data.street : "",
          street_number: typeof data.street_number === "string" ? data.street_number : "",
        };
        setProfileAddress(savedAddress);
        setAddress(savedAddress);
        setAddressChoice(isCompleteAddress(savedAddress) ? "saved" : "new");
      }
      setLoading(false);
    };

    void loadCheckout();
    return () => {
      current = false;
    };
  }, [router, supabase]);

  const shippingCost = shipping === "standard" ? 3990 : 0;
  const total = useMemo(() => subtotal + shippingCost, [shippingCost, subtotal]);
  const selectedAddress = addressChoice === "saved" && profileAddress ? profileAddress : address;
  const addressIsValid = shipping === "pickup" || isCompleteAddress(selectedAddress);
  const merchantKeys = items.map(getMerchantKey);
  const exceedsMerchantLimit =
    merchantKeys.some((key) => key === null) || new Set(merchantKeys).size > 2;

  const updateAddress = (field: keyof Address, value: string) => {
    setAddress((currentAddress) => ({ ...currentAddress, [field]: value }));
  };

  const handleCheckout = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    if (!hasHydrated || items.length === 0) {
      setErrorMessage("Tu carrito está vacío o todavía se está cargando.");
      return;
    }
    if (exceedsMerchantLimit) {
      setErrorMessage(MAX_CART_MERCHANTS_MESSAGE);
      return;
    }
    if (!addressIsValid) {
      setErrorMessage("Completa todos los campos de la dirección de envío.");
      return;
    }

    const shippingAddress = shipping === "pickup"
      ? "Acordar con el vendedor"
      : `${selectedAddress.street.trim()} ${selectedAddress.street_number.trim()}, ${selectedAddress.commune.trim()}, ${selectedAddress.city.trim()}`;

    setSubmitting(true);
    try {
      const response = await fetch("/api/payments/webpay/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shippingAddress,
          shippingMethod: shipping,
        }),
      });
      const result = await response.json() as {
        message?: unknown;
        paymentUrl?: unknown;
        token?: unknown;
      };
      if (
        !response.ok
        || typeof result.paymentUrl !== "string"
        || typeof result.token !== "string"
      ) {
        throw new Error(
          typeof result.message === "string" ? result.message : "No se pudo iniciar el pago con Transbank.",
        );
      }

      const paymentForm = document.createElement("form");
      paymentForm.method = "POST";
      paymentForm.action = result.paymentUrl;
      const tokenInput = document.createElement("input");
      tokenInput.type = "hidden";
      tokenInput.name = "token_ws";
      tokenInput.value = result.token;
      paymentForm.appendChild(tokenInput);
      document.body.appendChild(paymentForm);
      paymentForm.submit();
    } catch (checkoutError) {
      const message = getCheckoutErrorMessage(checkoutError);
      setErrorMessage(`No se pudo completar la compra: ${message}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !hasHydrated) {
    return (
      <main className="min-h-[60vh] bg-background">
        <div className="container-site py-12">
          <p role="status" className="text-sm text-muted-foreground">Cargando tu checkout...</p>
        </div>
      </main>
    );
  }

  if (items.length === 0) {
    return (
      <main className="min-h-[60vh] bg-background">
        <section className="container-site py-10 sm:py-12">
          <Card className="mx-auto max-w-xl border-border bg-surface">
            <CardHeader>
              <CardTitle className="text-xl">Tu carrito está vacío</CardTitle>
              <CardDescription>Agrega productos antes de continuar al checkout.</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/tienda" className="btn btn-primary inline-flex min-h-10 items-center px-5">Ir al catálogo</Link>
            </CardContent>
          </Card>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-[60vh] bg-background">
      <section className="container-site py-8 sm:py-12">
        <div className="section-head">
          <div>
            <p className="eyebrow">Vindex</p>
            <h1 className="section-title mt-1">Finalizar compra</h1>
            <p className="mt-2 text-sm text-muted-foreground">Confirma tu dirección, envío y medio de pago.</p>
          </div>
          <Link href="/cart" className="link-more">Volver al carrito</Link>
        </div>

        {errorMessage && (
          <p role="alert" className="mb-6 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {errorMessage}
          </p>
        )}
        {exceedsMerchantLimit && (
          <p role="alert" className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
            {MAX_CART_MERCHANTS_MESSAGE}
          </p>
        )}

        <form onSubmit={(event) => void handleCheckout(event)} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-start">
          <div className="space-y-6">
            <Card className="border-border bg-surface">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg"><MapPin className="size-5 text-brand-700" />1. Dirección de envío</CardTitle>
                <CardDescription>Elige tu dirección guardada o ingresa una distinta para este pedido.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {profileAddress && isCompleteAddress(profileAddress) && (
                  <label className="flex cursor-pointer gap-3 rounded-xl border border-border p-4 has-[:checked]:border-brand-600 has-[:checked]:bg-brand-50/70">
                    <input
                      type="radio"
                      name="address-choice"
                      value="saved"
                      checked={addressChoice === "saved"}
                      onChange={() => setAddressChoice("saved")}
                      className="mt-1 accent-brand-600"
                    />
                    <span className="min-w-0">
                      <span className="block font-medium text-foreground">Usar dirección guardada</span>
                      <span className="mt-1 block text-sm text-muted-foreground">
                        {profileAddress.street} {profileAddress.street_number}, {profileAddress.commune}, {profileAddress.city}, {profileAddress.region}
                      </span>
                    </span>
                  </label>
                )}

                <label className="flex cursor-pointer gap-3 rounded-xl border border-border p-4 has-[:checked]:border-brand-600 has-[:checked]:bg-brand-50/70">
                  <input
                    type="radio"
                    name="address-choice"
                    value="new"
                    checked={addressChoice === "new"}
                    onChange={() => setAddressChoice("new")}
                    className="mt-1 accent-brand-600"
                  />
                  <span className="font-medium text-foreground">Ingresar otra dirección</span>
                </label>

                {addressChoice === "new" && (
                  <div className="grid gap-4 border-t border-border pt-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="checkout-region">Región</Label>
                      <Input id="checkout-region" autoComplete="address-level1" value={address.region} onChange={(event) => updateAddress("region", event.target.value)} required={shipping === "standard"} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="checkout-city">Ciudad</Label>
                      <Input id="checkout-city" autoComplete="address-level2" value={address.city} onChange={(event) => updateAddress("city", event.target.value)} required={shipping === "standard"} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="checkout-commune">Comuna</Label>
                      <Input id="checkout-commune" value={address.commune} onChange={(event) => updateAddress("commune", event.target.value)} required={shipping === "standard"} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="checkout-street">Calle</Label>
                      <Input id="checkout-street" autoComplete="street-address" value={address.street} onChange={(event) => updateAddress("street", event.target.value)} required={shipping === "standard"} />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="checkout-street-number">Número / departamento</Label>
                      <Input id="checkout-street-number" autoComplete="address-line2" value={address.street_number} onChange={(event) => updateAddress("street_number", event.target.value)} required={shipping === "standard"} />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-border bg-surface">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg"><Truck className="size-5 text-brand-700" />2. Método de envío</CardTitle>
                <CardDescription>Selecciona cómo quieres recibir tu compra.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border p-4 has-[:checked]:border-brand-600 has-[:checked]:bg-brand-50/70">
                  <input type="radio" name="shipping" checked={shipping === "standard"} onChange={() => setShipping("standard")} className="mt-1 accent-brand-600" />
                  <Truck className="mt-0.5 size-5 shrink-0 text-brand-700" />
                  <span className="flex flex-1 flex-wrap justify-between gap-2">
                    <span><span className="block font-medium text-foreground">Envío Estándar Chile</span><span className="text-sm text-muted-foreground">Starken / Chilexpress</span></span>
                    <span className="font-semibold text-foreground">{formatProductPrice(3990)}</span>
                  </span>
                </label>
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border p-4 has-[:checked]:border-brand-600 has-[:checked]:bg-brand-50/70">
                  <input type="radio" name="shipping" checked={shipping === "pickup"} onChange={() => setShipping("pickup")} className="mt-1 accent-brand-600" />
                  <Store className="mt-0.5 size-5 shrink-0 text-brand-700" />
                  <span className="flex flex-1 flex-wrap justify-between gap-2">
                    <span><span className="block font-medium text-foreground">Retiro presencial: acordar con el vendedor</span><span className="text-sm text-muted-foreground">Coordina la entrega directamente con quien vende</span></span>
                    <span className="font-semibold text-foreground">{formatProductPrice(0)}</span>
                  </span>
                </label>
              </CardContent>
            </Card>

            <Card className="border-border bg-surface">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg"><CreditCard className="size-5 text-brand-700" />3. Medio de pago</CardTitle>
                <CardDescription>Pago de prueba. Este checkout utiliza exclusivamente el ambiente de integración de Transbank.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3 rounded-xl border border-brand-600 bg-brand-50/70 p-4">
                  <CreditCard className="size-5 shrink-0 text-brand-700" aria-hidden="true" />
                  <span>
                    <span className="block font-semibold text-foreground">Webpay Plus Mall</span>
                    <span className="text-sm text-muted-foreground">Transbank · Integración (sandbox)</span>
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          <aside className="lg:sticky lg:top-28">
            <Card className="border-border bg-surface">
              <CardHeader>
                <CardTitle className="text-lg">Resumen de compra</CardTitle>
                <CardDescription>{items.reduce((count, item) => count + item.quantity, 0)} productos</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="max-h-64 space-y-4 overflow-y-auto">
                  {items.map((item) => (
                    <li key={item.id} className="flex gap-3">
                      <img src={item.image} alt="" className="size-14 shrink-0 rounded-lg object-cover" />
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-sm font-medium text-foreground">{item.name}</p>
                        <p className="mt-1 text-xs text-muted-foreground">Cantidad: {item.quantity}</p>
                      </div>
                      <span className="shrink-0 text-sm font-semibold text-foreground">{formatProductPrice(item.price * item.quantity)}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-5 space-y-3 border-t border-border pt-4 text-sm">
                  <div className="flex justify-between gap-3"><span className="text-muted-foreground">Subtotal</span><span className="font-medium text-foreground">{formatProductPrice(subtotal)}</span></div>
                  <div className="flex justify-between gap-3"><span className="text-muted-foreground">Envío</span><span className="font-medium text-foreground">{formatProductPrice(shippingCost)}</span></div>
                  <div className="flex justify-between gap-3 border-t border-border pt-3 text-base"><span className="font-semibold text-foreground">Total</span><span className="font-extrabold text-foreground">{formatProductPrice(total)}</span></div>
                </div>
                <Button type="submit" className="mt-5 h-11 w-full bg-brand-600 text-white hover:bg-brand-700" disabled={submitting || !addressIsValid || exceedsMerchantLimit}>
                  {submitting ? "Conectando con Transbank..." : "Pagar con Webpay"}
                </Button>
                <p className="mt-3 text-center text-xs text-muted-foreground">Se usarán exclusivamente credenciales y tarjetas de prueba; no se realizarán cobros reales.</p>
              </CardContent>
            </Card>
          </aside>
        </form>
      </section>
    </main>
  );
}

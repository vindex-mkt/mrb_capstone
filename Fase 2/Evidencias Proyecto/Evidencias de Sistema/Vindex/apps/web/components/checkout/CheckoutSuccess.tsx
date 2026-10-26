"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, PackageCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { formatProductPrice } from "@/lib/formatters";

type Order = {
  id: number;
  status: string;
  shipping_address: string;
  shipping_cost: number;
  subtotal: number;
  total: number;
  payment_method: string;
  created_at: string;
};

type OrderItem = {
  id: number;
  product_id: number | null;
  unit_price: number;
  quantity: number;
};

type Product = {
  id: number;
  name: string | null;
  images: string[] | null;
};

type OrderItemWithProduct = OrderItem & { product: Product | null };

export default function CheckoutSuccess({ orderId }: { orderId: string | null }) {
  const [supabase] = useState(createClient);
  const [order, setOrder] = useState<Order | null>(null);
  const [items, setItems] = useState<OrderItemWithProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    const loadOrder = async () => {
      if (!orderId || !/^\d+$/.test(orderId)) {
        setErrorMessage("El identificador de la compra no es válido.");
        setLoading(false);
        return;
      }

      const [{ data: { user }, error: authError }, orderResult] = await Promise.all([
        supabase.auth.getUser(),
        supabase
          .from("orders")
          .select("id, status, shipping_address, shipping_cost, subtotal, total, payment_method, created_at")
          .eq("id", Number(orderId))
          .maybeSingle(),
      ]);
      if (!current) return;
      if (authError) {
        setErrorMessage(`No se pudo verificar tu sesión: ${authError.message}`);
        setLoading(false);
        return;
      }
      if (!user) {
        setErrorMessage("Inicia sesión con la cuenta que realizó esta compra para ver el detalle.");
        setLoading(false);
        return;
      }
      if (orderResult.error) {
        setErrorMessage(`No se pudo cargar la compra: ${orderResult.error.message}`);
        setLoading(false);
        return;
      }
      if (!orderResult.data) {
        setErrorMessage("No encontramos una compra con este identificador.");
        setLoading(false);
        return;
      }

      const loadedOrder = orderResult.data as Order;
      const { data: orderItems, error: itemsError } = await supabase
        .from("order_items")
        .select("id, product_id, unit_price, quantity")
        .eq("order_id", loadedOrder.id);
      if (!current) return;
      if (itemsError) {
        setErrorMessage(`No se pudieron cargar los productos de la compra: ${itemsError.message}`);
        setLoading(false);
        return;
      }

      const loadedItems = (orderItems ?? []) as OrderItem[];
      const productIds = loadedItems.flatMap((item) => item.product_id === null ? [] : [item.product_id]);
      const productsResult = productIds.length > 0
        ? await supabase.from("products").select("id, name, images").in("id", productIds)
        : { data: [], error: null };
      if (!current) return;
      if (productsResult.error) {
        setErrorMessage(`No se pudieron cargar los productos: ${productsResult.error.message}`);
        setLoading(false);
        return;
      }

      const products = (productsResult.data ?? []) as Product[];
      setOrder(loadedOrder);
      setItems(loadedItems.map((item) => ({
        ...item,
        product: products.find((product) => product.id === item.product_id) ?? null,
      })));
      setLoading(false);
    };

    void loadOrder();
    return () => {
      current = false;
    };
  }, [orderId, supabase]);

  return (
    <main className="min-h-[60vh] bg-background">
      <section className="container-site py-8 sm:py-12">
        {loading ? (
          <p role="status" className="py-12 text-center text-sm text-muted-foreground">Cargando el detalle de tu compra...</p>
        ) : errorMessage ? (
          <Card className="mx-auto max-w-2xl border-border bg-surface">
            <CardHeader>
              <CardTitle>No pudimos mostrar el detalle de la compra</CardTitle>
              <CardDescription role="alert">{errorMessage}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <Link href="/profile" className="btn btn-primary inline-flex min-h-10 items-center px-5">Ir a Mis Compras</Link>
              <Link href="/tienda" className="btn btn-outline inline-flex min-h-10 items-center px-5">Volver al catálogo</Link>
            </CardContent>
          </Card>
        ) : order ? (
          <div className="mx-auto max-w-3xl space-y-6">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center sm:p-10">
              <CheckCircle2 className="mx-auto size-12 text-emerald-700" aria-hidden="true" />
              <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">¡Gracias por tu compra!</h1>
              <p className="mt-2 text-sm text-muted-foreground">Tu pedido #{order.id} se registró correctamente.</p>
            </div>

            <Card className="border-border bg-surface">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg"><PackageCheck className="size-5 text-brand-700" />Detalle de la orden</CardTitle>
                <CardDescription>
                  {new Date(order.created_at).toLocaleDateString("es-CL")} · Pago simulado con {order.payment_method === "mercadopago" ? "Mercado Pago" : "Webpay Plus"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <ul className="divide-y divide-border">
                  {items.map((item) => (
                    <li key={item.id} className="flex gap-4 py-4 first:pt-0">
                      <img src={item.product?.images?.[0] ?? "https://picsum.photos/seed/vindex-order/160/160"} alt={item.product?.name ?? "Producto no disponible"} className="size-16 shrink-0 rounded-lg object-cover" />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-foreground">{item.product?.name ?? "Producto no disponible"}</p>
                        <p className="mt-1 text-sm text-muted-foreground">Cantidad: {item.quantity} · {formatProductPrice(Number(item.unit_price))} c/u</p>
                      </div>
                      <span className="shrink-0 text-sm font-semibold text-foreground">{formatProductPrice(Number(item.unit_price) * item.quantity)}</span>
                    </li>
                  ))}
                </ul>
                <div className="space-y-2 border-t border-border pt-4 text-sm">
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">
                      {order.shipping_address.toLocaleLowerCase("es").includes("acordar con el vendedor")
                        ? "Retiro presencial acordado con el vendedor"
                        : `Envío a ${order.shipping_address}`}
                    </span>
                    <span className="font-medium text-foreground">{formatProductPrice(Number(order.shipping_cost))}</span>
                  </div>
                  {order.shipping_address.toLocaleLowerCase("es").includes("acordar con el vendedor") && (
                    <p className="rounded-lg bg-brand-50 p-3 text-sm text-brand-900">
                      Tu código OTP estará disponible en <Link href="/profile" className="font-semibold underline underline-offset-2">Mis Compras</Link>. Compártelo con el vendedor solo cuando tengas el producto en tus manos.
                    </p>
                  )}
                  <div className="flex justify-between gap-3 border-t border-border pt-3 text-base"><span className="font-semibold text-foreground">Total pagado</span><span className="font-extrabold text-foreground">{formatProductPrice(Number(order.total))}</span></div>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Link href="/tienda" className="btn btn-primary inline-flex min-h-10 items-center px-5">Volver al catálogo</Link>
                  <Link href="/profile" className="btn btn-outline inline-flex min-h-10 items-center px-5">Ver Mis Compras</Link>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : null}
      </section>
    </main>
  );
}

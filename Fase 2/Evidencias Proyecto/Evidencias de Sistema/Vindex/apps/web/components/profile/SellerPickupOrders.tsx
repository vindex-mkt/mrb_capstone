"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { formatProductPrice } from "@/lib/formatters";
import { useToast } from "@/components/ToastProvider";

type Order = {
  id: number;
  buyer_id: string;
  status: string;
  delivery_status: string;
  shipping_address: string;
  created_at: string;
  total: number;
};

type OrderItem = {
  id: number;
  order_id: number;
  product_id: number | null;
  unit_price: number;
  quantity: number;
};

type Product = {
  id: number;
  name: string | null;
  images: string[] | null;
};

type SellerOrder = {
  order: Order;
  items: (OrderItem & { product: Product | null })[];
};

type VerifyOtpResponse = {
  success?: boolean;
  message?: string;
  delivery_status?: string;
};

const isPickupOrder = (order: Order) =>
  order.shipping_address.toLocaleLowerCase("es").includes("acordar con el vendedor")
  || order.shipping_address.toLocaleLowerCase("es").startsWith("retiro en tienda");

export default function SellerPickupOrders() {
  const [supabase] = useState(createClient);
  const { showToast } = useToast();
  const [orders, setOrders] = useState<SellerOrder[]>([]);
  const [codes, setCodes] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submittingOrderId, setSubmittingOrderId] = useState<number | null>(null);

  useEffect(() => {
    let current = true;

    const loadPickupOrders = async () => {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (!current) return;
      if (authError) {
        setLoadError(`No se pudo verificar tu sesión: ${authError.message}`);
        setLoading(false);
        return;
      }
      if (!user) {
        setLoadError("Inicia sesión para ver las órdenes de tus ventas.");
        setLoading(false);
        return;
      }

      const { data: orderItems, error: itemsError } = await supabase
        .from("order_items")
        .select("id, order_id, product_id, unit_price, quantity")
        .eq("seller_id", user.id)
        .order("order_id", { ascending: false });
      if (!current) return;
      if (itemsError) {
        setLoadError(`No se pudieron cargar las órdenes recibidas: ${itemsError.message}`);
        setLoading(false);
        return;
      }

      const loadedItems = (orderItems ?? []) as OrderItem[];
      const orderIds = [...new Set(loadedItems.map((item) => item.order_id))];
      if (orderIds.length === 0) {
        setLoading(false);
        return;
      }

      const { data: orderRows, error: ordersError } = await supabase
        .from("orders")
        .select("id, buyer_id, status, delivery_status, shipping_address, created_at, total")
        .in("id", orderIds)
        .order("created_at", { ascending: false });
      if (!current) return;
      if (ordersError) {
        setLoadError(`No se pudieron cargar los detalles de las órdenes: ${ordersError.message}`);
        setLoading(false);
        return;
      }

      const pickupOrders = ((orderRows ?? []) as Order[]).filter(isPickupOrder);
      if (pickupOrders.length === 0) {
        setLoading(false);
        return;
      }

      const pickupOrderIds = new Set(pickupOrders.map((order) => order.id));
      const pickupItems = loadedItems.filter((item) => pickupOrderIds.has(item.order_id));
      const productIds = [...new Set(pickupItems.flatMap((item) => item.product_id === null ? [] : [item.product_id]))];
      const productsResult = productIds.length > 0
        ? await supabase.from("products").select("id, name, images").in("id", productIds)
        : { data: [], error: null };
      if (!current) return;
      if (productsResult.error) {
        setLoadError(`No se pudieron cargar los productos de las órdenes: ${productsResult.error.message}`);
        setLoading(false);
        return;
      }

      const products = (productsResult.data ?? []) as Product[];
      setOrders(pickupOrders.map((order) => ({
        order,
        items: pickupItems.filter((item) => item.order_id === order.id).map((item) => ({
          ...item,
          product: products.find((product) => product.id === item.product_id) ?? null,
        })),
      })));
      setLoading(false);
    };

    void loadPickupOrders();
    return () => {
      current = false;
    };
  }, [supabase]);

  const handleCodeChange = (orderId: number, value: string) => {
    setCodes((current) => ({ ...current, [orderId]: value.replace(/\D/g, "").slice(0, 6) }));
  };

  const verifyDelivery = async (event: React.FormEvent<HTMLFormElement>, orderId: number) => {
    event.preventDefault();
    const codeInput = codes[orderId] ?? "";
    if (!/^\d{6}$/.test(codeInput)) {
      showToast("Ingresa el código OTP completo de 6 dígitos.", "error");
      return;
    }

    setSubmittingOrderId(orderId);
    try {
      const { data, error } = await supabase.rpc("verify_delivery_otp", {
        p_order_id: orderId,
        p_entered_code: codeInput,
      });
      if (error) throw error;

      const result = data as VerifyOtpResponse | null;
      if (!result?.success) {
        showToast(result?.message ?? "No se pudo validar el código de retiro.", "error");
        return;
      }

      setOrders((current) => current.map((entry) => entry.order.id === orderId
        ? { ...entry, order: { ...entry.order, delivery_status: "completed" } }
        : entry));
      setCodes((current) => ({ ...current, [orderId]: "" }));
      showToast(result.message ?? "Entrega confirmada con éxito.", "success");
    } catch (verificationError) {
      const message = verificationError instanceof Error ? verificationError.message : "Error desconocido";
      showToast(`No se pudo validar la entrega: ${message}`, "error");
    } finally {
      setSubmittingOrderId(null);
    }
  };

  return (
    <Card className="border-border bg-surface">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg text-foreground"><KeyRound className="size-5 text-brand-700" />Mis Ventas · Retiros presenciales</CardTitle>
        <CardDescription>Confirma la entrega ingresando el código OTP que te entrega el comprador en persona.</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p role="status" className="text-sm text-muted-foreground">Cargando retiros de tus ventas...</p>
        ) : loadError ? (
          <p role="alert" className="text-sm text-red-700">{loadError}</p>
        ) : orders.length === 0 ? (
          <p className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">No tienes órdenes con retiro presencial.</p>
        ) : (
          <ul className="space-y-4">
            {orders.map(({ order, items: orderItems }) => {
              const delivered = order.delivery_status === "completed";
              return (
                <li key={order.id} className="rounded-xl border border-border p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-foreground">Orden #{order.id}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {new Date(order.created_at).toLocaleDateString("es-CL")} · Total: {formatProductPrice(Number(order.total))}
                      </p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${delivered ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"}`}>
                      {delivered ? "Entregado" : "Pendiente de retiro"}
                    </span>
                  </div>

                  <ul className="mt-4 divide-y divide-border border-y border-border">
                    {orderItems.map((item) => (
                      <li key={item.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                        <span className="text-foreground">{item.product?.name ?? "Producto no disponible"} × {item.quantity}</span>
                        <span className="shrink-0 font-medium text-foreground">{formatProductPrice(Number(item.unit_price) * item.quantity)}</span>
                      </li>
                    ))}
                  </ul>

                  {delivered ? (
                    <p className="mt-4 flex items-center gap-2 text-sm font-medium text-emerald-800">
                      <CheckCircle2 className="size-4" aria-hidden="true" />
                      Entrega validada. El comprador ya puede calificar el producto.
                    </p>
                  ) : (
                    <form onSubmit={(event) => void verifyDelivery(event, order.id)} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
                      <div className="w-full space-y-2 sm:max-w-56">
                        <Label htmlFor={`pickup-otp-${order.id}`}>Código OTP del comprador</Label>
                        <Input
                          id={`pickup-otp-${order.id}`}
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          pattern="[0-9]{6}"
                          maxLength={6}
                          value={codes[order.id] ?? ""}
                          onChange={(event) => handleCodeChange(order.id, event.target.value)}
                          placeholder="6 dígitos"
                          required
                        />
                      </div>
                      <Button type="submit" className="min-h-10 bg-brand-600 text-white hover:bg-brand-700" disabled={submittingOrderId === order.id || (codes[order.id] ?? "").length !== 6}>
                        {submittingOrderId === order.id ? "Validando..." : "Validar Entrega con Código OTP"}
                      </Button>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

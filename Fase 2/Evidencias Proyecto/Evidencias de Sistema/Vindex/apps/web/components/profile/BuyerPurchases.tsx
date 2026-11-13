"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import PendingWebpayPayments from "@/components/profile/PendingWebpayPayments";
import { createClient } from "@/lib/supabase/client";
import { formatProductPrice } from "@/lib/formatters";
import { useToast } from "@/components/ToastProvider";

type Order = {
  id: number;
  status: string;
  created_at: string;
  total: number;
  shipping_address: string;
  delivery_status: string;
  shipping_method?: string;
};

type OrderItem = {
  id: number;
  order_id: number;
  product_id: number | null;
  seller_id: string;
  store_id: number | null;
  unit_price: number;
  quantity: number;
};

type Product = {
  id: number;
  name: string | null;
  images: string[] | null;
  store_id: number | null;
};

type PurchaseItem = OrderItem & {
  order: Order;
  product: Product | null;
};

type DeliveryCodeResponse = {
  success?: boolean;
  delivery_code?: string;
  message?: string;
};

type OrderSellerChat = {
  order_id: number;
  seller_id: string;
  conversation_id: number;
  seller_replied_at: string | null;
};

type BuyerOrdersResponse = {
  orders?: Order[];
  chats?: OrderSellerChat[];
  message?: string;
};

const isPickupOrder = (order: Order) =>
  order.shipping_method === "pickup"
  || order.shipping_address.toLocaleLowerCase("es").includes("coordinar con el vendedor")
  || order.shipping_address.toLocaleLowerCase("es").includes("acordar con el vendedor")
  || order.shipping_address.toLocaleLowerCase("es").startsWith("retiro en tienda");

export default function BuyerPurchases() {
  const router = useRouter();
  const [supabase] = useState(createClient);
  const { showToast } = useToast();
  const [items, setItems] = useState<PurchaseItem[]>([]);
  const [ratedProductIds, setRatedProductIds] = useState<Set<number>>(new Set());
  const [deliveryCodes, setDeliveryCodes] = useState<Record<number, string | null>>({});
  const [sellerChats, setSellerChats] = useState<OrderSellerChat[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [ratingItem, setRatingItem] = useState<PurchaseItem | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [startingCoordinationOrderId, setStartingCoordinationOrderId] = useState<number | null>(null);
  const [refreshingCoordinationOrderId, setRefreshingCoordinationOrderId] = useState<number | null>(null);

  useEffect(() => {
    let current = true;

    const loadPurchases = async () => {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (!current) return;
      if (authError) {
        setLoadError(`No se pudo verificar tu sesión: ${authError.message}`);
        setLoading(false);
        return;
      }
      if (!user) {
        setLoadError("Inicia sesión para ver tus compras.");
        setLoading(false);
        return;
      }

      let loadedOrders: Order[];
      try {
        const response = await fetch("/api/orders/mine", { cache: "no-store" });
        const result = await response.json() as BuyerOrdersResponse;
        if (!response.ok || !Array.isArray(result.orders) || !Array.isArray(result.chats)) {
          throw new Error(result.message ?? "No pudimos cargar tus compras.");
        }
        loadedOrders = result.orders;
        setSellerChats(result.chats);
      } catch (error) {
        if (!current) return;
        setLoadError(`No se pudieron cargar tus compras: ${error instanceof Error ? error.message : "Error desconocido"}`);
        setLoading(false);
        return;
      }
      if (!current) return;

      const pickupOrders = loadedOrders.filter((order) =>
        isPickupOrder(order) && ["paid", "completed", "delivered"].includes(order.status.toLowerCase()),
      );
      const codeResults = await Promise.all(pickupOrders.map((order) => supabase.rpc(
        "get_coordinated_buyer_delivery_code",
        { p_order_id: order.id },
      )));
      if (!current) return;
      const codeError = codeResults.find((result) => result.error)?.error;
      if (codeError) {
        setLoadError(`No se pudieron cargar tus códigos de retiro: ${codeError.message}`);
        setLoading(false);
        return;
      }
      setDeliveryCodes(Object.fromEntries(pickupOrders.map((order, index) => {
        const result = codeResults[index]?.data as DeliveryCodeResponse | null | undefined;
        return [order.id, result?.success && typeof result.delivery_code === "string" ? result.delivery_code : null];
      })));

      const orderIds = loadedOrders.map((order) => order.id);
      if (orderIds.length === 0) {
        setLoading(false);
        return;
      }

      const { data: orderItems, error: itemsError } = await supabase
        .from("order_items")
        .select("id, order_id, product_id, seller_id, store_id, unit_price, quantity")
        .in("order_id", orderIds);
      if (!current) return;
      if (itemsError) {
        setLoadError(`No se pudieron cargar los productos comprados: ${itemsError.message}`);
        setLoading(false);
        return;
      }

      const loadedItems = (orderItems ?? []) as OrderItem[];
      const productIds = [...new Set(loadedItems.flatMap((item) => item.product_id === null ? [] : [item.product_id]))];
      const [productsResult, reviewsResult] = await Promise.all([
        productIds.length > 0
          ? supabase.from("products").select("id, name, images, store_id").in("id", productIds)
          : Promise.resolve({ data: [], error: null }),
        productIds.length > 0
          ? supabase.from("reviews").select("product_id").eq("buyer_id", user.id).in("product_id", productIds)
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (!current) return;
      if (productsResult.error) {
        setLoadError(`No se pudieron cargar los detalles de los productos: ${productsResult.error.message}`);
        setLoading(false);
        return;
      }
      if (reviewsResult.error) {
        setLoadError(`No se pudieron verificar tus calificaciones: ${reviewsResult.error.message}`);
        setLoading(false);
        return;
      }

      const products = (productsResult.data ?? []) as Product[];
      setRatedProductIds(new Set((reviewsResult.data ?? [])
        .flatMap((review) => typeof review.product_id === "number" ? [review.product_id] : [])));
      setItems(loadedItems.flatMap((item) => {
        const order = loadedOrders.find((candidate) => candidate.id === item.order_id);
        if (!order) return [];
        return [{
          ...item,
          order,
          product: products.find((product) => product.id === item.product_id) ?? null,
        }];
      }));
      setLoading(false);
    };

    void loadPurchases();
    return () => {
      current = false;
    };
  }, [supabase]);

  const openRating = (item: PurchaseItem) => {
    setRatingItem(item);
    setRating(5);
    setComment("");
  };

  const startCoordinationChat = async (orderId: number) => {
    setStartingCoordinationOrderId(orderId);
    try {
      const response = await fetch(`/api/orders/${orderId}/pickup-chat`, {
        method: "POST",
        cache: "no-store",
      });
      const result = await response.json() as { conversationId?: unknown; message?: unknown };
      if (!response.ok || typeof result.conversationId !== "number") {
        throw new Error(typeof result.message === "string" ? result.message : "No se pudo iniciar el chat.");
      }
      router.push(`/messages/${result.conversationId}`);
    } catch (coordinationError) {
      const message = coordinationError instanceof Error ? coordinationError.message : "Error desconocido";
      showToast(`No se pudo iniciar la coordinación: ${message}`, "error");
    } finally {
      setStartingCoordinationOrderId(null);
    }
  };

  const refreshCoordination = async (orderId: number) => {
    setRefreshingCoordinationOrderId(orderId);
    try {
      const [codeResult, chatsResult] = await Promise.all([
        supabase.rpc("get_coordinated_buyer_delivery_code", { p_order_id: orderId }),
        supabase
          .from("order_seller_chats")
          .select("order_id, seller_id, conversation_id, seller_replied_at")
          .eq("order_id", orderId),
      ]);
      if (codeResult.error) throw codeResult.error;
      if (chatsResult.error) throw chatsResult.error;

      const code = codeResult.data as DeliveryCodeResponse | null;
      setDeliveryCodes((current) => ({
        ...current,
        [orderId]: code?.success && typeof code.delivery_code === "string" ? code.delivery_code : null,
      }));
      setSellerChats((current) => [
        ...current.filter((chat) => chat.order_id !== orderId),
        ...((chatsResult.data ?? []) as OrderSellerChat[]),
      ]);
      showToast(
        code?.success
          ? "El código OTP ya está disponible."
          : code?.message ?? "La coordinación todavía está pendiente.",
        code?.success ? "success" : "info",
      );
    } catch (refreshError) {
      const message = refreshError instanceof Error ? refreshError.message : "Error desconocido";
      showToast(`No se pudo actualizar la coordinación: ${message}`, "error");
    } finally {
      setRefreshingCoordinationOrderId(null);
    }
  };

  const submitRating = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!ratingItem?.product_id || ratedProductIds.has(ratingItem.product_id)) return;

    const productId = ratingItem.product_id;
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      showToast(`No se pudo verificar tu sesión: ${authError?.message ?? "Inicia sesión nuevamente."}`, "error");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from("reviews").insert({
        product_id: productId,
        buyer_id: user.id,
        seller_id: ratingItem.seller_id,
        store_id: ratingItem.store_id,
        rating,
        comment: comment.trim() || null,
      });
      if (error) throw error;

      setRatedProductIds((current) => new Set(current).add(productId));
      setRatingItem(null);
      showToast("Tu calificación fue registrada.", "success");
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : "Error desconocido";
      showToast(`No se pudo guardar la calificación: ${message}`, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="border-border bg-surface">
      <CardHeader>
        <CardTitle className="text-lg text-foreground">Mis Compras</CardTitle>
        <CardDescription>Consulta tus pedidos y califica los productos que ya compraste.</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p role="status" className="text-sm text-muted-foreground">Cargando tu historial de compras...</p>
        ) : loadError ? (
          <p role="alert" className="text-sm text-red-700">{loadError}</p>
        ) : (
          <>
            <PendingWebpayPayments />
            {items.length === 0 ? (
              <p className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Aún no tienes compras registradas.</p>
            ) : <ul className="divide-y divide-border">
            {items.map((item, index) => {
              const pickupOrder = isPickupOrder(item.order);
              const deliveryCompleted = item.order.delivery_status === "completed";
              const paymentConfirmed = ["paid", "completed", "delivered"].includes(item.order.status.toLowerCase());
              const canRate = (pickupOrder
                ? paymentConfirmed && deliveryCompleted
                : ["paid", "completed", "delivered"].includes(item.order.status.toLowerCase())) && item.product_id !== null;
              const hasRated = item.product_id !== null && ratedProductIds.has(item.product_id);
              const isFirstOrderItem = items.findIndex((purchase) => purchase.order.id === item.order.id) === index;
              const deliveryCode = deliveryCodes[item.order.id];
              const orderChats = sellerChats.filter((chat) => chat.order_id === item.order.id);
              const sellersHaveReplied = orderChats.length > 0 && orderChats.every((chat) => chat.seller_replied_at);

              return (
                <li key={item.id} className="flex flex-col gap-4 py-5 first:pt-0 sm:flex-row sm:items-center">
                  <img
                    src={item.product?.images?.[0] ?? "https://picsum.photos/seed/vindex-purchase/160/160"}
                    alt={item.product?.name ?? "Producto no disponible"}
                    className="size-20 shrink-0 rounded-lg object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-foreground">{item.product?.name ?? "Producto no disponible"}</p>
                    <p className="mt-1 text-sm text-muted-foreground">Pedido #{item.order.id} · {new Date(item.order.created_at).toLocaleDateString("es-CL")}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {item.quantity} × {formatProductPrice(Number(item.unit_price))} · Estado: {pickupOrder
                        ? !paymentConfirmed
                          ? item.order.status === "partially_paid" ? "Pago parcialmente autorizado" : "Pago pendiente o rechazado"
                          : deliveryCompleted ? "Entregado" : "Pendiente de coordinación"
                        : item.order.status}
                    </p>
                    {pickupOrder && paymentConfirmed && isFirstOrderItem && (
                      <div className={`mt-4 rounded-xl border p-4 ${deliveryCompleted ? "border-emerald-200 bg-emerald-50" : "border-brand-200 bg-brand-50/70"}`}>
                        {deliveryCompleted ? (
                          <p className="font-semibold text-emerald-800">Entrega coordinada y confirmada</p>
                        ) : deliveryCode && /^\d{6}$/.test(deliveryCode) ? (
                          <>
                            <p className="text-sm font-semibold text-foreground">Código OTP de entrega</p>
                            <p className="mt-1 font-mono text-3xl font-extrabold tracking-[0.3em] text-brand-800" aria-label={`Código de retiro ${deliveryCode}`}>
                              {deliveryCode}
                            </p>
                            <p className="mt-2 text-sm text-muted-foreground">Compártelo con el vendedor únicamente cuando tengas el producto en tus manos. La validación liberará los fondos retenidos.</p>
                          </>
                        ) : orderChats.length > 0 ? (
                          <>
                            <p className="text-sm font-semibold text-foreground">
                              {sellersHaveReplied
                                ? "La entrega está coordinada. El código OTP no está disponible."
                                : "El vendedor debe confirmar la coordinación antes de habilitar el código OTP."}
                            </p>
                            <div className="mt-2 flex flex-wrap gap-3">
                              {orderChats.map((chat) => (
                                <Link
                                  key={chat.conversation_id}
                                  href={`/messages/${chat.conversation_id}`}
                                  className="text-sm font-semibold text-brand-800 underline underline-offset-2"
                                >
                                  {chat.seller_replied_at ? "Ver chat de entrega" : "Coordinar con el vendedor"}
                                </Link>
                              ))}
                            </div>
                            {!deliveryCode && (
                              <Button
                                type="button"
                                variant="outline"
                                className="mt-3"
                                disabled={refreshingCoordinationOrderId === item.order.id}
                                onClick={() => void refreshCoordination(item.order.id)}
                              >
                                {refreshingCoordinationOrderId === item.order.id ? "Revisando..." : "Actualizar coordinación y OTP"}
                              </Button>
                            )}
                          </>
                        ) : (
                          <>
                            <p className="text-sm text-muted-foreground">La entrega requiere coordinarse por el chat de la orden antes de habilitar el OTP.</p>
                            <Button
                              type="button"
                              variant="outline"
                              className="mt-3"
                              disabled={startingCoordinationOrderId === item.order.id}
                              onClick={() => void startCoordinationChat(item.order.id)}
                            >
                              {startingCoordinationOrderId === item.order.id ? "Abriendo chat..." : "Iniciar coordinación"}
                            </Button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3 sm:justify-end">
                    <span className="font-semibold text-foreground">{formatProductPrice(Number(item.unit_price) * item.quantity)}</span>
                    {hasRated ? (
                      <span className="text-sm text-muted-foreground">Producto calificado</span>
                    ) : canRate && !loadError ? (
                      <Button type="button" variant="outline" onClick={() => openRating(item)}>Calificar producto</Button>
                    ) : null}
                  </div>
                </li>
              );
            })}
            </ul>}
          </>
        )}
      </CardContent>

      {ratingItem && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !saving) setRatingItem(null);
          }}
        >
          <section role="dialog" aria-modal="true" aria-labelledby="purchase-rating-title" className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 text-foreground shadow-xl">
            <h2 id="purchase-rating-title" className="text-xl font-semibold">Calificar producto</h2>
            <p className="mt-1 text-sm text-muted-foreground">{ratingItem.product?.name ?? "Producto comprado"}</p>
            <form onSubmit={(event) => void submitRating(event)} className="mt-5 space-y-5">
              <fieldset>
                <legend className="text-sm font-medium text-foreground">Tu calificación</legend>
                <div className="mt-2 flex gap-2">
                  {[1, 2, 3, 4, 5].map((value) => (
                    <button
                      key={value}
                      type="button"
                      aria-label={`${value} ${value === 1 ? "estrella" : "estrellas"}`}
                      aria-pressed={rating === value}
                      onClick={() => setRating(value)}
                      className="rounded-md p-1 text-amber-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
                    >
                      <Star className={`size-7 ${value <= rating ? "fill-current" : ""}`} aria-hidden="true" />
                    </button>
                  ))}
                </div>
              </fieldset>
              <div className="space-y-2">
                <Label htmlFor="purchase-rating-comment">Comentario (opcional)</Label>
                <Textarea id="purchase-rating-comment" value={comment} onChange={(event) => setComment(event.target.value)} rows={3} maxLength={1000} placeholder="Cuéntanos tu experiencia con el producto." />
              </div>
              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" disabled={saving} onClick={() => setRatingItem(null)}>Cancelar</Button>
                <Button type="submit" disabled={saving}>{saving ? "Guardando..." : "Enviar calificación"}</Button>
              </div>
            </form>
          </section>
        </div>
      )}
    </Card>
  );
}

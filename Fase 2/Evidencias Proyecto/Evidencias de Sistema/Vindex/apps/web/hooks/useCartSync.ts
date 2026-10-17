"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { useCartStore, type CartItem } from "@/lib/store/useCartStore";

type CartProduct = {
  id: number;
  name: string | null;
  price: number | null;
  discount_price: number | null;
  stock: number | null;
  images: string[] | null;
  seller_id: string;
  sale_type: string | null;
  status: boolean | string | null;
  offer_ends_at: string | null;
};

type JoinedCartItem = {
  product_id: number;
  quantity: number;
  products: CartProduct | CartProduct[] | null;
};

const productFields =
  "id, name, price, discount_price, stock, images, seller_id, sale_type, status, offer_ends_at";
const fallbackImage = "https://picsum.photos/seed/vindex-product/600/600";

const toCartItem = (product: CartProduct, quantity: number): CartItem | null => {
  const stock = Math.max(Math.floor(Number(product.stock) || 0), 0);
  const price = Number(product.price);
  const isActive = product.status === true || product.status === "true";
  if (
    !isActive ||
    !["direct", "fixed_price"].includes(product.sale_type ?? "") ||
    stock === 0 ||
    !Number.isFinite(price)
  ) {
    return null;
  }

  const hasActiveOffer =
    product.discount_price !== null &&
    product.offer_ends_at !== null &&
    new Date(product.offer_ends_at).getTime() > Date.now();

  return {
    id: product.id,
    name: product.name ?? "Producto sin nombre",
    price: hasActiveOffer ? Number(product.discount_price) : price,
    image: product.images?.[0] || fallbackImage,
    quantity: Math.min(Math.max(Math.floor(quantity), 0), stock),
    stock,
    seller_id: product.seller_id,
  };
};

const syncCartItems = async (supabase: ReturnType<typeof createClient>, cartId: string, items: CartItem[]) => {
  if (items.length > 0) {
    const { error: upsertError } = await supabase.from("cart_items").upsert(
      items.map(({ id, quantity }) => ({ cart_id: cartId, product_id: id, quantity })),
      { onConflict: "cart_id,product_id" },
    );
    if (upsertError) throw upsertError;

    const productIds = items.map(({ id }) => id);
    const { error: deleteError } = await supabase
      .from("cart_items")
      .delete()
      .eq("cart_id", cartId)
      .not("product_id", "in", `(${productIds.join(",")})`);
    if (deleteError) throw deleteError;
    return;
  }

  const { error } = await supabase.from("cart_items").delete().eq("cart_id", cartId);
  if (error) throw error;
};

export function useCartSync() {
  const [supabase] = useState(createClient);

  useEffect(() => {
    let isActive = true;
    let generation = 0;
    let stopStoreSubscription = () => {};
    let syncQueue = Promise.resolve();
    let resolveHydration: () => void = () => {};
    const hydrationReady = new Promise<void>((resolve) => {
      resolveHydration = resolve;
    });

    const finishHydration = () => resolveHydration();
    const hydrationSubscription = useCartStore.persist.onFinishHydration(finishHydration);
    if (useCartStore.persist.hasHydrated()) finishHydration();
    void Promise.resolve(useCartStore.persist.rehydrate()).finally(finishHydration);

    const syncUser = async (user: User | null) => {
      const currentGeneration = ++generation;
      stopStoreSubscription();
      stopStoreSubscription = () => {};

      if (!user) return;

      await hydrationReady;
      if (!isActive || currentGeneration !== generation) return;

      const store = useCartStore.getState();
      const isSameOwner = store.cartOwnerId === user.id;
      const localItems = store.cartOwnerId === null || store.cartOwnerId === user.id ? store.items : [];

      try {
        const { data: cart, error: cartError } = await supabase
          .from("carts")
          .upsert({ user_id: user.id }, { onConflict: "user_id" })
          .select("id")
          .single();
        if (cartError) throw cartError;
        if (!isActive || currentGeneration !== generation) return;

        const cartId = cart.id as string;
        const { data: databaseItems, error: itemsError } = await supabase
          .from("cart_items")
          .select(`product_id, quantity, products!inner(${productFields})`)
          .eq("cart_id", cartId);
        if (itemsError) throw itemsError;

        const joinedItems = (databaseItems ?? []) as unknown as JoinedCartItem[];
        const productMap = new Map<number, CartProduct>();
        for (const row of joinedItems) {
          const product = Array.isArray(row.products) ? row.products[0] : row.products;
          if (product) productMap.set(row.product_id, product);
        }

        const missingLocalIds = localItems
          .map(({ id }) => id)
          .filter((id) => !productMap.has(id));
        if (missingLocalIds.length > 0) {
          const { data: localProducts, error: productsError } = await supabase
            .from("products")
            .select(productFields)
            .in("id", missingLocalIds)
            .eq("status", true)
            .in("sale_type", ["direct", "fixed_price"])
            .gt("stock", 0);
          if (productsError) throw productsError;
          for (const product of (localProducts ?? []) as unknown as CartProduct[]) {
            productMap.set(product.id, product);
          }
        }

        if (!isActive || currentGeneration !== generation) return;

        const mergedQuantities = new Map<number, number>();
        for (const item of localItems) {
          mergedQuantities.set(item.id, item.quantity);
        }
        for (const item of joinedItems) {
          if (productMap.has(item.product_id)) {
            const localQuantity = mergedQuantities.get(item.product_id) ?? 0;
            mergedQuantities.set(
              item.product_id,
              isSameOwner
                ? Math.max(localQuantity, item.quantity)
                : localQuantity + item.quantity,
            );
          }
        }

        const mergedItems = [...mergedQuantities].flatMap(([productId, quantity]) => {
          const product = productMap.get(productId);
          const cachedItem = localItems.find((item) => item.id === productId);
          const item = product
            ? toCartItem(product, quantity)
            : cachedItem
              ? {
                  ...cachedItem,
                  quantity: Math.min(quantity, cachedItem.stock),
                }
              : null;

          // A failed/filtered product join must not erase a valid item from local persistence.
          return item && item.quantity > 0 ? [item] : [];
        });

        useCartStore.getState().setItems(mergedItems);
        useCartStore.getState().setCartOwnerId(user.id);

        const enqueueSync = (items: CartItem[]) => {
          syncQueue = syncQueue
            .then(async () => {
              if (isActive && currentGeneration === generation) {
                await syncCartItems(supabase, cartId, items);
              }
            })
            .catch((error: unknown) => console.error("No se pudo sincronizar el carrito:", error));
        };

        stopStoreSubscription = useCartStore.subscribe((state, previousState) => {
          if (state.items !== previousState.items) enqueueSync(state.items);
        });
        enqueueSync(mergedItems);
      } catch (error) {
        if (isActive && currentGeneration === generation) {
          console.error("No se pudo cargar el carrito desde Supabase:", error);
        }
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_authEvent, session) => {
      queueMicrotask(() => void syncUser(session?.user ?? null));
    });

    return () => {
      isActive = false;
      generation += 1;
      stopStoreSubscription();
      hydrationSubscription();
      subscription.unsubscribe();
    };
  }, [supabase]);
}
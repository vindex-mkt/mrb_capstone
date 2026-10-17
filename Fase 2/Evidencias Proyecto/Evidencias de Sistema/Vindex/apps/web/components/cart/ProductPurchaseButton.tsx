"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CreditCard, ShoppingCart } from "lucide-react";
import { useCartStore } from "@/lib/store/useCartStore";
import { getProductImage, type ProductListing } from "@/lib/product-utils";
import { useToast } from "@/components/ToastProvider";
import { createClient } from "@/lib/supabase/client";

type ProductPurchaseButtonProps = {
  product: Pick<
    ProductListing,
    "id" | "name" | "price" | "stock" | "images" | "seller_id" | "sale_type"
  >;
  currentPrice: number | null;
  action?: "add" | "buy";
};

export default function ProductPurchaseButton({ product, currentPrice, action = "add" }: ProductPurchaseButtonProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [supabase] = useState(createClient);
  const addItem = useCartStore((state) => state.addItem);
  const hasHydrated = useCartStore((state) => state.hasHydrated);
  const [wasAdded, setWasAdded] = useState(false);
  const [buying, setBuying] = useState(false);
  const stock = Math.max(Math.floor(Number(product.stock) || 0), 0);
  const isFixedPrice = ["direct", "fixed_price"].includes(product.sale_type ?? "");
  const canAdd = hasHydrated && isFixedPrice && stock > 0 && Number.isFinite(currentPrice);

  const handlePurchase = async () => {
    if (!canAdd || currentPrice === null || buying) return;

    const cartItem = {
      id: product.id,
      name: product.name ?? "Producto sin nombre",
      price: currentPrice,
      image: getProductImage(product),
      quantity: 1,
      stock,
      seller_id: product.seller_id,
    };
    addItem(cartItem);
    setWasAdded(true);
    if (action === "add") return;

    setBuying(true);
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!user) {
        router.push("/checkout");
        return;
      }

      const { data: cart, error: cartError } = await supabase
        .from("carts")
        .upsert({ user_id: user.id }, { onConflict: "user_id" })
        .select("id")
        .single();
      if (cartError) throw cartError;

      const { data: existingItem, error: itemError } = await supabase
        .from("cart_items")
        .select("quantity")
        .eq("cart_id", cart.id)
        .eq("product_id", product.id)
        .maybeSingle();
      if (itemError) throw itemError;

      const cartState = useCartStore.getState();
      const cartBelongsToUser = cartState.cartOwnerId === null || cartState.cartOwnerId === user.id;
      const localQuantity = cartBelongsToUser
        ? cartState.items.find((item) => item.id === product.id)?.quantity ?? 1
        : 1;
      const quantity = Math.max(localQuantity, Number(existingItem?.quantity ?? 0));
      const { error: saveError } = await supabase
        .from("cart_items")
        .upsert(
          { cart_id: cart.id, product_id: product.id, quantity },
          { onConflict: "cart_id,product_id" },
        );
      if (saveError) throw saveError;

      router.push("/checkout");
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : typeof error === "object" && error !== null && "message" in error && typeof error.message === "string"
          ? error.message
          : "Error desconocido";
      showToast(`No se pudo preparar la compra: ${message}`, "error");
    } finally {
      setBuying(false);
    }
  };

  return (
    <button
      type="button"
      disabled={!canAdd || buying}
      onClick={() => void handlePurchase()}
      className={`btn ${action === "buy" ? "btn-light" : "btn-primary"} flex-1 min-w-45 disabled:cursor-not-allowed disabled:opacity-50`}
    >
      {action === "buy"
        ? <CreditCard className="size-4" aria-hidden="true" />
        : <ShoppingCart className="size-4" aria-hidden="true" />}
      {!hasHydrated
        ? "Preparando carrito..."
        : buying
          ? "Preparando compra..."
        : canAdd
          ? action === "buy" ? "Comprar ahora" : wasAdded ? "Agregado al carrito" : "Agregar al carrito"
          : "No disponible para compra"}
    </button>
  );
}
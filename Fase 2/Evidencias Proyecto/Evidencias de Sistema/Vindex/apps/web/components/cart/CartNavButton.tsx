"use client";

import { ShoppingCart } from "lucide-react";
import Link from "next/link";
import { useCartStore } from "@/lib/store/useCartStore";

export default function CartNavButton() {
  const hasHydrated = useCartStore((state) => state.hasHydrated);
  const itemCount = useCartStore((state) => state.getItemCount());

  return (
    <Link
      href="/cart"
      className="icon-btn h-10 w-10"
      aria-label={itemCount > 0 ? `Ver carrito, ${itemCount} productos` : "Ver carrito"}
    >
      <ShoppingCart className="h-5 w-5" aria-hidden="true" />
      {hasHydrated && itemCount > 0 && <span className="count-badge">{itemCount}</span>}
    </Link>
  );
}
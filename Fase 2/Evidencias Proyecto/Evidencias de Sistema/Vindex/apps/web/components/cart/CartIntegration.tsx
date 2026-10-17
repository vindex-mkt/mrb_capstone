"use client";

import { useCartSync } from "@/hooks/useCartSync";
import CartDrawer from "@/components/cart/CartDrawer";

export default function CartIntegration() {
  useCartSync();
  return <CartDrawer />;
}
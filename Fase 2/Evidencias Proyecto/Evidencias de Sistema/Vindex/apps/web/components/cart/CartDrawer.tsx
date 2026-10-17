"use client";

import Link from "next/link";
import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { formatProductPrice } from "@/lib/formatters";
import { useCartStore } from "@/lib/store/useCartStore";

export default function CartDrawer() {
  const isOpen = useCartStore((state) => state.isOpen);
  const items = useCartStore((state) => state.items);
  const hasHydrated = useCartStore((state) => state.hasHydrated);
  const setIsOpen = useCartStore((state) => state.setIsOpen);
  const removeItem = useCartStore((state) => state.removeItem);
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const clearCart = useCartStore((state) => state.clearCart);
  const total = useCartStore((state) => state.getTotal());

  return (
    <Sheet open={hasHydrated && isOpen} onOpenChange={setIsOpen}>
      <SheetContent side="right" className="dark w-full border-neutral-800 bg-neutral-950 p-0 text-neutral-100 sm:max-w-md">
        <SheetHeader className="border-b border-neutral-800 px-5 py-5">
          <SheetTitle className="text-lg text-neutral-100">Tu carrito</SheetTitle>
          <p className="text-sm text-neutral-400">
            {items.length} {items.length === 1 ? "producto" : "productos"}
          </p>
        </SheetHeader>

        {!hasHydrated ? null : items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
            <ShoppingBag className="mb-4 size-10 text-neutral-500" aria-hidden="true" />
            <h2 className="text-base font-semibold text-neutral-100">Tu carrito está vacío</h2>
            <p className="mt-2 text-sm text-neutral-400">Encuentra algo especial en la tienda.</p>
            <Button
              nativeButton={false}
              render={<Link href="/tienda" onClick={() => setIsOpen(false)} />}
              className="mt-6 bg-brand-600 text-white hover:bg-brand-700"
            >
              Ir a la tienda
            </Button>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-5">
              <ul className="divide-y divide-neutral-800">
                {items.map((item) => (
                  <li key={item.id} className="flex gap-4 py-5">
                    <img
                      src={item.image}
                      alt={item.name}
                      className="size-20 shrink-0 rounded-md object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <h2 className="line-clamp-2 text-sm font-semibold text-neutral-100">{item.name}</h2>
                        <button
                          type="button"
                          aria-label={`Eliminar ${item.name}`}
                          onClick={() => removeItem(item.id)}
                          className="-mr-2 -mt-1 rounded p-2 text-neutral-400 transition hover:bg-neutral-800 hover:text-red-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                      <p className="mt-1 text-sm font-semibold text-neutral-100">{formatProductPrice(item.price)}</p>
                      <div className="mt-3 flex items-center justify-between gap-3">
                        <div className="flex h-8 items-center rounded-md border border-neutral-700">
                          <button
                            type="button"
                            aria-label={`Disminuir cantidad de ${item.name}`}
                            onClick={() => updateQuantity(item.id, item.quantity - 1)}
                            className="grid size-8 place-items-center rounded-l-md text-neutral-300 transition hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                          >
                            <Minus className="size-3.5" />
                          </button>
                          <span className="min-w-8 text-center text-sm tabular-nums text-neutral-100">{item.quantity}</span>
                          <button
                            type="button"
                            aria-label={`Aumentar cantidad de ${item.name}`}
                            disabled={item.quantity >= item.stock}
                            onClick={() => updateQuantity(item.id, item.quantity + 1)}
                            className="grid size-8 place-items-center rounded-r-md text-neutral-300 transition hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <Plus className="size-3.5" />
                          </button>
                        </div>
                        <span className="text-xs text-neutral-400">Stock: {item.stock}</span>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <SheetFooter className="border-t border-neutral-800 px-5 py-5 sm:flex-col">
              <div className="flex items-center justify-between text-base">
                <span className="text-neutral-300">Total</span>
                <span className="font-bold text-neutral-100">{formatProductPrice(total)}</span>
              </div>
              <Button
                nativeButton={false}
                render={<Link href="/cart" onClick={() => setIsOpen(false)} />}
                variant="outline"
                className="mt-2 w-full border-neutral-700 text-neutral-100 hover:bg-neutral-800"
              >
                Ver carrito
              </Button>
              <Button
                nativeButton={false}
                render={<Link href="/checkout" onClick={() => setIsOpen(false)} />}
                className="mt-2 w-full bg-brand-600 text-white hover:bg-brand-700"
              >
                Continuar al Pago
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100"
                onClick={clearCart}
              >
                Vaciar carrito
              </Button>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
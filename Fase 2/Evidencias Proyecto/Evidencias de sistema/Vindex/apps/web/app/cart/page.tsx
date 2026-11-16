"use client";

import Link from "next/link";
import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { formatProductPrice } from "@/lib/formatters";
import { useCartStore } from "@/lib/store/useCartStore";

export default function CartPage() {
	const items = useCartStore((state) => state.items);
	const hasHydrated = useCartStore((state) => state.hasHydrated);
	const total = useCartStore((state) => state.getTotal());
	const removeItem = useCartStore((state) => state.removeItem);
	const updateQuantity = useCartStore((state) => state.updateQuantity);

	return (
		<main className="min-h-[60vh] bg-background">
			<section className="container-site py-8 sm:py-12">
				<div className="section-head">
					<div>
						<p className="eyebrow">Vindex</p>
						<h1 className="section-title mt-1">Tu carrito</h1>
						<p className="mt-2 text-sm text-muted-foreground">
							{!hasHydrated
								? "Cargando carrito..."
								: `${items.reduce((count, item) => count + item.quantity, 0)} productos`}
						</p>
					</div>
					{hasHydrated && items.length > 0 && (
						<Link href="/tienda" className="link-more">Seguir comprando</Link>
					)}
				</div>

				{!hasHydrated ? (
					<p role="status" className="py-16 text-center text-sm text-muted-foreground">Cargando carrito...</p>
				) : items.length === 0 ? (
					<div className="flex flex-col items-center rounded-xl border border-border bg-surface px-6 py-16 text-center">
						<ShoppingBag className="size-10 text-muted-foreground" aria-hidden="true" />
						<h2 className="mt-4 text-lg font-semibold text-foreground">Tu carrito está vacío</h2>
						<p className="mt-2 text-sm text-muted-foreground">Explora la tienda y encuentra algo especial.</p>
						<Link href="/tienda" className="btn btn-primary mt-6 min-h-10 px-5">Ir a la tienda</Link>
					</div>
				) : (
					<div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
						<section aria-label="Productos en el carrito" className="rounded-xl border border-border bg-surface px-4 sm:px-6">
							<ul className="divide-y divide-border">
								{items.map((item) => (
									<li key={item.id} className="flex gap-4 py-5 sm:gap-6">
										<img src={item.image} alt={item.name} className="size-20 shrink-0 rounded-lg object-cover sm:size-24" />
										<div className="min-w-0 flex-1">
											<div className="flex items-start justify-between gap-3">
												<h2 className="line-clamp-2 text-sm font-semibold text-foreground sm:text-base">{item.name}</h2>
												<button
													type="button"
													aria-label={`Eliminar ${item.name}`}
													onClick={() => removeItem(item.id)}
													className="rounded-md p-2 text-muted-foreground transition hover:bg-muted hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
												>
													<Trash2 className="size-4" />
												</button>
											</div>
											<p className="mt-1 text-sm font-bold text-foreground">{formatProductPrice(item.price)}</p>
											<div className="mt-3 flex flex-wrap items-center justify-between gap-3">
												<div className="flex h-9 items-center rounded-md border border-border">
													<button
														type="button"
														aria-label={`Disminuir cantidad de ${item.name}`}
														onClick={() => updateQuantity(item.id, item.quantity - 1)}
														className="grid size-9 place-items-center rounded-l-md text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
													>
														<Minus className="size-4" />
													</button>
													<span className="min-w-9 text-center text-sm tabular-nums text-foreground">{item.quantity}</span>
													<button
														type="button"
														aria-label={`Aumentar cantidad de ${item.name}`}
														disabled={item.quantity >= item.stock}
														onClick={() => updateQuantity(item.id, item.quantity + 1)}
														className="grid size-9 place-items-center rounded-r-md text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 disabled:cursor-not-allowed disabled:opacity-40"
													>
														<Plus className="size-4" />
													</button>
												</div>
												<span className="text-xs text-muted-foreground">Stock: {item.stock}</span>
												<span className="ml-auto text-sm font-semibold text-foreground">{formatProductPrice(item.price * item.quantity)}</span>
											</div>
										</div>
									</li>
								))}
							</ul>
						</section>

						<aside className="rounded-xl border border-border bg-surface p-5 lg:sticky lg:top-28">
							<h2 className="text-base font-semibold text-foreground">Resumen del pedido</h2>
							<div className="mt-5 flex items-center justify-between border-t border-border pt-4">
								<span className="text-sm text-muted-foreground">Total</span>
								<span className="text-lg font-extrabold text-foreground">{formatProductPrice(total)}</span>
							</div>
							<Link href="/checkout" className="btn btn-primary mt-5 min-h-11 w-full">Continuar al pago</Link>
						</aside>
					</div>
				)}
			</section>
		</main>
	);
}

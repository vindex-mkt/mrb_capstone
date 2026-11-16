import Link from "next/link";
import { IconChevronRight, IconStore } from "@/components/icons";
import RatingStars from "@/components/RatingStars";
import { getAllStores } from "@/lib/supabase/queries";

export default async function StoresPage() {
	const stores = await getAllStores();

	return (
		<main className="min-h-screen bg-background py-10 sm:py-14">
			<div className="container-site">
				<div className="section-head">
					<div>
						<p className="eyebrow">Descubre vendedores</p>
						<h1 className="section-title mt-1">Tiendas de la comunidad</h1>
					</div>
				</div>

				{stores.length > 0 ? (
					<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
						{stores.map((store) => (
							<Link
								key={store.id}
								href={`/tiendas/${encodeURIComponent(store.slug)}`}
								className="group flex items-center gap-4 rounded-2xl border border-border bg-surface p-5 transition hover:border-brand-300 hover:shadow-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
							>
								{store.logo_url ? (
									<img
										src={store.logo_url}
										alt={`Logo de ${store.name}`}
										className="h-14 w-14 shrink-0 rounded-2xl border border-border object-cover"
									/>
								) : (
									<span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
										<IconStore aria-hidden="true" className="h-6 w-6" />
									</span>
								)}

								<div className="min-w-0 flex-1">
									<h2 className="truncate font-bold text-foreground group-hover:text-brand-700">
										{store.name}
									</h2>
									{store.total_reviews > 0 ? (
										<p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
											<RatingStars rating={Number(store.average_rating ?? 0)} />
											<span>
												{Number(store.average_rating ?? 0).toFixed(1)} ·{" "}
												{store.total_reviews} reseñas
											</span>
										</p>
									) : (
										<p className="mt-1 text-xs text-muted-foreground">
											Tienda nueva
										</p>
									)}
								</div>

								<IconChevronRight
									aria-hidden="true"
									className="h-5 w-5 shrink-0 text-muted-foreground group-hover:text-brand-700"
								/>
							</Link>
						))}
					</div>
				) : (
					<p className="rounded-xl border border-dashed border-border bg-surface p-6 text-center text-sm text-muted-foreground">
						Aún no hay tiendas públicas para mostrar.
					</p>
				)}
			</div>
		</main>
	);
}

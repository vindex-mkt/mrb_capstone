import Link from "next/link";
import { IconChevronRight, IconStore } from "@/components/icons";
import RatingStars from "@/components/RatingStars";
import { getPopularStores } from "@/lib/supabase/queries";

export default async function PopularStores() {
  const stores = await getPopularStores();

  return (
    <section className="border-y border-border bg-brand-50/70 py-12">
      <div className="container-site">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
          <div>
            <p className="eyebrow">Descubre vendedores</p>
            <h2 className="section-title mt-1">Tiendas populares</h2>
          </div>

          {stores.length > 0 && <p className="text-sm text-muted-foreground">Tiendas de la comunidad</p>}
        </div>

        {stores.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {stores.map((store) => (
            <Link
              key={store.name}
              href={`/tiendas/${encodeURIComponent(store.slug)}`}
              className="group flex cursor-pointer items-center gap-4 rounded-2xl border border-border bg-surface p-5 transition duration-300 hover:-translate-y-1 hover:border-brand-300 hover:shadow-card-hover"
            >
              {store.logo_url
                ? <img src={store.logo_url} alt="" className="h-14 w-14 shrink-0 rounded-2xl border border-border object-cover" />
                : <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-sm transition group-hover:scale-105"><IconStore className="h-6 w-6" /></span>}

              <div className="min-w-0 flex-1">
                <h3 className="truncate font-bold text-foreground transition group-hover:text-brand-700">
                  {store.name}
                </h3>
                {store.total_reviews > 0
                  ? <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><RatingStars rating={Number(store.average_rating ?? 0)} /><span>{Number(store.average_rating ?? 0).toFixed(1)} · {store.total_reviews} reseñas</span></p>
                  : <p className="mt-1 text-xs text-muted-foreground">Tienda nueva</p>}
              </div>

              <IconChevronRight className="h-5 w-5 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-brand-700" />
            </Link>
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-border bg-surface p-6 text-center text-sm text-muted-foreground">Aún no hay tiendas públicas.</p>
        )}
      </div>
    </section>
  );
}
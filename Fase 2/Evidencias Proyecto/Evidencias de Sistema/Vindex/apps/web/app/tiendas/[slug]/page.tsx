"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import RatingStars from "@/components/RatingStars";
import { createClient } from "@/lib/supabase/client";
import { formatProductPrice } from "@/lib/formatters";
import { getActiveDiscountPrice, getDiscountLabel, getProductImage, type ProductListing } from "@/lib/product-utils";

type Store = { id: number; name: string; slug: string; description: string | null; logo_url: string | null; banner_url: string | null };
type StoreCategory = { id: number; name: string };
type StoreRating = { average_rating: number | null; total_reviews: number | null };

export default function PublicStorePage() {
  const params = useParams<{ slug: string }>();
  const [supabase] = useState(createClient);
  const [store, setStore] = useState<Store | null>(null);
  const [rating, setRating] = useState<StoreRating | null>(null);
  const [categories, setCategories] = useState<StoreCategory[]>([]);
  const [products, setProducts] = useState<ProductListing[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    const load = async () => {
      try {
        const { data: storeRow, error: storeError } = await supabase.from("stores")
          .select("id, name, slug, description, logo_url, banner_url")
          .eq("slug", params.slug)
          .maybeSingle();
        if (storeError) throw storeError;
        if (!storeRow) {
          if (current) setErrorMessage("No encontramos esta tienda.");
          return;
        }

        const [{ data: ratingRow, error: ratingError }, { data: categoryRows, error: categoryError }, { data: productRows, error: productError }] = await Promise.all([
          supabase.from("store_ratings").select("average_rating, total_reviews").eq("store_id", storeRow.id).maybeSingle(),
          supabase.from("store_categories").select("id, name").eq("store_id", storeRow.id).order("name", { ascending: true }),
          supabase.from("products").select("*").eq("store_id", storeRow.id).eq("status", true).gt("stock", 0).order("created_at", { ascending: false }),
        ]);
        if (ratingError) throw ratingError;
        if (categoryError) throw categoryError;
        if (productError) throw productError;
        if (!current) return;
        setStore(storeRow as Store);
        setRating(ratingRow as StoreRating | null);
        setCategories((categoryRows ?? []) as StoreCategory[]);
        setProducts((productRows ?? []) as ProductListing[]);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Error desconocido";
        if (current) setErrorMessage(`No se pudo cargar la tienda: ${message}`);
      } finally {
        if (current) setLoading(false);
      }
    };

    void load();
    return () => {
      current = false;
    };
  }, [params.slug, supabase]);

  if (loading) return <main className="container-site py-12"><p role="status" className="text-sm text-muted-foreground">Cargando tienda...</p></main>;
  if (errorMessage || !store) return <main className="container-site py-12"><p role="alert" className="text-sm text-destructive">{errorMessage ?? "No encontramos esta tienda."}</p><Link href="/tienda" className="link-more mt-4">Volver a explorar</Link></main>;

  const filteredProducts = selectedCategory === null
    ? products
    : products.filter((product) => product.store_category_id === selectedCategory);

  return (
    <main className="min-h-screen bg-background">
      <section className="container-site py-8 sm:py-10">
        <div className="relative mb-8 overflow-hidden rounded-2xl border border-border bg-muted">
          {store.banner_url ? <img src={store.banner_url} alt="" className="h-44 w-full object-cover sm:h-64" /> : <div className="h-44 bg-gradient-to-r from-brand-100 to-brand-200 sm:h-64" />}
          <div className="absolute inset-x-0 bottom-0 flex items-end gap-4 bg-gradient-to-t from-black/70 to-transparent p-5 sm:p-7">
            {store.logo_url && <img src={store.logo_url} alt="" className="size-20 rounded-xl border-2 border-white bg-white object-cover shadow sm:size-24" />}
            <div className="min-w-0 text-white">
              <h1 className="text-2xl font-bold sm:text-4xl">{store.name}</h1>
              {rating && Number(rating.total_reviews) > 0 ? (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <RatingStars rating={Number(rating.average_rating ?? 0)} />
                  <span className="text-sm font-medium">{Number(rating.average_rating ?? 0).toFixed(1)} · {Number(rating.total_reviews)} reseñas</span>
                </div>
              ) : <p className="mt-1 text-sm text-white/90">Tienda nueva · Sin calificaciones</p>}
            </div>
          </div>
        </div>

        {store.description && <p className="mb-8 max-w-3xl whitespace-pre-line text-muted-foreground">{store.description}</p>}

        <div className="mb-6 space-y-4">
          <h2 className="text-xl font-semibold text-foreground">Productos y subastas</h2>
          {categories.length > 0 && (
            <div className="flex flex-wrap gap-2" aria-label="Filtrar por categoría">
              <button type="button" aria-pressed={selectedCategory === null} onClick={() => setSelectedCategory(null)} className={`rounded-full border px-4 py-2 text-sm ${selectedCategory === null ? "border-brand-600 bg-brand-50 text-brand-700" : "border-border bg-surface text-foreground hover:border-brand-300"}`}>Todas</button>
              {categories.map((category) => (
                <button key={category.id} type="button" aria-pressed={selectedCategory === category.id} onClick={() => setSelectedCategory(category.id)} className={`rounded-full border px-4 py-2 text-sm ${selectedCategory === category.id ? "border-brand-600 bg-brand-50 text-brand-700" : "border-border bg-surface text-foreground hover:border-brand-300"}`}>{category.name}</button>
              ))}
            </div>
          )}
        </div>

        {filteredProducts.length === 0 ? (
          <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">No hay publicaciones en esta categoría.</CardContent></Card>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
            {filteredProducts.map((product) => {
              const currentPrice = getActiveDiscountPrice(product)
                ?? (product.sale_type === "auction" ? product.current_bid ?? product.starting_price : product.price)
                ?? null;
              const isAuction = product.sale_type === "auction";
              return (
                <li key={product.id}>
                  <Link
                    href={isAuction ? `/subastas/${product.id}` : `/product/${product.id}`}
                    className="group flex items-center gap-3 p-3 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500 sm:gap-4 sm:p-4"
                  >
                    <img
                      src={getProductImage(product)}
                      alt=""
                      loading="lazy"
                      className="size-16 shrink-0 rounded-lg border border-border bg-muted object-cover sm:size-20"
                    />
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate font-semibold text-foreground group-hover:text-brand-700">
                        {product.name ?? "Producto sin nombre"}
                      </h3>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {isAuction ? "Subasta" : "Producto"}
                        {isAuction && product.current_bid !== null && product.current_bid !== undefined
                          ? " · Puja actual"
                          : ""}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      {getDiscountLabel(product) && <p className="text-xs font-semibold text-accent-600">{getDiscountLabel(product)}</p>}
                      <p className="text-sm font-bold text-foreground sm:text-base">{formatProductPrice(currentPrice)}</p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Heart, Trash2 } from "lucide-react";
import ProductCard from "@/components/ProductCard";
import { useToast } from "@/components/ToastProvider";
import { useFavorites } from "@/hooks/useFavorites";
import { createClient } from "@/lib/supabase/client";
import { formatProductPrice } from "@/lib/formatters";
import { getProductImage } from "@/lib/product-utils";

type FavoriteProduct = {
  id: number;
  name: string | null;
  price: number | null;
  sale_type: string | null;
  images: string[] | null;
  status: boolean | string | null;
  current_bid?: number | null;
  starting_price?: number | null;
  discount_price?: number | null;
  offer_ends_at?: string | null;
};

type FavoriteRecord = {
  id: string | number;
  product_id: number | null;
  products: FavoriteProduct | FavoriteProduct[] | null;
};

function UnavailableFavorite({
  product,
  onRemove,
}: {
  product: FavoriteProduct | null;
  onRemove: () => void;
}) {
  const image = product ? getProductImage(product) : "/logo.png";
  const name = product?.name ?? "Producto eliminado";

  return (
    <article className="card flex h-full flex-col bg-muted/40">
      <div className="relative aspect-square overflow-hidden bg-muted">
        <img src={image} alt={name} loading="lazy" className="h-full w-full object-cover grayscale opacity-60" />
        <span className="badge badge-overlay absolute left-3 top-3">{product ? "Producto no disponible" : "Eliminado"}</span>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h2 className="line-clamp-2 min-h-[2.6rem] text-sm font-semibold text-muted-foreground">{name}</h2>
        <p className="mt-2 text-sm text-muted-foreground">Este producto ya no está disponible.</p>
        <button type="button" onClick={onRemove} className="btn btn-outline mt-auto min-h-10 w-full px-3">
          <Trash2 className="size-4" aria-hidden="true" />
          Quitar de favoritos
        </button>
      </div>
    </article>
  );
}

export default function FavoritesPage() {
  const [supabase] = useState(createClient);
  const { userId, favoriteCount, isLoading: isAuthLoading, removeFavorite, removeFavoriteRecord } = useFavorites();
  const { showToast } = useToast();
  const [favorites, setFavorites] = useState<FavoriteRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthLoading) return;
    if (!userId) {
      setFavorites([]);
      setIsLoading(false);
      return;
    }

    let isCurrent = true;
    const loadFavorites = async () => {
      setIsLoading(true);
      setLoadError(null);
      const { data, error } = await supabase
        .from("favorites")
        .select("id, product_id, products(*)")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (!isCurrent) return;
      if (error) {
        console.error("No se pudo cargar la página de favoritos:", error);
        setLoadError("No fue posible cargar tus favoritos. Inténtalo nuevamente.");
        showToast("No se pudo cargar tu lista de favoritos.", "error");
      } else {
        setFavorites((data ?? []) as unknown as FavoriteRecord[]);
      }
      setIsLoading(false);
    };

    void loadFavorites();
    return () => {
      isCurrent = false;
    };
  }, [favoriteCount, isAuthLoading, showToast, supabase, userId]);

  const removeRecord = async (favorite: FavoriteRecord) => {
    if (favorite.product_id !== null) {
      await removeFavorite(favorite.product_id);
    } else {
      await removeFavoriteRecord(favorite.id);
    }
  };

  return (
    <main className="min-h-screen bg-background">
      <section className="container-site py-8 sm:py-10">
        <div className="mb-8 border-b border-border pb-6">
          <p className="eyebrow">Tu colección</p>
          <h1 className="section-title mt-1 flex items-center gap-2">
            <Heart className="size-6 fill-accent-600 text-accent-600" aria-hidden="true" />
            Favoritos
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">{favoriteCount} productos guardados</p>
        </div>

        {isAuthLoading || isLoading ? (
          <p role="status" className="py-12 text-center text-sm text-muted-foreground">Cargando tus favoritos...</p>
        ) : !userId ? (
          <div className="py-14 text-center">
            <p className="text-lg font-semibold text-foreground">Inicia sesión para ver tus favoritos</p>
            <Link href="/login" className="btn btn-primary mt-4 min-h-10 px-5">Ingresar</Link>
          </div>
        ) : loadError ? (
          <p role="alert" className="py-12 text-center text-sm text-red-700">{loadError}</p>
        ) : favorites.length === 0 ? (
          <div className="py-14 text-center">
            <p className="text-lg font-semibold text-foreground">Aún no tienes favoritos</p>
            <p className="mt-2 text-sm text-muted-foreground">Guarda productos con el corazón para encontrarlos aquí.</p>
            <Link href="/shop" className="btn btn-primary mt-4 min-h-10 px-5">Explorar productos</Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
            {favorites.map((favorite) => {
              const relation = Array.isArray(favorite.products) ? favorite.products[0] ?? null : favorite.products;
              const product = relation as FavoriteProduct | null;
              const status = product?.status;
              const unavailable = !product || status === false ||
                (typeof status === "string" && ["deleted", "inactive"].includes(status.toLowerCase()));

              if (unavailable) {
                return (
                  <UnavailableFavorite
                    key={String(favorite.id)}
                    product={product}
                    onRemove={() => void removeRecord(favorite)}
                  />
                );
              }

              const activeDiscount = product.discount_price !== null && product.discount_price !== undefined &&
                product.offer_ends_at && new Date(product.offer_ends_at).getTime() > Date.now()
                  ? product.discount_price
                  : null;
              const price = product.sale_type === "auction"
                ? product.current_bid ?? product.starting_price ?? product.price
                : activeDiscount ?? product.price;

              return (
                <div key={String(favorite.id)} className="relative">
                  <ProductCard
                    id={product.id}
                    name={product.name ?? "Producto sin nombre"}
                    price={formatProductPrice(price)}
                    image={getProductImage(product)}
                    saleType={product.sale_type}
                    currentBid={product.current_bid}
                  />
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
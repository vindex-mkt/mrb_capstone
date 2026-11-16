"use client";

import { useRouter } from "next/navigation";
import FavoriteButton from "@/components/FavoriteButton";

interface ProductCardProps {
  id: number;
  name: string;
  price: string;
  image: string;
  /** Precio anterior (se muestra tachado) */
  previousPrice?: string;
  /** Etiqueta de descuento, p. ej. "-31%" */
  discount?: string;
  saleType?: string | null;
  currentBid?: number | null;
  /** Vendedor / tienda */
  seller?: string;
}

/**
 * Tarjeta de producto reutilizable del sistema de diseño.
 * Ver reglas en apps/web/DESIGN_SYSTEM.md → Componentes → card.
 */
export default function ProductCard({
  id,
  name,
  price,
  image,
  previousPrice,
  discount,
  saleType,
  currentBid,
  seller,
}: ProductCardProps) {
  const router = useRouter();
  const isAuction = saleType === "auction";

  const openProduct = () => {
    router.push(isAuction ? `/subastas/${id}` : `/product/${id}`);
  };

  return (
    <article
      role="button"
      tabIndex={0}
      aria-label={`Ver detalles de ${name}`}
      onClick={openProduct}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openProduct();
        }
      }}
      className="card group flex h-full cursor-pointer flex-col transition duration-300 hover:-translate-y-1 hover:border-brand-200 hover:shadow-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
    >
      {/* Imagen */}
      <div className="relative aspect-square overflow-hidden bg-muted">
        <img
          src={image}
          alt={name}
          loading="lazy"
          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
        />

        {discount && (
          <span className="badge badge-accent absolute left-3 top-3">{discount}</span>
        )}

        <FavoriteButton productId={id} productName={name} />

        {/* CTA al pasar el cursor */}
        <div className="pointer-events-none absolute inset-x-3 bottom-3 translate-y-2 opacity-0 transition duration-300 group-hover:translate-y-0 group-hover:opacity-100">
          <span className="btn btn-primary h-9 w-full rounded-full bg-foreground! hover:bg-brand-700!">
            Ver producto
          </span>
        </div>
      </div>

      {/* Información */}
      <div className="flex flex-1 flex-col p-4">
        <h3 className="line-clamp-2 min-h-[2.6rem] text-sm font-semibold leading-snug text-foreground transition group-hover:text-brand-700">
          {name}
        </h3>

        {isAuction && <span className="badge badge-soft mt-2 w-fit">Subasta</span>}

        {seller && (
          <p className="mt-1.5 truncate text-xs text-muted-foreground">
            por {seller}
          </p>
        )}

        <div className="mt-auto flex flex-wrap items-baseline gap-x-2 pt-3">
          {isAuction && (
            <span className="basis-full text-xs text-muted-foreground">
              {currentBid !== null && currentBid !== undefined ? "Última puja" : "Precio inicial"}
            </span>
          )}
          <span className="text-lg font-extrabold tracking-tight text-foreground">
            {price}
          </span>
          {previousPrice && (
            <span className="text-xs font-medium text-muted-foreground line-through">
              {previousPrice}
            </span>
          )}
        </div>
      </div>
    </article>
  );
}

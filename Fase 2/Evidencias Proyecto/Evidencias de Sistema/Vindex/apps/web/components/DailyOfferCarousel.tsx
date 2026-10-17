"use client";

import { useEffect, useState } from "react";
import { IconArrowRight, IconBolt, IconChevronRight, IconTag } from "@/components/icons";
import OfferCountdown from "@/components/OfferCountdown";
import { formatProductPrice } from "@/lib/formatters";
import { getDiscountLabel, getProductImage, type ProductListing } from "@/lib/product-utils";

export default function DailyOfferCarousel({ deals }: { deals: ProductListing[] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const product = deals[activeIndex];

  useEffect(() => {
    if (deals.length < 2) return;

    const interval = window.setInterval(() => {
      setActiveIndex((index) => (index + 1) % deals.length);
    }, 5000);

    return () => window.clearInterval(interval);
  }, [deals.length]);

  if (!product) return null;

  const showPrevious = () => {
    setActiveIndex((index) => (index - 1 + deals.length) % deals.length);
  };

  const showNext = () => {
    setActiveIndex((index) => (index + 1) % deals.length);
  };

  return (
    <section
      aria-label="Ofertas del día"
      aria-roledescription="carrusel"
      className="flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-card"
    >
      <div className="flex items-center justify-between gap-3 p-5 pb-4">
        <div>
          <p className="eyebrow text-accent-600">Oferta especial</p>
          <h2 className="mt-1 text-xl font-extrabold tracking-tight text-foreground sm:text-2xl">
            Oferta del día
          </h2>
        </div>
        <span className="badge badge-accent shrink-0">
          <IconTag className="h-3 w-3" />
          {getDiscountLabel(product)}
        </span>
      </div>

      <div
        aria-label={`Oferta ${activeIndex + 1} de ${deals.length}`}
        aria-roledescription="diapositiva"
        className="relative mx-5 overflow-hidden rounded-xl bg-muted"
        role="group"
      >
        <img
          src={product.images?.[0] ?? getProductImage(product)}
          alt={product.name ?? "Producto en oferta"}
          loading="lazy"
          className="aspect-4/3 w-full object-cover sm:aspect-square"
        />

        <div className="absolute inset-x-3 bottom-3 flex items-center justify-between gap-3 rounded-xl bg-black/60 px-3.5 py-2.5 text-white backdrop-blur">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-white/70">
              Termina en
            </p>
            <p className="font-mono text-base font-bold tracking-wider">
              <OfferCountdown endsAt={product.offer_ends_at!} />
            </p>
          </div>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-600">
            <IconBolt className="h-4 w-4" />
          </span>
        </div>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-lg font-bold text-foreground">
          {product.name ?? "Producto en oferta"}
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">Oferta por tiempo limitado</p>

        <div className="mt-3 flex items-baseline gap-2.5">
          <span className="text-3xl font-extrabold tracking-tight text-foreground">
            {formatProductPrice(product.discount_price)}
          </span>
          <span className="text-sm font-medium text-muted-foreground line-through">
            {formatProductPrice(product.price)}
          </span>
        </div>

        <a href="/shop" className="btn btn-primary mt-4 w-full py-3">
          Ver oferta
          <IconArrowRight className="h-4 w-4" />
        </a>

        {deals.length > 1 && (
          <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
            <span className="text-sm font-medium text-muted-foreground">
              {activeIndex + 1} / {deals.length}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                aria-label="Oferta anterior"
                onClick={showPrevious}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-foreground transition-colors hover:bg-muted"
              >
                <IconChevronRight className="h-4 w-4 rotate-180" />
              </button>
              <button
                type="button"
                aria-label="Siguiente oferta"
                onClick={showNext}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-foreground transition-colors hover:bg-muted"
              >
                <IconChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
import ProductCard from "@/components/ProductCard";
import {
  formatProductPrice,
  getDailyDeals,
  getDiscountLabel,
  getProductImage,
} from "@/lib/supabase/queries";

export default async function OffersPage() {
  const offers = await getDailyDeals();

  return (
    <main className="min-h-screen bg-background">
      <section className="container-site py-8 sm:py-10">
        <header className="section-head">
          <p className="eyebrow text-accent-600">Ahorra en tus compras</p>
          <h1 className="section-title mt-1">Ofertas activas</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {offers.length === 1
              ? "1 producto con descuento disponible"
              : `${offers.length} productos con descuento disponibles`}
          </p>
        </header>

        {offers.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
            {offers.map((product) => (
              <ProductCard
                key={product.id}
                id={product.id}
                name={product.name ?? "Producto sin nombre"}
                price={formatProductPrice(product.discount_price)}
                image={getProductImage(product)}
                previousPrice={formatProductPrice(product.price)}
                discount={getDiscountLabel(product)}
                saleType={product.sale_type}
                currentBid={product.current_bid}
              />
            ))}
          </div>
        ) : (
          <p className="py-12 text-center text-sm text-muted-foreground">
            No hay ofertas disponibles en este momento.
          </p>
        )}
      </section>
    </main>
  );
}

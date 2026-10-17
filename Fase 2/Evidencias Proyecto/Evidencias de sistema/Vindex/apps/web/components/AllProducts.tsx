import ProductCard from "@/components/ProductCard";
import { formatProductPrice, getActiveDiscountPrice, getAllPublishedProducts, getDiscountLabel, getProductImage } from "@/lib/supabase/queries";

export default async function AllProducts() {
	const products = await getAllPublishedProducts();

  return (
    <section className="py-12">
      <div className="container-site">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
          <div>
            <p className="eyebrow">Explora</p>
            <h2 className="section-title mt-1">Todas las publicaciones</h2>
            <p className="mt-2 text-sm text-muted-foreground">{products.length} productos disponibles para ti</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
          {products.map((product) => (
            <ProductCard
              key={product.id}
              id={product.id}
              name={product.name ?? "Producto sin nombre"}
              price={formatProductPrice(product.sale_type === "auction"
                ? product.current_bid ?? product.starting_price ?? null
                : getActiveDiscountPrice(product) ?? product.price)}
              image={getProductImage(product)}
              previousPrice={getActiveDiscountPrice(product) !== null ? formatProductPrice(product.price) : undefined}
              discount={getDiscountLabel(product)}
              saleType={product.sale_type}
              currentBid={product.current_bid}
            />
          ))}
        </div>
        {products.length === 0 && <p className="text-sm text-muted-foreground">Aún no hay productos publicados.</p>}
      </div>
    </section>
  );
}
import ProductCard from "@/components/ProductCard";
import { IconChevronRight } from "@/components/icons";
import { formatProductPrice, getActiveDiscountPrice, getDiscountLabel, getLatestProducts, getProductImage } from "@/lib/supabase/queries";

export default async function LatestProducts() {
	const products = await getLatestProducts();

  return (
    <section className="flex h-full flex-col">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <p className="eyebrow">Recién publicado</p>
          <h2 className="section-title mt-1 text-xl sm:text-2xl">
            Últimas publicaciones
          </h2>
        </div>

        <a href="#" className="link-more shrink-0">
          Ver todos
          <IconChevronRight className="h-4 w-4" />
        </a>
      </div>

      <div className="grid flex-1 grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
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
        {products.length === 0 && <p className="text-sm text-muted-foreground">Aún no hay publicaciones disponibles.</p>}
    </section>
  );
}
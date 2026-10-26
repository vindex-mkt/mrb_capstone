import ProductCard from "@/components/ProductCard";
import { IconChevronRight } from "@/components/icons";
import { formatProductPrice, getActiveDiscountPrice, getDiscountLabel, getFeaturedProducts, getProductImage } from "@/lib/supabase/queries";

export default async function FeaturedProducts() {
	const products = await getFeaturedProducts();

  return (
    <section className="relative overflow-hidden bg-linear-to-br from-brand-700 via-brand-600 to-brand-500">
      {/* Decoración difuminada */}
      <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-white/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 left-1/3 h-80 w-80 rounded-full bg-brand-300/20 blur-3xl" />

      <div className="container-site relative py-10 sm:py-14">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
          <div>
            <p className="eyebrow text-brand-200">Descubre</p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
              Productos destacados
            </h2>
            <p className="mt-2 max-w-xl text-sm text-brand-100">
              Lo mejor de la semana, seleccionado por nuestra comunidad de
              compradores y vendedores.
            </p>
          </div>

          <a href="#" className="link-more text-white hover:text-brand-100">
            Ver todos
            <IconChevronRight className="h-4 w-4" />
          </a>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 xl:grid-cols-6">
          {products.map((product) => (
            <ProductCard
              key={product.id}
              id={product.id}
              name={product.name ?? "Producto sin nombre"}
              price={formatProductPrice(getActiveDiscountPrice(product) ?? product.price)}
              image={getProductImage(product)}
              previousPrice={getActiveDiscountPrice(product) !== null ? formatProductPrice(product.price) : undefined}
              discount={getDiscountLabel(product)}
            />
          ))}
        </div>
        {products.length === 0 && <p className="text-sm text-white/80">Aún no hay productos destacados.</p>}
      </div>
    </section>
  );
}
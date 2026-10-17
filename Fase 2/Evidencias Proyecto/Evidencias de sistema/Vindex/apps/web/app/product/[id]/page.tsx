import Link from "next/link";
import { notFound } from "next/navigation";
import ProductGallery from "@/components/ProductGallery";
import ProductPurchaseButton from "@/components/cart/ProductPurchaseButton";
import FavoriteButton from "@/components/FavoriteButton";
import ProductReviews from "@/components/reviews/ProductReviews";
import MessageSellerButton from "@/components/messaging/MessageSellerButton";
import { IconArrowRight, IconShieldCheck, IconStar, IconTruck } from "@/components/icons";
import { formatProductPrice, getActiveDiscountPrice, getProductById, getProductImage, getProductStoreName } from "@/lib/supabase/queries";

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const productId = Number(id);

  if (!Number.isFinite(productId)) {
    notFound();
  }

  const product = await getProductById(productId);

  if (!product) {
    notFound();
  }

  const storeName = await getProductStoreName(product);
  const activePrice = getActiveDiscountPrice(product) ?? product.price;
  const originalPrice = product.price ?? activePrice;
  const galleryImages = product.images && product.images.length > 0 ? product.images : [getProductImage(product)];

  return (
    <main className="min-h-screen bg-background">
      <section className="container-site py-8 sm:py-10">
        <div className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/" className="hover:text-foreground">Inicio</Link>
          <span>/</span>
          <Link href="/shop" className="hover:text-foreground">Tienda</Link>
          <span>/</span>
          <span className="text-foreground">{product.name ?? "Producto"}</span>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,520px)_minmax(0,1fr)] lg:items-start">
          <div className="lg:sticky lg:top-24">
            <ProductGallery images={galleryImages} alt={product.name ?? "Producto"} />
          </div>

          <div className="lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto lg:pr-2">
            <div className="space-y-6">
              <div>
                <p className="eyebrow">Producto</p>
                <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
                  {product.name ?? "Producto sin nombre"}
                </h1>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <span className="text-3xl font-extrabold tracking-tight text-foreground">
                  {formatProductPrice(activePrice)}
                </span>
                {activePrice !== null && originalPrice !== null && activePrice !== originalPrice && (
                  <span className="text-lg font-medium text-muted-foreground line-through">
                    {formatProductPrice(product.price)}
                  </span>
                )}
                {product.discount_price && product.offer_ends_at && new Date(product.offer_ends_at).getTime() > Date.now() && (
                  <span className="badge badge-accent">Oferta activa</span>
                )}
              </div>

              <div className="flex flex-wrap gap-3">
                <ProductPurchaseButton product={product} currentPrice={activePrice} />
                <ProductPurchaseButton product={product} currentPrice={activePrice} action="buy" />
                <MessageSellerButton
                  productId={product.id}
                  sellerId={product.seller_id}
                  saleType={product.sale_type}
                />
                <FavoriteButton productId={product.id} productName={product.name ?? "Producto"} variant="label" />
              </div>

              <div className="rounded-2xl border border-border bg-card p-5">
                <h2 className="text-lg font-semibold text-foreground">Descripción</h2>
                <p className="mt-3 whitespace-pre-line text-sm leading-7 text-muted-foreground">
                  {product.description ?? "Este producto aún no tiene descripción disponible."}
                </p>
              </div>
              
              <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <IconShieldCheck className="h-5 w-5 text-brand-700" />
                  <span>Pago seguro con custodia y validación OTP.</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <IconTruck className="h-5 w-5 text-brand-700" />
                  <span>{product.shipping_available ? "Envío disponible" : "Retiro en tienda"}</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <IconStar className="h-5 w-5 text-brand-700" />
                  <span>{product.condition ?? "Condición no especificada"}</span>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-border bg-card p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Stock</p>
                  <p className="mt-2 text-xl font-bold text-foreground">{product.stock ?? 0}</p>
                </div>
                <div className="rounded-2xl border border-border bg-card p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Tipo</p>
                  <p className="mt-2 text-xl font-bold text-foreground">{product.condition ?? "General"}</p>
                </div>
                <div className="rounded-2xl border border-border bg-card p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Entrega</p>
                  <p className="mt-2 text-xl font-bold text-foreground">
                    {product.shipping_available ? "Express" : "Local"}
                  </p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Vendedor: <span className="font-medium text-foreground">{product.seller?.full_name || "Vendedor Vindex"}</span>
                {storeName && <> · Tienda: <span className="font-medium text-foreground">{storeName}</span></>}
              </p>
              <ProductReviews
                productId={product.id}
                sellerId={product.seller_id}
                storeId={product.store_id}
              />
            </div>
          </div>
        </div>

        <div className="mt-10 flex items-center justify-between gap-4 border-t border-border pt-6">
          <span className="text-sm text-muted-foreground">¿Te interesa este producto?</span>
          <Link href="/shop" className="inline-flex items-center gap-2 text-sm font-medium text-brand-700 hover:text-brand-800">
            Volver a la tienda
            <IconArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </main>
  );
}

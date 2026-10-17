"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { ShoppingCart } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatProductPrice } from "@/lib/formatters";
import { useCartStore } from "@/lib/store/useCartStore";

type CatalogProduct = {
    id: number;
    name: string | null;
    slug: string | null;
    price: number | null;
    discount_price: number | null;
    offer_ends_at: string | null;
    images: string[] | null;
    stock: number | null;
    seller_id: string;
    condition: string | null;
    category_id: number | null;
    created_at: string;
};

type ProductCategory = { id: number; name: string };

const conditions = ["Nuevo", "Usado", "Reacondicionado"];
const fallbackImage = "https://picsum.photos/seed/vindex-catalog/640/640";
const getCurrentPrice = (product: CatalogProduct) =>
    product.discount_price !== null &&
    product.offer_ends_at !== null &&
    new Date(product.offer_ends_at).getTime() > Date.now()
        ? product.discount_price
        : product.price;

export default function Shop() {
    const supabase = createClient();
    const [products, setProducts] = useState<CatalogProduct[]>([]);
    const [categories, setCategories] = useState<ProductCategory[]>([]);
    const [search, setSearch] = useState("");
    const [minimumPrice, setMinimumPrice] = useState("");
    const [maximumPrice, setMaximumPrice] = useState("");
    const [condition, setCondition] = useState("");
    const [categoryId, setCategoryId] = useState("");
    const [sort, setSort] = useState("recent");
    const [loading, setLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState("");
    const addItem = useCartStore((state) => state.addItem);
    const hasCartHydrated = useCartStore((state) => state.hasHydrated);

    useEffect(() => {
        let isCurrent = true;

        const loadCatalog = async () => {
            const [productResult, categoryResult] = await Promise.all([
                supabase
                    .from("products")
                    .select("id, name, slug, price, discount_price, offer_ends_at, images, stock, seller_id, condition, category_id, created_at")
                    .eq("status", true)
                    .in("sale_type", ["direct", "fixed_price"])
                    .gt("stock", 0)
                    .order("created_at", { ascending: false }),
                supabase.from("categories").select("id, name").order("name"),
            ]);

            if (!isCurrent) return;
            if (productResult.error) {
                setErrorMessage(productResult.error.message);
            } else {
                setProducts((productResult.data ?? []) as CatalogProduct[]);
            }
            if (!categoryResult.error) {
                setCategories((categoryResult.data ?? []) as ProductCategory[]);
            }
            setLoading(false);
        };

        void loadCatalog();
        return () => {
            isCurrent = false;
        };
    }, [supabase]);

    const filteredProducts = useMemo(() => {
        const normalizedSearch = search.trim().toLocaleLowerCase("es-CL");
        return products
            .filter((product) => {
                const price = getCurrentPrice(product) ?? 0;
                return (
                    (!normalizedSearch || (product.name ?? "").toLocaleLowerCase("es-CL").includes(normalizedSearch)) &&
                    (!minimumPrice || price >= Number(minimumPrice)) &&
                    (!maximumPrice || price <= Number(maximumPrice)) &&
                    (!condition || product.condition === condition) &&
                    (!categoryId || String(product.category_id) === categoryId)
                );
            })
            .sort((first, second) => {
                if (sort === "price-asc") return (getCurrentPrice(first) ?? 0) - (getCurrentPrice(second) ?? 0);
                if (sort === "price-desc") return (getCurrentPrice(second) ?? 0) - (getCurrentPrice(first) ?? 0);
                return new Date(second.created_at).getTime() - new Date(first.created_at).getTime();
            });
    }, [products, search, minimumPrice, maximumPrice, condition, categoryId, sort]);

    return (
        <main className="min-h-screen bg-background">
            <section className="container-site py-8 sm:py-10">
                <header className="section-head">
                    <div>
                        <p className="eyebrow">Compra directa</p>
                        <h1 className="section-title mt-1">Catálogo de productos</h1>
                        <p className="mt-2 text-sm text-muted-foreground">
                            {loading ? "Cargando productos..." : `${filteredProducts.length} resultados`}
                        </p>
                    </div>
                    <div className="flex w-full items-center gap-3 sm:w-auto">
                        <Label htmlFor="catalog-sort" className="shrink-0">Ordenar por</Label>
                        <Select
                            id="catalog-sort"
                            value={sort}
                            onChange={(event) => setSort(event.target.value)}
                            className="h-9 min-w-0 flex-1 rounded-xl border border-border bg-surface px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-brand-600 sm:w-48 sm:flex-none"
                        >
                            <option value="recent">Más recientes</option>
                            <option value="price-asc">Precio: menor a mayor</option>
                            <option value="price-desc">Precio: mayor a menor</option>
                        </Select>
                    </div>
                </header>

                <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
                    <aside aria-label="Filtros de productos" className="w-full shrink-0 lg:sticky lg:top-24 lg:w-64">
                        <Card className="rounded-xl border-border bg-surface shadow-none">
                            <CardContent className="space-y-5 p-4">
                                <h2 className="font-semibold text-foreground">Filtrar productos</h2>
                                <div className="space-y-2">
                                    <Label htmlFor="catalog-search">Nombre del producto</Label>
                                    <Input id="catalog-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar..." className="h-10 rounded-lg bg-background" />
                                </div>
                                <fieldset className="space-y-2">
                                    <legend className="text-sm font-medium">Rango de precio (CLP)</legend>
                                    <div className="grid grid-cols-2 gap-2">
                                        <Input aria-label="Precio mínimo" type="number" min="0" value={minimumPrice} onChange={(event) => setMinimumPrice(event.target.value)} placeholder="Mínimo" className="h-10 rounded-lg bg-background" />
                                        <Input aria-label="Precio máximo" type="number" min="0" value={maximumPrice} onChange={(event) => setMaximumPrice(event.target.value)} placeholder="Máximo" className="h-10 rounded-lg bg-background" />
                                    </div>
                                </fieldset>
                                <div className="space-y-2">
                                    <Label htmlFor="catalog-condition">Condición</Label>
                                      <Select id="catalog-condition" value={condition} onChange={(event) => setCondition(event.target.value)} className="h-10 rounded-lg focus-visible:ring-2 focus-visible:ring-brand-600">
                                        <option value="">Todas las condiciones</option>
                                        {conditions.map((value) => <option key={value} value={value}>{value}</option>)}
                                      </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="catalog-category">Categoría</Label>
                                      <Select id="catalog-category" value={categoryId} onChange={(event) => setCategoryId(event.target.value)} className="h-10 rounded-lg focus-visible:ring-2 focus-visible:ring-brand-600">
                                        <option value="">Todas las categorías</option>
                                        {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                                      </Select>
                                </div>
                                <Button type="button" variant="outline" className="w-full rounded-lg" onClick={() => { setSearch(""); setMinimumPrice(""); setMaximumPrice(""); setCondition(""); setCategoryId(""); }}>
                                    Limpiar filtros
                                </Button>
                            </CardContent>
                        </Card>
                    </aside>

                    <div className="min-w-0 flex-1">
                        {errorMessage && <p role="alert" className="mb-5 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">No se pudo cargar el catálogo: {errorMessage}</p>}
                        {loading ? (
                            <p role="status" className="py-12 text-center text-sm text-muted-foreground">Cargando catálogo...</p>
                        ) : filteredProducts.length === 0 ? (
                            <p className="py-12 text-center text-sm text-muted-foreground">No hay productos que coincidan con estos filtros.</p>
                        ) : (
                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-5 xl:grid-cols-3">
                                {filteredProducts.map((product) => {
                                    const destination = `/producto/${encodeURIComponent(product.slug || String(product.id))}`;
                                    return (
                                        <Card key={product.id} className="group overflow-hidden rounded-xl border-border bg-surface py-0 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                                            <div className="flex h-full flex-col">
                                            <Link href={destination} className="flex flex-1 flex-col" aria-label={`Ver producto ${product.name ?? "sin nombre"}`}>
                                                <div className="relative aspect-square overflow-hidden bg-muted">
                                                    <img src={product.images?.[0] || fallbackImage} alt={product.name ?? "Producto"} loading="lazy" className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
                                                    {product.condition && <Badge variant="secondary" className="absolute left-3 top-3">{product.condition}</Badge>}
                                                </div>
                                                <CardContent className="flex flex-1 flex-col gap-3 p-3 sm:p-4">
                                                    <h2 className="line-clamp-2 min-h-10 text-sm font-semibold text-foreground">{product.name ?? "Producto sin nombre"}</h2>
                                                    <p className="mt-auto text-base font-extrabold text-foreground">{formatProductPrice(getCurrentPrice(product))}</p>
                                                    <span className="btn btn-primary min-h-9 w-full rounded-lg">Ver Producto</span>
                                                </CardContent>
                                            </Link>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                disabled={!hasCartHydrated || !product.stock || product.stock < 1}
                                                onClick={() => addItem({
                                                    id: product.id,
                                                    name: product.name ?? "Producto sin nombre",
                                                    price: getCurrentPrice(product) ?? 0,
                                                    image: product.images?.[0] || fallbackImage,
                                                    quantity: 1,
                                                    stock: Math.floor(product.stock ?? 0),
                                                    seller_id: product.seller_id,
                                                })}
                                                className="mx-3 mb-3 h-9 rounded-lg sm:mx-4 sm:mb-4"
                                            >
                                                <ShoppingCart aria-hidden="true" />
                                                {hasCartHydrated ? "Agregar al carrito" : "Preparando carrito..."}
                                            </Button>
                                            </div>
                                        </Card>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </section>
        </main>
    );
}
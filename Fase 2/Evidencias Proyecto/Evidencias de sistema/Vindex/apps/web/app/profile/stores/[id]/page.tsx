"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Pencil, Plus, Trash2 } from "lucide-react";
import { Dialog } from "@base-ui/react/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

type Store = { id: number; name: string; slug: string };
type StoreCategory = { id: number; name: string };
type StoreProduct = { id: number; name: string | null; images: string[] | null; sale_type: string | null; status: boolean | null; created_at: string };

export default function StoreAdminPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [supabase] = useState(createClient);
  const [store, setStore] = useState<Store | null>(null);
  const [categories, setCategories] = useState<StoreCategory[]>([]);
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [categoryName, setCategoryName] = useState("");
  const [categoriesDialogOpen, setCategoriesDialogOpen] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState("");
  const [unassignedProducts, setUnassignedProducts] = useState<StoreProduct[]>([]);
  const [addProductsDialogOpen, setAddProductsDialogOpen] = useState(false);
  const [selectedProductIds, setSelectedProductIds] = useState<number[]>([]);
  const [loadingUnassignedProducts, setLoadingUnassignedProducts] = useState(false);
  const [addingProducts, setAddingProducts] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const storeId = Number(params.id);

  useEffect(() => {
    let current = true;

    const load = async () => {
      if (!Number.isSafeInteger(storeId) || storeId <= 0) {
        router.replace("/profile");
        return;
      }

      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;
        if (!user) {
          router.replace(`/login?next=/profile/stores/${storeId}`);
          return;
        }

        const { data: storeRow, error: storeError } = await supabase
          .from("stores")
          .select("id, name, slug")
          .eq("id", storeId)
          .eq("owner_id", user.id)
          .maybeSingle();
        if (storeError) throw storeError;
        if (!storeRow) {
          router.replace("/profile");
          return;
        }

        const [{ data: categoryRows, error: categoryError }, { data: productRows, error: productError }] = await Promise.all([
          supabase.from("store_categories").select("id, name").eq("store_id", storeId).order("name", { ascending: true }),
          supabase.from("products").select("id, name, images, sale_type, status, created_at").eq("store_id", storeId).order("created_at", { ascending: false }),
        ]);
        if (categoryError) throw categoryError;
        if (productError) throw productError;
        if (!current) return;
        setStore(storeRow as Store);
        setCategories((categoryRows ?? []) as StoreCategory[]);
        setProducts((productRows ?? []) as StoreProduct[]);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Error desconocido";
        if (current) setErrorMessage(message);
      } finally {
        if (current) setLoading(false);
      }
    };

    void load();
    return () => {
      current = false;
    };
  }, [router, storeId, supabase]);

  const addCategory = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = categoryName.trim();
    if (!name) return;
    setSaving(true);
    setErrorMessage(null);
    try {
      const { data, error } = await supabase.from("store_categories")
        .insert({ store_id: storeId, name })
        .select("id, name")
        .single();
      if (error) throw error;
      setCategories((current) => [...current, data as StoreCategory].sort((a, b) => a.name.localeCompare(b.name, "es")));
      setCategoryName("");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "No se pudo crear la categoría.");
    } finally {
      setSaving(false);
    }
  };

  const saveCategory = async (categoryId: number) => {
    const name = editingCategoryName.trim();
    if (!name) return;
    setSaving(true);
    setErrorMessage(null);
    try {
      const { data, error } = await supabase.from("store_categories")
        .update({ name })
        .eq("id", categoryId)
        .eq("store_id", storeId)
        .select("id, name")
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("No se encontró esa categoría en esta tienda.");
      setCategories((current) => current.map((category) => category.id === categoryId ? data as StoreCategory : category).sort((a, b) => a.name.localeCompare(b.name, "es")));
      setEditingCategoryId(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "No se pudo guardar la categoría.");
    } finally {
      setSaving(false);
    }
  };

  const deleteCategory = async (category: StoreCategory) => {
    if (!window.confirm(`¿Eliminar la categoría "${category.name}"?`)) return;
    setErrorMessage(null);
    try {
      const { error } = await supabase.from("store_categories")
        .delete()
        .eq("id", category.id)
        .eq("store_id", storeId);
      if (error) throw error;
      setCategories((current) => current.filter(({ id }) => id !== category.id));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "No se pudo eliminar la categoría.");
    }
  };

  const openAddProductsDialog = async () => {
    setAddProductsDialogOpen(true);
    setSelectedProductIds([]);
    setLoadingUnassignedProducts(true);
    setErrorMessage(null);
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!user) {
        router.replace("/login");
        return;
      }
      const { data, error } = await supabase
        .from("products")
        .select("id, name, images, sale_type, status, created_at")
        .eq("seller_id", user.id)
        .is("store_id", null)
        .eq("status", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setUnassignedProducts((data ?? []) as StoreProduct[]);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "No se pudieron cargar tus productos.");
    } finally {
      setLoadingUnassignedProducts(false);
    }
  };

  const addSelectedProducts = async () => {
    if (selectedProductIds.length === 0) return;
    setAddingProducts(true);
    setErrorMessage(null);
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!user) {
        router.replace("/login");
        return;
      }

      const { data, error } = await supabase
        .from("products")
        .update({ store_id: storeId, store_category_id: null })
        .eq("seller_id", user.id)
        .is("store_id", null)
        .in("id", selectedProductIds)
        .select("id, name, images, sale_type, status, created_at");
      if (error) throw error;
      if (!data?.length) throw new Error("No se pudieron añadir los productos seleccionados.");

      const addedIds = new Set(data.map((product) => product.id));
      setProducts((current) => [...(data as StoreProduct[]), ...current].sort((a, b) => b.created_at.localeCompare(a.created_at)));
      setUnassignedProducts((current) => current.filter((product) => !addedIds.has(product.id)));
      setSelectedProductIds([]);
      setAddProductsDialogOpen(false);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "No se pudieron añadir los productos.");
    } finally {
      setAddingProducts(false);
    }
  };

  if (loading) return <main className="container-site py-12"><p role="status" className="text-sm text-muted-foreground">Cargando tienda...</p></main>;
  if (!store) return <main className="container-site py-12">{errorMessage && <p role="alert" className="text-sm text-destructive">{errorMessage}</p>}</main>;

  return (
    <main className="container-site space-y-6 py-10">
      <Link href="/profile" className="inline-flex items-center gap-2 text-sm text-brand-700 hover:text-brand-800"><ArrowLeft className="size-4" />Volver al perfil vendedor</Link>
      <header>
        <p className="eyebrow">Administración de tienda</p>
        <h1 className="mt-1 text-3xl font-bold text-foreground">{store.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">/tiendas/{store.slug}</p>
      </header>

      {errorMessage && <p role="alert" className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">{errorMessage}</p>}

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>Productos y subastas</CardTitle>
              <CardDescription>Publicaciones asignadas a esta tienda.</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => setCategoriesDialogOpen(true)}>
                Administrar categorías
              </Button>
              <Button type="button" variant="outline" onClick={() => void openAddProductsDialog()}>
                Añadir mis productos publicados
              </Button>
              <Button type="button" onClick={() => router.push(`/vender?storeId=${storeId}`)}>
                <Plus className="size-4" />Publicar producto
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {products.length === 0 ? <p className="text-sm text-muted-foreground">No hay publicaciones asignadas a esta tienda.</p> : (
            <ul className="divide-y divide-border">
              {products.map((product) => (
                <li key={product.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <img
                      src={product.images?.[0] ?? `https://picsum.photos/seed/vindex-product-${product.id}/120/120`}
                      alt=""
                      loading="lazy"
                      className="size-14 shrink-0 rounded-lg border border-border bg-muted object-cover sm:size-16"
                    />
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">{product.name ?? "Publicación sin nombre"}</p>
                      <p className="text-xs text-muted-foreground">{product.sale_type === "auction" ? "Subasta" : "Producto"} · {product.status ? "Activo" : "Inactivo"}</p>
                    </div>
                  </div>
                  <Link className="shrink-0 text-sm font-medium text-brand-700 hover:text-brand-800" href={product.sale_type === "auction" ? `/subastas/${product.id}` : `/product/${product.id}`}>Ver publicación</Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog.Root open={categoriesDialogOpen} onOpenChange={setCategoriesDialogOpen}>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/50" />
          <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 max-h-[85vh] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-border bg-surface p-6 text-foreground shadow-xl">
            <Dialog.Title className="text-xl font-semibold">Administrar categorías</Dialog.Title>
            <Dialog.Description className="mt-1 text-sm text-muted-foreground">Crea, renombra o elimina las categorías de {store.name}.</Dialog.Description>
            <div className="mt-5 space-y-4">
              <form onSubmit={(event) => void addCategory(event)} className="flex flex-col gap-2 sm:flex-row">
                <Label htmlFor="new-category" className="sr-only">Nombre de la nueva categoría</Label>
                <Input id="new-category" value={categoryName} onChange={(event) => setCategoryName(event.target.value)} placeholder="Ej. Accesorios" maxLength={80} required />
                <Button type="submit" disabled={saving}><Plus className="size-4" />Agregar categoría</Button>
              </form>
              {categories.length === 0 ? <p className="text-sm text-muted-foreground">Todavía no hay categorías propias.</p> : (
                <ul className="divide-y divide-border">
                  {categories.map((category) => (
                    <li key={category.id} className="flex flex-wrap items-center gap-2 py-3">
                      {editingCategoryId === category.id ? (
                        <>
                          <Input aria-label="Editar nombre de categoría" value={editingCategoryName} onChange={(event) => setEditingCategoryName(event.target.value)} className="max-w-sm" />
                          <Button type="button" size="sm" onClick={() => void saveCategory(category.id)} disabled={saving}>Guardar</Button>
                          <Button type="button" size="sm" variant="outline" onClick={() => setEditingCategoryId(null)}>Cancelar</Button>
                        </>
                      ) : (
                        <>
                          <span className="flex-1 font-medium text-foreground">{category.name}</span>
                          <Button type="button" size="icon" variant="ghost" aria-label={`Editar ${category.name}`} onClick={() => { setEditingCategoryId(category.id); setEditingCategoryName(category.name); }}><Pencil className="size-4" /></Button>
                          <Button type="button" size="icon" variant="ghost" aria-label={`Eliminar ${category.name}`} onClick={() => void deleteCategory(category)}><Trash2 className="size-4" /></Button>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="mt-5 flex justify-end">
              <Dialog.Close render={<Button type="button" variant="outline" />}>Cerrar</Dialog.Close>
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>

      <Dialog.Root open={addProductsDialogOpen} onOpenChange={setAddProductsDialogOpen}>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/50" />
          <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 max-h-[85vh] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-border bg-surface p-6 text-foreground shadow-xl">
            <Dialog.Title className="text-xl font-semibold">Añadir publicaciones a {store.name}</Dialog.Title>
            <Dialog.Description className="mt-1 text-sm text-muted-foreground">Selecciona publicaciones tuyas que aún no pertenecen a una tienda.</Dialog.Description>
            <div className="mt-5 space-y-4">
              {loadingUnassignedProducts ? <p role="status" className="text-sm text-muted-foreground">Cargando productos...</p>
                : unassignedProducts.length === 0 ? <p className="text-sm text-muted-foreground">No tienes productos publicados fuera de tus tiendas.</p>
                  : (
                    <ul className="max-h-72 divide-y divide-border overflow-y-auto">
                      {unassignedProducts.map((product) => (
                        <li key={product.id} className="py-3">
                          <label className="flex cursor-pointer items-center gap-3 text-sm text-foreground">
                            <input
                              type="checkbox"
                              checked={selectedProductIds.includes(product.id)}
                              onChange={(event) => setSelectedProductIds((current) => event.target.checked ? [...current, product.id] : current.filter((id) => id !== product.id))}
                              className="size-4 accent-brand-600"
                            />
                            <img
                              src={product.images?.[0] ?? `https://picsum.photos/seed/vindex-product-${product.id}/120/120`}
                              alt=""
                              loading="lazy"
                              className="size-12 shrink-0 rounded-md border border-border bg-muted object-cover"
                            />
                            <span className="min-w-0 flex-1 truncate">{product.name ?? "Publicación sin nombre"}</span>
                            <span className="text-xs text-muted-foreground">{product.sale_type === "auction" ? "Subasta" : "Producto"}</span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  )}
            </div>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <Dialog.Close render={<Button type="button" variant="outline" />}>Cancelar</Dialog.Close>
              <Button type="button" onClick={() => void addSelectedProducts()} disabled={addingProducts || loadingUnassignedProducts || selectedProductIds.length === 0}>
                {addingProducts ? "Añadiendo..." : `Añadir seleccionados${selectedProductIds.length ? ` (${selectedProductIds.length})` : ""}`}
              </Button>
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </main>
  );
}

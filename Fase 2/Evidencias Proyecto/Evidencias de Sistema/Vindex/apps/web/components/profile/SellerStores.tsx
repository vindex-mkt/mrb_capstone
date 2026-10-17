"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import RatingStars from "@/components/RatingStars";
import { useToast } from "@/components/ToastProvider";
import { createClient } from "@/lib/supabase/client";

type Store = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  logo_url: string | null;
  banner_url: string | null;
};

type SellerRating = {
  average_rating: number | null;
  total_reviews: number | null;
};

type StoreDraft = {
  name: string;
  description: string;
  logo_url: string;
  banner_url: string;
};

const toSlug = (value: string) =>
  value.trim().toLocaleLowerCase("es").normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const uploadStoreImage = async (
  supabase: ReturnType<typeof createClient>,
  file: File,
  ownerId: string,
): Promise<string> => {
  if (!file.type.startsWith("image/")) throw new Error("Selecciona un archivo de imagen válido.");
  if (file.size > 5 * 1024 * 1024) throw new Error("Cada imagen debe pesar menos de 5 MB.");

  const extension = file.name.split(".").pop()?.replace(/[^a-zA-Z0-9]/g, "").toLowerCase() || "img";
  const path = `${ownerId}/stores/${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage.from("product-images").upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (error) throw error;

  return supabase.storage.from("product-images").getPublicUrl(path).data.publicUrl;
};

export default function SellerStores() {
  const [supabase] = useState(createClient);
  const { showToast } = useToast();
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [stores, setStores] = useState<Store[]>([]);
  const [rating, setRating] = useState<SellerRating | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingStoreId, setEditingStoreId] = useState<number | null>(null);
  const [draft, setDraft] = useState<StoreDraft>({
    name: "",
    description: "",
    logo_url: "",
    banner_url: "",
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadStores = useCallback(async (userId: string) => {
    const [{ data: storeRows, error: storesError }, { data: ratingRow, error: ratingError }] = await Promise.all([
      supabase.from("stores").select("id, name, slug, description, logo_url, banner_url").eq("owner_id", userId).order("created_at", { ascending: false }),
      supabase.from("seller_ratings").select("average_rating, total_reviews").eq("seller_id", userId).maybeSingle(),
    ]);

    if (storesError) throw storesError;
    if (ratingError) throw ratingError;
    setStores((storeRows ?? []) as Store[]);
    setRating(ratingRow as SellerRating | null);
  }, [supabase]);

  useEffect(() => {
    let current = true;

    const load = async () => {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;
        if (!user) return;
        if (!current) return;
        setOwnerId(user.id);
        await loadStores(user.id);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Error desconocido";
        if (current) setLoadError(message);
      } finally {
        if (current) setLoading(false);
      }
    };

    void load();
    return () => {
      current = false;
    };
  }, [loadStores, supabase]);

  const openCreateForm = () => {
    setEditingStoreId(null);
    setDraft({ name: "", description: "", logo_url: "", banner_url: "" });
    setLogoFile(null);
    setBannerFile(null);
    setFormOpen(true);
  };

  const openEditForm = (store: Store) => {
    setEditingStoreId(store.id);
    setDraft({
      name: store.name,
      description: store.description ?? "",
      logo_url: store.logo_url ?? "",
      banner_url: store.banner_url ?? "",
    });
    setLogoFile(null);
    setBannerFile(null);
    setFormOpen(true);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!ownerId) return;

    const baseSlug = toSlug(draft.name);
    if (!baseSlug) {
      showToast("El nombre debe incluir letras o números para generar la dirección de la tienda.", "error");
      return;
    }

    setSaving(true);
    try {
      let slug = baseSlug;
      const { data: duplicate, error: duplicateError } = await supabase
        .from("stores")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();
      if (duplicateError) throw duplicateError;
      if (duplicate && duplicate.id !== editingStoreId) slug = `${baseSlug}-${crypto.randomUUID().slice(0, 8)}`;

      const logoUrl = logoFile ? await uploadStoreImage(supabase, logoFile, ownerId) : draft.logo_url.trim() || null;
      const bannerUrl = bannerFile ? await uploadStoreImage(supabase, bannerFile, ownerId) : draft.banner_url.trim() || null;
      const values = {
        name: draft.name.trim(),
        slug,
        description: draft.description.trim(),
        logo_url: logoUrl,
        banner_url: bannerUrl,
      };

      if (editingStoreId === null) {
        const { error } = await supabase.from("stores").insert({ ...values, owner_id: ownerId });
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("stores")
          .update(values)
          .eq("id", editingStoreId)
          .eq("owner_id", ownerId)
          .select("id")
          .maybeSingle();
        if (error) throw error;
        if (!data) throw new Error("No se encontró una tienda que puedas administrar.");
      }

      await loadStores(ownerId);
      setFormOpen(false);
      showToast(editingStoreId === null ? "Tienda creada correctamente." : "Tienda actualizada correctamente.", "success");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error desconocido";
      showToast(`No se pudo guardar la tienda: ${message}`, "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p role="status" className="text-sm text-muted-foreground">Cargando tus tiendas y reputación...</p>;

  return (
    <div className="space-y-6">
      {loadError && <p role="alert" className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">No se pudieron cargar las tiendas: {loadError}</p>}

      <Card>
        <CardHeader>
          <CardTitle>Reputación del vendedor</CardTitle>
          <CardDescription>Calificaciones recibidas por tus ventas y subastas completadas.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          {rating && Number(rating.total_reviews) > 0 ? (
            <>
              <RatingStars rating={Number(rating.average_rating ?? 0)} />
              <strong className="text-foreground">{Number(rating.average_rating ?? 0).toFixed(1)} / 5</strong>
              <span className="text-sm text-muted-foreground">({Number(rating.total_reviews)} reseñas)</span>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Aún no tienes calificaciones.</p>
          )}
        </CardContent>
      </Card>

      <section className="space-y-4" aria-labelledby="my-stores-heading">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="my-stores-heading" className="text-xl font-semibold text-foreground">Mis Tiendas</h2>
            <p className="mt-1 text-sm text-muted-foreground">Administra tus vitrinas, categorías y publicaciones.</p>
          </div>
          <Button type="button" onClick={openCreateForm}>+ Crear Tienda</Button>
        </div>

        {formOpen && (
          <Card>
            <CardHeader>
              <CardTitle>{editingStoreId === null ? "Crear tienda" : "Editar tienda"}</CardTitle>
              <CardDescription>El enlace de la tienda se genera automáticamente desde su nombre.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="store-name">Nombre</Label>
                    <Input id="store-name" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} maxLength={100} required />
                    <p className="text-xs text-muted-foreground">Dirección: /tiendas/{toSlug(draft.name) || "nombre-de-tienda"}</p>
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="store-description">Descripción</Label>
                    <Textarea id="store-description" value={draft.description ?? ""} onChange={(event) => setDraft({ ...draft, description: event.target.value })} rows={3} maxLength={2000} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="store-logo">Logo</Label>
                    <Input id="store-logo" type="file" accept="image/*" onChange={(event) => setLogoFile(event.target.files?.[0] ?? null)} />
                    {draft.logo_url && <img src={draft.logo_url} alt="Logo actual de la tienda" className="size-16 rounded-lg border border-border object-cover" />}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="store-banner">Banner</Label>
                    <Input id="store-banner" type="file" accept="image/*" onChange={(event) => setBannerFile(event.target.files?.[0] ?? null)} />
                    {draft.banner_url && <img src={draft.banner_url} alt="Banner actual de la tienda" className="h-16 w-full rounded-lg border border-border object-cover" />}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">Imágenes de hasta 5 MB; se guardan en el almacenamiento de Supabase.</p>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>Cancelar</Button>
                  <Button type="submit" disabled={saving}>{saving ? "Guardando..." : "Guardar tienda"}</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {stores.length === 0 && !formOpen ? (
          <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">Aún no has creado tiendas.</CardContent></Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {stores.map((store) => (
              <Card key={store.id}>
                <CardHeader className="flex flex-row items-center gap-3">
                  {store.logo_url
                    ? <img src={store.logo_url} alt="" className="size-14 rounded-lg border border-border object-cover" />
                    : <div aria-hidden="true" className="size-14 rounded-lg bg-muted" />}
                  <div className="min-w-0">
                    <CardTitle className="truncate">{store.name}</CardTitle>
                    <CardDescription className="truncate">/tiendas/{store.slug}</CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" onClick={() => openEditForm(store)}>Editar</Button>
                  <Button type="button" nativeButton={false} render={<Link href={`/profile/stores/${store.id}`} />}>Administrar</Button>
                  <Button type="button" variant="ghost" nativeButton={false} render={<Link href={`/tiendas/${encodeURIComponent(store.slug)}`} />}>Ver tienda</Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

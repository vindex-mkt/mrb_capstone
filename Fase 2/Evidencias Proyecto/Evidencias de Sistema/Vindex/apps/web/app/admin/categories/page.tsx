"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { createClient } from "@/lib/supabase/client";

type Category = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
};

const toSlug = (value: string) => value
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .trim()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-|-$/g, "");

export default function CategoriesAdminPage() {
  const router = useRouter();
  const supabase = createClient();
  const [authorized, setAuthorized] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [accessError, setAccessError] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingDescription, setEditingDescription] = useState("");
  const [editingIcon, setEditingIcon] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let isCurrent = true;

    const verifyAdmin = async () => {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (!isCurrent) return;
      if (authError || !user) {
        router.replace("/login?next=%2Fadmin%2Fcategories");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (!isCurrent) return;
      if (profileError) {
        setAccessError(`No se pudo consultar tu perfil: ${profileError.message}`);
        setCheckingAccess(false);
        return;
      }
      if (profile?.role !== "admin") {
        setAccessError(profile
          ? `Tu perfil tiene el rol "${profile.role ?? "sin rol"}". Se requiere "admin".`
          : "No se encontró un perfil asociado a tu usuario. La validación busca profiles.id igual al ID de tu sesión.");
        setCheckingAccess(false);
        return;
      }

      setAuthorized(true);
      setCheckingAccess(false);
    };

    void verifyAdmin();
    return () => {
      isCurrent = false;
    };
  }, [router, supabase]);

  useEffect(() => {
    if (!authorized) return;
    let isCurrent = true;

    const loadCategories = async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("id, name, slug, description, icon")
        .order("name", { ascending: true });
      if (!isCurrent) return;
      if (error) setErrorMessage(error.message);
      else setCategories((data ?? []) as Category[]);
      setLoading(false);
    };

    void loadCategories();
    return () => {
      isCurrent = false;
    };
  }, [authorized, supabase]);

  const createCategory = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage("");
    setFeedback("");
    const trimmedName = name.trim();
    const slug = toSlug(trimmedName);
    if (!trimmedName || !slug) {
      setErrorMessage("Ingresa un nombre de categoría válido.");
      return;
    }

    setSaving(true);
    const { data, error } = await supabase
      .from("categories")
      .insert({ name: trimmedName, slug, description: description.trim() || null, icon: icon.trim() || null })
      .select("id, name, slug, description, icon")
      .single();
    setSaving(false);
    if (error) {
      setErrorMessage(error.message);
      return;
    }
    setCategories((current) => [...current, data as Category].sort((first, second) => first.name.localeCompare(second.name, "es")));
    setName("");
    setDescription("");
    setIcon("");
    setFeedback("Categoría creada.");
  };

  const beginEdit = (category: Category) => {
    setEditingId(category.id);
    setEditingName(category.name);
    setEditingDescription(category.description ?? "");
    setEditingIcon(category.icon ?? "");
    setErrorMessage("");
    setFeedback("");
  };

  const saveEdit = async (categoryId: number) => {
    const trimmedName = editingName.trim();
    const slug = toSlug(trimmedName);
    if (!trimmedName || !slug) {
      setErrorMessage("Ingresa un nombre de categoría válido.");
      return;
    }
    setSaving(true);
    setErrorMessage("");
    const { data, error } = await supabase
      .from("categories")
      .update({ name: trimmedName, slug, description: editingDescription.trim() || null, icon: editingIcon.trim() || null })
      .eq("id", categoryId)
      .select("id, name, slug, description, icon")
      .single();
    setSaving(false);
    if (error) {
      setErrorMessage(error.message);
      return;
    }
    setCategories((current) => current.map((category) => category.id === categoryId ? data as Category : category));
    setEditingId(null);
    setFeedback("Categoría actualizada.");
  };

  const deleteCategory = async (category: Category) => {
    if (!window.confirm(`¿Eliminar la categoría "${category.name}"?`)) return;
    setErrorMessage("");
    const { error } = await supabase.from("categories").delete().eq("id", category.id);
    if (error) {
      setErrorMessage(error.message);
      return;
    }
    setCategories((current) => current.filter((item) => item.id !== category.id));
    setFeedback("Categoría eliminada.");
  };

  if (checkingAccess) {
    return <section className="container-site py-12"><p role="status" className="text-sm text-muted-foreground">Verificando permisos...</p></section>;
  }
  if (!authorized) {
    return (
      <section className="container-site py-12">
        <Card className="max-w-xl rounded-xl border-border bg-surface shadow-none">
          <CardHeader>
            <CardTitle>Acceso denegado</CardTitle>
            <CardDescription>{accessError || "Tu usuario no tiene permisos para administrar categorías."}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button type="button" variant="outline" className="rounded-lg" onClick={() => router.push("/")}>Volver al inicio</Button>
          </CardContent>
        </Card>
      </section>
    );
  }

  return (
    <section className="container-site space-y-6 py-8 sm:py-10">
      <header className="section-head mb-0">
        <div>
          <p className="eyebrow">Administración</p>
          <h1 className="section-title mt-1">Categorías</h1>
          <p className="mt-2 text-sm text-muted-foreground">Gestiona las categorías disponibles en el catálogo.</p>
        </div>
        <Badge variant="secondary">{categories.length} categorías</Badge>
      </header>

      {errorMessage && <p role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">{errorMessage}</p>}
      {feedback && <p role="status" className="rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-800">{feedback}</p>}

      <Card className="rounded-xl border-border bg-surface shadow-none">
        <CardHeader>
          <CardTitle>Nueva categoría</CardTitle>
          <CardDescription>El slug se genera automáticamente a partir del nombre.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={createCategory} className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="category-name">Nombre</Label>
              <Input id="category-name" required value={name} onChange={(event) => setName(event.target.value)} placeholder="Ej. Computación" className="h-10 rounded-lg bg-background" />
              {name.trim() && <p className="text-xs text-muted-foreground">Slug: {toSlug(name)}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="category-icon">Icono</Label>
              <Input id="category-icon" value={icon} onChange={(event) => setIcon(event.target.value)} placeholder="Nombre o identificador del icono" className="h-10 rounded-lg bg-background" />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="category-description">Descripción (opcional)</Label>
              <Input id="category-description" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Descripción de la categoría" className="h-10 rounded-lg bg-background" />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={saving} className="rounded-lg">{saving ? "Guardando..." : "Crear categoría"}</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="rounded-xl border-border bg-surface shadow-none">
        <CardHeader>
          <CardTitle>Categorías existentes</CardTitle>
          <CardDescription>Editar una categoría también actualiza su slug.</CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          {loading ? (
            <p role="status" className="px-5 py-6 text-sm text-muted-foreground">Cargando categorías...</p>
          ) : categories.length === 0 ? (
            <p className="px-5 py-6 text-sm text-muted-foreground">Aún no hay categorías.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-[680px] border-collapse text-left">
                <TableHeader className="border-y border-border bg-muted/60">
                  <TableRow className="hover:bg-transparent"><TableHead>Categoría</TableHead><TableHead>Slug</TableHead><TableHead>Icono</TableHead><TableHead className="text-right">Acciones</TableHead></TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-border">
                  {categories.map((category) => (
                    <TableRow key={category.id}>
                      {editingId === category.id ? (
                        <>
                          <TableCell className="space-y-2 py-3">
                            <Input aria-label="Nombre de la categoría" value={editingName} onChange={(event) => setEditingName(event.target.value)} className="h-9 rounded-lg bg-background" />
                            <Input aria-label="Descripción de la categoría" value={editingDescription} onChange={(event) => setEditingDescription(event.target.value)} placeholder="Descripción" className="h-9 rounded-lg bg-background" />
                          </TableCell>
                          <TableCell className="py-3 text-muted-foreground">{toSlug(editingName)}</TableCell>
                          <TableCell className="py-3"><Input aria-label="Icono de la categoría" value={editingIcon} onChange={(event) => setEditingIcon(event.target.value)} className="h-9 rounded-lg bg-background" /></TableCell>
                          <TableCell className="py-3">
                            <div className="flex justify-end gap-2">
                              <Button type="button" size="sm" disabled={saving} onClick={() => void saveEdit(category.id)}>Guardar</Button>
                              <Button type="button" size="sm" variant="outline" onClick={() => setEditingId(null)}>Cancelar</Button>
                            </div>
                          </TableCell>
                        </>
                      ) : (
                        <>
                          <TableCell>
                            <p className="font-medium text-foreground">{category.name}</p>
                            {category.description && <p className="mt-1 max-w-sm truncate text-xs text-muted-foreground">{category.description}</p>}
                          </TableCell>
                          <TableCell className="text-muted-foreground">{category.slug}</TableCell>
                          <TableCell className="text-muted-foreground">{category.icon || "—"}</TableCell>
                          <TableCell>
                            <div className="flex justify-end gap-2">
                              <Button type="button" size="sm" variant="outline" onClick={() => beginEdit(category)}>Editar</Button>
                              <Button type="button" size="sm" variant="destructive" onClick={() => void deleteCategory(category)}>Eliminar</Button>
                            </div>
                          </TableCell>
                        </>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
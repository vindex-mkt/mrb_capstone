"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ToastProvider";
import { createClient } from "@/lib/supabase/client";
import type { ModerationAction, ModerationStatus } from "@/lib/moderation";

type ProductReview = {
  id: number;
  name: string | null;
  moderation_status: ModerationStatus;
  moderation_reason: string | null;
  created_at: string | null;
};

const statusBadgeMap: Record<ModerationStatus, string> = {
  pending_review: "bg-amber-100 text-amber-800",
  approved: "bg-emerald-100 text-emerald-800",
  rejected: "bg-red-100 text-red-800",
  flagged: "bg-orange-100 text-orange-800",
};

const moderationLabel: Record<ModerationStatus, string> = {
  pending_review: "Pendiente",
  approved: "Aprobado",
  rejected: "Rechazado",
  flagged: "Marcado",
};

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null) {
    const result = error as { message?: unknown; details?: unknown; hint?: unknown; code?: unknown };
    const message = typeof result.message === "string" ? result.message : "No se pudo guardar la decisión.";
    const details = typeof result.details === "string" ? result.details : null;
    const hint = typeof result.hint === "string" ? result.hint : null;
    const code = typeof result.code === "string" ? `Código: ${result.code}.` : null;
    return [message, details, hint, code].filter(Boolean).join(" ");
  }
  return "No se pudo guardar la decisión.";
};

export default function ModerationAdminPage() {
  const router = useRouter();
  const supabase = createClient();
  const { showToast } = useToast();
  const [authorized, setAuthorized] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [accessError, setAccessError] = useState("");
  const [products, setProducts] = useState<ProductReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [decisionText, setDecisionText] = useState<Record<number, string>>({});
  const [busyId, setBusyId] = useState<number | null>(null);

  useEffect(() => {
    let current = true;

    const verifyAdmin = async () => {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (!current) return;
      if (authError || !user) {
        router.replace("/login?next=%2Fadmin%2Fmoderation");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (!current) return;
      if (profileError) {
        setAccessError(`No se pudo consultar tu perfil: ${profileError.message}`);
        setCheckingAccess(false);
        return;
      }

      if (profile?.role !== "admin") {
        setAccessError(profile ? `Tu perfil tiene el rol "${profile.role ?? "sin rol"}". Se requiere "admin".` : "No se encontró un perfil asociado a tu usuario.");
        setCheckingAccess(false);
        return;
      }

      setAuthorized(true);
      setCheckingAccess(false);
    };

    void verifyAdmin();
    return () => {
      current = false;
    };
  }, [router, supabase]);

  useEffect(() => {
    if (!authorized) return;

    let current = true;
    const loadQueue = async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, moderation_status, moderation_reason, created_at")
        .or("moderation_status.eq.pending_review,moderation_status.eq.flagged,moderation_status.eq.rejected")
        .order("created_at", { ascending: false });

      if (!current) return;
      if (error) {
        showToast(`No se pudo cargar la cola de moderación: ${error.message}`, "error");
      } else {
        const priority: Record<ModerationStatus, number> = {
          flagged: 0,
          pending_review: 1,
          rejected: 2,
          approved: 3,
        };
        setProducts(
          ((data ?? []) as ProductReview[]).sort((first, second) =>
            priority[first.moderation_status] - priority[second.moderation_status]
            || (first.created_at ?? "").localeCompare(second.created_at ?? ""),
          ),
        );
      }
      setLoading(false);
    };

    void loadQueue();
    return () => {
      current = false;
    };
  }, [authorized, showToast, supabase]);

  const counts = useMemo(() => ({
    pending: products.filter((product) => product.moderation_status === "pending_review").length,
    flagged: products.filter((product) => product.moderation_status === "flagged").length,
    rejected: products.filter((product) => product.moderation_status === "rejected").length,
  }), [products]);

  const decide = async (productId: number, action: ModerationAction) => {
    const reason = (decisionText[productId] ?? "").trim();
    if (action === "rejected" && !reason) {
      showToast("Indica el motivo para rechazar este producto.", "error");
      return;
    }

    setBusyId(productId);

    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        router.replace("/login?next=%2Fadmin%2Fmoderation");
        return;
      }

      const { error } = await supabase.rpc("moderate_product", {
        p_product_id: productId,
        p_action: action,
        p_reason: reason,
      });
      if (error) throw error;

      setProducts((current) => current.filter((product) => product.id !== productId));
      setDecisionText((current) => {
        const next = { ...current };
        delete next[productId];
        return next;
      });
      showToast(`Producto ${action === "approved" ? "aprobado" : action === "rejected" ? "rechazado" : "marcado para revisión prioritaria"}.`, "success");
    } catch (error) {
      showToast(getErrorMessage(error), "error");
    } finally {
      setBusyId(null);
    }
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
            <CardDescription>{accessError || "Tu usuario no tiene permisos para moderar productos."}</CardDescription>
          </CardHeader>
        </Card>
      </section>
    );
  }

  return (
    <main className="container-site space-y-6 py-8 sm:py-10">
      <header className="space-y-3">
        <p className="eyebrow">Moderación</p>
        <h1 className="text-3xl font-bold text-foreground">Revisión previa de productos</h1>
        <p className="text-sm text-muted-foreground">Los productos en espera, marcados o rechazados no aparecen públicamente hasta que un administrador decida.</p>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        <Card className="rounded-xl border-border bg-surface shadow-none">
          <CardHeader>
            <CardTitle>Pendientes</CardTitle>
          </CardHeader>
          <CardContent><p className="text-3xl font-bold text-foreground">{counts.pending}</p></CardContent>
        </Card>
        <Card className="rounded-xl border-border bg-surface shadow-none">
          <CardHeader>
            <CardTitle>Marcados</CardTitle>
          </CardHeader>
          <CardContent><p className="text-3xl font-bold text-foreground">{counts.flagged}</p></CardContent>
        </Card>
        <Card className="rounded-xl border-border bg-surface shadow-none">
          <CardHeader>
            <CardTitle>Rechazados</CardTitle>
          </CardHeader>
          <CardContent><p className="text-3xl font-bold text-foreground">{counts.rejected}</p></CardContent>
        </Card>
      </section>

      {loading ? (
        <p role="status" className="text-sm text-muted-foreground">Cargando productos por revisar...</p>
      ) : products.length === 0 ? (
        <Card className="rounded-xl border-border bg-surface shadow-none">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">No hay productos pendientes de revisión.</CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {products.map((product) => (
            <Card key={product.id} className="rounded-xl border-border bg-surface shadow-none">
              <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle className="text-lg text-foreground">{product.name ?? `Producto #${product.id}`}</CardTitle>
                  <CardDescription className="mt-2 text-sm text-muted-foreground">
                    Fecha: {product.created_at ? new Date(product.created_at).toLocaleString("es-CL") : "Sin información"}
                  </CardDescription>
                </div>
                <Badge className={statusBadgeMap[product.moderation_status]}>{moderationLabel[product.moderation_status]}</Badge>
              </CardHeader>
              <CardContent className="space-y-4">
                <textarea
                  value={decisionText[product.id] ?? product.moderation_reason ?? ""}
                  onChange={(event) => setDecisionText((current) => ({ ...current, [product.id]: event.target.value }))}
                  rows={3}
                  className="w-full rounded-md border border-input bg-background p-3 text-sm text-foreground shadow-sm"
                  placeholder="Describe el motivo de la decisión de moderación..."
                />
                <div className="flex flex-wrap gap-2">
                  <Button type="button" onClick={() => decide(product.id, "approved")} disabled={busyId === product.id}>
                    {busyId === product.id ? "Guardando..." : "Aprobar"}
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => decide(product.id, "flagged")} disabled={busyId === product.id}>
                    Marcar prioridad
                  </Button>
                  <Button type="button" variant="destructive" onClick={() => decide(product.id, "rejected")} disabled={busyId === product.id}>
                    Rechazar
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}

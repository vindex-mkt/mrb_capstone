"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import RatingStars from "@/components/RatingStars";
import { useToast } from "@/components/ToastProvider";
import { createClient } from "@/lib/supabase/client";

type Review = { id: number; buyer_id: string; rating: number; comment: string | null; created_at: string };
type ProductReviewsProps = {
  productId: number;
  sellerId: string;
  storeId: number | null;
  isAuction?: boolean;
  winnerId?: string | null;
  auctionClosed?: boolean;
};

export default function ProductReviews({
  productId,
  sellerId,
  storeId,
  isAuction = false,
  winnerId = null,
  auctionClosed = false,
}: ProductReviewsProps) {
  const [supabase] = useState(createClient);
  const { showToast } = useToast();
  const [userId, setUserId] = useState<string | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadReviews = async () => {
    const { data, error } = await supabase.from("reviews")
      .select("id, buyer_id, rating, comment, created_at")
      .eq("product_id", productId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    setReviews((data ?? []) as Review[]);
  };

  useEffect(() => {
    let current = true;
    const load = async () => {
      try {
        const [{ data: { user }, error: authError }, { data, error }] = await Promise.all([
          supabase.auth.getUser(),
          supabase.from("reviews").select("id, buyer_id, rating, comment, created_at").eq("product_id", productId).order("created_at", { ascending: false }),
        ]);
        if (authError) throw authError;
        if (error) throw error;
        if (!current) return;
        setUserId(user?.id ?? null);
        setReviews((data ?? []) as Review[]);
      } catch (loadFailure) {
        const message = loadFailure instanceof Error ? loadFailure.message : "Error desconocido";
        if (current) setLoadError(message);
      } finally {
        if (current) setLoading(false);
      }
    };
    void load();
    return () => {
      current = false;
    };
  }, [productId, supabase]);

  const existingReview = reviews.some((review) => review.buyer_id === userId);
  const canRateWinner = Boolean(
    isAuction &&
    auctionClosed &&
    userId &&
    winnerId === userId &&
    sellerId !== userId &&
    !existingReview,
  );

  const submitReview = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!userId || !canRateWinner) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("reviews").insert({
        product_id: productId,
        buyer_id: userId,
        seller_id: sellerId,
        store_id: storeId,
        rating,
        comment: comment.trim(),
      });
      if (error) throw error;
      await loadReviews();
      setComment("");
      showToast("Tu calificación fue registrada.", "success");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error desconocido";
      showToast(`No se pudo guardar la calificación: ${message}`, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Calificaciones y reseñas</CardTitle>
        <CardDescription>Opiniones de compradores de esta publicación.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {loading ? <p role="status" className="text-sm text-muted-foreground">Cargando reseñas...</p>
          : loadError ? <p role="alert" className="text-sm text-destructive">No se pudieron cargar las reseñas: {loadError}</p>
            : reviews.length === 0 ? <p className="text-sm text-muted-foreground">Aún no hay reseñas para esta publicación.</p>
              : (
                <ul className="divide-y divide-border">
                  {reviews.map((review) => (
                    <li key={review.id} className="space-y-2 py-4 first:pt-0 last:pb-0">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <RatingStars rating={review.rating} />
                        <time className="text-xs text-muted-foreground" dateTime={review.created_at}>{new Date(review.created_at).toLocaleDateString("es-CL")}</time>
                      </div>
                      <p className="text-xs text-muted-foreground">Calificación de comprador</p>
                      {review.comment && <p className="whitespace-pre-line text-sm text-foreground">{review.comment}</p>}
                    </li>
                  ))}
                </ul>
              )}

        {canRateWinner && (
          <form onSubmit={(event) => void submitReview(event)} className="space-y-4 border-t border-border pt-5">
            <h3 className="font-semibold text-foreground">Califica al vendedor de esta subasta</h3>
            <div className="space-y-2">
              <Label htmlFor={`review-rating-${productId}`}>Estrellas</Label>
              <select id={`review-rating-${productId}`} value={rating} onChange={(event) => setRating(Number(event.target.value))} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground sm:max-w-48">
                {[5, 4, 3, 2, 1].map((value) => <option key={value} value={value}>{value} {value === 1 ? "estrella" : "estrellas"}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`review-comment-${productId}`}>Comentario (opcional)</Label>
              <Textarea id={`review-comment-${productId}`} value={comment} onChange={(event) => setComment(event.target.value)} rows={3} maxLength={1000} placeholder="Cuéntanos cómo fue tu experiencia." />
            </div>
            <Button type="submit" disabled={saving}>{saving ? "Enviando..." : "Enviar calificación"}</Button>
          </form>
        )}
        {userId && existingReview && <p className="border-t border-border pt-4 text-sm text-muted-foreground">Ya enviaste una calificación para esta subasta.</p>}
        {!isAuction && <p className="border-t border-border pt-4 text-xs text-muted-foreground">Las calificaciones de productos estarán disponibles cuando el sistema confirme la compra y recepción del pedido.</p>}
      </CardContent>
    </Card>
  );
}

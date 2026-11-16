"use client";

import { useState } from "react";
import { Heart } from "lucide-react";
import { useFavorites } from "@/hooks/useFavorites";
import { useToast } from "@/components/ToastProvider";

type FavoriteButtonProps = {
  productId: number;
  productName: string;
  variant?: "icon" | "label";
  className?: string;
};

export default function FavoriteButton({
  productId,
  productName,
  variant = "icon",
  className = "",
}: FavoriteButtonProps) {
  const { userId, isFavorite, addFavorite, removeFavorite } = useFavorites();
  const { showToast } = useToast();
  const [isPending, setIsPending] = useState(false);
  const active = isFavorite(productId);
  const action = active ? "Quitar" : "Añadir";

  const toggleFavorite = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (!userId) {
      showToast("Inicia sesión para guardar productos en favoritos.", "info");
      return;
    }

    setIsPending(true);
    try {
      if (active) await removeFavorite(productId);
      else await addFavorite(productId);
    } finally {
      setIsPending(false);
    }
  };

  const visualClass = variant === "icon"
    ? `absolute right-3 top-3 z-10 flex size-9 items-center justify-center rounded-full border border-border bg-surface/95 text-foreground shadow-sm backdrop-blur transition hover:border-accent-600 hover:text-accent-600 focus-visible:opacity-100 disabled:cursor-wait ${active ? "opacity-100" : "opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100"}`
    : "btn btn-outline min-h-11 flex-1 px-4";

  return (
    <button
      type="button"
      aria-label={`${action} ${productName} ${active ? "de" : "a"} favoritos`}
      aria-pressed={active}
      disabled={isPending}
      onClick={toggleFavorite}
      className={`${visualClass} ${className}`.trim()}
    >
      <Heart className={`size-4 shrink-0 transition-colors ${active ? "fill-accent-600 text-accent-600" : "text-current"}`} aria-hidden="true" />
      {variant === "label" && <span>{active ? "Quitar de favoritos" : "Añadir a favoritos"}</span>}
    </button>
  );
}
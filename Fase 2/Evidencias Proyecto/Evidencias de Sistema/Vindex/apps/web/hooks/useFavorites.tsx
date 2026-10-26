"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ToastProvider";

type FavoritesContextValue = {
  userId: string | null;
  favoriteIds: number[];
  favoriteCount: number;
  isLoading: boolean;
  isFavorite: (productId: number) => boolean;
  addFavorite: (productId: number) => Promise<boolean>;
  removeFavorite: (productId: number) => Promise<boolean>;
  removeFavoriteRecord: (favoriteId: string | number) => Promise<boolean>;
};

const FavoritesContext = createContext<FavoritesContextValue | null>(null);

async function fetchFavoriteIds(supabase: ReturnType<typeof createClient>, userId: string) {
  const { data, error } = await supabase
    .from("favorites")
    .select("product_id")
    .eq("user_id", userId);

  if (error) throw error;

  const rows = data ?? [];
  const ids = rows.flatMap((favorite) => {
    const productId = Number(favorite.product_id);
    return Number.isSafeInteger(productId) && productId > 0 ? [productId] : [];
  });
  return { ids, count: rows.length };
}

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const [supabase] = useState(createClient);
  const { showToast } = useToast();
  const [userId, setUserId] = useState<string | null>(null);
  const [favoriteIds, setFavoriteIds] = useState<number[]>([]);
  const [favoriteCount, setFavoriteCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isCurrent = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isCurrent) return;
      setUserId(session?.user.id ?? null);
    });

    void supabase.auth.getUser().then(({ data, error }) => {
      if (!isCurrent) return;
      if (error) {
        setUserId(null);
        setIsLoading(false);
        return;
      }
      setUserId(data.user?.id ?? null);
    });

    return () => {
      isCurrent = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    let isCurrent = true;
    if (!userId) {
      setFavoriteIds([]);
      setFavoriteCount(0);
      setIsLoading(false);
      return;
    }

    const loadFavorites = async () => {
      try {
        const result = await fetchFavoriteIds(supabase, userId);
        if (isCurrent) {
          setFavoriteIds(result.ids);
          setFavoriteCount(result.count);
        }
      } catch (error) {
        if (!isCurrent) return;
        console.error("No se pudieron cargar los favoritos:", error);
        showToast("No se pudieron cargar tus favoritos.", "error");
      } finally {
        if (isCurrent) setIsLoading(false);
      }
    };

    setIsLoading(true);
    void loadFavorites();

    const channel = supabase
      .channel(`favorites:${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "favorites", filter: `user_id=eq.${userId}` },
        () => void loadFavorites(),
      )
      .subscribe();

    return () => {
      isCurrent = false;
      void supabase.removeChannel(channel);
    };
  }, [showToast, supabase, userId]);

  const addFavorite = useCallback(async (productId: number) => {
    if (!userId) return false;
    if (favoriteIds.includes(productId)) return true;

    setFavoriteIds((current) => current.includes(productId) ? current : [...current, productId]);
    setFavoriteCount((current) => current + 1);
    const { error } = await supabase.from("favorites").insert({ user_id: userId, product_id: productId });
    if (error) {
      console.error("No se pudo agregar el favorito:", error);
      try {
        const result = await fetchFavoriteIds(supabase, userId);
        setFavoriteIds(result.ids);
        setFavoriteCount(result.count);
      } catch {
        setFavoriteIds((current) => current.filter((id) => id !== productId));
        setFavoriteCount((current) => Math.max(0, current - 1));
      }
      showToast("No se pudo agregar el producto a favoritos.", "error");
      return false;
    }

    showToast("Producto agregado a favoritos.", "success");
    return true;
  }, [favoriteIds, showToast, supabase, userId]);

  const removeFavorite = useCallback(async (productId: number) => {
    if (!userId) return false;

    setFavoriteIds((current) => current.filter((id) => id !== productId));
    setFavoriteCount((current) => Math.max(0, current - 1));
    const { error } = await supabase
      .from("favorites")
      .delete()
      .eq("user_id", userId)
      .eq("product_id", productId);
    if (error) {
      console.error("No se pudo quitar el favorito:", error);
      try {
        const result = await fetchFavoriteIds(supabase, userId);
        setFavoriteIds(result.ids);
        setFavoriteCount(result.count);
      } catch {
        setFavoriteIds((current) => current.includes(productId) ? current : [...current, productId]);
        setFavoriteCount((current) => current + 1);
      }
      showToast("No se pudo quitar el producto de favoritos.", "error");
      return false;
    }

    return true;
  }, [showToast, supabase, userId]);

  const removeFavoriteRecord = useCallback(async (favoriteId: string | number) => {
    if (!userId) return false;

    const { error } = await supabase
      .from("favorites")
      .delete()
      .eq("user_id", userId)
      .eq("id", favoriteId);
    if (error) {
      console.error("No se pudo quitar el favorito eliminado:", error);
      showToast("No se pudo quitar el favorito.", "error");
      return false;
    }

    setFavoriteCount((current) => Math.max(0, current - 1));
    return true;
  }, [showToast, supabase, userId]);

  const contextValue = useMemo<FavoritesContextValue>(() => ({
    userId,
    favoriteIds,
    favoriteCount,
    isLoading,
    isFavorite: (productId) => favoriteIds.includes(productId),
    addFavorite,
    removeFavorite,
    removeFavoriteRecord,
  }), [addFavorite, favoriteCount, favoriteIds, isLoading, removeFavorite, removeFavoriteRecord, userId]);

  return <FavoritesContext.Provider value={contextValue}>{children}</FavoritesContext.Provider>;
}

export function useFavorites() {
  const context = useContext(FavoritesContext);
  if (!context) throw new Error("useFavorites debe usarse dentro de FavoritesProvider.");
  return context;
}
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { IconMessageCircle } from "@/components/icons";
import { useToast } from "@/components/ToastProvider";
import { createClient } from "@/lib/supabase/client";

type MessageSellerButtonProps = {
  productId: number;
  sellerId: string;
  saleType: string | null;
};

export default function MessageSellerButton({
  productId,
  sellerId,
  saleType,
}: MessageSellerButtonProps) {
  const [supabase] = useState(createClient);
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { showToast } = useToast();
  const isDirectSale = saleType === "direct" || saleType === "fixed_price";

  useEffect(() => {
    let isCurrent = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (isCurrent) setUserId(session?.user.id ?? null);
    });

    void supabase.auth.getUser().then(({ data, error }) => {
      if (!isCurrent) return;
      if (error) {
        console.error("No se pudo verificar la sesión para mensajería:", error);
        showToast("No se pudo verificar tu sesión.", "error");
        setUserId(null);
        return;
      }
      setUserId(data.user?.id ?? null);
    });

    return () => {
      isCurrent = false;
      subscription.unsubscribe();
    };
  }, [showToast, supabase]);

  const openConversation = async () => {
    if (!userId || isLoading) return;
    setIsLoading(true);

    try {
      const findConversation = () => supabase
        .from("conversations")
        .select("id")
        .eq("product_id", productId)
        .eq("buyer_id", userId)
        .eq("seller_id", sellerId)
        .maybeSingle();

      const existing = await findConversation();
      if (existing.error) throw existing.error;

      let conversationId = existing.data?.id;
      if (!conversationId) {
        const created = await supabase
          .from("conversations")
          .insert({ product_id: productId, buyer_id: userId, seller_id: sellerId })
          .select("id")
          .single();

        if (created.error?.code === "23505") {
          const concurrentConversation = await findConversation();
          if (concurrentConversation.error) throw concurrentConversation.error;
          conversationId = concurrentConversation.data?.id;
        } else if (created.error) {
          throw created.error;
        } else {
          conversationId = created.data?.id;
        }
      }

      if (conversationId === null || conversationId === undefined) {
        throw new Error("La conversación se creó sin devolver su identificador.");
      }

      router.push(`/messages/${conversationId}`);
    } catch (error) {
      console.error("No se pudo abrir la conversación con el vendedor:", error);
      showToast("No se pudo iniciar la conversación. Inténtalo nuevamente.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  if (!isDirectSale || !userId || userId === sellerId) return null;

  return (
    <Button
      type="button"
      size="lg"
      className="min-h-11 flex-1 bg-brand-600 text-white hover:bg-brand-700"
      onClick={() => void openConversation()}
      disabled={isLoading}
    >
      <IconMessageCircle className="size-5" />
      {isLoading ? "Abriendo conversación..." : "Enviar mensaje al vendedor"}
    </Button>
  );
}

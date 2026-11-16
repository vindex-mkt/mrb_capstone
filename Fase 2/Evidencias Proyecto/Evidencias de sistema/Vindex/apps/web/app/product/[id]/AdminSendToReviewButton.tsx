"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { EyeOff } from "lucide-react";
import { useToast } from "@/components/ToastProvider";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

export default function AdminSendToReviewButton({ productId }: { productId: number }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [supabase] = useState(createClient);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const sendToReview = async () => {
    if (!window.confirm("¿Retirar esta publicación del sitio y enviarla a revisión administrativa?")) return;

    setIsSubmitting(true);
    try {
      const { error } = await supabase.rpc("moderate_product", {
        p_product_id: productId,
        p_action: "flagged",
        p_reason: "Retirado desde la ficha del producto para revisión administrativa.",
      });

      if (error) throw error;

      showToast("Publicación retirada y enviada a revisión prioritaria.", "success");
      router.push("/admin/moderation");
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : typeof error === "object" && error !== null && "message" in error && typeof error.message === "string"
          ? error.message
          : "No se pudo enviar la publicación a revisión.";
      showToast(message, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => void sendToReview()}
      disabled={isSubmitting}
      className="rounded-full border-border bg-surface text-muted-foreground hover:text-foreground"
      aria-label="Retirar la publicación y enviarla a revisión"
    >
      <EyeOff aria-hidden="true" />
      {isSubmitting ? "Enviando..." : "Enviar a revisión"}
    </Button>
  );
}

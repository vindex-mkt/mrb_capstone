import { notFound, redirect } from "next/navigation";
import { getProductBySlug } from "@/lib/supabase/queries";

export default async function ProductSlugRedirect({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();
  redirect(`/product/${product.id}`);
}
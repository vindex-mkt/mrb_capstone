import DailyOfferCarousel from "@/components/DailyOfferCarousel";
import { getDailyDeals } from "@/lib/supabase/queries";

export default async function DailyOffer() {
  const deals = await getDailyDeals();
  if (deals.length === 0) {
    return (
      <section className="flex h-full flex-col rounded-lg border border-border bg-surface p-5">
        <p className="eyebrow text-accent-600">Oferta especial</p>
        <h2 className="mt-1 text-xl font-extrabold text-foreground">Oferta del día</h2>
        <p className="mt-3 text-sm text-muted-foreground">No hay ofertas disponibles en este momento.</p>
      </section>
    );
  }

  return <DailyOfferCarousel deals={deals} />;
}
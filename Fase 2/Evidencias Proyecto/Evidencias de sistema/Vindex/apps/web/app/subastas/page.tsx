import AuctionCard from "@/components/auctions/AuctionCard";
import { getActiveAuctions } from "@/lib/supabase/queries";

export default async function AuctionsPage() {
  const auctions = await getActiveAuctions();

  return (
    <main className="min-h-screen bg-background">
      <section className="container-site py-8 sm:py-12">
        <div className="section-head">
          <div>
            <p className="eyebrow">Puja en tiempo real</p>
            <h1 className="section-title mt-1">Subastas activas</h1>
            <p className="mt-2 text-muted-foreground">
              Encuentra oportunidades y participa antes de que termine el tiempo.
            </p>
          </div>
        </div>

        {auctions.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
            {auctions.map((auction) => (
              <AuctionCard key={auction.id} auction={auction} />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-surface p-8 text-center">
            <h2 className="text-lg font-semibold text-foreground">No hay subastas activas</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Vuelve pronto para descubrir nuevas subastas.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}

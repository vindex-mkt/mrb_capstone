import Link from "next/link";
import AuctionCard from "@/components/auctions/AuctionCard";
import { getActiveAuctions } from "@/lib/supabase/queries";
import { IconChevronRight } from "@/components/icons";

export default async function PopularAuctions() {
  const auctions = (await getActiveAuctions()).slice(0, 4);
  if (auctions.length === 0) return null;

  return (
    <section className="border-y border-border bg-surface py-10 sm:py-12">
      <div className="container-site">
        <div className="section-head">
          <div>
            <p className="eyebrow">En vivo</p>
            <h2 className="section-title mt-1">Subastas populares</h2>
          </div>
          <Link href="/subastas" className="link-more">
            Ver todas
            <IconChevronRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-4">
          {auctions.map((auction) => (
            <AuctionCard key={auction.id} auction={auction} />
          ))}
        </div>
      </div>
    </section>
  );
}

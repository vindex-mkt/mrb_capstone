import { notFound } from "next/navigation";
import AuctionRoom from "@/components/auctions/AuctionRoom";
import { getAuctionBids, getAuctionById, getAuctionWinnerName } from "@/lib/supabase/queries";

export default async function AuctionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const productId = Number(id);

  if (!Number.isSafeInteger(productId) || productId <= 0) {
    notFound();
  }

  const product = await getAuctionById(productId);
  if (!product) notFound();

  const [bids, winnerName] = await Promise.all([
    getAuctionBids(product.id),
    getAuctionWinnerName(product.winner_id),
  ]);

  return (
    <main className="min-h-screen bg-background">
      <AuctionRoom
        key={product.id}
        initialProduct={product}
        initialBids={bids}
        initialWinnerName={winnerName}
      />
    </main>
  );
}

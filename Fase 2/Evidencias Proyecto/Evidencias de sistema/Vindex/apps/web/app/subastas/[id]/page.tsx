import { notFound } from "next/navigation";
import AuctionRoom from "@/components/auctions/AuctionRoom";
import { getAuctionBids, getAuctionById, getAuctionWinnerName } from "@/lib/supabase/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function AuctionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const productId = Number(id);

  if (!Number.isSafeInteger(productId) || productId <= 0) {
    notFound();
  }

  const product = await getAuctionById(productId);
  if (!product) notFound();

  const isClosed = product.auction_ends_at
    ? new Date(product.auction_ends_at).getTime() <= Date.now()
    : false;

  if (isClosed) {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || user.id !== product.seller_id) notFound();
  }

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

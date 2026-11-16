import Link from "next/link";
import { AuctionCountdown } from "@/components/auctions/AuctionCountdown";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { formatAuctionAmount, getProductImage, type AuctionProduct } from "@/lib/product-utils";

export default function AuctionCard({ auction }: { auction: AuctionProduct }) {
  const currentAmount = auction.current_bid ?? auction.starting_price;
  const image = getProductImage(auction);
  const name = auction.name ?? "Subasta sin nombre";

  return (
    <Link
      href={`/subastas/${auction.id}`}
      className="block h-full rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Card className="h-full gap-0 py-0 transition hover:-translate-y-1 hover:shadow-lg">
        <div className="relative aspect-[4/3] overflow-hidden bg-muted">
          <img src={image} alt={name} loading="lazy" className="h-full w-full object-cover" />
          <Badge className="absolute left-3 top-3 bg-accent-600 text-white">Subasta</Badge>
        </div>
        <CardContent className="flex flex-1 flex-col gap-3 p-4">
          <h2 className="line-clamp-2 min-h-12 font-semibold text-foreground">{name}</h2>
          <div>
            <p className="text-sm text-muted-foreground">Oferta actual</p>
            <p className="text-xl font-extrabold tracking-tight text-foreground">
              {formatAuctionAmount(currentAmount)}
            </p>
          </div>
          <AuctionCountdown endsAt={auction.auction_ends_at} showStatus />
        </CardContent>
        <CardFooter className="border-t border-border p-4">
          <span className="btn btn-outline h-9 w-full">Ver subasta</span>
        </CardFooter>
      </Card>
    </Link>
  );
}

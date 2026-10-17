import { Star } from "lucide-react";

export default function RatingStars({ rating }: { rating: number }) {
  const safeRating = Number.isFinite(rating) ? Math.min(5, Math.max(0, rating)) : 0;
  const roundedRating = Math.round(safeRating);

  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${safeRating.toFixed(1)} de 5 estrellas`}>
      {Array.from({ length: 5 }, (_, index) => (
        <Star
          key={index}
          aria-hidden="true"
          className={`size-4 ${index < roundedRating ? "fill-amber-400 text-amber-500" : "text-muted-foreground"}`}
        />
      ))}
    </span>
  );
}

"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface ProductGalleryProps {
  images: string[];
  alt: string;
}

export default function ProductGallery({ images, alt }: ProductGalleryProps) {
  const safeImages = images.length > 0 ? images : ["https://picsum.photos/seed/vindex-product/600/600"];
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    setSelectedIndex(0);
  }, [images.length]);

  const goToPrevious = () => {
    setSelectedIndex((prev) => (prev === 0 ? safeImages.length - 1 : prev - 1));
  };

  const goToNext = () => {
    setSelectedIndex((prev) => (prev === safeImages.length - 1 ? 0 : prev + 1));
  };

  const selectImage = (index: number) => {
    setSelectedIndex(index);
  };

  return (
    <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
      <div className="relative aspect-square overflow-hidden bg-muted">
        <img
          src={safeImages[selectedIndex]}
          alt={alt}
          className="h-full w-full object-contain"
        />

        {safeImages.length > 1 && (
          <>
            <button
              type="button"
              aria-label="Ver imagen anterior"
              onClick={goToPrevious}
              className="absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-surface/85 text-foreground shadow-sm backdrop-blur transition hover:border-brand-300 hover:text-brand-700"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              aria-label="Ver imagen siguiente"
              onClick={goToNext}
              className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-surface/85 text-foreground shadow-sm backdrop-blur transition hover:border-brand-300 hover:text-brand-700"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        )}
      </div>

      {safeImages.length > 1 && (
        <div className="grid grid-cols-4 gap-2 border-t border-border bg-muted/20 p-3">
          {safeImages.slice(0, 4).map((image, index) => (
            <button
              key={`${image}-${index}`}
              type="button"
              aria-label={`Seleccionar imagen ${index + 1}`}
              onClick={() => selectImage(index)}
              className={`aspect-square overflow-hidden rounded-xl border bg-card transition ${
                selectedIndex === index ? "border-brand-500 ring-2 ring-brand-200" : "border-border"
              }`}
            >
              <img src={image} alt={`${alt} ${index + 1}`} className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

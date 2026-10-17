import FeaturedProducts from "@/components/FeaturedProducts";
import DailyOffer from "@/components/DailyOffer";
import LatestProducts from "@/components/LatestProducts";
import PopularAuctions from "@/components/PopularAuctions";
import AllProducts from "@/components/AllProducts";
import PopularStores from "@/components/PopularStores";

export default function Home() {
  return (
    <main className="min-h-screen bg-background">
      {/* Navbar principal(en layout.tsx) */}
      {/* Navegación secundaria(en layout.tsx) */}

      {/* Productos destacados */}
      <FeaturedProducts />

      {/* Oferta del día + últimas publicaciones */}
      <section className="container-site grid grid-cols-1 gap-6 py-8 lg:grid-cols-3">
        {/* Oferta del día */}
        <div className="lg:col-span-1">
          <DailyOffer />
        </div>

        {/* Últimas publicaciones */}
        <div className="lg:col-span-2">
          <LatestProducts />
        </div>
      </section>

      {/* Subastas populares */}
      <PopularAuctions />

      {/* Todas las publicaciones */}
      <AllProducts />

      {/* Tiendas populares */}
      <PopularStores />
    </main>
  );
}
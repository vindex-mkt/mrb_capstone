import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Gavel, ShieldCheck, Zap, Users } from "lucide-react";

const values = [
  {
    icon: Gavel,
    title: "Compra con intención",
    description:
      "Encuentra productos únicos o participa en subastas en tiempo real con información clara para decidir mejor.",
  },
  {
    icon: ShieldCheck,
    title: "Confianza en cada paso",
    description:
      "Protegemos el proceso con pagos en custodia y validación física mediante OTP para que ambas partes estén tranquilas.",
  },
  {
    icon: Zap,
    title: "Una experiencia ágil",
    description:
      "Conectamos compradores y vendedores de Chile con una plataforma rápida, simple y pensada para volver cada día.",
  },
  {
    icon: Users,
    title: "Una comunidad que crece",
    description:
      "Apoyamos a tiendas y emprendedores para que construyan su vitrina digital y encuentren nuevos clientes.",
  },
];

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-background">
      <section className="overflow-hidden bg-brand-950 text-white">
        <div className="container-site relative py-16 sm:py-24">
          <div className="max-w-3xl">
            <p className="eyebrow text-brand-200">Sobre Vindex</p>
            <h1 className="mt-4 text-4xl font-extrabold tracking-tight sm:text-6xl">
              El lugar donde cada objeto encuentra una nueva historia.
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-brand-100 sm:text-lg">
              Vindex es el marketplace chileno que reúne productos, tiendas y
              subastas en una experiencia diseñada para comprar y vender con
              confianza.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/shop" className="btn btn-light h-11 px-5">
                Explorar marketplace
              </Link>
              <Link
                href="/signup"
                className="btn h-11 border border-brand-300/50 px-5 text-white hover:bg-brand-900"
              >
                Crear una cuenta
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="py-12 sm:py-16">
        <div className="container-site">
          <div className="max-w-2xl">
            <p className="eyebrow">Nuestra misión</p>
            <h2 className="section-title mt-2">
              Hacer que comprar y vender se sienta más humano.
            </h2>
            <p className="mt-5 text-base leading-7 text-muted-foreground">
              Creemos que un marketplace debe ser más que un catálogo. Por eso
              creamos herramientas que acercan a las personas, dan visibilidad
              a los negocios locales y hacen que cada transacción sea clara de
              principio a fin.
            </p>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {values.map(({ icon: Icon, title, description }) => (
              <Card key={title} className="h-full">
                <CardContent className="p-6">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                    <Icon aria-hidden="true" className="h-5 w-5" />
                  </div>
                  <h3 className="mt-5 text-lg font-bold text-foreground">
                    {title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-border bg-brand-50/70 py-12 sm:py-16">
        <div className="container-site grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <p className="eyebrow">Vindex para todos</p>
            <h2 className="section-title mt-2">
              Tu próxima gran compra está más cerca.
            </h2>
            <p className="mt-4 max-w-2xl text-muted-foreground">
              Descubre oportunidades, apoya a vendedores locales y participa en
              una comunidad que transforma la manera de intercambiar productos.
            </p>
          </div>
          <Link href="/shop" className="btn btn-primary h-11 px-5">
            Comenzar a explorar
          </Link>
        </div>
      </section>
    </main>
  );
}
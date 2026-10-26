import Link from "next/link";
import {
  IconShieldCheck,
  IconTruck,
  IconTag,
  IconStore,
  IconClock,
} from "@/components/icons";

const groups = [
  {
    title: "Marketplace",
    links: [
      { label: "Productos", href: "/tienda" },
      { label: "Subastas", href: "/subastas" },
      { label: "Tiendas", href: "/tiendas" },
      { label: "Ofertas del día", href: "/ofertas" },
      { label: "Categorías", href: "/tienda" },
    ],
  },
  {
    title: "Ayuda",
    links: [
      { label: "Centro de ayuda", href: "/ayuda" },
      { label: "Envíos y entregas", href: "/envios-y-entregas" },
      { label: "Devoluciones", href: "/devoluciones" },
      { label: "Métodos de pago", href: "/metodos-de-pago" },
      { label: "Estado de mi compra", href: "/profile" },
    ],
  },
  {
    title: "Vindex",
    links: [
      { label: "Sobre nosotros", href: "/about" },
      { label: "Términos y condiciones", href: "/terminos-y-condiciones" },
      { label: "Privacidad", href: "/privacidad" },
      { label: "Política de OTP", href: "/politica-otp" },
      { label: "Trabaja con nosotros", href: "/trabaja-con-nosotros" },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="mt-16 bg-foreground text-white">
      <div className="container-site py-12 sm:py-14">
        {/* Franja de confianza */}
        <div className="mb-12 grid gap-4 rounded-2xl bg-white/5 p-6 ring-1 ring-white/10 sm:grid-cols-3">
          {[
            {
              icon: <IconShieldCheck className="h-5 w-5 text-brand-300" />,
              title: "Compra protegida",
              text: "Custodia del pago hasta confirmar la entrega.",
            },
            {
              icon: <IconTruck className="h-5 w-5 text-brand-300" />,
              title: "Envío a todo Chile",
              text: "Seguimiento del pedido en cada paso.",
            },
            {
              icon: <IconTag className="h-5 w-5 text-brand-300" />,
              title: "Validación con OTP",
              text: "Validación física segura al recibir tu producto.",
            },
          ].map((item) => (
            <div key={item.title} className="flex gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10">
                <span aria-hidden="true">{item.icon}</span>
              </span>
              <div>
                <p className="text-sm font-bold">{item.title}</p>
                <p className="mt-0.5 text-sm text-white/70">{item.text}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Columnas */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-12">
          {/* Marca */}
          <div className="col-span-2 md:col-span-4">
            <Link
              href="/"
              className="flex items-center gap-2.5 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 focus-visible:ring-offset-2 focus-visible:ring-offset-foreground"
            >
              <img
                src="/logo.png"
                alt="Logo de Vindex"
                className="mx-left h-20 w-auto object-contain"
              />
            </Link>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/70">
              El marketplace chileno donde comprar, vender y pujar en vivo es
              simple y seguro. Con custodia de pagos y validación física mediante OTP.
            </p>
            <ul
              aria-label="Funciones de Vindex"
              className="mt-6 flex flex-wrap gap-x-4 gap-y-2 text-xs text-white/70"
            >
              <li className="inline-flex items-center gap-1.5">
                <IconStore aria-hidden="true" className="h-4 w-4 text-brand-300" />
                <span>Tiendas personalizadas</span>
              </li>
              <li className="inline-flex items-center gap-1.5">
                <IconClock aria-hidden="true" className="h-4 w-4 text-brand-300" />
                <span>Subastas en vivo</span>
              </li>
              <li className="inline-flex items-center gap-1.5">
                <IconShieldCheck aria-hidden="true" className="h-4 w-4 text-brand-300" />
                <span>Compra protegida</span>
              </li>
            </ul>
          </div>

          {/* Enlaces */}
          {groups.map((group) => (
            <div key={group.title} className="md:col-span-2">
              <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-brand-200">
                {group.title}
              </h3>
              <ul className="mt-4 space-y-2.5">
                {group.links.map(({ label, href }) => (
                  <li key={label}>
                    <Link
                      href={href}
                      className="rounded-sm text-sm text-white/80 transition hover:text-brand-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 focus-visible:ring-offset-2 focus-visible:ring-offset-foreground"
                    >
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Barra inferior */}
      <div className="border-t border-white/10">
        <div className="container-site flex flex-col items-center justify-between gap-3 py-6 text-sm text-white/70 sm:flex-row">
          <p>© {new Date().getFullYear()} Vindex · Hecho en Chile</p>
          <div className="flex flex-wrap justify-center gap-6">
            <Link
              href="/privacidad"
              className="rounded-sm transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 focus-visible:ring-offset-2 focus-visible:ring-offset-foreground"
            >
              Privacidad
            </Link>
            <Link
              href="/terminos-y-condiciones"
              className="rounded-sm transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 focus-visible:ring-offset-2 focus-visible:ring-offset-foreground"
            >
              Términos
            </Link>
            <Link
              href="/privacidad#cookies"
              className="rounded-sm transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 focus-visible:ring-offset-2 focus-visible:ring-offset-foreground"
            >
              Cookies
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

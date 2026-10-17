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
    links: ["Productos", "Subastas", "Tiendas", "Ofertas del día", "Categorías"],
  },
  {
    title: "Ayuda",
    links: ["Centro de ayuda", "Envíos y entregas", "Devoluciones", "Métodos de pago", "Estado de mi compra"],
  },
  {
    title: "Vindex",
    links: ["Sobre nosotros", "Términos y condiciones", "Privacidad", "Política de OTP", "Trabaja con nosotros"],
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
              title: "Precios con OTP",
              text: "Validación física segura al recibir tu producto.",
            },
          ].map((item) => (
            <div key={item.title} className="flex gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10">
                {item.icon}
              </span>
              <div>
                <p className="text-sm font-bold">{item.title}</p>
                <p className="mt-0.5 text-sm text-white/60">{item.text}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Columnas */}
        <div className="grid gap-10 md:grid-cols-12">
          {/* Marca */}
          <div className="md:col-span-4">
            <Link href="/" className="flex items-center gap-2.5">
              <img 
                src="logo.png" 
                alt="Logo de Vindex" 
                className="mx-left h-20 w-auto object-contain" 
             />
            </Link>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/60">
              El marketplace chileno donde comprar, vender y pujar en vivo es
              simple y seguro. Con custodia de pagos y validación física mediante OTP.
            </p>
            <div className="mt-6 flex items-center gap-2 text-xs text-white/60">
              <IconStore className="h-4 w-4" />
              <IconClock className="h-4 w-4" />
              <IconShieldCheck className="h-4 w-4" />
            </div>
          </div>

          {/* Enlaces */}
          {groups.map((group) => (
            <div key={group.title} className="md:col-span-2">
              <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-white/40">
                {group.title}
              </h3>
              <ul className="mt-4 space-y-2.5">
                {group.links.map((link) => (
                  <li key={link}>
                    <Link
                      href={link === "Sobre nosotros" ? "/about" : "#"}
                      className="text-sm text-white/70 transition hover:text-brand-300"
                    >
                      {link}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {/* Newsletter */}
          <div className="md:col-span-2">
            <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-white/40">
              Novedades
            </h3>
            <p className="mt-4 text-sm text-white/60">
              Ofertas y nuevas subastas, directo a tu correo.
            </p>
            <div className="mt-4" aria-label="Suscripción a novedades">
              <input
                type="email"
                placeholder="tu@correo.cl"
                aria-label="Tu correo"
                className="w-full rounded-xl border border-white/15 bg-white/10 px-4 py-2.5 text-sm text-white outline-none transition placeholder:text-white/40 focus:border-brand-400 focus:ring-2 focus:ring-brand-500/40"
              />
              <button type="button" className="btn btn-light mt-3 w-full py-2.5">
                Suscribirme
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Barra inferior */}
      <div className="border-t border-white/10">
        <div className="container-site flex flex-col items-center justify-between gap-3 py-6 text-sm text-white/50 sm:flex-row">
          <p>© {new Date().getFullYear()} Vindex · Hecho en Chile</p>
          <div className="flex gap-6">
            <Link href="#" className="transition hover:text-white">
              Privacidad
            </Link>
            <Link href="#" className="transition hover:text-white">
              Términos
            </Link>
            <Link href="#" className="transition hover:text-white">
              Cookies
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

'use client';
import Link from "next/link";
import { usePathname } from 'next/navigation';
import { IconBolt } from "@/components/icons";

// 1. Definimos la estructura de los enlaces en un arreglo limpio
const NAV_LINKS = [
  { href: "/", label: "Inicio", className: "my-1.5 rounded-full text-brand-700" },
  { href: "/tienda", label: "Tienda", className: "my-1.5 rounded-full text-brand-700" },
  { href: "/subastas", label: "Subastas", className: "my-1.5 rounded-full text-brand-700" },
  { href: "/categorias", label: "Categorías", className: "my-1.5 rounded-full text-brand-700" },
  { 
    href: "/ofertas", 
    label: "Ofertas", 
    className: "text-accent-600 hover:text-accent-700 rounded-full",
    icon: <IconBolt className="h-3.5 w-3.5" /> 
  },
];

export default function SecondaryNavbar() {
  const pathname = usePathname();

  return (
    <nav className="border-b border-border bg-surface">
      <div className="container-site flex items-center gap-1 overflow-x-auto no-scrollbar">
        {NAV_LINKS.map((link) => {
          const isActive = pathname === link.href;

          return (
            <Link
              key={link.href}
              href={link.href}
              className={`nav-tab ${link.className || ""} ${
                isActive ? "bg-brand-400 text-white" : ""
              }`}
            >
              {/* link.icon */}
              {link.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

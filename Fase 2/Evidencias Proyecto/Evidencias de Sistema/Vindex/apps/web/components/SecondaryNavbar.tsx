"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { ChevronDown, ChevronRight } from "lucide-react";
import { IconBolt } from "@/components/icons";
import { createClient } from "@/lib/supabase/client";

type ProductCategory = { id: string; name: string };

const NAV_LINKS = [
  { href: "/", label: "Inicio", className: "my-1.5 rounded-full text-brand-700" },
  { href: "/tienda", label: "Tienda", className: "my-1.5 rounded-full text-brand-700" },
  { href: "/subastas", label: "Subastas", className: "my-1.5 rounded-full text-brand-700" },
];

export default function SecondaryNavbar() {
  const pathname = usePathname();
  const [supabase] = useState(createClient);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [categoryError, setCategoryError] = useState("");

  useEffect(() => {
    let isCurrent = true;

    const loadCategories = async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("id, name")
        .order("name", { ascending: true });

      if (!isCurrent) return;
      if (error) {
        setCategoryError(error.message);
        setCategoriesLoading(false);
        return;
      }

      setCategories((data ?? []) as ProductCategory[]);
      setCategoriesLoading(false);
    };

    void loadCategories();
    return () => {
      isCurrent = false;
    };
  }, [supabase]);

  return (
    <nav aria-label="Navegación principal" className="relative z-50 border-b border-border bg-surface">
      <div className="container-site relative flex flex-nowrap items-center gap-1 overflow-x-auto no-scrollbar md:overflow-x-visible">
        {NAV_LINKS.map((link) => {
          const isActive = pathname === link.href;

          return (
            <Link
              key={link.href}
              href={link.href}
              className={`nav-tab inline-flex shrink-0 items-center whitespace-nowrap ${link.className || ""} ${
                isActive ? "bg-brand-400 text-white" : ""
              }`}
            >
              {link.label}
              </Link>
          );
        })}
        <div className="group relative">
          <Link
            href="/tienda"
            aria-haspopup="true"
            className="nav-tab inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full text-brand-700"
          >
            Categorías
            <ChevronDown className="h-4 w-4 transition-transform group-hover:rotate-180 group-focus-within:rotate-180" aria-hidden="true" />
          </Link>
          <div className="invisible absolute left-0 top-full z-50 mt-1 w-72 translate-y-1 rounded-2xl border border-border bg-surface p-3 opacity-0 shadow-xl transition duration-200 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100">
            <div className="mb-2 border-b border-border px-3 pb-3">
              <p className="text-sm font-semibold text-foreground">Explorar categorías</p>
              <p className="mt-1 text-xs text-muted-foreground">Encuentra productos por categoría</p>
            </div>
            <div className="max-h-72 overflow-y-auto">
              {categoryError ? (
                <p role="alert" className="px-3 py-2 text-sm text-red-700">
                  No se pudieron cargar las categorías: {categoryError}
                </p>
              ) : categoriesLoading ? (
                <p role="status" className="px-3 py-2 text-sm text-muted-foreground">
                  Cargando categorías...
                </p>
              ) : categories.length === 0 ? (
                <p className="px-3 py-2 text-sm text-muted-foreground">
                  No hay categorías disponibles.
                </p>
              ) : (
                categories.map((category) => (
                  <Link
                    key={category.id}
                    href={`/tienda?categoryId=${encodeURIComponent(category.id)}`}
                    className="group/item flex items-center justify-between rounded-xl px-3 py-2 text-sm text-foreground transition hover:bg-brand-50 hover:text-brand-700 focus-visible:bg-brand-50 focus-visible:text-brand-700 focus-visible:outline-none"
                  >
                    <span>{category.name}</span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground transition group-hover/item:translate-x-0.5 group-hover/item:text-brand-700" aria-hidden="true" />
                  </Link>
                ))
              )}
            </div>
            <Link
              href="/tienda"
              className="mt-2 flex items-center justify-center rounded-xl bg-brand-50 px-3 py-2.5 text-sm font-semibold text-brand-700 transition hover:bg-brand-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
            >
              Ver todas las categorías
            </Link>
          </div>
        </div>
        <Link
          href="/ofertas"
          className={`nav-tab inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap my-1.5 rounded-full text-accent-600 hover:text-accent-700 ${
            pathname === "/ofertas" ? "bg-brand-400 text-white" : ""
          }`}
        >
          <IconBolt className="h-3.5 w-3.5" />
          Ofertas
        </Link>
      </div>
    </nav>
  );
}

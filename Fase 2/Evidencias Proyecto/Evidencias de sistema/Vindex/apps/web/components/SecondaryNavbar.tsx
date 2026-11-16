"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, LoaderCircle } from "lucide-react";
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
  const router = useRouter();
  const [isNavigating, startNavigation] = useTransition();
  const [supabase] = useState(createClient);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [categoryError, setCategoryError] = useState("");
  const [categoriesOpen, setCategoriesOpen] = useState(false);

  const navigate = (href: string) => {
    setCategoriesOpen(false);
    startNavigation(() => router.push(href));
  };

  useEffect(() => {
    setCategoriesOpen(false);
  }, [pathname]);

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
    <nav aria-label="Navegación principal" className="relative z-40 border-b border-border bg-surface">
      <div className="container-site relative flex flex-wrap items-center gap-1 md:flex-nowrap">
        {NAV_LINKS.map((link) => {
          const isActive = pathname === link.href;

          return (
            <Link
              key={link.href}
              href={link.href}
              onClick={(event) => {
                event.preventDefault();
                navigate(link.href);
              }}
              className={`nav-tab inline-flex shrink-0 items-center whitespace-nowrap px-1.5 md:px-4 ${link.className || ""} ${
                isActive ? "bg-brand-400 text-white" : ""
              }`}
            >
              {link.label}
            </Link>
          );
        })}
        <div
          className="group relative"
          onKeyDown={(event) => {
            if (event.key === "Escape") setCategoriesOpen(false);
          }}
        >
          <button
            type="button"
            aria-haspopup="true"
            aria-expanded={categoriesOpen}
            aria-controls="secondary-navbar-categories"
            onClick={() => setCategoriesOpen((open) => !open)}
            className="nav-tab inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-1.5 text-brand-700 md:px-4"
          >
            Categorías
            <ChevronDown
              className={`h-4 w-4 transition-transform ${categoriesOpen ? "rotate-180" : ""} md:group-hover:rotate-180`}
              aria-hidden="true"
            />
          </button>
          <div
            id="secondary-navbar-categories"
            data-menu-open={categoriesOpen}
            className="invisible absolute left-0 top-full z-50 mt-1 w-[min(18rem,calc(100vw-2rem))] translate-y-1 rounded-2xl border border-border bg-surface p-3 opacity-0 shadow-xl transition duration-200 data-[menu-open=true]:visible data-[menu-open=true]:translate-y-0 data-[menu-open=true]:opacity-100 md:w-72 md:group-hover:visible md:group-hover:translate-y-0 md:group-hover:opacity-100"
          >
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
                    aria-busy={isNavigating}
                    onClick={(event) => {
                      event.preventDefault();
                      navigate(`/tienda?categoryId=${encodeURIComponent(category.id)}`);
                    }}
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
          onClick={(event) => {
            event.preventDefault();
            navigate("/ofertas");
          }}
          className={`nav-tab my-1.5 inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-1.5 text-accent-600 hover:text-accent-700 md:px-4 ${
            pathname === "/ofertas" ? "bg-brand-400 text-white" : ""
          }`}
        >
          <IconBolt className="h-3.5 w-3.5" />
          Ofertas
        </Link>
      </div>
      {isNavigating && (
        <div
          className="fixed inset-0 z-[100] grid place-items-center bg-surface/60 backdrop-blur-sm"
          role="status"
          aria-live="polite"
        >
          <LoaderCircle className="h-12 w-12 animate-spin text-brand-600" aria-hidden="true" />
          <span className="sr-only">Cargando página...</span>
        </div>
      )}
    </nav>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { ChevronDown } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import CartNavButton from "@/components/cart/CartNavButton";
import { useFavorites } from "@/hooks/useFavorites";
import {
  IconHeart,
  IconMessageCircle,
  IconPlus,
  IconSearch,
  IconUser,
} from "@/components/icons";

const getAccountName = (user: User | null) => {
  if (!user) return null;

  const fullName = user.user_metadata?.full_name;
  const firstName = user.user_metadata?.first_name;

  if (typeof fullName === "string" && fullName.trim()) return fullName.trim();
  if (typeof firstName === "string" && firstName.trim()) return firstName.trim();
  return user.email ?? "Mi perfil";
};

export default function Navbar() {
  const [search, setSearch] = useState("");
  const router = useRouter();
  const [supabase] = useState(createClient);
  const [accountName, setAccountName] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const { favoriteCount } = useFavorites();

  useEffect(() => {
    let isCurrent = true;

    const loadUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (isCurrent) setAccountName(getAccountName(user));
    };

    void loadUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setAccountName(getAccountName(session?.user ?? null));
      setAuthError(null);
      if (!session) setMenuOpen(false);
    });

    return () => {
      isCurrent = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  const handleSignOut = async () => {
    setSigningOut(true);
    setAuthError(null);

    const { error } = await supabase.auth.signOut();

    setSigningOut(false);

    if (error) {
      setAuthError(error.message);
      return;
    }

    router.push("/");
    router.refresh();
  };

  const searchField = () => (
    <div className="relative w-full">
      <IconSearch className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Buscar productos, tiendas o subastas…"
        aria-label="Buscar productos, tiendas o subastas"
        className="search-input"
      />
      <button
        type="button"
        className="absolute right-1.5 top-1/2 flex h-8 -translate-y-1/2 items-center rounded-full bg-brand-600 px-4 text-sm font-semibold text-white transition hover:bg-brand-700"
      >
        Buscar
      </button>
    </div>
  );

  return (
    <header className="sticky top-0 z-50">
      {/* Barra de confianza 

      <div className="hidden bg-foreground text-white lg:block">
        <div className="container-site flex h-9 items-center justify-between text-xs">
          <p className="flex items-center gap-1.5 font-medium text-white/80">
            <IconShieldCheck className="h-3.5 w-3.5 text-brand-400" />
            Compra protegida Vindex · Validación física mediante OTP
          </p>
          <div className="flex items-center gap-6">
            <span className="flex items-center gap-1.5 text-white/80">
              <IconTruck className="h-3.5 w-3.5 text-brand-400" />
              Envíos a todo Chile
            </span>
            <a href="#" className="font-medium text-white/80 transition hover:text-white">
              Centro de ayuda
            </a>
          </div>
        </div>
      </div>
      
      */}
      {/* Cabecera principal */}
      <div className="border-b border-border bg-surface/95 backdrop-blur">
        <div className="container-site">
          <div className="flex h-16 items-center gap-3 sm:h-20 sm:gap-5">
            {/* Logo */}
            <Link href="/" className="flex shrink-0 items-center gap-2.5" aria-label="Vindex, ir al inicio">
              <img 
                src="/logo.png" 
                alt="Logo de Vindex" 
                className="mx-auto h-20 w-auto object-contain" 
             />
            </Link>

            {/* Buscador (escritorio) */}
            <div className="hidden flex-1 md:block">{searchField()}</div>

            {/* Acciones */}
            <div className="ml-auto flex items-center gap-1 sm:gap-2">
              {accountName ? (
                <div
                  className="group relative flex items-center"
                  data-menu-open={menuOpen}
                  onBlur={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                      setMenuOpen(false);
                    }
                  }}
                >
                  <Link
                    href="/profile"
                    className="flex max-w-36 items-center gap-2 rounded-l-full py-2 pl-3 pr-1 text-sm font-semibold text-foreground transition hover:bg-brand-50 hover:text-brand-700"
                  >
                    <IconUser className="h-5 w-5 shrink-0" />
                    <span className="max-w-24 truncate sm:max-w-36">{accountName}</span>
                  </Link>
                  <button
                    type="button"
                    aria-label="Opciones de cuenta"
                    aria-expanded={menuOpen}
                    onClick={() => setMenuOpen((open) => !open)}
                    className="rounded-r-full py-2 pl-1 pr-3 text-foreground transition hover:bg-brand-50 hover:text-brand-700"
                  >
                    <ChevronDown className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <div className="invisible absolute right-0 top-full z-50 w-48 translate-y-1 rounded-md border border-border bg-surface p-1 opacity-0 shadow-lg transition group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100 data-[menu-open=true]:visible data-[menu-open=true]:translate-y-0 data-[menu-open=true]:opacity-100">
                    <Link
                      href="/profile"
                      className="block rounded px-3 py-2 text-sm text-foreground transition hover:bg-brand-50 hover:text-brand-700"
                    >
                      Mi perfil
                    </Link>
                    <Link
                      href="/messages"
                      className="flex items-center gap-2 rounded px-3 py-2 text-sm text-foreground transition hover:bg-brand-50 hover:text-brand-700"
                    >
                      <IconMessageCircle className="h-4 w-4" />
                      Mensajes
                    </Link>
                    <div aria-hidden="true" className="mx-2 my-2 border-t border-border" />
                    <button
                      type="button"
                      onClick={handleSignOut}
                      disabled={signingOut}
                      className="block w-full rounded px-3 py-2 text-left text-sm text-foreground transition hover:bg-brand-50 hover:text-brand-700 disabled:opacity-60"
                    >
                      {signingOut ? "Cerrando sesión..." : "Cerrar sesión"}
                    </button>
                    {authError && <p role="alert" className="px-3 py-2 text-xs text-red-700">{authError}</p>}
                  </div>
                </div>
              ) : (
                <Link
                  href="/login"
                  className="hidden items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold text-foreground transition hover:bg-brand-50 hover:text-brand-700 lg:flex"
                >
                  <IconUser className="h-5 w-5" />
                  Ingresar
                </Link>
              )}

              <Link href="/favorites" className="icon-btn h-10 w-10" aria-label={`Mis favoritos, ${favoriteCount} productos`}>
                <IconHeart className="h-5 w-5" />
                {favoriteCount > 0 && <span className="count-badge">{favoriteCount > 99 ? "99+" : favoriteCount}</span>}
              </Link>

              <CartNavButton />

              <Link href="/vender" className="btn btn-primary hidden h-10 px-4 sm:inline-flex">
                <IconPlus className="h-4 w-4" />
                Vender
              </Link>
            </div>
          </div>

          {/* Buscador (móvil) */}
          <div className="pb-3 md:hidden">{searchField()}</div>
        </div>
      </div>
    </header>
  );
}
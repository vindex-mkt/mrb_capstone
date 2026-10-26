import Link from "next/link";

export default function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border bg-surface">
        <div className="container-site flex min-h-16 flex-wrap items-center justify-between gap-3 py-3">
          <div>
            <p className="eyebrow">Vindex</p>
            <p className="font-semibold text-foreground">Administración</p>
          </div>
          <nav aria-label="Administración" className="flex items-center gap-4 text-sm font-medium">
            <Link href="/admin/categories" className="text-brand-700 hover:text-brand-800">Categorías</Link>
            <Link href="/" className="text-muted-foreground hover:text-foreground">Volver a la tienda</Link>
          </nav>
        </div>
      </header>
      {children}
    </main>
  );
}
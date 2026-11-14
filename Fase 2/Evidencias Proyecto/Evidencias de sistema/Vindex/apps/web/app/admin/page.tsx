import Link from "next/link";

const adminSections = [
  {
    title: "Categorías",
    description: "Administra las categorías del catálogo y la taxonomía del marketplace.",
    href: "/admin/categories",
  },
  {
    title: "Moderación",
    description: "Revisa productos pendientes, rechazados o marcados para priorizar su aprobación.",
    href: "/admin/moderation",
  },
  {
    title: "Tienda",
    description: "Prepara futuras herramientas de gestión comercial y de inventario.",
    href: "/",
  },
];

export default function AdminDashboardPage() {
  return (
    <main className="container-site space-y-8 py-8 sm:py-10">
      <header className="space-y-3">
        <p className="eyebrow">Administración</p>
        <h1 className="text-3xl font-bold text-foreground">Panel central</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Desde aquí se centraliza la administración del marketplace, incluyendo categorías, moderación de productos y futuras operaciones comerciales.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        {adminSections.map((section) => (
          <Link
            key={section.href}
            href={section.href}
            className="rounded-2xl border border-border bg-surface p-5 shadow-card transition hover:border-brand-300 hover:shadow-md"
          >
            <div className="mb-3 inline-flex rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700">
              Módulo
            </div>
            <h2 className="text-xl font-semibold text-foreground">{section.title}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{section.description}</p>
          </Link>
        ))}
      </section>
    </main>
  );
}

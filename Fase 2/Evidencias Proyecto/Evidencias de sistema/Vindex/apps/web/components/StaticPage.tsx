import type { StaticPageContent } from "@/components/static-pages/content";

export type StaticPageSection = {
	id?: string;
	title: string;
	paragraphs: string[];
	bullets?: string[];
};

type StaticPageProps = StaticPageContent;

export default function StaticPage({
	title,
	description,
	sections,
	isDraft = false,
}: StaticPageProps) {
	return (
		<main className="min-h-screen bg-background">
			<section className="bg-brand-950 text-white">
				<div className="container-site py-12 sm:py-16">
					<div className="max-w-3xl">
						<p className="eyebrow text-brand-200">Información Vindex</p>
						<h1 className="mt-4 text-4xl font-extrabold tracking-tight sm:text-5xl">
							{title}
						</h1>
						<p className="mt-5 text-base leading-7 text-brand-100 sm:text-lg">
							{description}
						</p>
						<p className="mt-4 text-sm text-brand-200">
							Actualizado el 26 de octubre de 2026
						</p>
						{isDraft && (
							<p className="mt-5 rounded-xl border border-brand-300/40 bg-brand-900/60 p-4 text-sm leading-6 text-white">
								Borrador para un proyecto universitario: este contenido es
								referencial y debe ser revisado por el equipo antes de
								publicarse como política oficial.
							</p>
						)}
					</div>
				</div>
			</section>

			<section className="py-10 sm:py-14">
				<div className="container-site">
					<div className="max-w-3xl space-y-8">
						{sections.map((section) => (
							<section
								key={section.title}
								id={section.id}
								className="scroll-mt-24"
							>
								<h2 className="text-xl font-bold text-foreground">
									{section.title}
								</h2>
								{section.paragraphs.map((paragraph) => (
									<p
										key={paragraph}
										className="mt-3 text-base leading-7 text-muted-foreground"
									>
										{paragraph}
									</p>
								))}
								{section.bullets && (
									<ul className="mt-3 list-disc space-y-2 pl-6 text-base leading-7 text-muted-foreground">
										{section.bullets.map((bullet) => (
											<li key={bullet}>{bullet}</li>
										))}
									</ul>
								)}
							</section>
						))}
					</div>
				</div>
			</section>
		</main>
	);
}

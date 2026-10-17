# 🎨 Sistema de diseño — Vindex (apps/web)

> Reglas de estilo obligatorias para todo el sitio web.
> Si una página nueva no respeta estas reglas, **no debe mergearse**.

Este sistema de diseño está implementado en:

| Archivo | Contenido |
| --- | --- |
| `app/globals.css` | Tokens (`@theme`), estilos base y **clases reutilizables** |
| `components/icons.tsx` | Iconos SVG de la marca (usar en vez de emojis) |
| `components/ProductCard.tsx` | Tarjeta de producto estándar |
| `app/layout.tsx` | Fuente Geist y metadatos globales |

---

## 1. Principios

1. **Texto legible siempre.** Nunca usar `text-gray-300/400/500` para texto sobre blanco a menos que sea decorativo. Texto secundario = `text-muted-foreground` (`#4b5563`, cumple WCAG AA).
2. **Usar tokens, no valores sueltos.** Prohibido inventar hex o repetir estilos inline: todo color/radio/sombra sale de `@theme`.
3. **Reutilizar antes que duplicar.** Si una tarjeta de producto se repite, usa `ProductCard`. Si un icono es necesario, agrégalo a `icons.tsx`.
4. **Una sola fuente de verdad.** `globals.css` centraliza los estilos; las clases `.container-site`, `.card`, `.btn-*`, etc. deben usarse tal cual.
5. **Mobile first y responsive.** Toda sección se prueba desde 360 px.
6. **El sitio es claro por diseño.** No reintroducir overrides de `prefers-color-scheme: dark` que rompan el contraste (bug histórico del repo).

---

## 2. Tokens de color

Los tokens generan utilidades Tailwind automáticamente (`bg-brand-600`, `text-muted-foreground`, `border-border`, `ring-brand-600`, etc.).

### Marca (violeta) — acciones, enlaces, foco
`--color-brand-*`: 50 `#f5f3ff` · 100 `#ede9fe` · 200 `#ddd6fe` · 300 `#c4b5fd` · 400 `#a78bfa` · 500 `#8b5cf6` · **600 `#7c3aed` (principal)** · **700 `#6d28d9` (hover/texto)** · 800 `#5b21b6` · 900 `#4c1d95` · 950 `#2e1065`

- CTA principal: `bg-brand-600` con `hover:bg-brand-700`.
- Enlaces / texto interactivo: `text-brand-700` (`hover:text-brand-800`).
- Tintes de fondo: `bg-brand-50` y `bg-brand-50/70`.

### Acento (rojo) — señales de urgencia
`--color-accent-*`: **600 `#dc2626`** para badges de descuento, "EN VIVO" y contadores. **No** usar para CTAs principales.

### Semánticos
| Token | Valor | Uso |
| --- | --- | --- |
| `background` | `#f6f7f9` | Fondo general de página |
| `surface` | `#ffffff` | Tarjetas, inputs, barras |
| `foreground` | `#111827` | Títulos y texto principal |
| `muted` | `#f3f4f6` | Fondo de imágenes placeholder |
| `muted-foreground` | `#4b5563` | **Texto secundario (AA)** |
| `border` | `#e5e7eb` | Bordes por defecto |
| `ring` | `#7c3aed` | Foco accesible |

### Contraste mínimo (WCAG AA)
| Uso | Sobre fondo | Color |
| --- | --- | --- |
| Texto principal | blanco | `foreground` `#111827` |
| Texto secundario | blanco | `muted-foreground` `#4b5563` |
| Texto principal | violeta (hero) | blanco `#fff` |
| Texto sobre hero | violeta | `brand-100` / `brand-200` |

---

## 3. Tipografía

- **Fuente:** Geist (cargada con `next/font` en `layout.tsx`). No importar fuentes nuevas sin aprobarse.
- El `<body>` aplica `font-sans` (mapeado a Geist en `@theme`).
- Jerarquía por roles:

| Rol | Clase |
| --- | --- |
| Título de sección | `.section-title` (`text-2xl sm:text-3xl font-extrabold tracking-tight`) |
| Sobretítulo ("kicker") | `.eyebrow` (uppercase, `text-brand-600`) |
| Texto base | hereda de `body` → `text-foreground` |
| Texto secundario | `text-muted-foreground` |
| Enlace "Ver todos" | `.link-more` |
| Precios | `text-lg/xl font-extrabold tracking-tight text-foreground` |

---

## 4. Layout y espaciado

- Toda sección va dentro de `.container-site` (ancho máximo `max-w-7xl`, padding responsive `px-4 sm:px-6 lg:px-8`).
- Ritmo vertical: secciones separadas por `py-10 sm:py-12`; encabezado de sección con `.section-head` (`mb-6 sm:mb-8`).
- Grillas: usar `grid` con `gap-3 sm:gap-5` en tarjetas pequeñas; nunca forzar una sola columna con `lg:` sin probar primero el base mobile.
- Banda de sección completa (ej. subastas): `border-y border-border bg-surface`; bandas tintadas: `bg-brand-50/70`.

---

## 5. Componentes reutilizables (clases en globals.css)

| Clase | Uso |
| --- | --- |
| `.container-site` | Contenedor principal |
| `.card` | Tarjeta (`rounded-2xl border bg-surface`) |
| `.btn` + `.btn-primary` | CTA principal violeta |
| `.btn` + `.btn-outline` | Acción secundaria |
| `.btn` + `.btn-light` | CTA claro sobre fondos de color |
| `.icon-btn` | Botón circular de icono (+ `.count-badge` para contadores) |
| `.input` | Campo de formulario |
| `.search-input` | Buscador (icono izq. + botón der.) |
| `.badge` + `.badge-accent` / `.badge-overlay` / `.badge-soft` | Etiquetas |
| `.eyebrow`, `.section-title`, `.section-head`, `.link-more` | Texto de sección |
| `.nav-tab` | Pestañas de navegación |
| `.no-scrollbar` | Navs horizontales sin scrollbar visible |

### Patrón estándar de una sección

```tsx
<section className="py-10 sm:py-12">
  <div className="container-site">
    <div className="section-head">
      <div>
        <p className="eyebrow">Kicker</p>
        <h2 className="section-title mt-1">Título de la sección</h2>
      </div>
      <a href="#" className="link-more">Ver todos</a>
    </div>

    <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
      <ProductCard name="..." price="$..." image="..." />
    </div>
  </div>
</section>
```

---

## 6. Iconos

- **No usar emojis como iconos de UI** (🔍🛒♡🏪…). Usar `components/icons.tsx`.
- Los iconos heredan `currentColor`, así que se colorean con utilidades de texto (`text-brand-700`).
- Todos los botones/links con icono decorativo llevan `aria-label`.

```tsx
import { IconSearch } from "@/components/icons";

<button aria-label="Buscar" className="icon-btn">
  <IconSearch className="h-5 w-5" />
</button>
```

---

## 7. Imágenes

- Usar `loading="lazy"` en imágenes fuera del primer viewport y siempre `alt` descriptivo.
- Contenedor con `aspect-*` (`aspect-square`, `aspect-[4/3]`) + `object-cover` para evitar saltos de layout.
- En el repo se usan imágenes de demostración de `picsum.photos` con `seed` estable. Al conectar datos reales, reemplazar por las URLs del backend manteniendo el mismo patrón de contenedor.

---

## 8. Check-list antes de un PR con UI

- [ ] Texto secundario con `muted-foreground` (nunca gris claro sobre blanco).
- [ ] Toda la página envuelta en `.container-site`.
- [ ] Sin emojis de iconos; sin hex inventados; sin estilos inline.
- [ ] Estados `hover` y `focus-visible` (ring de marca) presentes en elementos interactivos.
- [ ] Prueba en 360 px y escritorio.
- [ ] Se reutilizó `ProductCard` / clases del sistema en vez de duplicar markup.
- [ ] Cambio de UI documentado aquí si modifica tokens o añade componentes.

## 9. Superficies de subastas

- El catálogo y las tarjetas de subasta reutilizan los tokens y componentes shadcn/ui existentes (`Card`, `Badge`, `Button`, `Input`).
- El componente `AuctionCountdown` representa días, horas, minutos y segundos; usa el tono de urgencia cuando quedan tres minutos o menos.
- Las tarjetas y la sala usan imágenes públicas de `products.images`; las nuevas cargas de producto se convierten a WebP en el flujo de publicación.
- Solo el detalle de una subasta presenta datos en vivo. Los listados muestran datos iniciales y temporizadores locales sin abrir conexiones Realtime.

# Vindex

Marketplace de productos orientado al mercado chileno que integra catálogo y tiendas personalizadas, subastas, mensajería, pagos de integración y validación de entregas mediante OTP.

## Descripcion

Vindex conecta vendedores independientes, microempresarios, artistas y creadores con compradores y coleccionistas. Resuelve la informalidad de canales como redes sociales, ofreciendo publicación de productos, carrito sincronizado, búsqueda, conversaciones y checkout Webpay Plus Mall en ambiente sandbox.

La plataforma incluye actualmente:

- Registro e inicio de sesión con Supabase Auth.
- Tiendas, perfiles y administración de publicaciones.
- Catálogo, categorías, ofertas y carrito sincronizado.
- Mensajería y notificaciones.
- Subastas con Supabase Realtime y reglas de puja en base de datos.
- Checkout Webpay Plus Mall exclusivo para integración, sin cobros reales.
- OTP de retiro presencial para confirmar la entrega; no libera fondos ni sustituye una implementación de custodia.
- Panel administrativo, moderación y métricas financieras simuladas.

## Tecnologias

| Area | Tecnologias |
|---|---|
| Monorepo | npm workspaces, Turborepo |
| Web | Next.js 16, React 19, TypeScript, Tailwind CSS |
| Mobile | React Native, Expo, Expo Router |
| Base de datos | PostgreSQL gestionado mediante Supabase |
| Servicios Supabase | Auth, Storage, Realtime y RPC |
| Pagos | Webpay Plus Mall con `transbank-sdk` en ambiente de integracion |
| Nube | Supabase; la web puede alojarse en plataformas compatibles con Next.js, como Vercel |
| Pruebas | Vitest, Supertest y pruebas Node.js integradas |

No se utiliza Docker ni existen actualmente Dockerfile o `docker-compose.yml`. El despliegue local equivalente usa Node.js/npm y un proyecto Supabase configurado.

## Requisitos

- Node.js 22.18 o superior.
- npm 11.19 o superior.
- Git.
- Proyecto Supabase con las tablas, migraciones, RPC, RLS y funciones necesarias.
- Credenciales oficiales de integracion de Webpay Plus Mall para probar pagos.
- Android Studio, Xcode o Expo Go solo si se ejecuta la app movil.

## Ejecutar localmente

### 1. Instalar

```powershell
git clone <URL_DEL_REPOSITORIO>
cd Vindex
npm install
```

### 2. Configurar Supabase

Crear `apps/web/.env.local` con las variables publicas necesarias:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=<URL_DEL_PROYECTO_SUPABASE>
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<CLAVE_PUBLICABLE_SUPABASE>
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Para checkout y operaciones privilegiadas se requieren variables privadas solamente en el servidor:

```dotenv
SUPABASE_SERVICE_ROLE_KEY=<CLAVE_SECRETA_DE_SERVICIO>
TRANSBANK_ENV=integration
TRANSBANK_API_KEY=<API_KEY_DE_INTEGRACION>
TRANSBANK_COMMERCE_CODE=<CODIGO_DE_COMERCIO_MALL>
TRANSBANK_CHILD_COMMERCE_CODE_1=<CODIGO_COMERCIO_HIJOS_1>
TRANSBANK_CHILD_COMMERCE_CODE_2=<CODIGO_COMERCIO_HIJOS_2>
```

No agregues claves secretas ni credenciales reales al repositorio ni uses variables `NEXT_PUBLIC_*` para secretos. Revisa `apps/web/.env.local` antes de compartirlo y elimina cualquier valor privado.

Aplicar las migraciones de `supabase/migrations/` necesarias en el proyecto Supabase. Para checkout, leer primero `docs/WEBPAY_PLUS_MALL.md`.

### 3. Levantar la aplicacion web

Desde la raiz del monorepo:

```powershell
npm run dev
```

Abrir [http://localhost:3000](http://localhost:3000).

Tambien puede iniciarse directamente:

```powershell
cd apps/web
npm run dev
```

### 4. Levantar la app movil

La app movil es independiente de la carpeta web:

```powershell
cd apps/mobile
npm install
npx expo start
```

Seleccionar Android, iOS o web desde la terminal de Expo.

### 5. Comandos de calidad

Desde la raiz:

```powershell
npm run lint
npm run check-types
npm run build
```

Pruebas web de checkout:

```powershell
npm run test:checkout --workspace=web
```

## Variables de entorno

| Variable | Alcance | Uso |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Navegador y servidor | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Navegador y servidor | Clave publicable de Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Solo servidor | Operaciones privilegiadas y Webpay |
| `NEXT_PUBLIC_SITE_URL` | Navegador y servidor | URL base y retorno HTTPS |
| `TRANSBANK_ENV` | Solo servidor | Debe ser `integration` |
| `TRANSBANK_API_KEY` | Solo servidor | Credencial sandbox de Transbank |
| `TRANSBANK_COMMERCE_CODE` | Solo servidor | Comercio Mall |
| `TRANSBANK_CHILD_COMMERCE_CODE_1/2` | Solo servidor | Comercios vendedores hijo |

## Equipo

| Integrante | Rol en el proyecto |
|---|---|
| Renato Astargo | Product Owner & Scrum Master |
| Bryan Aravena | Frontend & QA Lead |
| Maximiliano Vargas | LeadBackend, Database |

Los roles específicos de especialidad pueden completarse según la asignación real de tareas en el seguimiento del equipo.

## Metodologia de trabajo

El equipo utiliza **Scrum**. Se planifican Sprints, se prioriza un Product Backlog, se ejecutan Sprint Backlogs y se realizan revisiones y retrospectivas. La Definition of Done exige desarrollo, control de cambios, migraciones y pruebas antes de considerar una historia terminada.

## Arquitectura

Vindex es un monorepo con una aplicacion web principal Next.js y aplicaciones complementarias:

```text
Cliente web (Next.js)
  -> Supabase Auth / PostgreSQL / Storage / Realtime
  -> Rutas servidor Next.js -> Webpay Plus Mall sandbox

Cliente movil (React Native/Expo)
  -> Supabase

```

La persistencia principal es PostgreSQL mediante Supabase. Las pujas y el reloj de subastas se sincronizan con Supabase Realtime y las reglas sensibles se ejecutan mediante RPC y migraciones SQL.

- [Arquitectura tecnica](docs/ARCHITECTURE.md)
- [Modelo de datos](docs/DATABASE.md)
- [Decisiones arquitectonicas](docs/DECISIONS.md)
- [Funcionalidades](docs/FEATURES.md)
- [Integracion Webpay](docs/WEBPAY_PLUS_MALL.md)
- [Subastas](docs/subastas.md)
- [Autenticacion](docs/AUTHENTICATION.md)

## Documentacion del proyecto

```text
README.md
docs/
├── 01-product-vision.md
├── 02-product-backlog.md
├── 03-sprint-backlogs.md
├── 04-definition-of-done.md
├── 05-documento-diseno.md
├── 06-retrospectivas.md
├── 07-plan-pruebas-evidencias.md
├── 08-manual-tecnico-despliegue.md
└── 09-cierre-e-innovacion.md
```

La documentacion tecnica existente se conserva como detalle complementario. Los documentos anteriores sobre vision, backlog, sprints y DoD han sido consolidados en la estructura numerada.

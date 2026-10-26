# AGENTS.md

## Proyecto

Marketplace orientado al mercado chileno que combina:

- Marketplace de productos
- Tiendas personalizadas
- Sistema de subastas en tiempo real
- Custodia de pagos
- Validación física mediante OTP
- Aplicación web
- Aplicación móvil.

---

# Arquitectura

El proyecto utiliza un Monorepo administrado con Turborepo.

## Aplicaciones

/apps/web
Next.js.
Aplicación web del marketplace.

/apps/mobile
React Native + Expo.
Aplicación móvil para iOS y Android.

/apps/api
NestJS.
Backend principal y API.

---

# Packages compartidos

/packages/types
Tipos TypeScript compartidos.

/packages/api-client
Cliente para comunicarse con la API.

/packages/validation
Validaciones compartidas.

/packages/ui
Componentes reutilizables cuando sea posible.

---

# Tecnologías principales

Frontend Web:
- Next.js
- React
- TypeScript
- Tailwind CSS

Mobile:
- React Native
- Expo
- TypeScript

Backend:
- Node.js
- NestJS
- TypeScript

Base de datos:
- PostgreSQL

Tiempo real:
- Redis
- WebSocket
- Socket.io

---

# Reglas de desarrollo

1. Utilizar TypeScript.
2. No utilizar JavaScript salvo que sea estrictamente necesario.
3. Mantener separación entre Web, Mobile y API.
4. Reutilizar tipos desde @marketplace/types.
5. No duplicar modelos entre aplicaciones.
6. No colocar lógica de negocio dentro de componentes visuales.
7. Las funcionalidades del backend deben organizarse por módulos.
8. No almacenar secretos en el repositorio.
9. No modificar la arquitectura sin documentar la decisión.
10. Antes de crear una nueva dependencia, comprobar si ya existe una solución dentro del proyecto.

---

# UI (apps/web)

Todo el trabajo de interfaz web debe seguir el sistema de diseño en:

apps/web/DESIGN_SYSTEM.md

Reglas mínimas:
- Usar los tokens y clases reutilizables de apps/web/app/globals.css.
- Texto legible: nunca gris claro sobre blanco (usar tokens text-muted-foreground).
- No usar emojis como iconos de UI (usar components/icons.tsx).
- Reutilizar components/ProductCard.tsx en vez de duplicar tarjetas.

---

# Subastas

Las subastas utilizan comunicación en tiempo real.

El flujo principal es:

Cliente
↓
WebSocket
↓
NestJS
↓
Auction Service
↓
Redis
↓
PostgreSQL

No implementar lógica de subastas directamente en Next.js o React Native.

---

# Base de datos

PostgreSQL es la fuente principal de persistencia.

Redis se utiliza para:

- Estado temporal de subastas
- Operaciones de alta velocidad
- Cache
- Sesiones cuando corresponda

---

# Git

No trabajar directamente sobre main.

Utilizar ramas:

feature/*
fix/*
refactor/*
docs/*
chore/*

Los commits deben utilizar Conventional Commits.

Ejemplos:

feat: add auction creation
fix: validate bid amount
docs: update architecture
refactor: simplify auction service

## Documentación obligatoria

Cuando una modificación cambie:

- arquitectura
- API
- base de datos
- flujo de negocio
- tecnologías
- estructura de carpetas
- funcionalidades

la documentación correspondiente debe actualizarse
en el mismo Pull Request.
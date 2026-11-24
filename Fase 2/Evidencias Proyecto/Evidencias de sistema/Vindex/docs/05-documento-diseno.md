# Documento de diseño

## Arquitectura general

```text
Navegador/Aplicacion movil
            |
            v
Next.js / Expo
            |
            v
Supabase: Auth + PostgreSQL + Storage + Realtime
            |
            v
Rutas servidor Next.js -> Transbank Integration
```

## Componentes

- `apps/web`: aplicación marketplace y rutas API de servidor.
- `apps/mobile`: cliente Expo para futuro despliegue móvil.
- `apps/api`: proyecto NestJS base; no sustituye las rutas web actuales.
- `packages/types`, `packages/ui`, `packages/validation`: paquetes compartidos.
- `supabase/migrations`: esquema, RPC, RLS y lógica de base de datos.

## Flujo principal

1. Supabase Auth identifica al usuario.
2. Catálogo y carrito consultan PostgreSQL.
3. El servidor valida productos, stock y precios.
4. Webpay crea y confirma el checkout en sandbox.
5. La base de datos actualiza la orden y su stock.
6. Realtime publica cambios de subastas y mensajes.

Consultar [ARCHITECTURE.md](./ARCHITECTURE.md), [DATABASE.md](./DATABASE.md) y [DECISIONS.md](./DECISIONS.md).

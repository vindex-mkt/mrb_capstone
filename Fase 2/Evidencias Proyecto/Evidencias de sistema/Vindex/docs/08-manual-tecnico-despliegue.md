# Manual tecnico y despliegue

## Estado de contenedores

El proyecto no incluye Docker actualmente. No existen Dockerfile ni `docker-compose.yml`, por lo que el equivalente es instalar Node.js/npm y ejecutar el monorepo directamente.

## Requisitos

- Node.js >=22.18.0.
- npm >=11.19.0.
- Proyecto Supabase configurado.
- Migraciones aplicadas.
- Variables privadas disponibles solamente en el servidor.

## Variables

Las variables públicas y privadas se describen en el README y en [WEBPAY_PLUS_MALL.md](./WEBPAY_PLUS_MALL.md). En producción `NEXT_PUBLIC_SITE_URL` debe usar HTTPS.

## Ejecución local

```powershell
npm install
npm run dev
```

Abrir `http://localhost:3000`.

## Despliegue web

1. Configurar el root del proyecto como el monorepo o `apps/web`.
2. Configurar Node.js compatible y comando de build.
3. Configurar las variables públicas y privadas.
4. Aplicar las migraciones requeridas en Supabase.
5. Ejecutar lint, typecheck y build.
6. Registrar URL verificable y evidencia del despliegue.

Docker queda documentado como mejora futura: deberá añadirse una estrategia de Dockerfiles, compose y secretos solo después de probar el entorno Supabase y las variables.

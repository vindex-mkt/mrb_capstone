# Arquitectura

## Tipo de arquitectura

El proyecto utiliza una arquitectura de Monorepo con aplicaciones
independientes y paquetes compartidos.

## Aplicaciones

Web
→ Next.js

Mobile
→ React Native + Expo

Backend
→ NestJS

## Comunicación

Web / Mobile
↓
REST API
↓
NestJS

Web / Mobile
↓
WebSocket
↓
NestJS

## Moderación de productos

Se mantiene el estado comercial existente en `products.status` para no romper la lógica actual de publicación y comercio. Además, se incorpora un estado de moderación separado basado en `products.moderation_status` con los valores `pending_review`, `approved`, `rejected` y `flagged`.

El flujo es:

- Una regla textual valida título, descripción, categoría y etiquetas antes de publicar.
- Si no encuentra reglas de riesgo, el producto queda `approved` y se publica automáticamente cuando el vendedor eligió publicarlo (estado comercial activo).
- Una coincidencia sospechosa deja el producto oculto y `pending_review`; una coincidencia de alto riesgo lo deja oculto y `flagged` para priorizar la revisión.
- La detección automática no rechaza productos: el administrador revisa la cola en `/admin/moderation` y decide aprobar, marcar o rechazar.
- Un producto aprobado solo aparece si también está comercialmente activo.
- El historial de decisiones se guarda en `product_moderation_reviews` para conservar trazabilidad y futuras integraciones con IA.

La estructura está preparada para añadir luego detectores por imagen, categoría o revisión manual sin reemplazar el flujo actual de publicación.
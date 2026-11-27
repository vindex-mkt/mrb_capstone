# Modelo de datos

Vindex utiliza PostgreSQL mediante Supabase como fuente principal de persistencia. El modelo separa usuarios, tiendas, publicaciones, operaciones de compra, pagos, subastas y moderación.

El esquema completo versionado se encuentra en [supabase_schema.md](./supabase_schema.md). Las políticas RLS y las funciones deben verificarse en el proyecto Supabase configurado; las vistas o RPC remotas pueden diferir si una migración no fue aplicada.

## Entidades principales

| Entidad | Propósito |
|---|---|
| `profiles` | Datos de perfil y rol de cada usuario autenticado |
| `stores` | Tienda administrada por un vendedor |
| `store_categories` | Categorías internas de una tienda |
| `categories` | Categorías públicas de publicaciones |
| `products` | Productos, publicaciones destacadas y subastas |
| `carts` | Carrito persistido de un usuario |
| `cart_items` | Líneas del carrito y cantidades |
| `bids` | Pujas asociadas a subastas |
| `favorites` | Publicaciones marcadas como favoritas |
| `conversations` | Conversaciones entre comprador y vendedor |
| `messages` | Mensajes enviados dentro de una conversación |
| `orders` | Órdenes de compra y estado de entrega |
| `order_items` | Líneas de producto dentro de una orden |
| `reviews` | Calificaciones realizadas por compradores |

## Entidades de pagos y entrega

| Entidad | Propósito |
|---|---|
| `payment_transactions` | Transacción Mall principal de Webpay |
| `payment_subtransactions` | Transacción individual por comercio vendedor |
| `product_ad_transactions` | Pago sandbox de publicidad de publicaciones |
| `order_escrows` | Custodia simulada o virtual asociada a una orden |
| `order_seller_chats` | Coordinación de retiro y respuesta de vendedores |
| `user_wallets` | Saldo disponible y saldo bloqueado |
| `wallet_topup_transactions` | Recargas Webpay Plus y conciliación del saldo |
| `auction_guarantees` | Garantía reservada para participar en subastas |
| `auction_guarantee_forfeitures` | Distribución auditable de garantías de ganadores que no pagaron |
| `order_commissions` | Registro de comisión por línea pagada |

## Entidades de administración

| Entidad | Propósito |
|---|---|
| `notifications` | Notificaciones de compra, venta y mensajes |
| `product_moderation_reviews` | Historial de decisiones administrativas |
| `product_detection_results` | Resultados de detectores automáticos o revisión manual |
| `product_reports` | Reportes de usuarios sobre publicaciones |

## Relaciones principales

```text
auth.users
  ├── profiles
  ├── stores
  ├── carts ── cart_items ── products
  ├── bids ────────────────── products
  ├── favorites ───────────── products
  ├── conversations ───────── messages
  ├── orders ── order_items ── products
  ├── user_wallets
  └── wallet_topup_transactions

stores
  ├── store_categories
  └── products

orders
  ├── payment_transactions ── payment_subtransactions
  ├── order_escrows
  ├── order_seller_chats
  └── order_commissions

products
  ├── bids
  ├── reviews
  ├── conversations
  ├── product_ad_transactions
  ├── product_reports
  └── moderación y detecciones
```

## Productos y subastas

`products` concentra productos de venta directa y subastas. Los identificadores de tienda y categoría pueden combinarse con las tablas `stores`, `store_categories` y `categories`.

Los campos principales del modelo son:

- Venta directa: `price`, `discount_price`, `offer_ends_at`, `stock`.
- Subasta: `starting_price`, `current_bid`, `bid_increment`, `auction_ends_at`, `winner_id`.
- Publicación: `status`, `moderation_status`, `images`, `is_featured`, `featured_until`.
- Tipo de temporización: `auction_mode` (`standard` o `demo`).
- Propiedad: `seller_id` y, cuando corresponde, `store_id`.

Las pujas se registran en `bids`. `bid_increment` debe ser al menos el valor que calcula `calculate_auction_bid_increment()` desde `starting_price`; el vendedor puede elegir un monto mayor. El trigger de `products` impone ese piso. Las migraciones `supabase/migrations/20261127010000_auction_bid_increment.sql` y `supabase/migrations/20261127020000_auction_bid_increment_minimum.sql` mantienen esta regla y actualizan subastas existentes sin reducir incrementos superiores. El cliente no debe insertar pujas directamente: debe invocar la RPC transaccional `place_bid`, respaldada por validaciones y triggers de PostgreSQL. La hora del servidor se obtiene mediante `get_server_time`.

## Carrito y órdenes

`carts` tiene una fila por usuario. `cart_items` relaciona el carrito con `products` y conserva la cantidad.

`orders` representa la compra y `order_items` sus líneas. Los precios persistidos y los stocks deben validarse en el servidor; el navegador no debe ser la fuente de verdad del importe.

Los métodos de entrega admitidos son `standard` y `pickup`. El retiro puede asociar OTP y chats de coordinación por vendedor. Una orden de subasta guarda el producto, precio final, garantía aplicada, saldo pendiente y fecha límite; la garantía no se vuelve a cobrar como parte de Webpay.

Cada producto de subasta puede generar una sola orden ganadora. Las transacciones Webpay pueden tener varios intentos para esa orden, por lo que `payment_transactions.order_id` no es único; la aplicación usa el intento más reciente para mostrar el estado.

## Webpay Plus Mall

`payment_transactions` representa el pago Mall y `payment_subtransactions` representa los comercios vendedores hijos. Los estados deben registrarse desde el servidor después de confirmar la respuesta de Transbank.

Las operaciones privilegiadas se realizan mediante RPC disponibles principalmente para `service_role`. Los detalles completos del flujo, conciliación y escenarios de prueba están en [WEBPAY_PLUS_MALL.md](./WEBPAY_PLUS_MALL.md).

Las recargas de billetera usan una transacción Webpay Plus (no Mall) y se registran en `wallet_topup_transactions`. Solo la confirmación del servidor contra Transbank puede acreditar el monto a `user_wallets`; los errores ambiguos quedan en revisión y bloquean otro intento hasta conciliarse.

## Supabase Auth y seguridad

Los usuarios existen en `auth.users`. `profiles`, tiendas, órdenes y conversaciones mantienen referencias a esos usuarios o perfiles.

La seguridad aplicativa requiere:

- Políticas RLS para carrito, órdenes, mensajes, billetera y datos privados.
- Restricción de funciones administrativas y de pago a roles autorizados.
- Uso exclusivo del servidor para `SUPABASE_SERVICE_ROLE_KEY`.
- Validación de relaciones, montos y stock desde Supabase o RPC.
- Realtime habilitado para tablas que deben publicar cambios al cliente.

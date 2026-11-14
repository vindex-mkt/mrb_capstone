# Features

## Autenticación

Status: 🟡 En desarrollo

- [x] Registro
- [x] Login con correo y contraseña
- [x] Recuperación de contraseña mediante enlace de Supabase Auth
- [x] Cargar y guardar datos del perfil en metadatos del usuario de Supabase Auth
- [x] Logout
- [ ] KYC

El flujo de recuperación y la configuración de URLs permitidas están documentados en [AUTHENTICATION.md](./AUTHENTICATION.md).

---

## Marketplace

Status: 🟡 En desarrollo

- [x] Crear producto
- [x] Exigir al menos una imagen al publicar un producto
- [x] Buscar productos por coincidencias parciales en el nombre o la descripción
- [x] Editar publicaciones propias desde el perfil de vendedor
- [x] Asignar o corregir la categoría de una publicación al editarla
- [x] Filtrar productos por categoría desde la tienda y el menú de navegación
- [x] Crear y renovar ofertas con vencimiento
- [x] Consultar las ofertas activas en una página dedicada y abrir el detalle de cada producto
- [x] Listar publicaciones activas ordenadas por fecha en la portada
- [x] Mensajería entre compradores y vendedores para productos de compra directa
- [x] Carrito sincronizado y persistido para productos de compra directa
- [x] Checkout Webpay Plus Mall en sandbox con máximo dos comercios vendedores por compra
- [x] Impedir que un vendedor compre sus propios productos
- [x] Solicitar publicidad al publicar y activar el destacado solo tras autorización de Webpay sandbox
- [x] Comprar o extender publicidad para publicaciones activas desde el perfil del vendedor
- [x] Historial de compras del comprador y calificación de productos comprados
- [ ] Eliminar producto

---

## Mensajería

- [x] Iniciar o reutilizar una conversación desde el detalle de un producto de compra directa
- [x] Abrir el acceso a mensajería desde las publicaciones recientes y solicitar login cuando sea necesario
- [x] Listar conversaciones con el nombre de la otra parte y el producto asociado
- [x] Abrir una conversación desde su notificación y acceder al producto desde el encabezado del chat
- [x] Cargar historial, enviar mensajes y recibir inserciones mediante Supabase Realtime
- [x] Restringir el acceso a las conversaciones y mensajes mediante las políticas RLS existentes

---

## Notificaciones

- [x] Mostrar una campana en el navbar de escritorio y móvil, antes de favoritos
- [x] Notificar compras confirmadas al comprador y nuevas ventas al vendedor
- [x] Notificar mensajes entrantes al otro participante de la conversación
- [x] Actualizar notificaciones en tiempo real y permitir marcarlas como leídas
- [x] Restringir la consulta y actualización de notificaciones a su propietario
- [ ] Notificaciones de pujas superadas y resultados de subastas

Las notificaciones se crean en la base de datos al confirmar una orden o insertar un mensaje. Aplicar `supabase/migrations/20261113190000_notifications.sql` para crear la tabla y los triggers, y `supabase/migrations/20261113223700_enrich_message_notifications.sql` para incluir el nombre del remitente, el producto asociado y el enlace directo a la conversación.

---

## Subastas

Status: 🔴 Pendiente

- [ ] Crear subasta
- [ ] Unirse a subasta
- [ ] Realizar puja
- [ ] Actualización en tiempo real
- [ ] Finalización automática
- [ ] Notificación de puja superada

---

## Pagos

Status: 🟡 Integración sandbox disponible; requiere configurar y aplicar la migración de Supabase

- [x] Checkout Webpay Plus Mall de integración, sin cobros reales
- [x] Creación de órdenes y subtransacciones desde el servidor con validación de stock y comercios
- [x] Confirmación individual de subtransacciones y estados para pagos aprobados, parciales y rechazados
- [x] Límite de dos comercios vendedores distintos en frontend y servidor
- [x] Bloqueo del uso de `process_mock_checkout` por clientes
- [x] Pagos de publicidad con Webpay Plus de integración, sin cobros reales
- [x] Publicación conservada sin destacar si el pago de publicidad se rechaza o cancela
- [x] Consulta de saldo disponible y congelado de la billetera en web
- [x] Accesos a billetera y operaciones desde el navbar de escritorio y móvil
- [x] Simulación de recarga con selección de Webpay Plus o Mercado Pago
- [ ] Recargas reales de billetera
- [ ] Solicitudes y desembolsos de retiros
- [ ] Integración productiva de pasarela (el checkout actual solo usa credenciales de integración)
- [ ] Custodia
- [ ] Liberación de fondos
- [ ] Comisión

La configuración del entorno, la migración requerida y los casos de prueba están documentados en [WEBPAY_PLUS_MALL.md](./WEBPAY_PLUS_MALL.md).
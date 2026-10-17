# Features

## Autenticación

Status: 🟡 En desarrollo

- [x] Registro
- [x] Login con correo y contraseña
- [x] Cargar y guardar datos del perfil en metadatos del usuario de Supabase Auth
- [x] Logout
- [ ] Recuperación de contraseña
- [ ] KYC

---

## Marketplace

Status: 🟡 En desarrollo

- [x] Crear producto
- [x] Editar publicaciones propias desde el perfil de vendedor
- [x] Crear y renovar ofertas con vencimiento
- [x] Listar publicaciones activas ordenadas por fecha en la portada
- [x] Mensajería entre compradores y vendedores para productos de compra directa
- [x] Carrito sincronizado y persistido para productos de compra directa
- [x] Checkout simulado con selección de dirección, envío y método de pago
- [x] Historial de compras del comprador y calificación de productos comprados
- [ ] Eliminar producto

---

## Mensajería

- [x] Iniciar o reutilizar una conversación desde el detalle de un producto de compra directa
- [x] Listar conversaciones con el nombre de la otra parte y el producto asociado
- [x] Cargar historial, enviar mensajes y recibir inserciones mediante Supabase Realtime
- [x] Restringir el acceso a las conversaciones y mensajes mediante las políticas RLS existentes

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

Status: 🟡 Simulación disponible

- [x] Métodos simulados Webpay Plus y Mercado Pago
- [x] Creación de órdenes mediante la RPC `process_mock_checkout`
- [ ] Integración real de pasarela
- [ ] Custodia
- [ ] Liberación de fondos
- [ ] Comisión
# API

## Administración

### GET /api/admin/dashboard

Obtiene indicadores agregados del marketplace para el dashboard administrativo. Requiere una sesión autenticada y que `profiles.role` sea `admin`; responde con `401` si falta la sesión y `403` si el usuario no tiene el rol requerido. Las métricas se consultan en el servidor y la respuesta no se almacena en caché.

Incluye catálogo, moderación, ofertas, subastas, pedidos y ventas brutas mensuales (últimos seis meses), usuarios, tiendas, pujas, favoritos, reseñas y mensajería. Las ventas brutas suman el subtotal de pedidos pagados y no representan utilidad neta. Los errores en métricas individuales se reportan en `unavailableMetrics`; sus valores se devuelven como `null`.

### GET /api/admin/finance?period=day|month|year

Obtiene el resumen e historial financiero del día, mes o año vigente en hora de Chile. Requiere sesión autenticada y `profiles.role = admin`. Devuelve comisiones generadas, cobradas y pendientes de liquidación, autorizaciones de promociones en sandbox e ingresos de Vindex registrados (comisiones cobradas más promociones autorizadas). El historial incluye hasta 100 movimientos; no incluye las ventas brutas de los vendedores como ingreso de Vindex. Responde `401` sin sesión, `403` sin rol de administrador y `400` ante un período inválido.

## Products

### GET /products

Obtiene los productos.

### GET /products/:id

Obtiene un producto.

### POST /products

Crea un producto.

### PUT /products/:id

Actualiza un producto.

### DELETE /products/:id

Elimina un producto.
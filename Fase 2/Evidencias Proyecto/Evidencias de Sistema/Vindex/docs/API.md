# API

## Administración

### GET /api/admin/dashboard

Obtiene indicadores agregados del marketplace para el dashboard administrativo. Requiere una sesión autenticada y que `profiles.role` sea `admin`; responde con `401` si falta la sesión y `403` si el usuario no tiene el rol requerido. Las métricas se consultan en el servidor y la respuesta no se almacena en caché.

Incluye catálogo, moderación, ofertas, subastas, pedidos y ventas brutas mensuales (últimos seis meses), usuarios, tiendas, pujas, favoritos, reseñas y mensajería. Las ventas brutas suman el subtotal de pedidos pagados y no representan utilidad neta. Los errores en métricas individuales se reportan en `unavailableMetrics`; sus valores se devuelven como `null`.

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
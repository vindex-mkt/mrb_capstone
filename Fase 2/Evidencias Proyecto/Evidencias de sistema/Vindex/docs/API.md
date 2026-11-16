# API

## Administración

### GET /api/admin/dashboard

Obtiene indicadores agregados del marketplace para el dashboard administrativo. Requiere una sesión autenticada y que `profiles.role` sea `admin`; responde con `401` si falta la sesión y `403` si el usuario no tiene el rol requerido. Las métricas se consultan en el servidor y la respuesta no se almacena en caché.

Incluye catálogo, moderación, ofertas, subastas, pedidos y ventas brutas mensuales (últimos seis meses), usuarios, tiendas, pujas, favoritos, reseñas, mensajería y `netProfitEstimate`. La utilidad neta estimada suma la comisión devengada de Vindex después del IVA estimado y el monto bruto de las promociones autorizadas del mes vigente. Las promociones son de sandbox y no representan fondos recibidos; el IVA publicitario y los costos operativos reales no están modelados, por lo que no es un resultado contable definitivo. Los errores en métricas individuales se reportan en `unavailableMetrics`; sus valores se devuelven como `null`.

### GET /api/admin/finance?period=day|month|year

Obtiene el resumen e historial financiero del día, mes o año vigente en hora de Chile. Requiere sesión autenticada y `profiles.role = admin`. Devuelve comisiones generadas, cobradas y pendientes de liquidación, autorizaciones de promociones en sandbox e ingresos de Vindex registrados (comisiones cobradas más promociones autorizadas). La utilidad neta estimada suma la comisión después del IVA y el monto bruto de las promociones autorizadas; no modela IVA publicitario ni costos operativos reales. El historial incluye todos los movimientos del período y no incluye las ventas brutas de los vendedores como ingreso de Vindex. Responde `401` sin sesión, `403` sin rol de administrador y `400` ante un período inválido.

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
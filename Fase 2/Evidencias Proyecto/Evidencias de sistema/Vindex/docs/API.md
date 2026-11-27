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

## Compras de subastas

### GET /api/orders/mine

Requiere sesión autenticada. Devuelve las órdenes del comprador, incluyendo órdenes ganadas en subasta, el precio final, la garantía aplicada, el saldo pendiente y la fecha límite. También liquida subastas cerradas y aplica penalizaciones vencidas si `pg_cron` no está disponible.

### POST /api/payments/auction/:orderId/initiate

Requiere sesión autenticada y que la orden pertenezca al usuario, siga pendiente y esté dentro de las 24 horas desde el cierre de la subasta. Inicia Webpay Plus Mall por el saldo restante (precio final menos garantía) y devuelve URL/token para redirigir a Transbank. La confirmación continúa por los endpoints Webpay existentes; rechazos definitivos permiten volver a intentar antes del vencimiento.

## Recargas de billetera

### POST /api/payments/wallet/initiate

Requiere sesión autenticada. Recibe `{ "amount": number }` en CLP (entero entre 1 y 999.999.999), crea una recarga pendiente y una transacción Webpay Plus de integración. Devuelve la URL y el token para redirigir al usuario a Transbank. No acredita saldo.

### POST /api/payments/wallet/return

Callback de Transbank (GET o POST). No acepta ni acredita pagos directamente; conserva el token en una cookie HttpOnly y redirige a `/wallet/resultado`.

### POST /api/payments/wallet/commit

Requiere la sesión de la cuenta que inició la recarga. Reclama el token, confirma el pago con Transbank y solo acredita el saldo cuando la orden, el monto y la autorización coinciden con la transacción guardada. Las respuestas ambiguas quedan en revisión y no se acreditan.

### GET /api/payments/wallet/status?transaction_id=:id

Requiere sesión autenticada y solo devuelve el estado y monto de una recarga perteneciente a esa cuenta.
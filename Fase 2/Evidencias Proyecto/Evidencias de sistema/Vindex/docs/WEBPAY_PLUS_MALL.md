# Webpay Plus Mall (integración)

El checkout Webpay de Vindex usa exclusivamente el ambiente de integración del SDK oficial `transbank-sdk` (6.1.1). La creación y confirmación de pagos ocurren en rutas del servidor; los montos se calculan desde el carrito y los productos en Supabase. No se debe cambiar `buildForIntegration` por una configuración de producción.

## Configuración

Las variables de Transbank se leen en el servidor desde `apps/web/.env.local` o desde el entorno privado del despliegue:

- `TRANSBANK_ENV=integration`
- `TRANSBANK_API_KEY`
- `TRANSBANK_COMMERCE_CODE`
- `TRANSBANK_CHILD_COMMERCE_CODE_1`
- `TRANSBANK_CHILD_COMMERCE_CODE_2`

La aplicación rechaza credenciales que no correspondan a los códigos de integración Mall oficiales conocidos por el SDK. Nunca expongas estas variables con prefijo `NEXT_PUBLIC_` ni las agregues al repositorio.

También se requieren `SUPABASE_SERVICE_ROLE_KEY` (solo servidor; no la clave publicable) y `NEXT_PUBLIC_SITE_URL` en producción para restringir las operaciones privilegiadas y construir la URL de retorno HTTPS. La clave de servicio no está en el navegador ni en el repositorio. La migración concede las RPC de pago únicamente al rol `service_role`; las rutas verifican además la sesión del comprador y el dueño de la orden.

Aplicar `supabase/migrations/20261105200000_webpay_plus_mall.sql` en Supabase antes de habilitar el checkout. La migración agrega `payment_transactions` (transacción Mall), `payment_subtransactions` (una por comercio vendedor), protege estados e importes de `orders`, limita el acceso a los datos del proveedor y revoca el acceso directo a `process_mock_checkout` para los roles de cliente. El flujo simulado queda retirado del checkout web; no se puede usar para completar la misma orden de Webpay.

## Flujo y consistencia

1. `POST /api/payments/webpay/initiate` autentica al usuario y llama a `create_webpay_checkout`. La RPC lee carrito, precios, descuentos, stock y la relación producto/tienda/vendedor en Supabase; rechaza productos no disponibles, precios CLP fraccionarios, tienda sin dueño coincidente y más de dos comercios.
2. El comercio lógico es `store:<store_id>` cuando `products.store_id` existe; si no, `seller:<seller_id>`. La ordenación por identificador lógico hace estable la asignación de códigos hijo durante la compra. Cada comercio recibe un código distinto. El envío estándar (CLP 3.990) se reparte entre los comercios; cualquier residuo se asigna al primero. En retiro el envío es CLP 0.
3. La RPC reserva stock, crea una orden `pending_payment` y persiste importes y órdenes hijas aleatorias antes de llamar a `MallTransaction.create`. Si la creación falla antes de exponer el token al comprador, la reserva se libera. Los montos enviados al SDK vienen de la base de datos, nunca del navegador.
4. El comprador se redirige mediante un formulario POST a la URL de integración de Transbank. La ruta de retorno guarda temporalmente el token en una cookie `HttpOnly`; la página de resultado inicia `MallTransaction.commit` una sola vez. Un reintento no vuelve a llamar a Transbank si la operación está procesándose o ya terminó.
5. El servidor compara orden Mall, órdenes hijas, códigos, montos y el estado de cada detalle. Solo `response_code === 0` junto con `status === "AUTHORIZED"` se guarda como autorizado. La respuesta completa queda en la tabla privada para auditoría y no se devuelve al navegador.
6. La orden se marca `paid`, `partially_paid`, `payment_failed` o `payment_review`. En autorización parcial se registra cada comercio por separado, se conserva la compra autorizada y solo se restituye el stock de la rechazada. La cesta elimina únicamente cantidades autorizadas; no se reintenta ni se reembolsa automáticamente. Una autorización parcial requiere revisión y eventual compensación manual mediante las operaciones habilitadas por Transbank.
7. Cancelaciones restituyen las reservas sin borrar el carrito. Una falla de comunicación durante `commit` deja la operación en revisión y conserva la reserva: no se repite el cobro a ciegas; se debe revisar el estado con Transbank antes de tomar una acción.

La interfaz impide agregar un tercer comercio lógico y muestra el mensaje de límite. El servidor repite esa validación usando los datos actuales de Supabase, por lo que cambiar el contenido del navegador no la evita. Al quitar todos los productos de un comercio, la validación del carrito se recalcula y permite incorporar otro.

## Publicidad de productos

La publicidad usa Webpay Plus estándar del ambiente de integración, con el código de comercio de prueba `WEBPAY_PLUS` del SDK oficial (`597055555532`), porque el cobro corresponde a Vindex y no a una tienda vendedora. No se usa un código productivo ni se envían detalles Mall.

- Al crear una publicación, se inserta primero como producto no destacado. Solo después de que Supabase confirma que está publicada se inicia la transacción Webpay. Si la inserción falla, no se crea ni se cobra una transacción de publicidad.
- El pago se calcula en servidor a partir de un plan permitido (1, 3, 7 o 14 días); se ignora cualquier monto enviado por el navegador. El estado destacado solo se activa tras `Transaction.commit` con `response_code === 0`, `status === "AUTHORIZED"` y monto/orden coincidentes.
- Si el usuario cancela o el pago es rechazado, el producto permanece publicado y sin destacar. Ante resultado ambiguo o error de comunicación, el pago queda bloqueado para evitar un segundo cobro hasta revisar la operación.
- En el perfil, junto a la administración de la oferta del producto, se puede iniciar publicidad para una publicación activa o extender una publicidad vigente. La extensión comienza al terminar el período vigente, o inmediatamente si ya venció.
- La migración `supabase/migrations/20261107150000_webpay_advertising.sql` crea la bitácora privada de pagos, las RPC de creación/confirmación y la protección para que el cliente no altere directamente `is_featured` ni `featured_until`. También impide retirar una publicación mientras su pago está pendiente.

Aplicar esta migración al mismo proyecto Supabase en el que se aplicó Webpay Plus Mall, y reiniciar el servidor web después de actualizar el código. No requiere una clave adicional de Transbank: usa la API key y las variables sandbox documentadas arriba.

## Verificación local

Ejecutar pruebas del límite de comercios y de validación individual de subtransacciones:

```powershell
npm run test:checkout --workspace=web
npm run check-types --workspace=web
npm run lint --workspace=web
```

Las pruebas de integración manual deben usar exclusivamente las tarjetas y credenciales publicadas por Transbank para integración en [Webpay Plus](https://www.transbankdevelopers.cl/documentacion/webpay-plus) y en la [referencia del SDK oficial](https://github.com/TransbankDevelopers/transbank-sdk-nodejs). Nunca uses tarjetas personales ni credenciales productivas.

| Escenario | Resultado esperado |
|---|---|
| Varios productos de un solo comercio | Una subtransacción, monto calculado por el servidor y pago de integración. |
| Productos de dos comercios | Dos subtransacciones, códigos hijo distintos y suma igual al total de la orden. |
| Intentar agregar un tercer comercio | El frontend muestra el mensaje de límite y no modifica el carrito; una solicitud manipulada es rechazada por la RPC. |
| Eliminar los productos de uno de los comercios y agregar uno nuevo | El carrito vuelve a admitir dos comercios; la persistencia del carrito continúa funcionando. |
| Ambas subtransacciones autorizadas | Orden `paid`; el carrito retira las cantidades pagadas. |
| Ambas subtransacciones rechazadas | Orden `payment_failed`; se conserva el carrito y se libera el stock reservado. |
| Una subtransacción autorizada y otra rechazada | Orden `partially_paid`; se conservan ambos resultados, solo se retira la parte pagada del carrito y no se ejecuta reembolso automático. |
| Token inválido | No se llama a `commit` ni se altera otra orden. |
| Token vencido | El pago no se considera aprobado; se muestra resultado no confirmado y se requiere revisar Transbank antes de reintentar. |
| Usuario no autenticado | No inicia ni confirma pagos; la orden de otro comprador no se revela. |
| Producto sin stock o inactivo | La creación se rechaza antes de redirigir y no se crea un cobro. |
| Monto cambiado desde el navegador | El monto enviado a Transbank sigue siendo el calculado desde Supabase. |
| Confirmación repetida | La operación no se confirma una segunda vez; se devuelve su estado guardado. |
| Código, orden o monto de respuesta alterado/incompleto | El pago queda `payment_review`, nunca `paid`, y requiere conciliación manual. |

Para publicidad, probar además: error al insertar el producto (no se inicia pago), publicación activa con plan seleccionado (abre Webpay después de insertar), rechazo/cancelación (producto publicado y sin destacar), autorización (destacado activado solo en servidor), producto de otro vendedor o no publicado (rechazo), respuesta con monto/orden incorrectos (revisión) y confirmación repetida (sin segundo `commit`).

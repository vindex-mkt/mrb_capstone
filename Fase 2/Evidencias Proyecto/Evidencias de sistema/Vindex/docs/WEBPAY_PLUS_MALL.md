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

1. `POST /api/payments/webpay/initiate` autentica al usuario y comprueba desde Supabase que ninguno de los productos del carrito pertenezca al comprador; si encuentra uno, rechaza el pago con HTTP 409. Luego llama a `create_webpay_checkout`. La RPC lee carrito, precios, descuentos, stock y la relación producto/tienda/vendedor en Supabase; rechaza productos no disponibles, precios CLP fraccionarios, tienda sin dueño coincidente y más de dos comercios.
2. El comercio lógico es `store:<store_id>` cuando `products.store_id` existe; si no, `seller:<seller_id>`. La ordenación por identificador lógico hace estable la asignación de códigos hijo durante la compra. Cada comercio recibe un código distinto. El envío estándar (CLP 3.990) se reparte entre los comercios; cualquier residuo se asigna al primero. En retiro el envío es CLP 0.
3. La RPC reserva stock, crea una orden `pending_payment` y persiste importes y órdenes hijas aleatorias antes de llamar a `MallTransaction.create`. Si la creación falla antes de exponer el token al comprador, la reserva se libera. Los montos enviados al SDK vienen de la base de datos, nunca del navegador.
4. El comprador se redirige mediante un formulario POST a la URL de integración de Transbank. La ruta de retorno guarda temporalmente el token en una cookie `HttpOnly`; la página de resultado inicia `MallTransaction.commit` una sola vez. Un reintento no vuelve a llamar a Transbank si la operación está procesándose o ya terminó.
5. El servidor compara orden Mall, órdenes hijas, códigos, montos y el estado de cada detalle. Solo `response_code === 0` junto con `status === "AUTHORIZED"` se guarda como autorizado. La respuesta completa queda en la tabla privada para auditoría y no se devuelve al navegador.
6. La orden se marca `paid`, `partially_paid`, `payment_failed` o `payment_review`. En autorización parcial se registra cada comercio por separado, se conserva la compra autorizada y solo se restituye el stock de la rechazada. La cesta elimina únicamente cantidades autorizadas; no se reintenta ni se reembolsa automáticamente. Una autorización parcial requiere revisión y eventual compensación manual mediante las operaciones habilitadas por Transbank.
7. Cancelaciones restituyen las reservas sin borrar el carrito. Una falla de comunicación durante `commit` deja la operación en revisión y conserva la reserva: no se repite el cobro a ciegas; se debe revisar el estado con Transbank antes de tomar una acción.

La interfaz impide agregar un tercer comercio lógico y muestra el mensaje de límite. El servidor repite esa validación usando los datos actuales de Supabase, por lo que cambiar el contenido del navegador no la evita. Al quitar todos los productos de un comercio, la validación del carrito se recalcula y permite incorporar otro.

## Pagos pendientes: conciliación, reintento y cancelación

En **Perfil → Comprador → Mis compras** se muestra la sección **Pagos pendientes** para las órdenes Webpay que sigan en `created`, `initiated`, `processing`, `payment_review` o `communication_error`. La sección actualiza el estado cada minuto mientras está abierta; el servidor intenta resolver intentos vencidos al listar los pagos o antes de iniciar otro checkout:

- La espera máxima es de cinco minutos desde la creación. Un intento `created` sin token se cierra con la RPC existente de fallo una vez vencida esa ventana.
- Para un intento con token se consulta `MallTransaction.status`. Si Transbank confirma autorización, se recupera el retorno y se ejecuta el flujo idempotente de `commit`; no se crea un cobro nuevo.
- Si pasaron cinco minutos y todos los comercios siguen en `INITIALIZED`, el servidor valida orden, comercio, buy order y montos, cancela el intento local y libera su reserva; el checkout puede reintentarse con el carrito conservado.
- Los rechazos terminales verificados se registran como `rejected`. Si Transbank no responde o devuelve un estado desconocido/inconsistente, se conserva la reserva y se bloquea otro cobro: no es seguro cancelar a ciegas porque podría haber una autorización.

Aplicar `supabase/migrations/20261113160000_resolve_failed_webpay_checkouts.sql` y `supabase/migrations/20261113162500_grant_service_role_select_webpay_payments.sql` antes de desplegar el frontend. La RPC de conciliación y las lecturas de órdenes/pagos se limitan a `service_role`; la RPC vuelve a comprobar toda la respuesta antes de liberar el bloqueo.

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
| Comprador intenta pagar un producto propio | La ruta de inicio rechaza la compra con HTTP 409 antes de crear la orden o iniciar Webpay. |
| Producto sin stock o inactivo | La creación se rechaza antes de redirigir y no se crea un cobro. |
| Monto cambiado desde el navegador | El monto enviado a Transbank sigue siendo el calculado desde Supabase. |
| Confirmación repetida | La operación no se confirma una segunda vez; se devuelve su estado guardado. |
| Código, orden o monto de respuesta alterado/incompleto | El pago queda `payment_review`, nunca `paid`, y requiere conciliación manual. |

Para publicidad, probar además: error al insertar el producto (no se inicia pago), publicación activa con plan seleccionado (abre Webpay después de insertar), rechazo/cancelación (producto publicado y sin destacar), autorización (destacado activado solo en servidor), producto de otro vendedor o no publicado (rechazo), respuesta con monto/orden incorrectos (revisión) y confirmación repetida (sin segundo `commit`).

## Entrega a coordinar y ledger de custodia (sandbox)

Al seleccionar **Entrega a coordinar con el vendedor**, el checkout oculta y omite la dirección. Esta opción admite un solo vendedor por orden, validado en el cliente y mediante una restricción de base de datos para impedir que un OTP libere el saldo de más de una entrega. Una vez que el estado de pago sea `paid`, el servidor crea una conversación idempotente y el comprador se redirige al chat. Un trigger marca la respuesta del vendedor; hasta entonces, el OTP no se entrega al comprador ni se acepta para validar la operación. Al recibir el producto, el OTP válido libera el registro de custodia y acredita el saldo interno del vendedor. Comprador y vendedor ven sus montos en custodia en `/wallet`; la calificación sigue condicionada a la entrega completada.

Desplegar `supabase/migrations/20261109170000_pickup_order_escrow.sql` sobre las funciones existentes `get_buyer_delivery_code` y `verify_delivery_otp`. La migración restringe las funciones base y entrega acceso mediante RPC coordinadas; aplicar la migración antes de publicar la versión web.

Este flujo es únicamente una **simulación de ledger** con las credenciales de integración. Webpay Mall autoriza subtransacciones por comercio hijo y el código existente no retiene fondos reales en Vindex. Acreditar el saldo interno no inicia una transferencia real al vendedor. Para producción, el producto debe cambiar a un adquirente que liquide primero a Vindex y contar con un payout conciliado/reembolsable antes de anunciar custodia real.

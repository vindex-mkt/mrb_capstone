# Funcionamiento del carrito de compras

Esta guía describe el carrito que está implementado en Vindex Web: cómo se construye un artículo, dónde se persiste, cómo se sincroniza para usuarios autenticados y qué componentes permiten modificarlo.

## Resumen de arquitectura

El carrito tiene dos capas de persistencia:

1. **Estado del navegador:** Zustand persiste los artículos en `localStorage`, bajo la clave `vindex-cart`. Esto permite que el carrito sobreviva a una recarga incluso si Supabase no está disponible.
2. **Estado de la cuenta autenticada:** `useCartSync` sincroniza los artículos con `public.carts` y `public.cart_items` cuando Supabase restaura o cambia la sesión.

El recorrido principal es:

```text
Tienda o detalle del producto
        │ addItem(CartItem)
        ▼
Zustand (items, total, contador)
        ├── persistencia local: localStorage["vindex-cart"]
        └── si hay sesión: useCartSync → Supabase carts/cart_items
                                      │
                                      └── lee products para validar y refrescar datos

Navbar → /cart                 CartDrawer → abrir / cerrar
```

El estado local es la respuesta inmediata que consume la interfaz. La escritura remota es asíncrona y no bloquea los controles del carrito.

## Archivos que participan

| Archivo | Responsabilidad |
|---|---|
| [`apps/web/lib/store/useCartStore.ts`](../apps/web/lib/store/useCartStore.ts) | Tipo `CartItem`, acciones, selectores derivados y persistencia de Zustand. |
| [`apps/web/hooks/useCartSync.ts`](../apps/web/hooks/useCartSync.ts) | Hidratación inicial, escucha de autenticación, lectura/fusión con Supabase y cola de escrituras remotas. |
| [`apps/web/lib/supabase/client.ts`](../apps/web/lib/supabase/client.ts) | Crea el cliente Supabase de navegador que comparten autenticación y sincronización. |
| [`apps/web/components/cart/CartIntegration.tsx`](../apps/web/components/cart/CartIntegration.tsx) | Monta el sincronizador y el drawer como integración global de cliente. |
| [`apps/web/app/layout.tsx`](../apps/web/app/layout.tsx) | Incluye `CartIntegration` en el layout raíz para que funcione en las rutas web. |
| [`apps/web/app/tienda/page.tsx`](../apps/web/app/tienda/page.tsx) | Consulta productos de compra directa y ofrece agregarlos desde las tarjetas del catálogo. |
| [`apps/web/components/cart/ProductPurchaseButton.tsx`](../apps/web/components/cart/ProductPurchaseButton.tsx) | Construye el artículo desde la ficha de producto y llama `addItem`. |
| [`apps/web/app/product/[id]/page.tsx`](../apps/web/app/product/[id]/page.tsx) | Carga la ficha del producto y renderiza `ProductPurchaseButton`. |
| [`apps/web/lib/product-utils.ts`](../apps/web/lib/product-utils.ts) | Define los datos compartidos de productos, el cálculo de descuentos vigentes y la imagen principal. |
| [`apps/web/components/cart/CartNavButton.tsx`](../apps/web/components/cart/CartNavButton.tsx) | Muestra el acceso a `/cart` y el contador cuando hay artículos. |
| [`apps/web/components/cart/CartDrawer.tsx`](../apps/web/components/cart/CartDrawer.tsx) | Presenta el drawer, el resumen, las cantidades y las acciones de quitar/vaciar. |
| [`apps/web/app/cart/page.tsx`](../apps/web/app/cart/page.tsx) | Página completa `/cart`, con artículos, cantidades, total y estado vacío. |
| [`apps/web/components/Navbar.tsx`](../apps/web/components/Navbar.tsx) | Coloca `CartNavButton` dentro de la navegación principal. |
| [`docs/DATABASE.md`](./DATABASE.md) | Documenta el modelo de productos y el contrato esperado de tablas del carrito. |

## Modelo de estado

### Artículo

El tipo `CartItem` de [`useCartStore.ts`](../apps/web/lib/store/useCartStore.ts) contiene:

| Campo | Significado |
|---|---|
| `id: number` | `products.id`, que en PostgreSQL es BIGINT. |
| `name: string` | Nombre mostrado en las filas del carrito. |
| `price: number` | Precio unitario utilizado para el subtotal. Puede ser el precio promocional vigente. |
| `image: string` | Imagen principal (`images[0]`) o una imagen de reemplazo. |
| `quantity: number` | Unidades seleccionadas, limitada por el stock conocido. |
| `stock: number` | Stock conocido al construir o refrescar el artículo. |
| `seller_id: string` | UUID del vendedor. |
| `store_id: number | null` | Identificador de la tienda, o `null` para venta personal. |

`cart_id`, a diferencia de `product_id`, es el UUID que identifica el carrito remoto. El artículo del store usa el ID numérico del producto como identidad local; no guarda el UUID del carrito en cada fila.

### Estado persistido y estado de interfaz

El store contiene `items`, `isOpen`, `hasHydrated` y `cartOwnerId`, entre otras acciones. El middleware `persist` solo serializa `items` y `cartOwnerId` mediante `partialize`.

Consecuencias:

- Los productos y el propietario asociado sobreviven a una recarga en `localStorage`.
- `isOpen` no se restaura: el drawer no reaparece abierto solo porque lo estaba antes de recargar.
- `hasHydrated` no se almacena. Empieza en `false` en el cliente y pasa a `true` tras terminar la rehidratación.
- El estado inicial serializado por el servidor no necesita conocer `localStorage`.

El store usa `skipHydration: true`. El hook de sincronización llama explícitamente a `persist.rehydrate()` y espera a que finalice. Los botones y vistas comprueban `hasHydrated` para no mostrar un carrito vacío transitorio ni aceptar una acción antes de cargar el almacenamiento.

## Acciones y límites

Todas estas operaciones se implementan centralmente en [`useCartStore.ts`](../apps/web/lib/store/useCartStore.ts):

- **`addItem(item)`**: ignora el alta si el stock es cero o si el artículo no tiene identidad verificable. Limita el carrito a dos comercios lógicos (`store:<store_id>` o `seller:<seller_id>`); los productos de la misma tienda cuentan una sola vez. Si el producto ya existe, incrementa su cantidad sin superar el stock recibido. Quitar todos los artículos de un comercio libera su espacio. Abre el drawer cuando agrega el artículo.
- **`removeItem(productId)`**: elimina el producto cuyo `id` coincide con el ID numérico indicado.
- **`updateQuantity(productId, quantity)`**: normaliza la cantidad a entero y la limita entre cero y stock. Una cantidad resultante de cero elimina el artículo.
- **`clearCart()`**: vacía los artículos.
- **`getTotal()`**: suma `price * quantity` para cada artículo.
- **`getItemCount()`**: suma las unidades, no la cantidad de filas/productos distintos.
- **`setIsOpen(open)`**: controla el drawer.
- **`setItems(items)`**: reemplaza la colección; el sincronizador la usa durante la reconciliación.
- **`setCartOwnerId(userId)`**: registra a qué usuario autenticado se vinculó el estado local.

Estos cálculos son de presentación del carrito. Antes de una futura compra, el backend debe volver a validar precio, disponibilidad, stock y totales; los valores enviados por un navegador no deben considerarse una fuente de verdad para cobrar.

## Checkout y compras

La ruta `/checkout` requiere sesión autenticada. Para ingresar una dirección nueva, región, ciudad y comuna se seleccionan desde `CHILE_LOCATIONS`; las opciones de ciudad y comuna dependen de la selección anterior y el checkout valida la combinación antes de continuar. La dirección estándar incluye región, ciudad y comuna. El envío estándar cuesta CLP 3.990 y el retiro cuesta CLP 0. El pago se inicia por `POST /api/payments/webpay/initiate` y usa exclusivamente Webpay Plus Mall en integración. La interfaz impide agregar al carrito productos del vendedor autenticado y el servidor también rechaza el checkout con HTTP 409 si algún producto del carrito pertenece al comprador. El servidor relee el carrito, confirma vendedores, precios y stock en Supabase, y rechaza el límite de dos comercios incluso si se altera la solicitud. El comprador se redirige al formulario seguro de Transbank y el retorno se confirma con `MallTransaction.commit`; volver a Vindex no es suficiente para marcar una orden como pagada.

La cesta local y la remota se conservan hasta conocer el resultado. Tras una autorización completa se quitan las cantidades pagadas; ante autorización parcial solo se quitan las cantidades autorizadas y no se hace reembolso automático. Las órdenes y cada subtransacción quedan auditadas en `payment_transactions` y `payment_subtransactions`. Configuración, estados y escenarios de prueba están documentados en [WEBPAY_PLUS_MALL.md](./WEBPAY_PLUS_MALL.md).

La RPC debe localizar el carrito mediante `cart_items.cart_id → carts.id → carts.user_id`; `cart_items` no tiene una columna `user_id`. La migración de corrección [`20261015195500_fix_mock_checkout_cart_lookup.sql`](../supabase/migrations/20261015195500_fix_mock_checkout_cart_lookup.sql) actualiza la función ya desplegada.

El perfil comprador muestra **Mis Compras**. Las compras con estado `completed` o `delivered` permiten calificar el producto; las reseñas se guardan en `reviews` y se evita ofrecer otra calificación si ese comprador ya reseñó ese producto. La configuración de tablas, RPC, permisos y políticas debe estar desplegada en Supabase; la definición versionada está en [`supabase/migrations/checkout.sql`](../supabase/migrations/checkout.sql).

Para **Entrega a coordinar con el vendedor**, el checkout oculta los campos de dirección y la orden se guarda sin dirección personal. Esta modalidad se limita a productos de un solo vendedor, para que un OTP no libere fondos de varios vendedores antes de entregar todos sus productos; el cliente y una restricción diferida de base de datos validan el límite. Solo después de que Webpay confirma el pago, se crea una conversación y el comprador es redirigido al chat con un mensaje para acordar fecha y lugar. El OTP no se muestra al comprador hasta que el vendedor responda por ese chat. Al recibir el producto, el comprador comparte el código de seis dígitos y el vendedor lo valida con `verify_pickup_otp_and_release_escrow`; la operación confirma la entrega, acredita el ledger interno del vendedor y habilita la calificación. La orden crea saldos de custodia asociados a comprador y vendedor, visibles en sus billeteras; se liberan únicamente con OTP válido. Este ledger es una simulación para el sandbox actual: Webpay Mall liquida sus subtransacciones a comercios hijos y no retiene fondos reales en Vindex. Aplicar `20261109170000_pickup_order_escrow.sql` después de las migraciones existentes. Las publicaciones agotadas se ocultan de los listados públicos, pero siguen disponibles en el perfil del vendedor para reponer su stock.

## Alta desde el catálogo y la ficha

### Catálogo `/tienda`

[`app/tienda/page.tsx`](../apps/web/app/tienda/page.tsx) consulta productos activos, con stock positivo, y filtra `sale_type` por los valores `direct` y `fixed_price`. Se aceptan ambos porque el catálogo existente utiliza `direct` para compra directa; no se deben tratar subastas (`auction`) como artículos de carrito.

El botón de cada tarjeta forma el `CartItem` con:

- ID, nombre y vendedor del producto.
- Precio actual, calculado con `discount_price` solo cuando `offer_ends_at` está en el futuro.
- Primera imagen o imagen de reemplazo.
- Cantidad inicial `1` y stock disponible.

El botón permanece deshabilitado hasta que Zustand termina de hidratarse o si el producto no tiene stock.

### Ficha del producto

[`app/product/[id]/page.tsx`](../apps/web/app/product/[id]/page.tsx) obtiene la ficha mediante las consultas compartidas de [`lib/supabase/queries.ts`](../apps/web/lib/supabase/queries.ts) y renderiza [`ProductPurchaseButton.tsx`](../apps/web/components/cart/ProductPurchaseButton.tsx). Este componente acepta `direct` y `fixed_price`, exige stock y un precio numérico, crea un artículo de cantidad uno y usa la acción global `addItem`.

La ficha y el catálogo terminan en el mismo store. Por eso el contador, la página `/cart` y el drawer reflejan la misma colección sin duplicar estado por componente.

## Recarga e hidratación de Next.js

La prevención de inconsistencias entre render del servidor y render del navegador se reparte entre estos archivos:

1. [`app/layout.tsx`](../apps/web/app/layout.tsx) monta la integración como parte del layout común.
2. [`CartIntegration.tsx`](../apps/web/components/cart/CartIntegration.tsx) es un componente cliente que activa `useCartSync` y renderiza `CartDrawer`.
3. [`useCartSync.ts`](../apps/web/hooks/useCartSync.ts) solicita la rehidratación manual de Zustand y mantiene una promesa que indica cuándo está lista.
4. [`CartNavButton.tsx`](../apps/web/components/cart/CartNavButton.tsx), [`CartDrawer.tsx`](../apps/web/components/cart/CartDrawer.tsx) y [`app/cart/page.tsx`](../apps/web/app/cart/page.tsx) ocultan el contador o muestran “Cargando carrito...” hasta que `hasHydrated` es verdadero.

El orden es importante: el listener de autenticación puede recibir la sesión inicial antes de que termine de leerse `localStorage`. `syncUser` espera `hydrationReady` antes de capturar `items` y fusionarlos con los datos remotos. No se debe eliminar esta espera ni reemplazar el estado por una respuesta remota vacía anterior a la hidratación.

## Sincronización para usuarios autenticados

La lógica está en [`useCartSync.ts`](../apps/web/hooks/useCartSync.ts), usando el cliente browser de [`lib/supabase/client.ts`](../apps/web/lib/supabase/client.ts).

### Inicio y restauración de sesión

El hook registra `supabase.auth.onAuthStateChange`. Cada cambio incrementa un contador de generación y detiene la suscripción de store asociada a la sincronización previa. La generación evita que una respuesta asíncrona vieja sobrescriba un estado correspondiente a una sesión más reciente.

Si no hay usuario, no se inicia una lectura remota. Los artículos locales se conservan; una sesión nula no debe tratarse como una orden para vaciar `localStorage`.

### Propiedad local

Después de la hidratación:

- Si `cartOwnerId` es `null`, los artículos locales pueden fusionarse con la primera cuenta autenticada.
- Si `cartOwnerId` coincide con el usuario actual, se consideran artículos de ese usuario.
- Si el owner guardado es otro usuario, los artículos locales se omiten para no transferir por accidente el carrito de una cuenta a otra.

Una vez que se completa la reconciliación, se guarda el `user.id` actual con `setCartOwnerId`.

### Lectura y reconciliación remota

Para una sesión autenticada, el hook:

1. Hace upsert de `{ user_id }` en `carts`, con conflicto por `user_id`, y obtiene el UUID del carrito.
2. Lee `cart_items` por `cart_id`, haciendo join a `products` para obtener los datos actuales.
3. Normaliza `products`, que puede llegar como objeto o arreglo debido a la forma del join.
4. Para IDs locales que no aparecieron en el join, consulta `products` directamente.
5. Construye la unión de cantidades local/remota, refresca datos desde productos consultables y reemplaza el store.
6. Suscribe el store a cambios de `items` y persiste las modificaciones en Supabase.

Para artículos con el mismo owner, la fusión usa la cantidad máxima entre local y remota; esto evita sumar dos veces el mismo carrito cuando Supabase emite más de un evento de sesión. Si el carrito local todavía no tiene owner (`null`), las cantidades local y remota se suman en la primera fusión con la cuenta y luego quedan asociadas a ese owner.

`toCartItem` valida producto activo, tipo directo (`direct` o `fixed_price`), stock positivo y precio numérico. La respuesta del join puede serializar `status` como booleano o cadena (`true` / `"true"`), y ambos valores activos se aceptan. El precio promocional se utiliza cuando existe `discount_price` y su `offer_ends_at` es posterior a la hora actual.

Si el join o la consulta complementaria no entrega un producto, el sincronizador puede conservar la copia local cacheada y limitar su cantidad al stock guardado. Si una llamada Supabase produce un error, se informa en la consola y se evita tratar ese error como una lista vacía válida.

### Escritura de cambios

Tras fusionar, se registra una suscripción Zustand que detecta cambios en la referencia `items`. Cada cambio se agrega a una cola serializada:

- Los artículos actuales se guardan mediante upsert de `(cart_id, product_id, quantity)`.
- Las filas remotas cuyo `product_id` ya no está en el estado se eliminan.
- Si la colección queda vacía, se eliminan todas las filas de `cart_items` para ese `cart_id`.

La cola mantiene el orden de cambios rápidos (por ejemplo, pulsar `+` varias veces). Los errores de escritura se registran en consola con “No se pudo sincronizar el carrito”; las acciones locales siguen funcionando porque Zustand persiste primero en el navegador.

## Interfaz del carrito

### Acceso desde navegación

[`Navbar.tsx`](../apps/web/components/Navbar.tsx) incluye [`CartNavButton.tsx`](../apps/web/components/cart/CartNavButton.tsx). El botón navega a `/cart`; muestra un badge con `getItemCount()` cuando la hidratación terminó y el número de unidades es mayor que cero.

### Drawer

[`CartDrawer.tsx`](../apps/web/components/cart/CartDrawer.tsx) está conectado al store global. `addItem` lo abre automáticamente; también puede cerrarse con el control de `Sheet`. Muestra imágenes, nombre, precio unitario, stock, controles `+`/`−`, eliminación por producto y total. Ofrece ir a `/tienda`, navegar a `/cart`, continuar a `/checkout` y vaciar el carrito.

### Página `/cart`

[`app/cart/page.tsx`](../apps/web/app/cart/page.tsx) usa las mismas acciones y selectores que el drawer. Antes de hidratar presenta un estado de carga; después muestra la lista y resumen o el estado vacío. Sus botones modifican el mismo store y por tanto disparan la sincronización remota cuando hay una suscripción autenticada activa.

## Esquema de datos requerido

El contrato descrito en [`docs/DATABASE.md`](./DATABASE.md) es:

- `public.carts`: una fila por usuario autenticado, con ID UUID y `user_id`.
- `public.cart_items`: `cart_id` UUID, `product_id` BIGINT y `quantity`, con unicidad por `(cart_id, product_id)`.
- `cart_items.product_id` referencia `products.id`; el RLS debe permitir al usuario leer y modificar solo el carrito que le pertenece.

**Estado del repositorio revisado para esta guía:** no se encontró un archivo de migración SQL de `carts`/`cart_items` en el checkout actual, aunque `docs/DATABASE.md` menciona `20260928000000_shopping_cart.sql`. Por tanto, la presencia real de tablas, índices, claves foráneas y políticas RLS debe verificarse en el proyecto Supabase desplegado; no se debe asumir que esa migración está versionada aquí. El cliente necesita que el esquema y las políticas estén instalados para persistencia entre dispositivos/sesiones.

La persistencia en `localStorage` no depende de esas tablas: mantiene el carrito en el mismo navegador. La persistencia remota sí es necesaria para que el carrito autenticado pueda recuperarse en otro navegador o dispositivo.

## Estado actual y límites

- El carrito admite solo compras directas; las subastas no se agregan desde catálogo o ficha.
- El stock se limita en el cliente con el valor conocido al agregar/refrescar. No reserva inventario y puede quedar obsoleto; el checkout/back-end debe comprobarlo de nuevo.
- Los cambios locales se conservan aunque falle una operación remota, pero el error se registra en consola y la réplica remota puede quedar desactualizada hasta otra sincronización.
- El botón continúa a `/checkout`, donde se confirma dirección, entrega y pago. Con entrega a coordinar, la dirección se omite y, después del pago aprobado, el comprador pasa al chat creado para esa orden.
- Las cantidades y los precios de Zustand son datos de UI. Para crear una orden, el backend debe reconstruir precios, vendedor, stock y total desde datos confiables.

## Guía rápida de diagnóstico

1. **El contador o la página aparecen vacíos un instante:** comprobar `hasHydrated`, `skipHydration` y la espera de `hydrationReady`.
2. **Persiste en el mismo navegador pero no en otro dispositivo:** revisar la sesión, las tablas remotas, RLS y errores de consola de `useCartSync`.
3. **Un cambio desaparece al recargar con sesión:** verificar que `cartOwnerId` coincide con el usuario Supabase y revisar si `cart_items` recibe el upsert.
4. **Un producto no se puede agregar:** comprobar `sale_type`, `status`, `price` y `stock` en la consulta que alimenta el componente.
5. **Una reconciliación elimina filas:** revisar el resultado del join a `products` y el conjunto `mergedItems` antes de que `syncCartItems` aplique sus borrados. Una consulta fallida no debe convertirse en una lista vacía que se persista como si fuera correcta.

2026 i 



<!-- Start of picture text -->
Windex<br><!-- End of picture text -->

# Metodología Ágil 

MARCO ÁGIL, SCRUM RENATO ASTARGO – BRYAN ARAVENA – MAXIMILIANO VARGAS 

1 

## **1.** Visión del Producto e Innovación 

### Visión del Producto (Product Vision) 

#### 1.1Introducción y Contexto del Mercado 

El comercio electrónico en Chile ha experimentado un crecimiento exponencial en la última década, consolidando infraestructuras orientadas casi en su totalidad al retail estandarizado y al consumo masivo. Sin embargo, el mercado de compraventa entre particulares y la comercialización de productos independientes ha quedado rezagado. Ante la falta de plataformas especializadas que ofrezcan condiciones justas, los métodos de venta informal para creadores, coleccionistas y microempresarios se han volcado masivamente a las redes sociales (como Instagram o grupos de Facebook). 

Esta informalidad genera un ecosistema transaccional deficiente: carece de trazabilidad logística, no cuenta con mecanismos de protección de pagos para el comprador y, lo más crítico, obliga a los usuarios a concretar transacciones en la vía pública o mediante transferencias directas sin ninguna garantía de seguridad física ni financiera. Vindex nace como una respuesta directa a estas deficiencias, proponiendo un ecosistema digital que profesionaliza y asegura el comercio independiente. 

#### 1.2 El Problema a Resolver 

El proyecto aborda tres problemáticas fundamentales que asfixian el comercio y a los creadores independientes en la actualidad: 

- **Vulnerabilidad económica por comisiones abusivas:** Los creadores independientes, artistas emergentes y microvendedores enfrentan un escenario hostil en los Marketplace tradicionales y plataformas extranjeras, donde pierden entre un 20% y un 30% de sus ingresos netos debido a tarifas de intermediación excesivas. Esto hace que muchos modelos de negocio a pequeña escala sean insostenibles. 

- **Falta de mecanismos dinámicos de valorización:** En el mercado de artículos únicos, de segunda mano de alto valor, arte o coleccionables, el modelo de "precio fijo" es ineficiente. Los vendedores a menudo no saben cómo tasar una pieza exclusiva, y los compradores no tienen un entorno transparente para determinar el precio justo mediante la oferta y la demanda, perdiendo oportunidades de capitalizar el valor real de los productos. 

2 

- **Desconfianza y exposición al fraude:** El acuerdo de compraventas por redes sociales expone a ambas partes. El comprador teme realizar transferencias previas por miedo a no recibir el producto (estafas), mientras que el vendedor se arriesga a despachar productos sin garantías de pago o a sufrir cancelaciones unilaterales. Además, las entregas presenciales sin validación representan un riesgo para la seguridad personal de los involucrados. 

#### 1.3. Perfiles de Usuario (A quién va dirigido) 

Para que Vindex genere un impacto real, la plataforma centra su propuesta de valor en dos perfiles de usuarios claramente definidos: 

- **Creadores, Artistas y Microempresarios (Vendedores):** Emprendedores y particulares, predominantemente entre 20 y 45 años, que comercializan obras de autor, artesanía, artículos coleccionables, moda independiente o bienes de segunda mano de alto valor. Son usuarios que buscan autonomía, márgenes de ganancia justos y herramientas profesionales para gestionar su inventario y liquidar piezas exclusivas sin depender de algoritmos restrictivos o tarifas predatorias. 

- **Compradores y Coleccionistas Digitales:** Usuarios habituados al entorno digital que buscan adquirir artículos originales, únicos o participar en pujas competitivas. Desean una experiencia interactiva y segura. La custodia de pagos y la verificación de vendedores son necesidades del producto, pero no deben entenderse como garantías disponibles en la aplicación web actual. 

#### 1.4 La Solución: ¿Qué es Vindex? 

Vindex es una plataforma de comercio electrónico orientada a la compra y venta C2C. La visión de producto integra tres pilares; la aplicación web disponible y los componentes planificados se distinguen a continuación: 

1. **Vitrina y Tiendas Personalizadas:** Un espacio donde los vendedores pueden configurar perfiles profesionales, exhibir su portafolio y gestionar un catálogo de productos con precios fijos, devolviendo el control del inventario al creador. 

2. **Sala de Subastas Interactivas en Tiempo Real:** Un entorno dinámico para liquidar piezas exclusivas mediante pujas competitivas. En la aplicación web actual, la sala recibe cambios mediante Supabase Realtime y sincroniza el reloj con Supabase; la aceptación de ofertas y la regla _anti-sniping_ dependen de las funciones y triggers configurados en la base de datos, protegiendo el remate frente a ofertas de último segundo cuando esa configuración está activa. 

3. **Módulo de Seguridad Financiera (Escrow y OTP):** El checkout actual permite simular pagos y, en caso de retiro presencial, generar un OTP de seis dígitos para validar la entrega. La retención y liberación de fondos mediante Escrow y una pasarela real siguen siendo objetivos futuros; la verificación del OTP no libera fondos actualmente. 

#### 1.5 Propuesta de Valor y Diferenciadores 

Lo que busca diferenciar a Vindex no es solo la suma de sus funcionalidades, sino su enfoque en la equidad y la seguridad. La propuesta de valor es **democratizar la comercialización digital**. El rango de comisión entre el 5% y el 10% es una meta del modelo de negocio y debe validarse antes de presentarse como una tarifa vigente o como un ahorro medido. 

Además, Vindex busca ofrecer una alternativa más segura a la venta informal. El modelo híbrido combina la venta directa con subastas y el checkout disponible es simulado. La validación mediante OTP está disponible para confirmar retiros presenciales, pero no implica custodia de pagos; Escrow sigue siendo una propuesta futura y no permite afirmar que actualmente exista un entorno de "Cero Riesgo" o _Trustless_. 

#### 1.6 Visión a Futuro e Impacto 

La visión a largo plazo de Vindex es convertirse en un referente nacional para transacciones C2C seguras y subastas de artículos independientes en Chile, fomentando la economía creativa local. A nivel tecnológico, el proyecto busca evolucionar desde la aplicación web actual, integrada con Supabase, hacia una plataforma con flujos transaccionales más completos y servicios especializados. Componentes como una API NestJS, Redis y pagos en custodia son objetivos de evolución; el OTP está implementado para confirmar retiros presenciales, pero no como parte de una liberación de fondos. 

4 

5 

### 1.7. Innovación de la Solución 

El proyecto Vindex ha sido diseñado no solo para cumplir con los estándares técnicos de una plataforma de comercio electrónico tradicional, sino para introducir un modelo de negocio y tecnológico disruptivo en el mercado chileno. A continuación, se detallan los pilares de innovación del sistema respondiendo a las exigencias del proyecto: 

**¿Qué problema busca resolver?** Vindex aborda tres deficiencias que afectan a los creadores independientes, artistas emergentes y microempresarios en el entorno digital: 

- **Vulnerabilidad y barreras económicas:** Los marketplaces intermediarios tradicionales y las plataformas internacionales imponen comisiones abusivas (entre un 20% y un 30%), lo que reduce drásticamente los márgenes de ganancia y hace insostenible la comercialización a pequeña escala. 

- **Inflexibilidad en la fijación de precios:** Los creadores de piezas únicas, arte o artículos de colección de segunda mano carecen de herramientas para determinar el valor real de sus productos en el mercado. El modelo estático de "precio fijo" a menudo genera pérdidas de capital o estancamiento de inventario. 

- **Fraude y exposición en la entrega:** La venta informal canalizada a través de redes sociales carece de trazabilidad y protección financiera. Los compradores se exponen a estafas al transferir dinero por adelantado, mientras que las entregas presenciales sin validación representan un riesgo de seguridad para ambas partes. 

##### **¿Qué hace diferente a la solución?** 

La diferenciación técnica y comercial de Vindex radica en la integración de arquitecturas complejas dentro de un mismo ecosistema híbrido: 

- **Modelo Comercial Híbrido (Marketplace + Subastas):** La aplicación web contempla un catálogo de venta directa y la publicación de subastas. Las salas reciben cambios de pujas mediante Supabase Realtime; el envío de ofertas utiliza la RPC `place_bid`. La tolerancia a concurrencia y la regla _anti-sniping_ dependen de la configuración de PostgreSQL/Supabase y deben verificarse en ese entorno. No se atribuye este flujo a Socket.io o Redis. 

6 

- **Modelo de Confianza Cero (** **_Trustless_ ) mediante Escrow y OTP (objetivo):** La custodia del pago y la validación física asociada a su liberación son una evolución propuesta para reducir el riesgo entre usuarios. El checkout web crea órdenes con métodos de pago simulados y ofrece un OTP para confirmar retiros presenciales, pero ese código no habilita ni libera fondos. 

##### **¿Qué valor agrega?** 

El valor agregado de la plataforma impacta tanto a nivel socioeconómico como tecnológico: 

- **Empoderamiento y Rentabilidad:** El modelo de negocio propone un rango de comisión de 5% a 10%. Su efecto sobre la rentabilidad deberá calcularse y validarse frente a costos y tarifas vigentes antes de afirmarse como resultado. 

- **Seguridad Transaccional (objetivo):** El checkout simulado ya permite confirmar el retiro presencial mediante OTP; la integración con una pasarela real y la custodia de fondos buscan completar la protección de la transacción. No debe presentarse la validación OTP actual como garantía de pago o liberación de fondos.

- **Gamificación del Comercio Digital:** Las subastas agregan una experiencia interactiva y competitiva al catálogo. El efecto sobre la retención y la formación de precios es una hipótesis de valor que debe evaluarse con métricas de uso.

## 2. Gestión Ágil del Proyecto 

### 2.1 Product Backlog Priorizado (Historias de Usuario) 

El siguiente Product Backlog detalla los requerimientos funcionales y técnicos de Vindex. Ha sido priorizado basándose en el valor arquitectónico y de negocio, ordenando los elementos desde la infraestructura base hasta las funcionalidades críticas de concurrencia y seguridad financiera. 

7 

Épica 1: Infraestructura y Autenticación Base (Prioridad: Alta) 

_US-01: Estructura del Monorepo y Persistencia_ 

- **_Historia:_** Como desarrollador, quiero organizar la aplicación web y los paquetes compartidos en el monorepo e integrar la persistencia en Supabase, para mantener una base coherente para la evolución de Vindex. La incorporación de Docker, Redis o un backend NestJS es una tarea futura, no una precondición del flujo web actual. 

_US-02: Registro y Autenticación de Usuarios_ 

- **_Historia:_** Como usuario visitante, quiero registrarme, iniciar y cerrar sesión con mi correo electrónico y contraseña, para acceder a las funciones de compra y venta de la plataforma. La recuperación de contraseña y la verificación KYC quedan fuera del alcance actualmente implementado.

_US-03: Perfiles de Tienda para Vendedores_ 

- **_Historia:_** Como vendedor, quiero crear y personalizar un perfil de tienda (nombre, logo, descripción), para agrupar mis productos y generar confianza en los compradores. 

Épica 2: Marketplace y Gestión de Inventario (Prioridad: Alta) 

_US-04: Gestión de Catálogo de Productos (CRUD)_ 

- **_Historia:_** Como vendedor, quiero publicar y editar productos con imágenes, descripción, categoría y precio fijo, para mantener mi catálogo actualizado. La eliminación definitiva no está implementada.

_US-05: Carrito de Compras_ 

- **_Historia:_** Como comprador, quiero agregar múltiples productos a un carrito de compras interactivo, para revisar mi pedido y calcular el total antes de pagar. 

_US-06: Control de Stock Concurrente_ 

- **_Historia:_** Como vendedor, quiero que el stock disponible se valide al agregar productos al carrito y al procesar una compra, para reducir el riesgo de sobreventas. La validación transaccional ante compras concurrentes debe confirmarse en la base de datos.

Épica 3: Motor de Subastas e Interactividad (Prioridad: Media-Alta) 

_US-07: Configuración de Subastas_ 

- **_Historia:_** Como vendedor, quiero configurar un producto en modalidad "Subasta", definiendo un precio base, incrementos mínimos y fecha de término, para maximizar el valor de artículos exclusivos. 

8 

_US-08: Sala de Subastas y Sincronización_ 

- **_Historia:_** Como comprador, quiero ver el temporizador de cierre y el precio actual sincronizados con el servidor, para saber exactamente cuánto tiempo me queda para ofertar. 

_US-09: Pujas en Tiempo Real (Supabase Realtime)_ 

- **_Historia:_** Como comprador, quiero realizar una puja y que esta se refleje instantáneamente en la pantalla de todos los demás usuarios conectados, para participar en una competencia justa y sin latencia. 

_US-10: Regla Anti-Sniping_ 

- **_Historia:_** Como vendedor, quiero que si alguien oferta en los últimos minutos de la subasta, el temporizador se extienda automáticamente, para evitar que usuarios malintencionados roben el remate en el último segundo. 

Épica 4: Seguridad Financiera y Logística (Prioridad: Media) 

_US-11: Retención de Fondos en Custodia (Escrow)_ 

- **_Historia:_** Como comprador, quiero que al pagar por un producto, mi dinero quede retenido por la plataforma y no vaya directo al vendedor, para garantizar que no seré estafado si no recibo el artículo. 

_US-12: Generación de Código Dinámico (OTP) para Retiro Presencial_ 

- **_Historia:_** Como comprador que selecciona retiro presencial, quiero obtener un código único (OTP) asociado a mi orden, para entregarlo al vendedor solo cuando reciba el producto. La aplicación genera el código para este flujo; no se usa como autorización de pago ni implica custodia de fondos. 

_US-13: Confirmación de Entrega mediante OTP_ 

- **_Historia:_** Como vendedor, quiero ingresar el OTP proporcionado por el comprador en mi perfil, para confirmar la entrega y actualizar el estado de la orden. La confirmación actual no libera fondos; esa integración depende de una pasarela real y un flujo Escrow aún pendiente. 

Épica 5: Administración y Notificaciones (Prioridad: Baja - Cierre) 

_US-14: Panel de Control Administrativo_ 

- **_Historia:_** Como administrador del sistema, quiero acceder a un panel centralizado para moderar tiendas, ocultar productos inapropiados y revisar el estado de las transacciones. 

9 

_US-15: Sistema de Alertas y Notificaciones_ 

- **_Historia:_** Como usuario, quiero recibir notificaciones push o por correo electrónico cuando mi puja ha sido superada o cuando he ganado una subasta, para no perderme la compra. 

## 2.2. Sprint Backlog (Desarrollo por Iteración) 

El siguiente Sprint Backlog organiza el alcance de Vindex en ocho iteraciones de referencia. La documentación disponible no registra fechas, compromisos ni actas que permitan afirmar que se ejecutaron ocho Sprints de dos semanas; por ello, el estado se indica según la implementación web observada y no como evidencia de cierre histórico. La aplicación actual utiliza Next.js, React, TypeScript y Supabase; las tareas de backend NestJS, Redis, pagos reales y custodia permanecen como objetivos futuros mientras no exista evidencia de su implementación.

### Sprint 1: Infraestructura y Base de Datos 

**Objetivo del Sprint:** Establecer la base del repositorio y conectar la aplicación web con sus servicios de datos. 

- [US-01] Organización del proyecto como monorepo con la aplicación web Next.js y paquetes compartidos.

- Configuración de la aplicación web con TypeScript y las herramientas de desarrollo del repositorio.

- Integración de Supabase para autenticación, persistencia PostgreSQL y almacenamiento de imágenes.

- **Estado observado:** base web y conexión con Supabase documentadas; Docker, Redis y una API NestJS no se consideran implementados por la aplicación web actual.

### Sprint 2: Base del Marketplace / CRUD 

**Objetivo del Sprint:** Permitir el ingreso de usuarios y la publicación y consulta de artículos. 

- [US-02] Registro, inicio y cierre de sesión con Supabase Auth desde la aplicación web.

- [US-03] Vistas de perfiles de vendedor y tiendas.

- [US-04] Creación y edición de productos, carga de imágenes a Supabase Storage y consulta del catálogo. La eliminación de productos no está disponible; las publicaciones pueden retirarse mediante baja lógica donde corresponda.

10 

### Sprint 3: Carrito e Inventario 

**Objetivo del Sprint:** Habilitar la compra directa mediante un carrito persistente y un checkout simulado. 

- [US-05] Carrito con estado local persistido y sincronización con Supabase para usuarios autenticados; permite agregar, quitar y cambiar cantidades.

- [US-06] Validación de cantidades respecto del stock conocido en la interfaz. El checkout actual se ejecuta mediante la RPC `process_mock_checkout`; la documentación no acredita un flujo de pagos reales ni permite afirmar que el control de stock concurrente esté cubierto de extremo a extremo.

- Pantallas de checkout y confirmación, selección de dirección, envío y método de pago simulado; historial de compras y calificación de productos comprados.

### Sprint 4: Base del Módulo de Subastas 

**Objetivo del Sprint:** Permitir la publicación y consulta de productos en modalidad de subasta. 

- [US-07] Formulario web para crear subastas con precio inicial, incremento mínimo y duración; las subastas se almacenan en `products` en Supabase.

- Catálogo de subastas activas y páginas de detalle con la información disponible en la base de datos. La implementación no utiliza endpoints NestJS.

### Sprint 5: Tiempo Real y Pujas 

**Objetivo del Sprint:** Habilitar la interacción de pujas en la sala individual mediante Supabase Realtime y funciones de base de datos. 

- [US-08] Sala de subastas web con precio, ofertas, temporizador y sincronización del reloj con Supabase.

- [US-09] El cliente envía pujas mediante la RPC `place_bid`; la sala recibe cambios de `bids` y `products` mediante Supabase Realtime. No se utiliza Socket.io en la aplicación web actual.

- El catálogo, la sala y sus interacciones están descritos en el código y la documentación técnica web; sin embargo, `FEATURES.md` aún marca las subastas como pendientes. Por esta discrepancia y por la dependencia de la configuración remota, se documenta la implementación de la interfaz, no la validación completa del flujo en producción.

- Las validaciones y el cierre efectivo dependen de que la RPC, los triggers, las políticas RLS y la publicación Realtime estén correctamente configurados en Supabase.

- [US-10] La interfaz contempla la actualización del vencimiento recibida desde la base de datos. La regla anti-sniping debe verificarse en los triggers desplegados en Supabase; no se atribuye a Redis.

### Sprint 6: Checkout y Pagos 

**Objetivo del Sprint:** Completar el flujo de compra y definir las necesidades pendientes de seguridad financiera. 

11 

- El checkout permite seleccionar Webpay Plus o Mercado Pago como métodos simulados y crea órdenes mediante `process_mock_checkout`.

- [US-11] La integración real de pasarela y custodia de fondos (Escrow) continúa pendiente.

- [US-12 y US-13] En el retiro presencial, la RPC genera un OTP de seis dígitos y el vendedor puede validarlo desde sus órdenes; al confirmarlo, la orden pasa a `completed`. Este OTP confirma la entrega, pero no libera dinero. La configuración y las políticas de las RPC deben verificarse en Supabase.

### Sprint 7: Panel Administrativo y Notificaciones 

**Objetivo del Sprint:** Identificar y priorizar las herramientas operativas posteriores al MVP. 

- [US-14] Panel administrativo para moderar publicaciones, administrar tiendas y supervisar transacciones: pendiente.

- [US-15] Notificaciones push o por correo sobre pujas, resultados de subastas y pagos: pendientes. La mensajería entre comprador y vendedor sí cuenta con conversaciones y recepción de mensajes mediante Supabase Realtime.

### Sprint 8: QA, Testing y MVP 

**Objetivo del Sprint:** Validar los flujos existentes, cerrar brechas y preparar una eventual publicación. 

- Verificación manual de autenticación, catálogo, carrito, checkout simulado, mensajería y pujas; para estas últimas, comprobar RPC, RLS, triggers y Realtime en el proyecto Supabase.

- Ejecutar las comprobaciones de lint y tipos disponibles en `apps/web`; no se encontró un script de pruebas unitarias/E2E definido para esta aplicación.

- Resolver defectos detectados y registrar resultados, ambiente, datos de prueba y evidencia de cada validación.

- Despliegue: pendiente de documentar con URL y evidencia verificable. Este checkout no acredita un despliegue productivo ni un backend NestJS en Render.

## 2.3. Definition of Done (Criterios de Aceptación) 

En el marco ágil de Vindex, la Definición de Terminado (DoD) es el estándar de calidad global que debe cumplir una tarea para considerarse finalizada; los Criterios de Aceptación son las condiciones específicas de negocio de cada Historia de Usuario. Los criterios siguientes deben aplicarse según el alcance realmente implementado y la configuración de Supabase disponible; no implican que las funcionalidades pendientes ya estén construidas.

12 

### 2.3.1 Definición de Terminado Global (DoD) 

Para mover una Historia de Usuario del Sprint Backlog a "Terminado" (Done), debe cumplir el siguiente checklist: 

- Desarrollo y estándares: el código web está escrito en TypeScript, respeta el lint configurado y compila correctamente. En `apps/web` están disponibles los comandos `npm run lint`, `npm run check-types` y `npm run build`.

- Control de versiones: los cambios se revisan antes de integrarse y se conserva un historial trazable. La existencia de un Pull Request o de un flujo Jira debe verificarse en las herramientas del equipo; no se presume en este documento.

- Base de datos: si hay cambios de esquema, las migraciones, RPC, políticas RLS y triggers requeridos están documentados y verificados en Supabase; una implementación de interfaz no basta para dar por terminada una regla del servidor.

- Verificación: se han ejecutado las comprobaciones automatizadas disponibles y una prueba manual del flujo afectado; se registran resultados y errores. Si no existe API propia para el flujo, no se exige una respuesta HTTP de NestJS.

- Criterios específicos: se cumplen los criterios de aceptación y se comprueban los estados de carga, error, ausencia de datos y éxito pertinentes.

### 2.3.2 Ejemplos de Criterios de Aceptación por Funcionalidad Clave 

A continuación, se detallan criterios para los flujos implementados y para los objetivos pendientes. Los tiempos y reglas indicados son umbrales de aceptación que se deben medir, no resultados de pruebas ya ejecutadas:

Para las Historias de Usuario de la Sala de Subastas (Supabase Realtime): 

- Criterio 1: Cuando se acepta una puja válida, la sala debe reflejar la nueva puja y el precio vigente para las sesiones conectadas. El objetivo de latencia es inferior a 500 ms y debe verificarse con medición; no se garantiza por el mero uso de Realtime.

- Criterio 2: El sistema debe rechazar cualquier puja que sea inferior al precio actual más el incremento mínimo definido por el vendedor. 

- Criterio 3 (Anti-sniping): debe aplicarse el umbral y la extensión que estén definidos en el trigger desplegado. La documentación técnica actual describe una extensión de cinco minutos cuando quedan hasta tres minutos y treinta segundos; este criterio requiere verificar la configuración en Supabase antes de aprobarlo.

13 

Para las Historias de Usuario de Carrito y Checkout (flujo actualmente implementado): 

- Criterio 1: solo los productos de compra directa con stock disponible pueden agregarse al carrito; la cantidad elegida no puede superar el stock conocido.

- Criterio 2: para un usuario autenticado, el carrito debe sincronizarse con su cuenta y conservar sus artículos al recargar o volver a iniciar sesión.

- Criterio 3: al confirmar el checkout, `process_mock_checkout` debe crear la orden y sus ítems a partir del carrito remoto, vaciarlo y mostrar la confirmación. La interfaz debe indicar que el método de pago es simulado.

Para la Historia de Usuario de Pagos en Custodia (Escrow), pendiente de implementación:

   - Criterio 1: Al procesar un pago mediante una pasarela real, el estado de la orden debe reflejar la retención y el dinero no debe transferirse al vendedor antes de confirmarse la entrega. 

   - Criterio 2: El sistema debe asociar la transacción a la orden y conciliar de forma verificable la confirmación de pago. 

   - Criterio 3: La liberación de fondos debe ejecutarse una sola vez, después de la validación de entrega, y registrar un resultado auditable. La integración y las medidas específicas de seguridad deben definirse antes de implementar el flujo.

Para las Historias de Usuario de OTP y confirmación de entrega (flujo de retiro presencial implementado en la aplicación web):

   - Criterio 1: Al elegir retiro presencial, la orden debe quedar en estado `pending_pickup` y la RPC debe generar un código OTP de seis dígitos asociado a esa orden.

   - Criterio 2: Solo el comprador autorizado debe poder consultar el código de su orden mediante la función correspondiente; el vendedor no debe acceder al secreto almacenado y solo debe ingresarlo al recibir el código del comprador.

   - Criterio 3: El vendedor debe poder validar el código mediante la función de verificación. Si es correcto, la orden cambia a `completed` y el comprador puede calificar el producto. Esta verificación confirma la entrega, pero no procesa ni libera fondos.

   - Criterio 4: Probar que un comprador no pueda consultar el código de otra orden y que un vendedor no pueda completar una orden con un código incorrecto. Confirmar que las RPC y políticas RLS requeridas estén desplegadas en Supabase.

### 2.4 Evidencia de Retrospectivas 

No se encontraron actas, fechas ni acuerdos de retrospectivas en la documentación disponible. Para completar esta evidencia en cada Sprint, registrar:

- **Sprint y fecha:** número de iteración y fecha de la reunión.
- **Participantes:** integrantes que asistieron.
- **Qué funcionó:** prácticas o resultados que conviene mantener.
- **Qué dificultó el trabajo:** impedimentos y causas observadas.
- **Acciones de mejora:** acción concreta, responsable y fecha de seguimiento.
- **Resultado de seguimiento:** indicar si la acción se completó y qué efecto tuvo.

No se incorporan retrospectivas ficticias; esta sección debe actualizarse con los registros reales del equipo.

## 3. Diagramas UML 

Para documentar la interacción de los actores y la arquitectura de Vindex, se incluyen los siguientes diagramas. La compra directa, las salas de subasta y la confirmación OTP para retiro presencial cuentan con comportamiento en la aplicación web, sujeto a la configuración de Supabase. La custodia de pagos y la liberación de fondos representan objetivos futuros. 

14 

### 3.1 Diagrama de Casos de Uso 

Este diagrama ilustra las interacciones entre Comprador y Vendedor: compra directa, subastas y validación de entrega. El OTP está implementado para confirmar retiros presenciales; el Escrow y la liberación de fondos no están disponibles en la aplicación web actual.



<!-- Start of picture text -->
Plataforma Vindex<br>Registrarse<br>Iniciar Sesion<br>Realizar Puja en<br>Ws a,<br>Gestionar Tienda H<br>y Catalogo i<br>Lip] Pagaren custosia ‘Comprador<br>= Escrow po<br>Configurar i<br>Subasta i<br>Directamente<br>Ingresar Cédigo<br>OTP ‘Valida entrega para- ‘Bl Recibir Fondos<br><!-- End of picture text -->

15 

### 3.2 Diagrama de Secuencia (Funcionalidad Principal: Pago Escrow y Validación OTP) 

El diagrama representa el flujo propuesto de custodia y validación de entrega. En la aplicación web, el checkout simula el pago y genera un OTP para el retiro presencial; el vendedor puede validarlo para completar la orden. La integración con pasarela, la retención del dinero y su liberación no están implementadas, por lo que cualquier paso del diagrama referido a esos procesos es una funcionalidad futura.



<!-- Start of picture text -->
"a0, 246,258) "Usmos (tres? “Econo Vinee “Senor Exe<br>comersA VerdeserA Frontend (Nests) ‘Backend Supabase [Base de Datos Mercado Pago yTransbank<br>Pana eaucn<br>Process<br>eence compra Seta tren 00)<br>Guarda Conia der rio<br>Retna ortonyeela TP<br>Mesa Gen pra os90 OTP<br>Erevento<br>Entep oticfo paray dita eteoeOTP<br>Ing OT? enla atoma Evia OTPprvi<br>Vesa<br>quo OTP concise<br>Vliacin econ<br>rene ies odor<br>nero neti<br>Acatz<br>Ral confer eta oConpltado™<br>Mufeta<br>lee adopecuaie acudzado<br>° Q ror secon | SS | ==<br>comers verso { J<br><!-- End of picture text -->

16 

### 3.3 Diagrama de Componentes 

El diagrama muestra una arquitectura objetivo. En el checkout disponible, la aplicación web está construida con Next.js y se integra directamente con Supabase (PostgreSQL, Auth, Storage y Realtime); no se acredita aquí una API NestJS, Redis ni pasarelas de pago reales. El diagrama no debe interpretarse como un inventario de componentes actualmente desplegados.



<!-- Start of picture text -->
Capa de Presentacién<br>Cliente Web<br>Nexts + React<br>HITPIRES WSS Bidireccional<br>| ‘Capa de Negocio -API |<br>Gateway<br>API Core WebSockets<br>NestiS REST Socketo<br>LecturarEsertura Validacén Token Gestion Archivos Emite Eventos RetencionLiberacién _Sincroniza Tempos<br>pa de Datos ¢ infraestuctura Pasarela de Pagos<br>_— Mercado Pago<br>wr Imagenes Redis<br>PostgreSQL Supabase Auth Supabase Storage a Sandbox<br>Supabase PubiSub<br>& Cache<br><!-- End of picture text -->

## 4. Requisitos No Funcionales 

Los siguientes atributos fijan objetivos y comprobaciones para Vindex. Se distingue entre lo que utiliza actualmente la aplicación web y lo que aún requiere implementación o validación externa; no se presentan metas como resultados ya medidos.

17 

### 4.1. Seguridad 

Dado que Vindex maneja cuentas de usuario, órdenes y códigos de retiro, la seguridad es un requisito transversal. El checkout actual es simulado y no implementa custodia de fondos: 

- **Autenticación y autorización:** El registro y el inicio de sesión web utilizan Supabase Auth. El acceso a datos debe seguir las políticas RLS configuradas en Supabase. No se atribuyen Guards de NestJS a esta aplicación web.

- **Protección de datos:** Las credenciales se gestionan mediante Supabase Auth y no deben almacenarse en el código ni en el repositorio. Las variables públicas requeridas por el cliente son la URL y la clave publicable de Supabase; cualquier secreto de servidor debe mantenerse fuera del cliente. Para el retiro presencial, el comprador consulta el OTP de su orden mediante `get_buyer_delivery_code` y el vendedor verifica el código mediante `verify_delivery_otp`. La autorización de estas funciones y la protección del código dependen de las RPC y políticas desplegadas en Supabase; no se afirma que el OTP esté cifrado o almacenado como hash sin evidencia de su implementación SQL.

- **Pagos:** El checkout usa métodos simulados y no captura datos de tarjetas ni ejecuta una integración real de pago. Una futura pasarela deberá procesar los datos sensibles directamente en sus componentes seguros y validar sus notificaciones en servidor; ese alcance está pendiente.

### 4.2. Rendimiento 

El modelo híbrido de Vindex exige tiempos de respuesta rápidos para mantener la equidad en las subastas: 

- **Latencia en tiempo real:** La sala de subasta recibe cambios mediante Supabase Realtime. El objetivo de menos de 500 milisegundos para reflejar una puja debe medirse en el entorno desplegado, con varias sesiones concurrentes; no se presupone un gateway Socket.io o Redis.

- **Recursos estáticos:** Las imágenes de producto se alojan en Supabase Storage. La conversión y el tamaño de las imágenes deben verificarse al publicar, así como el tiempo de carga del catálogo; no se fija un resultado de rendimiento sin mediciones.

### 4.3. Escalabilidad 

La aplicación debe poder atender crecimiento de usuarios y actividad simultánea, especialmente en las salas de subasta:

18 

- **Capacidad:** La persistencia del estado de productos, pujas, carritos y mensajes en Supabase permite que el navegador no sea la fuente de verdad. La capacidad ante concurrencia depende también de la configuración, límites y funciones de Supabase, y debe probarse antes de comprometer niveles de servicio.

- **Despliegue independiente:** El monorepo organiza aplicaciones y paquetes; la existencia de una plataforma de hosting o escalamiento automático debe documentarse con evidencia del despliegue. Este documento no afirma que Vercel o Render estén configurados.

### 4.4. Disponibilidad 

La disponibilidad de la web y de sus dependencias debe verificarse en los entornos donde se despliegue:

- **Dependencias externas:** La aplicación depende de Supabase para autenticación, datos y servicios Realtime. Los objetivos de disponibilidad deben basarse en los planes y acuerdos vigentes de los proveedores realmente contratados, no en servicios que no se hayan configurado.

- **Manejo de fallos:** Si se pierde la conexión a Realtime, se debe informar al usuario y recuperar el estado mediante una consulta actualizada al restablecerse la conexión. La hora sincronizada ayuda a la interfaz, pero la aceptación definitiva de pujas corresponde a la base de datos.

### 4.5. Portabilidad (Docker) 

La ejecución local documentada para la aplicación web usa Node.js y npm. No se encontró un Dockerfile ni un archivo `docker-compose.yml` en el checkout; por lo tanto, Docker se considera una mejora posible y no un requisito ya configurado:

- **Entorno reproducible:** registrar las versiones de Node.js y npm utilizadas, instalar las dependencias desde el manifiesto y configurar las variables requeridas. Si se incorpora Docker en el futuro, documentar su configuración y validar que no requiera credenciales compartidas.

## 5. Despliegue, Docker y Manual Técnico 

19 

### 5.1. Entorno de Portabilidad (Dockerfiles y docker-compose) 

La aplicación web no incluye configuración Docker verificada en este checkout. Para ejecutarla localmente se requiere Node.js, npm y acceso a un proyecto Supabase configurado. La contenerización queda como trabajo futuro, no como paso necesario para iniciar el frontend.

### 5.2. Variables de entorno 

Crear `apps/web/.env.local` a partir de un archivo de ejemplo local y configurar:

- `NEXT_PUBLIC_SUPABASE_URL`: URL del proyecto Supabase.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: clave publicable correspondiente al proyecto.

No incluir claves secretas, contraseñas ni valores de producción en el repositorio. La clave publicable se utiliza desde el navegador y debe complementarse con políticas RLS correctamente configuradas en Supabase. No hay variables de una pasarela real requeridas por el checkout simulado.

### 5.3. Cómo levantar el sistema localmente 

Desde la carpeta `apps/web`:

1. Instalar las dependencias del monorepo desde su raíz con `npm install`.
2. Crear y completar `apps/web/.env.local` con las variables indicadas.
3. Ejecutar `npm run dev`.
4. Abrir `http://localhost:3000`.

Para verificar calidad antes de integrar cambios, ejecutar desde `apps/web`: `npm run lint`, `npm run check-types` y `npm run build`. El acceso a funciones que consultan Supabase requiere que las credenciales, el esquema, las políticas y las funciones remotas correspondientes estén disponibles.

## 6. Calidad y Pruebas (Plan de pruebas ágil) 

### 6.1. Pruebas Unitarias y de Integración 

En el `package.json` de `apps/web` están configurados lint, verificación de tipos y build; no se encontró un comando de pruebas unitarias o E2E. Por ello, los flujos siguientes son casos de prueba manuales que deben registrarse con fecha, ambiente, resultado y evidencia. La ausencia de un registro se considera pendiente de validación, no una prueba aprobada.

- **Autenticación:** Registrar una cuenta, iniciar y cerrar sesión y visitar una ruta protegida. Resultado esperado: la sesión se crea o termina correctamente y la ruta respeta el estado de autenticación.
- **Catálogo y producto:** Consultar productos activos, abrir un detalle y revisar una publicación de vendedor. Resultado esperado: se presentan los datos disponibles y los errores de consulta no se confunden con un catálogo vacío.
- **Carrito:** Agregar un producto directo, modificar su cantidad, quitarlo, recargar y probar con una cuenta autenticada. Resultado esperado: total y cantidades coherentes; el carrito autenticado se sincroniza con Supabase.
- **Checkout simulado:** Completar el checkout con Webpay o Mercado Pago simulado. Resultado esperado: la RPC crea una orden y sus ítems desde el carrito remoto, lo vacía y muestra confirmación; el flujo no se presenta como pago real.
- **Mensajería:** Iniciar una conversación, enviar un mensaje y abrirla desde otra sesión autorizada. Resultado esperado: historial y mensajes nuevos visibles conforme a las políticas RLS y Realtime.
- **Subasta:** Publicar una subasta, probar valores inválidos, registrar una puja y observar otra sesión. Resultado esperado: la interfaz valida el rango, la RPC es la vía de envío y la sala refleja los cambios de Realtime; RLS y triggers se verifican directamente en Supabase.
- **Retiro presencial con OTP:** Completar una compra con retiro en tienda, consultar el código desde la cuenta compradora, ingresar el código desde la cuenta vendedora y verificar que la orden pase de `pending_pickup` a `completed`. Probar además un código incorrecto y el acceso a una orden ajena; la configuración de las RPC y políticas debe confirmarse en Supabase.
- **Custodia de pagos:** No aplicable a la versión web actual. Mantener pendiente hasta implementar y probar una pasarela real, custodia y liberación de fondos.

Después de cualquier cambio de esquema, repetir los flujos afectados contra un entorno de prueba de Supabase y registrar qué migraciones, RPC, triggers y políticas se utilizaron.

### 6.2. Pruebas de Rendimiento y Seguridad (Realtime, acceso y pagos) 

- **Rendimiento de subastas:** medir el tiempo entre una puja aceptada y la actualización visible en varias sesiones; el objetivo de menos de 500 ms debe reportarse con número de clientes, ambiente, cantidad de operaciones y percentiles observados.
- **Concurrencia de pujas:** enviar ofertas simultáneas a una misma subasta y comprobar que la RPC/triggers de PostgreSQL conservan una única secuencia válida y rechazan montos fuera de regla.
- **Autorización:** probar con usuarios distintos el acceso a carritos, órdenes, mensajes y operaciones del vendedor; confirmar que RLS impide lecturas y escrituras ajenas.
- **Recuperación de conexión:** desconectar y reconectar una sala y comprobar que el estado se resincroniza desde Supabase sin perder la puja aceptada.
- **Pagos:** no ejecutar pruebas de carga o seguridad de Escrow mientras el flujo real no exista. Antes de habilitarlo, probar webhooks, idempotencia, autorización, tratamiento de errores y prevención de doble liberación en un ambiente sandbox. El OTP de retiro presencial debe probarse aparte como mecanismo de confirmación de entrega; no debe confundirse con la autorización financiera.

Toda medición debe acompañarse de fecha, versión, configuración, datos de entrada y resultado. No se deben publicar secretos ni datos personales en evidencias.

20 

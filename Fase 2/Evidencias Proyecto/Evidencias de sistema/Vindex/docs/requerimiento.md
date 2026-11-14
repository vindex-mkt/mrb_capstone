Quiero implementar un sistema completo de moderación de productos en Vindex para impedir que productos prohibidos, como armas, explosivos u otros artículos restringidos, se publiquen directamente en el marketplace sin revisión.
Ya conoces el contexto, la arquitectura, las tecnologías y la estructura de mi proyecto. Utiliza esa información para adaptar la implementación al código existente.
1. Objetivo general
Implementar un sistema de moderación previa a la publicación que permita:
•	Que los vendedores puedan crear productos normalmente.
•	Que los productos nuevos queden pendientes de revisión antes de aparecer públicamente.
•	Que exista un sistema inicial de detección automática basado en texto.
•	Que los productos sospechosos puedan ser identificados y priorizados para revisión manual.
•	Que un administrador pueda aprobar o rechazar productos desde un panel administrativo. (El panel administrativo debe ser moderno e intuitivo, actualmente solo se pueden crear categorías en él. Yo quiero que sea un panel completo con varias opciones, ahí se podrá acceder a las categorías del sitio web y también a moderación, haz esta estructura base del panel de admin para incluir mas funciones después tambien)
•	Que los productos aprobados se publiquen correctamente.
•	Que los productos rechazados permanezcan ocultos.
•	Que se registre el historial de moderación.
•	Que la implementación quede preparada para integrar en el futuro un modelo de inteligencia artificial que analice imágenes de productos y entregue porcentajes de coincidencia con categorías peligrosas.
Importante: la detección de imágenes mediante IA es una funcionalidad futura. No quiero que implementes, entrenes ni conectes ningún modelo de imágenes en esta fase.
Por ahora, implementa únicamente la estructura necesaria para que pueda incorporarse posteriormente sin tener que rehacer el sistema de moderación.
________________________________________
2. Estados de moderación
Primero, inspecciona la tabla products y cómo se utiliza actualmente el campo status.
No reemplaces ni elimines el estado comercial existente sin comprobar sus dependencias.
Implementa un sistema de moderación separado del estado comercial.
Utiliza los siguientes estados de moderación:
•	pending_review: producto pendiente de revisión.
•	approved: producto aprobado.
•	rejected: producto rechazado.
•	flagged: producto marcado para revisión prioritaria.
Si actualmente existe una estructura equivalente, reutilízala o adapta la implementación sin duplicar innecesariamente estados.
Comportamiento esperado
Producto nuevo:
•	Se crea como pendiente de revisión.
•	No aparece en las consultas públicas del marketplace.
•	No puede comprarse ni agregarse al carrito.
•	No puede participar en subastas públicas.
Producto aprobado:
•	Puede aparecer públicamente si también cumple las condiciones comerciales existentes.
•	Puede utilizar los mecanismos actuales de venta, carrito y subastas.
•	No debe perder sus relaciones con vendedor, tienda, categorías o imágenes.
Producto rechazado:
•	No aparece públicamente.
•	No puede comprarse.
•	El vendedor puede consultar el motivo del rechazo.
•	No debe eliminarse automáticamente.
Producto marcado:
•	Permanece oculto hasta que un administrador lo revise.
•	Debe aparecer prioritariamente en el panel administrativo.
No permitas que un producto pendiente, rechazado o marcado pueda aparecer públicamente simplemente porque su campo status comercial tenga el valor active.
________________________________________
3. Migración de base de datos
Inspecciona el esquema actual de Supabase antes de crear migraciones.
Implementa los cambios necesarios mediante migraciones SQL versionadas y compatibles con el esquema existente.
A. Moderación de productos
Agrega, si no existen, los campos necesarios para representar:
•	Estado de moderación.
•	Motivo de revisión.
•	Fecha de última revisión.
•	Administrador responsable de la revisión.
Utiliza nombres coherentes con las convenciones existentes.
La información debe permitir identificar:
•	Si el producto está pendiente.
•	Si fue aprobado.
•	Si fue rechazado.
•	Si necesita revisión prioritaria.
•	Cuándo fue revisado.
•	Quién tomó la decisión.
•	Por qué fue rechazado o marcado.
No reemplaces los campos comerciales actuales de productos.
B. Historial de moderación
Crea una tabla product_moderation_reviews, o adapta una tabla equivalente si ya existe.
Debe permitir almacenar:
•	Identificador de la revisión.
•	Identificador del producto.
•	Identificador del administrador responsable, cuando corresponda.
•	Acción realizada.
•	Motivo de la decisión.
•	Información de las reglas automáticas que activaron la revisión.
•	Fecha de creación.
Acciones iniciales:
•	approved
•	rejected
•	flagged
•	resubmitted
El historial debe permitir conocer las decisiones anteriores de moderación.
No sobrescribas las revisiones anteriores al aprobar o rechazar un producto.
C. Información preparada para futuras detecciones
Quiero que la estructura permita incorporar posteriormente diferentes sistemas de detección.
Por ejemplo:
•	Detección por texto.
•	Detección por imágenes.
•	Detección por categorías.
•	Revisión manual.
Prepara una estructura razonable para registrar:
•	Tipo de detección.
•	Categoría de riesgo.
•	Resultado.
•	Motivo.
•	Puntaje de coincidencia, cuando exista.
•	Versión del detector, cuando corresponda.
No implementes todavía el modelo de imágenes.
No inventes porcentajes de detección.
No generes resultados de IA ficticios.
Si consideras necesario crear una tabla independiente para registrar resultados de detección, hazlo únicamente si aporta una estructura útil y evita duplicar información existente.
________________________________________
4. Detección automática inicial mediante texto
Implementa un sistema de reglas que analice los productos antes de permitir su publicación.
Debe revisar:
•	Título.
•	Descripción.
•	Categoría.
•	Etiquetas, si existen.
El sistema debe ser modular, reutilizable y fácil de ampliar.
Categorías iniciales
Prepara reglas para identificar posibles productos relacionados con:
•	Armas de fuego.
•	Municiones.
•	Explosivos.
•	Armas blancas restringidas.
•	Drogas y sustancias prohibidas.
•	Productos falsificados.
•	Otros artículos prohibidos definidos en las políticas de Vindex.
No implementes una lista indiscriminada de palabras que rechace automáticamente cualquier producto relacionado con estos términos.
Por ejemplo, un libro sobre armas puede mencionar una pistola sin que el producto sea un arma.
Resultados de detección
El sistema debe diferenciar:
1.	Sin coincidencias relevantes.
2.	Coincidencia sospechosa.
3.	Coincidencia que requiere revisión prioritaria.
La detección automática debe generar información útil para el moderador.
No debe aprobar automáticamente productos basándose únicamente en la ausencia de coincidencias.
Reglas importantes
•	Normaliza el texto antes de analizarlo.
•	Considera diferencias entre mayúsculas y minúsculas.
•	Considera acentos y variantes ortográficas razonables.
•	Evita coincidencias parciales que generen falsos positivos.
•	Mantén las reglas separadas de los componentes visuales.
•	Permite agregar nuevas categorías sin modificar toda la lógica.
•	Registra las reglas activadas y los motivos.
El sistema debe ser determinista y ejecutarse sin depender de APIs externas.
________________________________________
5. Preparar la arquitectura para moderación futura de imágenes
Esta parte es importante porque posteriormente quiero implementar un modelo de inteligencia artificial entrenado con imágenes de productos peligrosos, como armas.
El modelo futuro podría recibir las imágenes de un producto y devolver resultados similares a:
•	Categoría detectada.
•	Porcentaje de coincidencia.
•	Nivel de riesgo.
•	Identificación del modelo utilizado.
Por ejemplo, en una futura implementación podría entregar:
•	Categoría: arma de fuego.
•	Coincidencia: 92%.
•	Resultado: revisión manual prioritaria.
Este ejemplo es únicamente ilustrativo.
No implementes todavía el modelo, su entrenamiento ni su inferencia.
Lo que sí debes implementar ahora
Diseña el sistema de moderación para que en el futuro pueda recibir resultados de diferentes detectores.
El sistema debe poder distinguir:
•	Detección por texto.
•	Detección por imágenes.
•	Detección por categoría.
•	Revisión manual.
Debe existir una forma de registrar resultados de detección sin acoplar la moderación a un modelo específico.
Si implementas una interfaz o módulo para futuros detectores:
•	Define únicamente la estructura necesaria.
•	No realices inferencias.
•	No instales bibliotecas de machine learning.
•	No descargues modelos.
•	No agregues servicios de pago.
•	No generes resultados simulados.
•	No ejecutes detección de imágenes todavía.
La arquitectura debe permitir que en el futuro pueda incorporar un modelo local o un servicio externo que entregue resultados a Vindex.
Preparación para porcentajes de coincidencia
Prepara la estructura para almacenar un puntaje numérico de coincidencia cuando un detector futuro lo proporcione.
El puntaje debe:
•	Ser opcional.
•	Tener una definición clara.
•	Poder asociarse a una categoría detectada.
•	Identificar el detector que generó el resultado.
•	Permitir registrar varios resultados por producto.
•	No confundirse con una decisión de moderación.
No utilices el porcentaje como prueba definitiva de que un producto está prohibido.
La decisión final debe continuar dependiendo de la revisión humana cuando corresponda.
________________________________________
6. Panel administrativo de moderación
Implementa una sección administrativa para revisar publicaciones.
Utiliza las rutas, componentes, autenticación y diseño que ya existen en Vindex.
No crees un sistema administrativo completamente separado si ya existe uno.
A. Lista de productos pendientes
Debe permitir visualizar:
•	Productos pendientes de revisión.
•	Productos marcados como sospechosos.
•	Productos rechazados, cuando se necesite consultar su historial.
•	Productos previamente aprobados, cuando se necesite revisar decisiones anteriores.
Incluye filtros por:
•	Estado de moderación.
•	Categoría.
•	Fecha de publicación.
•	Vendedor.
•	Nivel de prioridad.
B. Detalle del producto
El administrador debe poder revisar:
•	Título.
•	Descripción.
•	Categoría.
•	Precio.
•	Tipo de venta.
•	Vendedor.
•	Tienda, si corresponde.
•	Imágenes.
•	Resultados de las reglas automáticas.
•	Motivos por los que el producto fue marcado.
•	Historial de moderación.
Debe ser posible revisar productos publicados por vendedores individuales y productos asociados a tiendas.
C. Acciones administrativas
Implementa:
Aprobar
•	Cambia el estado de moderación a aprobado.
•	Registra quién tomó la decisión.
•	Registra la fecha.
•	Registra la acción en el historial.
•	Permite que el producto aparezca públicamente si cumple las demás condiciones.
Rechazar
•	Requiere un motivo.
•	Cambia el estado de moderación a rechazado.
•	Registra la decisión.
•	Mantiene el producto oculto.
•	Permite al vendedor consultar el motivo.
Marcar para revisión
•	Permite indicar que el producto necesita una revisión adicional.
•	Registra el motivo.
•	Mantiene el producto oculto.
•	Lo muestra en la lista de revisión prioritaria.
No permitas que una acción administrativa se ejecute únicamente modificando el estado desde el frontend.
________________________________________
7. Permisos y seguridad
Implementa las protecciones necesarias utilizando Supabase Auth, PostgreSQL, RLS y los mecanismos de autorización existentes.
Vendedores
Un vendedor debe poder:
•	Crear productos.
•	Consultar sus propios productos.
•	Consultar el estado de moderación de sus publicaciones.
•	Consultar el motivo de rechazo.
•	Editar sus productos según las reglas existentes.
No debe poder:
•	Aprobar sus propios productos.
•	Rechazar productos.
•	Modificar el historial de moderación.
•	Cambiar arbitrariamente el estado de moderación.
•	Consultar publicaciones privadas de otros vendedores.
Administradores
Solamente los administradores autorizados deben poder:
•	Consultar la cola completa de moderación.
•	Revisar productos de otros vendedores.
•	Aprobar productos.
•	Rechazar productos.
•	Marcar productos.
•	Consultar el historial administrativo.
Utiliza el sistema de roles existente.
No inventes un rol administrativo nuevo si ya existe uno.
Si actualmente no existe un mecanismo seguro de autorización administrativa, identifica qué falta y propón una implementación compatible.
No confíes en un valor enviado desde el navegador para determinar si un usuario es administrador.
RLS
Revisa las políticas existentes y crea las necesarias.
Protege:
•	Productos pendientes.
•	Productos rechazados.
•	Historial de moderación.
•	Resultados de detección.
•	Acciones administrativas.
Los usuarios no autorizados no deben poder consultar ni modificar información administrativa.
No desactives RLS para facilitar la implementación.
No utilices service_role en componentes cliente.
Si se necesita realizar una operación privilegiada desde el servidor, utiliza el mecanismo seguro existente y verifica previamente la autorización del administrador.
________________________________________
8. Publicación y consultas públicas
Revisa todos los lugares donde Vindex consulta productos.
Incluye, según corresponda:
•	Página principal.
•	Catálogo.
•	Búsqueda.
•	Categorías.
•	Tiendas.
•	Productos destacados.
•	Ofertas.
•	Subastas.
•	Carrito.
•	Detalle de producto.
•	Realtime.
Los productos públicos deben cumplir simultáneamente las condiciones comerciales existentes y estar aprobados por moderación.
No basta con ocultarlos mediante CSS o filtros en el frontend.
La protección debe aplicarse en las consultas y en las políticas de acceso correspondientes.
Cambios de productos aprobados
Si un vendedor modifica un producto aprobado, revisa qué campos pueden afectar su seguridad.
Los cambios relevantes en:
•	Título.
•	Descripción.
•	Categoría.
•	Imágenes.
Deben provocar una nueva revisión.
Mientras se revisa la modificación, el producto debe permanecer oculto o utilizar un mecanismo de revisión de cambios que impida mostrar contenido nuevo sin aprobar.
No permitas que el vendedor cambie un producto aprobado y conserve automáticamente la aprobación del contenido modificado.
Adapta este comportamiento al sistema actual sin romper las relaciones del producto ni sus operaciones comerciales.
________________________________________
9. Supabase Storage e imágenes
Inspecciona cómo se almacenan actualmente las imágenes de productos.
Quiero que la moderación permita mantener privadas las imágenes de productos pendientes y rechazados.
Si actualmente se utiliza un bucket público:
•	Evalúa cómo separar imágenes pendientes de imágenes aprobadas.
•	Utiliza un bucket privado para las imágenes que todavía no pueden publicarse.
•	Mantén las imágenes aprobadas accesibles según el diseño actual del marketplace.
•	Protege las imágenes mediante políticas de acceso apropiadas.
•	Evita exponer directamente imágenes de productos rechazados mediante URLs públicas.
No cambies indiscriminadamente el sistema actual de imágenes.
Antes de modificar buckets, comprueba:
•	Qué componentes cargan imágenes.
•	Qué rutas generan sus URLs.
•	Qué productos utilizan actualmente cada bucket.
•	Si hay dependencias con tiendas, subastas o perfiles.
Si es necesario migrar imágenes existentes, prepara una migración segura y explícita.
No elimines imágenes existentes.
No copies automáticamente productos pendientes a un bucket público.
________________________________________
10. Supabase Realtime
Utiliza Realtime para mejorar el panel de moderación si la arquitectura actual lo permite.
Quiero que:
•	Los nuevos productos pendientes aparezcan en la cola administrativa.
•	Los cambios de estado se reflejen en la interfaz.
•	Los administradores no tengan que recargar manualmente para ver nuevas publicaciones.
•	Los vendedores puedan ver los cambios de moderación de sus propios productos.
Respeta las políticas RLS.
No transmitas información administrativa a usuarios no autorizados.
Evita suscripciones innecesarias o duplicadas.
Implementa correctamente la limpieza de suscripciones cuando corresponda.
________________________________________
11. Reportes de productos
Prepara una estructura básica para que los usuarios puedan reportar productos publicados.
Motivos iniciales:
•	Producto prohibido.
•	Posible falsificación.
•	Descripción engañosa.
•	Categoría incorrecta.
•	Otro motivo.
Si ya existe un sistema de reportes, reutilízalo.
Si no existe, implementa una estructura mínima que permita:
•	Registrar el producto reportado.
•	Registrar el usuario que reporta.
•	Registrar el motivo.
•	Registrar la fecha.
•	Consultar los reportes desde administración.
•	Marcar un reporte como revisado.
Los reportes no deben aprobar ni rechazar automáticamente un producto.
Si un producto recibe un reporte, no lo ocultes automáticamente por cualquier denuncia sin revisar primero las reglas de moderación y el sistema de reportes.
________________________________________
12. Interfaz del vendedor
Adapta la experiencia de publicación de productos.
Cuando un vendedor publique:
1.	El producto se crea.
2.	Se ejecutan las reglas automáticas de texto.
3.	Se determina el estado de moderación.
4.	Se informa al vendedor que el producto está pendiente.
5.	El producto permanece oculto hasta su aprobación.
El vendedor debe poder consultar:
•	Pendiente de revisión.
•	Aprobado.
•	Rechazado.
•	Revisión prioritaria.
Cuando se rechace un producto, muestra el motivo proporcionado por el administrador.
Cuando se apruebe, informa que ya puede aparecer en el marketplace.
Mantén el diseño visual actual de Vindex.
No rompas el flujo de creación de productos.
________________________________________
13. Requisitos técnicos
Utiliza la arquitectura existente:
•	Next.js.
•	React.
•	TypeScript.
•	Supabase PostgreSQL.
•	Supabase Auth.
•	Supabase Storage.
•	Supabase Realtime.
•	Vercel.
No agregues un backend independiente.
No integres servicios de moderación pagos.
No instales modelos de inteligencia artificial.
No agregues nuevas dependencias si no son necesarias.
Mantén la implementación compatible con los planes gratuitos actuales, dentro de sus límites.
________________________________________
Restricción final
Implementa el sistema de moderación descrito en esta tarea, pero no implementes todavía el modelo de inteligencia artificial para detectar armas u otros productos peligrosos mediante imágenes.
Quiero que el sistema quede funcional ahora, con revisión manual y detección por texto, y preparado para que en una futura fase pueda conectar un modelo de imágenes que entregue resultados de clasificación y porcentajes de coincidencia.
No realices refactorizaciones generales ni modifiques funcionalidades existentes que no sean necesarias para esta implementación.

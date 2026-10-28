1. Valor de la Garantía
Porcentaje del Precio Base:
Se exige una garantía del 10% al 15% del valor inicial o precio base configurado por el vendedor.
Ejemplo: Si una subasta parte en $100.000 CLP, la garantía para entrar a pujar es de $10.000 CLP.

2. Arquitectura del Sistema de Pago y Fondos: Modelo "Billetera Virtual / Créditos" (Vindex Wallet)
Para gestionar las garantías de forma fluida y económica, el modelo basado en Billetera de Créditos Interna es la mejor opción técnica y operativa.
¿Cómo funciona el flujo?
Carga de Saldo (Depósito):
El usuario recarga saldo en su "Billetera Vindex" mediante transferencia o pasarela de pago 1 Crédito = $1 CLP
Bloqueo de Garantía (Hold/Retención):
Al momento de realizar la primera puja en una subasta, el sistema ejecuta una función RPC en PostgreSQL (lock_auction_guarantee) que no descuenta el dinero, sino que congela/reserva los créditos necesarios de la billetera del usuario.
Mientras la garantía está retenida, ese saldo no se puede retirar ni usar para entrar a otra subasta.
Pujar sin Comisiones Adicionales:
Una vez bloqueada la garantía para una subasta específica, el usuario puede pujar cuantas veces quiera en esa misma subasta sin tener que volver a pagar nada extra.

3. ¿Qué pasa con la Garantía en los distintos Escenarios de la Subasta?
Escenario A: El usuario NO gana la subasta
Liberación Automática e Inmediata: En el instante en que el temporizador de la subasta llega a cero y el sistema declara al ganador, un SQL Trigger / función RPC libera los créditos retenidos a todos los participantes perdedores.
El saldo pasa de estado "Retenido" a "Disponible" en su Billetera Vindex inmediatamente, listo para ser usado en otra subasta, comprar productos directos o ser retirado a su cuenta bancaria.
Escenario B: El usuario GANA la subasta
Abono al Precio Final: La garantía se descuenta del total que debe pagar por el producto.
Ejemplo: Subasta ganada en $100.000 CLP con garantía previa retenida de $10.000 CLP. Al momento de pagar, el saldo pendiente es de solo $90.000 CLP.
Escenario C: El usuario GANA pero NO PAGA (Infracción/Incumplimiento)
Penalización y Retención Definitiva: Se establece un plazo límite de pago (ej. 24 a 48 horas). Si el ganador no completa el pago del saldo restante, pierde la garantía retenida.
Distribución de la Penalización:
70% para el Vendedor: Como compensación por el tiempo perdido y la falla de la venta.
30% para Vindex: Por concepto de comisión operacional e infracción a las políticas de la plataforma.

Notificaciones Push/Realtime en Billetera:
Cuando finaliza la subasta, enviar una notificación en tiempo real vía WebSockets: "La subasta ha finalizado. Hemos liberado tu garantía de $10.000 CLP a tu billetera Vindex".

## Interfaz web

La aplicación web consulta `user_wallets.balance` y `user_wallets.locked_balance` para mostrar el saldo disponible y el congelado en el acceso del navbar y en `/wallet`. La consulta se limita al usuario autenticado y debe estar protegida por las políticas RLS del esquema.

La página explica el flujo de garantías y ofrece accesos a las secciones de ingreso y retiro. El ingreso presenta una simulación local de pago con Webpay Plus y Mercado Pago, siguiendo el patrón del checkout y del pago de destacados. La simulación no cobra ni acredita saldo; para habilitar recargas reales se requiere integrar una pasarela y una operación segura del servidor. Los retiros permanecen deshabilitados hasta implementar un flujo seguro de desembolso. El historial de transacciones tampoco se muestra porque el esquema documentado no incluye una tabla de movimientos.

Antes de habilitar operaciones, hay que desplegar el esquema de [`vindex-wallet.md`](../supabase/migrations/vindex-wallet.md) y definir las operaciones transaccionales y controles de autorización del servidor. No realizar cambios de saldo desde el cliente.

1. Valor de la Garantía
Porcentaje del Precio Base:
Se exige una garantía del 10% al 15% del valor inicial o precio base configurado por el vendedor.
Ejemplo: Si una subasta parte en $100.000 CLP, la garantía para entrar a pujar es de $10.000 CLP.

2. Arquitectura del Sistema de Pago y Fondos: Modelo "Billetera Virtual / Créditos" (Vindex Wallet)
Para gestionar las garantías de forma fluida y económica, el modelo basado en Billetera de Créditos Interna es la mejor opción técnica y operativa.
¿Cómo funciona el flujo?
Carga de Saldo (Depósito):
El usuario recarga saldo en su "Billetera Vindex" mediante Webpay Plus. 1 crédito = $1 CLP.
Bloqueo de Garantía (Hold/Retención):
Al momento de realizar la primera puja en una subasta, `place_bid` bloquea la billetera y registra la puja y la garantía en una misma transacción de PostgreSQL. Actualmente la garantía aplicada es del 10% del precio base (dentro del rango documentado del 10% al 15%). El monto se mueve de saldo disponible a saldo retenido; las pujas posteriores en esa misma subasta no vuelven a retenerlo.
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

La página explica el flujo de garantías y ofrece accesos a las secciones de ingreso y retiro. El acceso **Ingresar saldo** del navbar abre directamente el formulario de recarga. Este crea una transacción Webpay Plus de integración, redirige a Transbank y confirma el resultado en el servidor antes de acreditar `user_wallets.balance`. Las referencias y estados se guardan en `wallet_topup_transactions`; las RPC privilegiadas solo se invocan desde el servidor con `service_role`. El ambiente de integración no procesa dinero real. Para producción se requiere habilitar y validar credenciales productivas con Transbank. Los retiros permanecen deshabilitados hasta implementar un flujo seguro de desembolso. La pantalla todavía no presenta el historial de recargas.

La migración [`20261127170000_wallet_webpay_topups.sql`](../supabase/migrations/20261127170000_wallet_webpay_topups.sql) crea el ledger de recargas y las RPC para crear, confirmar y acreditar pagos de forma idempotente. El saldo se incrementa solo cuando Transbank devuelve una autorización que coincide con la orden y el monto esperados. La migración requiere que la tabla `user_wallets` ya esté desplegada.

La migración [`20261127160000_auction_guarantees.sql`](../supabase/migrations/20261127160000_auction_guarantees.sql) integra la reserva con la RPC de puja y agrega la liquidación al cierre: devuelve a disponibilidad las garantías de quienes pierden y aplica la garantía del ganador al precio, mostrando el saldo pendiente. Si `pg_cron` está habilitado, programa la liquidación en segundo plano cada minuto; la sala también la invoca al llegar a cero o al cargar la subasta finalizada. No realizar cambios de saldo desde el cliente.

## Custodia de entregas a coordinar

La migración `20261109170000_pickup_order_escrow.sql` agrega saldos de órdenes en custodia, visibles por comprador y vendedor en `/wallet`, sin mezclarlos con las garantías de subasta (`locked_balance`). El comprador solo recibe el OTP tras la respuesta del vendedor en el chat de la orden. La verificación del OTP marca la custodia como liberada y acredita el monto al saldo disponible interno del vendedor en la misma transacción.

**Importante:** es una simulación de ledger para el ambiente de integración. El checkout actual usa Webpay Mall, cuyas subtransacciones se liquidan a comercios hijos; esta migración no captura ni retiene dinero real en Vindex ni implementa desembolsos. No habilitar producción con la promesa de custodia real hasta cambiar el modelo de adquirencia/liquidación y añadir un flujo real de payouts.

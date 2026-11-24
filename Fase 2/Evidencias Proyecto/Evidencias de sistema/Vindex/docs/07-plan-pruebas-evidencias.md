# Plan de pruebas y evidencias

## Comandos disponibles

```powershell
npm run lint
npm run check-types
npm run build
npm run test:checkout --workspace=web
```

## Pruebas principales

- Registro, login, recuperación y cierre de sesión.
- Catálogo, publicación y edición de productos.
- Carrito, stock y sincronización.
- Mensajería con Supabase Realtime.
- Pujas, límites, concurrencia y anti-sniping.
- Checkout Webpay sandbox: autorizado, rechazado, parcial y ambiguo.
- OTP de retiro: código correcto, código incorrecto y acceso ajeno.
- RLS para usuarios distintos y operaciones administrativas.

## Evidencia mínima

Cada ejecución debe registrar fecha, ambiente, comando o flujo manual, usuario de prueba, resultado, error y captura o log. Los casos Webpay se detallan en [WEBPAY_PLUS_MALL.md](./WEBPAY_PLUS_MALL.md).

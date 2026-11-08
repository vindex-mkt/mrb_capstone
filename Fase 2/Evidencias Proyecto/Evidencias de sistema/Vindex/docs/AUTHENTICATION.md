# Autenticación y recuperación de contraseña

## Recuperación de contraseña

1. Desde `/login`, el usuario abre `/forgot-password` e ingresa su correo.
2. La aplicación llama a `resetPasswordForEmail` y dirige el correo a `/auth/callback` en el mismo origen desde el que se solicitó.
3. El Route Handler intercambia el código PKCE con el cliente Supabase SSR. Solo si el intercambio crea una sesión válida, establece una cookie HTTP-only temporal y redirige a `/update-password`.
4. La página y su acción de servidor verifican esa cookie y la sesión de Supabase antes de permitir `updateUser({ password })`. La cookie se elimina al completar el cambio.
5. Si el enlace no es válido, expiró o ya se utilizó, no se muestra el formulario de cambio y se ofrece solicitar otro enlace.

La respuesta al solicitar el correo no confirma si la dirección está registrada. La longitud mínima de contraseña es de 8 caracteres, igual que en el registro actual.

## Configuración de Supabase

En **Authentication → URL Configuration → Redirect URLs**, agrega:

- `http://localhost:3000/auth/callback`
- `https://vindex-mkt.vercel.app/auth/callback`

Mantén **Site URL** apuntando al origen de producción (`https://vindex-mkt.vercel.app`); la solicitud de recuperación especifica su URL de callback explícitamente.

Si pruebas en dominios de Preview de Vercel, agrega también un patrón permitido que coincida con esos dominios, siguiendo el formato de URLs de redirect admitido por Supabase. No se requieren claves privadas en el navegador ni cambios en tablas o políticas.

## Pruebas

1. Ejecuta `npm run dev` desde la raíz y visita `http://localhost:3000/login`.
2. Solicita el enlace con un correo registrado y abre el enlace recibido en el mismo navegador donde se hizo la solicitud para conservar la cookie/verificador PKCE.
3. Confirma que el enlace termina en `/update-password`, que contraseñas menores a 8 caracteres o que no coinciden se rechazan, y que una contraseña válida muestra confirmación.
4. Intenta abrir `/update-password` directamente y confirma que no aparece el formulario.
5. Inicia sesión con la nueva contraseña. Prueba también un enlace expirado o reutilizado: debe ofrecer solicitar otro enlace.
6. Repite el flujo en producción después de agregar la URL de callback de Vercel a la lista permitida.

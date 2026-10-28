# Activar Web Push en PASIÓN APP

La interfaz, el service worker y la ruta de envío están implementados, pero **no se enviarán push hasta completar estos pasos**.

## 1. Generar las claves VAPID

Desde una terminal con Node.js, en el repositorio:

```bash
npx web-push generate-vapid-keys
```

Guarda la clave privada en un gestor seguro; no la subas a GitHub. La pareja de claves debe mantenerse estable: al cambiarla, habrá que volver a suscribir los dispositivos.

## 2. Variables de Vercel

En Vercel > proyecto `pasion-app` > Settings > Environment Variables (Production):

- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`: clave pública VAPID.
- `VAPID_PRIVATE_KEY`: clave privada VAPID, **secreto**.
- `VAPID_SUBJECT`: `mailto:<dirección de contacto válida>`.
- `SUPABASE_SERVICE_ROLE_KEY`: clave `service_role` de tu proyecto Supabase, **secreto**. No usar en variables `NEXT_PUBLIC_*`.
- `PUSH_WEBHOOK_SECRET`: una cadena aleatoria larga (al menos 32 bytes), **secreto**. Ejemplo de generación: `openssl rand -hex 32`.

Los valores secretos deben añadirse únicamente a Vercel y configurarse para que no se muestren ni se envíen al navegador.

**Haz un redeploy** después de definir las variables: `NEXT_PUBLIC_VAPID_PUBLIC_KEY` se incorpora al JavaScript del navegador durante el build.

## 3. Migración SQL

Ejecuta `supabase/migrations/20261028_web_push_subscriptions.sql` en Supabase SQL Editor. La tabla guarda exclusivamente las suscripciones de cada usuario aprobado y permite desactivarlas.

## 4. Webhook de base de datos Supabase

En Supabase Dashboard > Database > Webhooks > Create a new hook:

- Nombre: `pasion_app_push`
- Tabla: `public.app_notifications`
- Eventos: `INSERT` y `UPDATE`
- Método: `POST`
- URL: `https://pasion-app.vercel.app/api/push/dispatch`
- Cabecera: `x-pasion-push-secret` con **exactamente** el valor de `PUSH_WEBHOOK_SECRET`

Esto conecta las notificaciones internas con los push. Las actualizaciones de estado `read_at` no envían avisos; sí lo hacen las actualizaciones de título/mensaje/fecha (por ejemplo, una cancelación o una consulta de aportación recién publicada).

La cabecera secreta evita que terceros soliciten envíos. El endpoint valida que el aviso exista, que el destinatario esté aprobado y que la URL de destino sea una ruta interna autorizada.

## 5. Activar en los dispositivos

- **Android:** abrir PASIÓN APP en Chrome compatible, iniciar sesión, entrar en `/panel/notificaciones` y pulsar «Activar notificaciones push». Conceder permiso.
- **iPhone:** Safari > Compartir > Añadir a pantalla de inicio, abrir PASIÓN APP desde su icono, entrar en Notificaciones, pulsar «Activar notificaciones push» y conceder permiso. Requiere iOS 16.4+.
- Otros móviles o navegadores: depende del soporte de Push API.

La suscripción es **por dispositivo**. Si se revoca el permiso en los ajustes del sistema, hay que volver a activarla.

## 6. Prueba real

1. Entra con un músico aprobado, activa notificaciones y cierra la app.
2. Desde directiva, crea un aviso nuevo, por ejemplo un ensayo de su hilo o una votación.
3. Comprueba que el aviso aparece en la bandeja y como notificación del sistema operativo.
4. Prueba con un músico de **otro hilo**: no debe recibir avisos de un ensayo al que no está convocado.
5. Prueba que «Desactivar notificaciones» elimina su suscripción.

**Limitaciones:** las notificaciones push dependen del servicio del navegador, permisos, conexión y disponibilidad del dispositivo; no se garantiza entrega instantánea ni al 100%. El backend envía nuevos avisos, no un recordatorio independiente a las 24 h. Las votaciones se cierran por fecha de base de datos y solo notifican al crear/publicar acciones que generan un registro en `app_notifications`.

No enviar nunca información sensible en el texto push: puede mostrarse en la pantalla bloqueada.

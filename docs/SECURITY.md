# Seguridad y privacidad

- No subir a GitHub credenciales, claves de servicio, expedientes administrativos ni datos identificables de músicos.
- Partituras protegidas en Supabase Storage privado, con autorización del servidor y políticas RLS. Las marcas de agua ayudan a identificar filtraciones, pero **no es posible impedir capturas de pantalla** o fotografías de una web.
- El rol solicitado al registrarse nunca otorga privilegios. Solo el superadmin podrá conceder directiva; la directiva podrá aprobar músicos.
- Controlar acceso a datos de asistencia, motivos de ausencia y advertencias; definir retención, derecho de rectificación y acceso limitado.
- Correos de advertencia: revisión humana previa, historial de envíos y servicio transaccional configurado.
- Tesorería y aportaciones: no confundir intención de donar con pago confirmado.
- Antes de producción: auditar RLS y endpoints, verificar titularidad del remitente email, probar recuperación de cuenta y gestionar consentimiento de notificaciones.

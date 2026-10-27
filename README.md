# 🎺 PASIÓN APP

**Estado del proyecto: TERMINADO ✅**

Aplicación web privada de gestión para la **Agrupación Musical La Pasión de Mazarrón**, desarrollada con un enfoque adaptable a móviles y escritorio.

🌐 **Sitio web:** https://pasion-app.vercel.app/

> Proyecto de desarrollo completado. El uso de algunas funciones depende de la configuración del servicio de correo y de que las migraciones SQL correspondientes estén aplicadas en la base de datos de Supabase.

## Tecnologías

- Next.js, React y TypeScript.
- Supabase: autenticación, PostgreSQL, políticas de acceso (RLS) y almacenamiento privado.
- Vercel: despliegue web desde GitHub.

## Funcionalidades implementadas

- Registro de músicos con confirmación del correo y aprobación por la directiva.
- Inicio de sesión y recuperación de contraseñas.
- Roles y permisos diferenciados: músico, directiva y superadmin.
- Biblioteca de partituras privadas por hilo musical, con modo atril.
- Calendario, ensayos, repertorio y planificación de marchas.
- Convocatorias de ensayo para toda la agrupación o para uno o varios hilos musicales.
- Gestión de asistencia y justificación de ausencias.
- Cancelación, reactivación y eliminación de ensayos.
- Comunicados, notificaciones y votaciones.
- Gestión de miembros, inventario, actuaciones y tesorería.

## Desarrollo local

```bash
npm install
cp .env.example .env.local
npm run dev
```

Configura las variables de entorno necesarias de Supabase en `.env.local`. **No publiques claves privadas ni credenciales** en GitHub.

## Configuración de la base de datos

La aplicación usa migraciones SQL ubicadas en `supabase/migrations/`. Deben aplicarse en el orden indicado por sus dependencias.

En particular, las funciones recientes de convocatorias por instrumento, cancelación y borrado de ensayos requieren estas migraciones:

1. `20261027_rehearsal_part_groups.sql`
2. `20261027_cancel_delete_rehearsals.sql`

**Importante:** que las migraciones estén incluidas en GitHub no significa que se hayan ejecutado ya en el proyecto de Supabase. Verifica su aplicación antes de usar estas funciones en producción.

## Seguridad

El acceso está restringido a miembros autorizados. El código fuente no debe incluir datos personales de músicos, contraseñas, claves del servicio de correo ni partituras privadas.

---

**Proyecto finalizado · Agrupación Musical La Pasión de Mazarrón · 2026**

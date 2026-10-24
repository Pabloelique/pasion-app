# 🎺 PASIÓN APP

PWA **mobile-first** para la gestión de la Agrupación Musical La Pasión de Mazarrón.

> 🚧 En desarrollo: actualmente se está preparando la base técnica. Las funcionalidades descritas son el plan de implementación, no funciones ya operativas.

## Stack

- Next.js + React + TypeScript
- Supabase (Auth, PostgreSQL y almacenamiento privado)
- Vercel (despliegue previsto)

## Funcionalidades previstas

- Registro, aprobación de altas y roles (músico, directiva y superadmin único).
- Partituras privadas: músicos ven su hilo; directiva ve todos.
- Calendario navegable por meses y años y convocatoria de ensayos.
- Control presencial de asistencia, justificación de faltas y advertencias revisadas por directiva.
- Anuncios tipo chat, notificaciones, encuestas para elegir marchas y reparto orientativo de aportaciones voluntarias.
- Tesorería, perfiles con foto y redes sociales.

## Desarrollo local

```bash
npm install
cp .env.example .env.local
npm run dev
```

Configura las variables públicas de Supabase en `.env.local` cuando se conecte el servicio. Nunca subas credenciales al repositorio.

## Estado

Repositorio público para portfolio. Se integrarán los módulos de forma incremental y se documentará su progreso. Sin datos personales reales ni partituras protegidas en el código.

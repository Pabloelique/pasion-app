# PASIÓN APP · Preparación segura del lanzamiento

**Estado: INVENTARIO, NO LIMPIEZA.** No se han eliminado ni editado datos de producción.

## 1. Copia de seguridad, antes de cambiar nada

La base de datos y los archivos de Supabase Storage se respaldan **por separado**. Una exportación de SQL no contiene las partituras ni los audios en sí.

1. Revisa en Supabase **Database → Backups** si tu plan ofrece copia y restauración. Comprueba la fecha de la copia disponible. Una copia programada antigua no necesariamente cubre los cambios más recientes.
2. Para una copia **manual y reciente** de datos y estructura, sigue la [guía oficial de backup con Supabase CLI](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore). La CLI permite crear `roles.sql`, `schema.sql` y `data.sql`. Si usas `supabase link`, revisa que sea el proyecto correcto. **No ejecutes `db reset` ni acciones de restauración en producción**.
3. Comprueba por separado las cuentas en Supabase Auth: la exportación habitual de `supabase db dump` excluye los esquemas administrados como `auth` y `storage`. No supongas que una exportación de `public` permite reconstruir por sí sola usuarios y contraseñas. Valida qué ofrece el respaldo completo de tu plan o el flujo oficial de clonación/restauración.
4. En **Storage → partituras**, descarga una copia de todos los PDF y audios. Para volúmenes grandes, usa las [opciones de la documentación oficial](https://supabase.com/docs/guides/storage/management/download-objects). Mantén la estructura de rutas, pues las tablas se refieren a ellas.
5. Guarda respaldos en un lugar privado fuera del repositorio GitHub: los datos incluyen información de los miembros y material musical protegido. Nunca compartas aquí contraseñas de la base de datos, tokens, claves de servicio, dumps con datos personales o archivos de autenticación.
6. Verifica que los archivos SQL y los de Storage se descargaron y son legibles. Para tener garantías de recuperación, prueba la restauración en un entorno **separado** antes de tocar producción.

## 2. Inventario de datos

Archivo: [01_inventario_lectura.sql](./01_inventario_lectura.sql).

Ábrelo en Supabase SQL Editor. Ejecuta **cada SELECT por separado**, seleccionando exclusivamente esa sentencia y usando Run. El editor suele mostrar el resultado de la sentencia seleccionada o de la última sentencia del lote. Exporta los resultados a CSV si lo necesitas, pero guárdalos en privado.

El inventario obtiene:
- Recuento de tablas para comparar antes/después;
- Recuento de cuentas por rol y estado, sin revelar emails;
- Tesorería y contrataciones marcadas con `is_test = true`;
- Registros con «test», «prueba», «demo» y «fictici» en el título o nombre como **candidatos de revisión**, no eliminaciones;
- Número y tamaño aproximado de archivos del bucket privado `partituras`;
- Contrataciones marcadas con pruebas y sus cobros vinculados.

Si una consulta falla porque falta una migración, informa del nombre de la tabla; **no crees tablas ficticias para compensarlo**.

## 3. Datos que nunca deben borrarse por heurística

- Usuarios reales, perfil, permisos, instrumentos/hilos;
- Partituras, guiones, grabaciones y su estructura en Storage;
- Repertorio oficial y votaciones reales;
- Tesorería real y movimientos de reversión/auditoría;
- Asistencia, histórico, publicaciones o contratos reales.

La cuenta de músico «Test» se valorará específicamente **cuando ya no haga falta para pruebas**, confirmando su ID y posibles referencias a otros registros. No borres un usuario simplemente por tener «test» en el nombre.

## 4. Reglas antes de la limpieza

- Confirmar respaldo descargado y, preferiblemente, restaurado en entorno independiente.
- Revisar los candidatos uno por uno, incluyendo tablas relacionadas y efectos de claves foráneas.
- Preparar un plan de eliminación concreto por IDs revisados, con recuento esperado, revisión humana y transacción.
- No usar nunca borrados masivos por nombre, `TRUNCATE` ni `DELETE ... WHERE title ILIKE '%test%'`.
- Mantener temporalmente visibles los controles de prueba hasta que se apruebe la limpieza final.

**Ningún archivo de este directorio ejecuta borrados ni hace cambios en Supabase.**

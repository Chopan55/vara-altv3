# VARA — Respaldo y recuperación

Un respaldo que nunca se restauró no es un respaldo. Este documento dice qué hay hoy, qué **no** se pudo verificar y cómo probarlo.

## 1. Qué hay que poder recuperar

| Qué | Dónde vive | Respaldo hoy | Estado |
|---|---|---|---|
| Código | GitHub `Chopan55/vara-altv3` | Las ramas de trabajo se subieron el 15 de octubre | **OK** (hay que mantenerlo al día) |
| Base de datos de producción | Supabase, proyecto "VARA MVP" | No documentado | **UNKNOWN** |
| Archivos subidos | Supabase Storage (3 buckets) | No documentado; los respaldos de la base de Supabase **no incluyen** los archivos de Storage (confirmar) | **UNKNOWN** |
| Variables y secretos | Vercel (3 de producción) y `.env.local` local | No hay copia centralizada | **MISSING** |
| Configuración de Vercel y DNS | Vercel (sin dominio todavía) | Ninguno | **MISSING** |
| Avisos de mercado | Tabla `market_listings` (staging) | Se pueden volver a barrer (USD 1,5 por 1.000) | **OK** (no es insustituible) |

## 2. Lo que no pude verificar

- Plan de Supabase y si incluye copias diarias o recuperación a un punto en el tiempo. Mirá *Database → Backups* en el proyecto: si aparece vacío o dice que requiere un plan pago, hoy **no hay respaldo automático**.
- Si GitHub tiene protecciones de rama que eviten borrar historial.
- Quién más puede entrar a las cuentas de Supabase, Vercel y GitHub: hoy parece ser una sola persona.

## 3. Objetivos propuestos (a validar con vos)

- **RPO** (cuántos datos aceptamos perder): 24 horas.
- **RTO** (cuánto tardamos en volver): 4 horas.

Hoy ninguno está garantizado por el proveedor porque no se pudo confirmar el plan.

## 4. Respaldo manual mínimo (mientras no haya automático)

1. Una vez por semana, exportar la base con `pg_dump`, usando la cadena de conexión que da Supabase en *Connect* (la contraseña se guarda en un gestor de contraseñas, **nunca** en el repositorio ni en el chat):

```bash
pg_dump "$CONEXION_SUPABASE" --no-owner --format=custom --file=vara-AAAA-MM-DD.dump
```

2. Guardar el archivo cifrado, **fuera de la notebook** (almacenamiento en la nube personal con verificación en dos pasos).
3. Para los archivos de Storage, descargar los buckets `documents` y `property-photos` a la misma ubicación con la herramienta de Supabase o desde el panel.
4. Mantener al menos 4 copias semanales.

## 5. Prueba de restauración (hacerla antes de levantar capital)

1. Restaurar el último `dump` en un proyecto **vacío** (no en producción).
2. Comprobar que existan las tablas y que los conteos coincidan con los de producción.
3. Probar una cuenta de prueba: iniciar sesión y abrir una operación.
4. Anotar cuánto tardó: ese es el RTO real.
5. Repetir cada tres meses.

## 6. Quién puede restaurar y riesgos

- Hoy: una sola persona (el dueño de las cuentas). **Riesgo alto de depender de alguien único.**
- Recomendado: un segundo administrador en Supabase, Vercel y GitHub, con verificación en dos pasos, y un documento de acceso de emergencia guardado fuera de línea.
- Las claves compartidas por chat durante las pruebas (Bright Data y la clave secreta del staging) deben **rotarse** antes de producción.

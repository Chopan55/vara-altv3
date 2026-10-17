# VARA — Decisiones firmes

- Lema: "Comprá y vendé a tu manera." Bajada: "Más libertad para decidir. Más control para avanzar. Menos costos innecesarios." Mensaje: "VARA empieza donde terminan los portales." No atacar a las inmobiliarias.
- Costo de servicios externos: USD 0 salvo aprobación explícita. Excepciones aprobadas por FAH (2026-10-10/11): OpenAI hasta USD 20 y Google Veo (clips de recorrido), ambas solo para su email (`VARA_AI_ALLOWED_EMAILS`) y con tope diario.
- Producción: nunca sin aprobación explícita. Se publica por Preview + Promote en Vercel (lo hace FAH).
- La API de video de OpenAI (Sora) se cerró el 2026-09-24: el video con IA va por Google Veo (`/api/tour-clip`).
- Las claves nunca pasan por el chat ni el repo: las carga FAH en Vercel.
- Todo contenido generado por IA se rotula como visualización, nunca como estado real.
- Datos del usuario de las herramientas nuevas: hoy en el navegador (localStorage/IndexedDB), no en la base. Mover a base requiere migración aprobada.
- Rollback: `NEXT_PUBLIC_FLAGS_OFF` (conversationalEntry, groupedMenu, journeyTools).

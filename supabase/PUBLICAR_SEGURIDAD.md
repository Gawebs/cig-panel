# Publicar la seguridad de acceso (rama `seguridad-acceso`)

Hacerlo fuera de horario: quien tenga el panel abierto en ese momento va a tener que volver a ingresar (con la misma contraseña).

## Antes

- Probado en local con `npx supabase start` + `node supabase/pruebas/probar_seguridad.mjs <API_URL> <ANON_KEY>` (25 pruebas) y en el navegador contra la réplica (`npm run dev -- --mode prueba`, usa `.env.prueba.local`).
- `npm run build` sin errores.

## Pasos (en este orden, uno detrás del otro)

1. **Función de ingreso** (no afecta al panel actual, que no la usa):
   `SUPABASE_ACCESS_TOKEN=<PAT> npx supabase functions deploy panel-login --project-ref zjmizljqkbfdotdpxyac --no-verify-jwt`
2. **Reglas de la base**: correr `supabase/migrations/20261106010000_seguridad_acceso.sql` en producción (Management API `POST /v1/projects/zjmizljqkbfdotdpxyac/database/query`, o el SQL Editor del panel de Supabase). **No** correr `20261106000000_replica_produccion.sql`: es solo la réplica para pruebas locales.
3. **Panel**: push a `main`, inmediatamente después del paso 2. Vercel publica solo en cig-panel.vercel.app (entre el 2 y el 3, el panel viejo deja de mostrar datos).
4. **Verificar**: entrar con un perfil real, ver expedientes, abrir un adjunto, abrir Constancias. Probar sin sesión que `GET /rest/v1/expedientes` con la anon key devuelve `[]`.

## Si algo falla

1. Correr `supabase/rollback/20261106_seguridad_acceso_deshacer.sql` en producción.
2. Volver a publicar la versión anterior del panel (en Vercel, cuenta `admin-80077198s-projects`: Deployments → la anterior → Promote to Production).

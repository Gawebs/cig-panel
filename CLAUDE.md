# CIG Panel — Municipalidad de Banda del Río Salí

Panel web interno para la gestión de expedientes de la **Dirección de Regularización Dominial**. Es un sistema institucional de uso interno, **no un SaaS**: no hay multi-tenancy, ni planes, ni clientes múltiples.

## Stack

React + Vite, **sin TypeScript**. Supabase para base de datos y storage. Deploy en Vercel.

- **Repo:** https://github.com/Gawebs/cig-panel, rama `main` (antes estaba en `nxaia/cig-panel`)
- **Producción:** https://cig-panel-rho.vercel.app
- **Tablas:** `expedientes`, `expediente_planos`, `certificados_residencia`, `certificado_residencia_archivos`, `usuarios`, `panel_accesos`
- **Storage:** bucket `planos-expedientes`
- **Env vars:** `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`, en `.env` local y en Vercel producción

## Todo vive en `src/App.jsx`

Un solo archivo de ~4.200 líneas con toda la aplicación: login, dashboard, expedientes, constancias, importación de Excel. No hay router ni componentes en archivos separados.

Al buscar algo, orientarse por los nombres de constantes y funciones, no por scroll: `LOGIN_USERS`, `UBICACIONES`, `isSupabasePaused`.

## Secciones

Dashboard (con vista especial `IntendenteDashboard` para el intendente) · Expedientes (tabla principal con filtros, paginación dinámica y adjuntos) · Constancias (certificados de residencia imprimibles) · Importar Excel · Nuevo expediente.

## Usuarios

Están hardcodeados en `LOGIN_USERS` dentro de `App.jsx`, no en la base. Seis perfiles: el intendente y un usuario genérico son de solo lectura; los cuatro perfiles del área técnica y la dirección tienen `canEdit: true`.

Para agregar o cambiar un usuario hay que editar ese array **y** el mapa `PERFILES` de `supabase/functions/panel-login/index.ts`, y redeployar los dos.

## Seguridad de acceso (rama `seguridad-acceso`, 06-nov-2026)

Hasta esa fecha la base estaba abierta: con la anon key de la página se podía leer, modificar y borrar todo, y las contraseñas vivían solo en el `localStorage` de cada navegador. Ahora:

- **Todos los perfiles piden contraseña.** La pantalla manda el SHA-256 de lo que escribe el usuario a la función `panel-login` (Edge Function), que lo verifica contra `panel_usuarios.password_pbkdf2` y entrega una sesión de Supabase. La primera vez que un perfil ingresa sin contraseña guardada, la que escribe queda registrada. Si el navegador tenía guardada la contraseña vieja (`cig_panel_password_hash_cache_v1`), tiene que coincidir.
- Cada perfil tiene una cuenta interna `<clave>@cig-brs.local` en Supabase Auth, creada por la función. Nadie la usa directamente.
- **RLS:** las tablas de trabajo solo responden a sesiones iniciadas (`authenticated`). `panel_usuarios` y `panel_login_intentos` no tienen reglas para la página: solo las toca la función con la service role.
- **Archivos privados:** el bucket `planos-expedientes` ya no es público. Las URLs guardadas conservan el formato `/object/public/`; un listener global (`abrirArchivoPrivado`) intercepta esos clics y abre un enlace firmado de 5 minutos.
- **Freno:** 8 intentos fallidos por perfil en 15 minutos bloquean ese perfil por 15 minutos.
- **Resetear una contraseña:** borrar `password_pbkdf2` de esa fila en `panel_usuarios`. El próximo ingreso registra la nueva. El botón "Reset manual admin" se sacó porque nunca funcionó.
- **Pruebas locales:** `npx supabase start` (Docker) levanta una réplica con datos inventados (`supabase/seed.sql`). `supabase/pruebas/probar_seguridad.mjs` corre 25 pruebas. Para el panel contra la réplica: `npm run dev -- --mode prueba` con `.env.prueba.local`.
- `supabase/migrations/20261106000000_replica_produccion.sql` es **solo para la réplica local**. Nunca hacer `supabase db push` en producción.
- Publicación y vuelta atrás: `supabase/PUBLICAR_SEGURIDAD.md`.

## Formulario Ley 24.374 (Catastro provincial)

Botón "Formulario Ley 24.374" en la ficha del expediente (`Formulario24374Modal`). **No se puede rediseñar:** es un formulario oficial de Catastro de Tucumán y tiene que salir idéntico. Por eso se llena el PDF original (`public/formularios/ley-24374-solicitud.pdf`) con `pdf-lib`, escribiendo cada dato en coordenadas medidas a mano (`FORMULARIO_24374_FILAS`, `FORMULARIO_24374_PERSONA_CAMPOS`, `FORMULARIO_24374_INMUEBLE_CAMPOS`). Si Catastro manda una versión nueva del PDF, hay que volver a medir las posiciones con pymupdf.

Lo que se carga en el modal no se guarda: CUIL, cónyuge y datos catastrales no existen en la tabla `expedientes`.

## Trampas conocidas

**El campo "Ubicación" se llama `resp` en el código.** La etiqueta que ve el usuario dice "Ubicación", pero la propiedad del expediente es `resp`. Los valores salen de la constante `UBICACIONES` (hoy: vacío, "Área técnica BRS", "Catastro"), es una lista fija, no una tabla. Originalmente era un UUID y se migró a texto.

**`src/assets/logo-area-clean.png` no se puede perder.** Se usa en las constancias y en la interfaz, y está trackeado en git. Al resolver conflictos de merge en `App.jsx` con `git checkout --ours`, ese archivo puede desaparecer del disco y romper el build. Si falta: `git checkout HEAD -- src/assets/logo-area-clean.png`. Ya pasó una vez.

`public/logo-icono.png` es el logo del municipio, se usa en el login y el sidebar.

## Supabase se pausaba solo

El proyecto está en plan gratuito y Supabase lo pausa tras 7 días sin actividad, dejando el panel caído hasta que alguien lo reactiva a mano.

Dos mecanismos lo cubren hoy:

1. **`.github/workflows/keep-alive.yml`** — hace un `GET` de un registro de `expedientes` todos los días a las 12:00 UTC (09:00 Argentina). Usa los secrets `SUPABASE_URL` y `SUPABASE_ANON_KEY` del repo. Es la prevención: si esto corre, el proyecto no se pausa. Se puede disparar a mano con `gh workflow run keep-alive.yml`.
2. **La app lo detecta y avisa.** `isSupabasePaused(error)` reconoce el error y muestra un banner en vez de una pantalla rota. Decisión tomada: el banner es **solo texto, sin botón de WhatsApp**.

Además, `nexaia-ops-agent` monitorea este proyecto y reactiva Supabase automáticamente si igual llegara a pausarse.

## Flujo de trabajo

Siempre sobre `main`. `git pull` antes de tocar nada, `npm run build` para verificar antes de pushear, y deploy con `vercel --prod` desde la carpeta del proyecto.

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

Están hardcodeados en `LOGIN_USERS` dentro de `App.jsx`, no en la base. Seis perfiles: el intendente y un usuario genérico entran sin contraseña y son de solo lectura; los cuatro perfiles del área técnica y la dirección tienen `canEdit: true` y `requiresPassword: true`.

Para agregar o cambiar un usuario hay que editar ese array y redeployar.

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

@AGENTS.md

# CIG Regularización Dominial (cig-dominial)

Producto nuevo que reemplaza a `cig-panel` (que sigue en uso en cig-panel.vercel.app hasta que este esté probado). Leer `PRODUCT.md` antes de tocar pantallas y `ESTADO.md` para retomar.

- **Propuesta de diseño aprobada:** https://claude.ai/artifact/6PCJUA8ZTxi4CRJ9H3Vfft
- **Relevamiento de Catastro:** `docs/relevamiento-catastro.md` (portal, pasos, formularios por ley). Formularios oficiales en `docs/formularios-oficiales/` y los que se llenan en `public/formularios/` (los `portal-*` son los vigentes).

## Stack
Next.js 16 (App Router, `proxy.ts`, params como Promise) + React 19 + TypeScript + Tailwind 4 + Supabase (`@supabase/ssr`) + zod. Patrón Nexaia: Server Actions en `src/actions/`, lectura en Server Components, tres clientes en `src/lib/supabase/`.

## Datos
- Tablas en inglés, columnas de negocio en español. Migraciones en `supabase/migrations/`.
- Multi-municipio: todo cuelga de `municipalities`; acceso por `memberships` (roles: direccion, subdireccion, armado, relevamiento, consulta) y `platform_admins` (soporte).
- RLS en todas las tablas. Funciones `es_miembro`, `tiene_rol`, `puede_ver_expediente`, `puede_editar_expediente`.
- **El estado del expediente solo cambia con `cambiar_estado()`** (valida transición y rol). Un trigger bloquea cambiarlo con un update común.
- `case_events` y `audit_log` son inmutables (nadie puede escribirlos ni borrarlos desde la app).
- Expedientes no se borran: se desisten o archivan.

## Leyes
Configuración en `supabase/marcos/*.json` (se cargan a `legal_frameworks.config`). El motor `src/lib/requisitos.ts` arma el checklist por ley, estado civil, personas y años de prueba. Es función pura con pruebas en `src/lib/requisitos.test.ts`. Solo 3 leyes para Banda del Río Salí: Pierri, 5670 (La Milagrosa), 8162 (Menem). Las reglas de años de Menem están "a confirmar con Carlos".

## Archivos, DNI y formularios
- Archivos en el bucket privado `expedientes`, ruta `<municipality_id>/<case_file_id>/<archivo>.pdf`; las reglas de `storage.objects` usan `ruta_de_expediente_valida()`. Siempre PDF: las fotos se unen con `unirEnPdf` (`src/lib/escaneo.ts`) y se suben con `subirDocumento` (`src/lib/subida.ts`).
- **Imágenes: usar `createImageBitmap`, no `img.decode()`**: con la pestaña en segundo plano `decode()` no termina nunca.
- DNI: `src/lib/dni.ts` (puro, con pruebas) + `leerCodigoDni`/`leerTexto` en `escaneo.ts`. El lector de texto usa `public/vendor/` (copiado por `npm install` con `scripts/copiar-recursos.mjs`; no se versiona).
- Formularios: plantillas con coordenadas en `src/lib/formularios/plantillas.ts` (medidas con PyMuPDF sobre `public/formularios/portal-*`). Cada casillero apunta a un dato de la ficha; `guardarFormulario` escribe en la ficha, nunca en una copia. `generarPdf` imprime sobre el original. Para revisar la alineación: `GUARDAR_PDF=<carpeta> npx vitest run src/lib/formularios` y mirar los PDF.
- En inputs ocultos controlados por estado usar `value`, no `defaultValue` (React los reinicia en cada render).
- Formularios nuevos: medir con PyMuPDF el rótulo de cada casillero y usar los ayudantes `bloque`, `familia` y `fechaEsquina` de `plantillas.ts`. Revisar siempre imprimiendo con todo lleno (prueba de `imprimir.test.ts` con `GUARDAR_PDF`).
- `generarPdf` escribe sobre las hojas originales y recién al final quita las que no van: si se quitan antes, pdf-lib pierde lo escrito.
- Al leer `input.files`, copiarlo con `Array.from` antes de limpiar el campo (la lista del navegador se vacía).
- Pruebas de posesión: `servicio_impuesto` en la configuración de una ley se abre en cada servicio (`tiposDePrueba`); con mínimo de 2 o más por año cuentan los tipos distintos (`pruebasDistintas`).

## Firma y Catastro
- PDF firmados: requisito `pdf_firmado`, `origen = 'firmado'`, archivo `firmado-P<n>-*.pdf`. Solo los sube la Dirección (`puede_firmar_expediente`: aprobado, observado o prórroga). `cambiar_estado(..., 'firmado')` exige los 4 pasos.
- Presentación, observación, prórroga y reingreso: siempre con las funciones `registrar_*` de la base (nunca un update directo: el estado y los datos van juntos). Plazos con `sumar_dias` y la tabla `feriados`; plazo y tipo de días en `municipalities.plazo_catastro_*`.
- La base corre con hora de Argentina (`alter database ... set timezone`): repetirlo al crear la base en la nube.
- Constancias de tenencia precaria: `tenure_certificates` (+ archivos en el depósito `constancias`), impresión en `/imprimir/constancia/[id]` (`?vista=1` para verla sin abrir el diálogo de impresión).

## Relevamiento (celular, sin señal)
- `/campo` es una página estática que corre entera en el navegador: datos en IndexedDB (`src/lib/campo/almacen.ts`), sincronización en `src/lib/campo/sincronizar.ts`. No usar el layout del panel ahí (necesita servidor).
- `public/sw.js` guarda la pantalla `/campo` y los recursos con nombre fijo. Se registra solo en producción (en desarrollo los archivos cambian de contenido con el mismo nombre). Para probar sin conexión: `npm run build` + entrada `cig-dominial-prod` (puerto 5681), abrir `/campo` dos veces y apagar el servidor.
- Cuestionario y reglas de interpretación en `src/lib/relevamiento/cuestionario.ts`; paso a la ficha en `aplicar.ts` (nunca pisa datos cargados a mano); casillas de lo observado en `observaciones.ts`. Todo puro, con pruebas.
- Voz a texto: `src/lib/voz/` (Whisper base en un Web Worker). Modelo en `public/vendor/modelos/` bajado por `scripts/bajar-modelo-voz.mjs` en el `postinstall`; motor onnxruntime en `public/vendor/ort/`. `env.allowRemoteModels = false`: nunca pide nada a terceros.
- Tabla `field_surveys` (un relevamiento por expediente, id generado en el celular) y depósito privado `audios` (sin update ni delete).

## Desarrollo local
1. Docker Desktop abierto. `npx supabase start` (puertos 54321-54324).
2. `.env.local` con las claves locales (ver `.env.ejemplo`).
3. `node scripts/semilla-local.mjs` carga leyes, 2 municipios de prueba y 7 usuarios `@prueba.local` (clave en `SEMILLA_CLAVE_PRUEBA`). Se niega a correr contra una base que no sea local.
4. `npm run dev -- --port 5680` (entrada `cig-dominial` en el launch.json global).
5. `npx vitest run`: motor de requisitos + pruebas de seguridad contra la base local (se saltean si la base no está arriba).

**Todavía no hay base en la nube ni deploy.** Para publicar seguir `docs/PUBLICAR.md`. Nunca correr `supabase db push` contra cig-db (la base del panel actual).

## Seguridad y alta de municipios
- Nadie se registra solo (`enable_signup = false`); los usuarios se crean con `scripts/alta-municipio.mjs` (contraseñas provisorias en `credenciales/`, fuera de git). Cada uno la cambia en `/cuenta`.
- Las funciones de la base no se pueden llamar sin sesión (migración `endurecer`); las nuevas tampoco (privilegios por defecto).
- `next.config.ts` pone la política de contenido: si se suma un servicio externo o un recurso nuevo, agregarlo ahí o se bloquea. El sitio no usa la clave de servicio (`src/lib/supabase/admin.ts` no se importa en ningún lado).

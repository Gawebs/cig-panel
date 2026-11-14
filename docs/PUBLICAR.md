# Publicar CIG Regularización Dominial

Guía para la primera publicación y para sumar municipios. Todo lo que dice **Gabriel** necesita su cuenta o su permiso; el resto lo puede hacer Claude con ese permiso.

> **Nunca** correr `supabase db push` contra `cig-db` (la base del panel actual, que sigue en uso). Este producto va en un proyecto de Supabase **nuevo**.

## 1. Base de datos (Supabase)

1. **Gabriel**: crear un proyecto nuevo en supabase.com
   - Nombre `cig-dominial`, región **South America (São Paulo)**.
   - Plan **Pro** (unos US$ 25 por mes): incluye copias de seguridad diarias y no se pausa por falta de uso. El plan gratuito se pausa a los 7 días, como le pasó al panel actual.
   - Guardar la contraseña de la base en el gestor de contraseñas.
2. **Gabriel**, en Authentication:
   - *Sign In / Providers*: desactivar **Allow new users to sign up**. Los usuarios los da de alta soporte.
   - *Passwords*: mínimo **10** caracteres, con **minúsculas, mayúsculas y números**.
   - *URL Configuration*: Site URL = la dirección final de Vercel.
3. **Claude** (con el permiso de Gabriel): subir la estructura a ese proyecto y a ningún otro.
   ```
   npx supabase link --project-ref <ref-del-proyecto-nuevo>
   npx supabase db push
   ```
   Las migraciones crean tablas, reglas de acceso, depósitos privados (`expedientes`, `audios`, `constancias`), el público `logos`, los feriados de 2026 y ponen la base en hora de Argentina.
4. Comprobar en *Database > Roles / Settings* que la zona horaria quedó `America/Argentina/Buenos_Aires` (`show timezone;` en el editor SQL).

## 2. Código (GitHub)

- Repositorio **privado** `Gawebs/cig-dominial`. El primer commit lo hace Claude cuando Gabriel lo pida.
- Lo que no va a git (ya está en `.gitignore`): `.env*`, `public/vendor/` (se genera al instalar), `credenciales/`.

## 3. Sitio (Vercel)

1. **Gabriel**: crear el proyecto en Vercel importando `Gawebs/cig-dominial`. Para cobrarle a municipios hace falta el plan **Pro** (unos US$ 20 por mes): el gratuito es solo para uso no comercial.
2. Variables de entorno (Production):
   - `NEXT_PUBLIC_SUPABASE_URL` = URL del proyecto nuevo
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = clave pública (anon / publishable)
   - **No** cargar la clave de servicio: el sitio no la usa. Solo la usa el script de alta, desde la computadora de soporte.
3. Al instalar, Vercel corre `postinstall`: copia los lectores (PDF, DNI, voz) a `public/vendor` y baja una vez el modelo de voz en español (76 MB).
   - **Revisar en el primer deploy** que no supere el límite de tamaño. Si lo supera, el modelo se sirve desde un depósito de Supabase y se cambia `env.localModelPath` en `src/lib/voz/motor.worker.ts`.
4. Dominio: el que elija Gabriel. El sitio exige HTTPS, y la cámara, el micrófono y el GPS solo funcionan con HTTPS.

## 4. Dar de alta un municipio

1. Copiar `supabase/municipios/ejemplo.json` como `<slug>.json` y completarlo:
   - nombre, sigla (va en el número de expediente) y leyes;
   - localidades y barrios;
   - plazo de Catastro: días y si son hábiles o corridos;
   - logo;
   - usuarios con sus roles.
2. Probarlo sin cambiar nada:
   ```
   CIG_SUPABASE_URL=... CIG_SERVICE_ROLE_KEY=... node scripts/alta-municipio.mjs supabase/municipios/<slug>.json
   ```
3. Repetir el comando con `--confirmar`. Las contraseñas provisorias quedan en `credenciales/<slug>.txt`:
   - se entregan en mano y no se mandan por WhatsApp;
   - cada usuario la cambia en **Mi cuenta**;
   - el archivo se borra después de entregarlas.
4. Se puede volver a correr con el mismo archivo para sumar barrios o usuarios: no duplica nada.

## 5. Prueba antes de entregar

- Entrar con cada rol y hacer un expediente de punta a punta:
  1. abrir con DNI, cargar documentos e imprimir los formularios;
  2. hacer el relevamiento con un celular real (con y sin señal);
  3. revisar y aprobar;
  4. firmar con la herramienta real de Estela;
  5. presentar, registrar una observación y reingresar.
- Probar la aplicación del celular en Android y en iPhone: instalarla, sacar fotos, usar el GPS y grabar.
- Confirmar con Carlos: días hábiles o corridos, reglas de años de Menem y feriados del año.

## 6. Cada año

- Cargar los feriados del año siguiente en la tabla `feriados`, con soporte o con SQL.

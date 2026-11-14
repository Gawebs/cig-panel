# Estado — CIG Regularización Dominial

## Etapa 1: base (13-nov-2026) — hecha, solo en local
- Proyecto Next.js nuevo, identidad azul→verde, letra Questrial + Nunito Sans.
- Base multi-municipio con RLS, roles, leyes configurables, expedientes, personas, documentos (tabla), historial y auditoría inmutables, número correlativo `SIGLA-AAAA-0001`.
- Recorrido de estados con control de rol en la base (incluye "Firmado por Dirección" antes de presentar).
- Motor de requisitos por ley + estado civil + grupo familiar + años de prueba (12 pruebas).
- 11 pruebas de seguridad contra la base local (aislamiento entre municipios, roles, historial inmutable).
- Pantallas: ingreso, inicio por rol, lista con filtros, nuevo expediente (elige ley, padrón doble), ficha con los 4 pasos de Catastro, personas, inmueble, cambio de estado con nota, historial.
- Verificado en el navegador: abrir expediente de La Milagrosa, cargar familiar (el checklist se actualiza), enviar a revisión.

## Etapa 2: paso 1 en Pierri (13-nov-2026) — hecha, solo en local
- Depósito privado `expedientes` (ruta `municipio/expediente/archivo.pdf`) con reglas en la base: cada municipio solo ve y sube lo suyo; consulta solo mira; un expediente firmado no acepta archivos.
- Carga de documentos contra cada requisito: varias fotos o PDF se unen solos en un PDF liviano (fotos achicadas a 1800 px, JPEG 72 %). Ver y quitar documentos. Pruebas de posesión con tipo y año.
- Lectura del DNI: código de barras del frente (formato tarjeta y anterior), CUIL calculado y domicilio del dorso con lector de texto local (tesseract con recursos propios en `public/vendor`, nada sale a terceros). Disponible al abrir expediente y al cargar cualquier persona; las fotos quedan como el documento DNI de esa persona.
- Aviso de DNI repetido en el mismo expediente (bloquea) y en otros (avisa).
- Formularios oficiales en pantalla: solicitud y DDJJ Pierri dibujadas sobre el PDF del portal, cada casillero editable; lo corregido se guarda en la ficha y aparece en todos los formularios. Impresión sobre el PDF original (verificada la alineación). Si un dato cambia después de imprimir, aviso de reimprimir y volver a firmar.
- PDF final de cada paso para subir a Catastro (todos los documentos del paso, en orden, nombre `P1-BRS-2026-0001.pdf`).
- 40 pruebas automáticas (requisitos, DNI, impresión, seguridad de base y de archivos).

Lo que quedaba pendiente del paso 1 se hizo en la etapa 4.

## Etapa 3: relevamiento en el lugar (13-nov-2026) — hecha, solo en local
- **Aplicación del celular en `/campo`**, instalable (manifest + service worker `public/sw.js`). Funciona sin señal: todo se guarda primero en el celular (IndexedDB, `src/lib/campo/almacen.ts`) y se sube solo cuando vuelve la conexión (`src/lib/campo/sincronizar.ts`). Verificado con el servidor apagado: abre y muestra los expedientes guardados.
- **Ubicación por GPS** (espera precisión de 25 m o menos) → coordenadas en la ficha (solo si estaban vacías) + PDF de coordenadas en el paso 2.
- **4 fotos guiadas** (frente, contrafrente, 2 interiores), achicadas en el celular → un PDF de 4 hojas en el paso 2.
- **Croquis en pantalla**: líneas, terreno, lápiz, texto (medidas y calles), grilla, deshacer → PDF en el paso 2.
- **Entrevista grabada pregunta por pregunta** (`src/lib/relevamiento/cuestionario.ts`): grabar → el vecino responde → "Listo, siguiente pregunta". Grupo familiar con contador y 4 preguntas por persona. Se puede escribir a mano. Audios privados en el depósito `audios` (sin modificar ni borrar).
- **Voz a texto local** (Whisper base en español, `src/lib/voz/`), modelo y motor servidos desde `public/vendor` (nada sale a terceros). En el celular si tiene 4 GB de memoria o más; si no, la computadora de la oficina transcribe sola al abrir la revisión. Probado: unos 5 segundos por respuesta en esta PC.
- **Las respuestas llenan la ficha** (`src/lib/relevamiento/aplicar.ts`): teléfono y ocupación del titular, fecha y origen de la posesión, IPVDU (La Milagrosa), grupo familiar (nombre, edad, vínculo, ocupación). Regla: nunca pisa un dato cargado a mano en la oficina.
- **Lo que se ve en el lugar**: casillas de las hojas 2 y 3 (entorno, ocupación, presencia, tipología, destino, estado, materiales, servicios, mejoras). Destino, servicios y mejoras se proponen solos con lo que dijo el vecino.
- **Revisión en la oficina** (`/expedientes/[id]/relevamiento`): escuchar cada respuesta, corregir, confirmar una por una o todas las que se entendieron.
- **Formulario de relevamiento social de 4 hojas** sobre el PDF del portal, para las 3 leyes: datos personales, grupo familiar (3 por solicitante), inmueble, casillas, observaciones en renglones, croquis y las 4 fotos impresas dentro. Editable a mano como los otros (lo que se corrige va a la ficha o al relevamiento). Alineación verificada imprimiendo con todos los casilleros llenos.
- 71 pruebas automáticas (se sumaron cuestionario, paso a la ficha, impresión de 4 hojas y 7 de seguridad de relevamiento y audios).

### Pendiente dentro de la etapa 3
- **Probar en celulares reales** (Android e iPhone) con un vecino de verdad: micrófono, GPS, cámara, ruido de la calle. En esta PC se probó con voz sintética y GPS simulado.
- Que el relevador abra `/campo` una vez con señal antes de salir (deja guardados los expedientes y la aplicación). El reconocimiento en el celular baja unos 100 MB la primera vez: conviene con wifi.
- El modelo de voz (76 MB) va en `public/vendor` y se baja al instalar (`scripts/bajar-modelo-voz.mjs`). Revisar en el primer deploy que Vercel lo acepte; si no, servirlo desde Supabase Storage.
- Si hay más de 3 familiares por solicitante, el formulario impreso muestra 3 (el resto a mano).

## Etapa 4: paso 3 y las otras leyes (13-nov-2026) — hecha, solo en local
- **Formularios de La Milagrosa (5670)**: solicitud (con grupo familiar de cada solicitante) y declaración jurada de 2 hojas (domicilio del inmueble, grupo familiar, casilla del IPVDU sí/no).
- **Formularios de Menem (8162)**: solicitud de 2 hojas (manzana y lote según el Plano 67.856/2013, observaciones y las 4 fotos del paso 2 impresas en la hoja 2) y declaración jurada de 2 hojas (compra u otro, fecha de inicio).
- **Anexo I de Pierri** (solicitantes 3 a 5 con sus cónyuges), con el número de solicitante impreso. Aparece en la ficha cuando hay más de 2 solicitantes.
- Alineación de las 5 plantillas verificada imprimiendo con todos los casilleros llenos. Arreglo en la impresión: ahora se escribe antes de quitar las hojas que no van (pdf-lib perdía lo escrito en el Anexo I).
- **Paso 3, pruebas de posesión**: cada servicio o impuesto por separado (Edet, Gasnor, SAT, Rentas, tasa municipal, otro). Cuando la ley pide 2 por año, tienen que ser de distinto tipo (dos de Edet cuentan como una) y la ficha avisa. No deja guardar una boleta sin confirmar que tiene el ticket de pago.
- **Localidad del inmueble** en la ficha. Si no se elige, se toma la del barrio (o la única del municipio). Va en la DDJJ de Pierri y en el relevamiento social.
- Arreglo en la carga de documentos: a veces la foto elegida se perdía antes de agregarse.
- 78 pruebas automáticas.

### Pendiente dentro de la etapa 4
- Las reglas de años de Menem siguen "a confirmar con Carlos" (hoy: 1998 a 2002, 1 prueba por año, y 2 del año en curso).
- Más de 3 familiares por solicitante, o más de 5 solicitantes: el resto se agrega a mano en el papel.

## Etapa 5: revisión, firma y Catastro (13-nov-2026) — hecha, solo en local
- **Revisión de Carlos**: cuando el expediente llega a "Listo para revisar", la ficha muestra "Antes de aprobar" (documentos que faltan, avisos, formularios sin imprimir, relevamiento hecho, respuestas sin revisar).
- **Firma de la Dirección** (cualquier herramienta): baja el PDF de cada paso, lo firma y sube el firmado. El sistema controla que tenga firma digital (`src/lib/firma.ts`, busca el diccionario de firma; no valida el certificado). Solo la Dirección puede subirlos, y la base no deja marcar "Firmado" sin los 4.
- **Presentación en Catastro**: sección en la ficha con cada dato del portal y botón Copiar, los 4 PDF firmados para bajar con nombres que el portal acepta, y el registro del número de expediente de Catastro y la fecha.
- **Observaciones de Catastro**: se cargan con la fecha y el texto. El vencimiento lo calcula la base (`sumar_dias`, 10 días hábiles sin feriados por defecto, configurable por municipio). Prórroga (con la fecha que dé Catastro o un plazo igual al original) y reingreso. Todo con funciones de la base que cambian el estado y guardan los datos juntos (`registrar_presentacion`, `registrar_observacion`, `registrar_prorroga`, `registrar_reingreso`).
- **Tablero** (`/tablero`): expedientes por etapa, plazos de Catastro ordenados por vencimiento (rojo vencido, ámbar 3 días o menos), avance por barrio (como el del intendente en el panel actual) y por ley. Filtro por barrio en la lista de expedientes.
- **Constancias de tenencia precaria** (`/constancias`): igual que en el panel actual (estados, búsqueda, resumen, archivos, impresión con el mismo texto). Número `CR-AAAA-0001` por municipio, archivos privados en el depósito `constancias`. El encabezado sale del municipio (nombre, logo, área, secretaría).
- La base usa la hora de Argentina (antes, después de las 21 h la fecha de apertura salía del día siguiente).
- 94 pruebas automáticas (14 nuevas de seguridad de firma, presentación, observaciones y constancias).

### Pendiente dentro de la etapa 5
- **Vigilancia del correo de Catastro**: espera los mails reales que va a mandar Carlos (expediente nuevo y observación). Mientras, las observaciones se cargan a mano.
- **Firma digital**: falta saber qué herramienta usa Estela y si firma 4 PDF o uno. Hoy pide uno por paso. Probar con un PDF firmado de verdad.
- **Plazo**: quedó en 10 días hábiles; confirmar con Carlos si son corridos (se cambia por municipio, sin programar).
- **Feriados**: cargados los de 2026; los trasladables están marcados para confirmar con el decreto anual. Hay que cargar los de cada año.
- La constancia impresa no se pudo mirar a la vista en esta prueba (ventana minimizada); el texto se verificó.

## Etapa 6: preparación del lanzamiento (13-nov-2026) — hecha la parte que no depende de cuentas
- **Revisión de seguridad completa**: las 20 tablas con reglas de acceso; ninguna clave secreta en el código del sitio (la clave de servicio no se usa en el sitio); todas las acciones piden sesión. Corregido:
  - nadie se registra solo (los usuarios los da de alta soporte);
  - contraseñas de 10+ con mayúsculas, minúsculas y números;
  - funciones internas de la base cerradas a visitantes sin sesión;
  - relevador y expediente de un relevamiento no se pueden cambiar;
  - documentos cargados no se modifican;
  - cookie del municipio solo por HTTPS en producción.
- **Encabezados de seguridad** (`next.config.ts`): política de contenido (solo el propio dominio y su Supabase; sin eval), sin poder meter el sitio en otra página, HTTPS obligatorio, cámara/micrófono/GPS solo para el sitio. Verificado en la versión de producción: lector de DNI, voz a texto y procesos de fondo funcionan; eval y otros dominios quedan bloqueados.
- Voz a texto: se descartan las marcas que pone el reconocedor cuando no hay habla ("(Música)").
- **Alta de municipios** con `scripts/alta-municipio.mjs` + `supabase/municipios/<slug>.json` (datos, logo, leyes, plazo, localidades, barrios y usuarios con contraseña provisoria en `credenciales/`, fuera de git). Muestra lo que haría y solo cambia con `--confirmar`; se puede repetir sin duplicar. Probado contra la base local.
- **Mi cuenta** (`/cuenta`): cada usuario cambia su contraseña.
- **Guía de publicación**: `docs/PUBLICAR.md`.
- 99 pruebas automáticas.

### Falta para publicar (necesita a Gabriel)
- Crear el proyecto nuevo de Supabase (São Paulo, plan Pro) y el de Vercel (plan Pro para uso comercial), o dar acceso.
- Permiso para `git init`, primer commit y crear el repositorio privado `Gawebs/cig-dominial`.
- Datos reales de Banda del Río Salí para el alta: barrios, usuarios y roles, logo, plazo (hábiles o corridos).
- Pendientes con Carlos: mails de Catastro (vigilancia del correo), años de Menem, herramienta de firma de Estela.
- El visor del formulario en pantalla no se pudo mirar en esta prueba (la ventana estaba minimizada y el navegador no dibuja); su proceso de fondo carga bien con los encabezados nuevos. Mirarlo en la primera prueba con la ventana abierta.

## Pendiente de decidir
- Proyecto Supabase en la nube para el producto (nuevo, separado de cig-db) y plan Pro; proyecto Vercel. Gabriel tiene que crearlos o darme acceso.
- Firma digital de Estela: herramienta y si firma 4 PDF o uno.
- Si los 10 días de observación son corridos o hábiles.
- Reglas exactas de años de prueba de Menem (Ley 8162).
- Lista de padrones de La Milagrosa y Menem (pedir a Catastro).
- Mails reales de Catastro (expediente nuevo y observación) para la vigilancia del correo.

## Próximo
Publicar siguiendo `docs/PUBLICAR.md`, alta de Banda del Río Salí, prueba con celulares reales y vigilancia del correo cuando lleguen los mails de Catastro.

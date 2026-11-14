# Relevamiento de Catastro — Escrituración Social (13-nov-2026)

Fuente: web pública `catastrotucuman.gov.ar/2803-2/`, portal de trámites con la cuenta de Carlos (solo lectura, no se inició ni subió nada), reunión con Carlos (`Downloads\Recording_13.pdf`).

## Trámites que usa la Muni de Banda del Río Salí

En el portal aparecen 5 "marcos normativos". La Muni usa **solo 3** (confirmado por Gabriel):

| Código en el portal | Nombre | Formularios propios |
|---|---|---|
| `Ley Pierri` | Ley Nacional 24.374 – Ley 6753 – Ley 8031 – Dcto. Reg. 782 | Solicitud (2 hojas, con Anexo I) + DDJJ (1 hoja) |
| `Ley 5670` | Barrio La Milagrosa BRS | Solicitud (1 hoja, con grupo familiar) + DDJJ (2 hojas) |
| `Ley 8162` | Barrio Menem BRS | Solicitud (2 hojas: datos + observaciones y fotos) + DDJJ (2 hojas) |

No se usan: Ley 8415 (San Eduardo) ni Ley 9850 (El Parquecito, SMT).

## Cómo funciona el portal por dentro

- Un asistente de 4 pasos. **Cada paso tiene un solo casillero que acepta uno o varios PDF**, no un casillero por documento:
  1. `pdf_datos_solicitante[]` — Datos del solicitante
  2. `pdf_individualizacion_inmueble[]` — Individualización del inmueble
  3. `pdf_acreditar_posesion[]` — Acreditar posesión
  4. `pdf_certificacion_municipal[]` — Verificación municipal
- **Rechaza archivos con el mismo nombre en dos pasos distintos.** Nuestro sistema tiene que exportar con nombres únicos (ej. `P1-solicitud-<padron>.pdf`).
- Campos que se escriben en el portal: marco normativo, tipo de ingreso (**INGRESO NUEVO / REINGRESO**), apellido y nombre + CUIT/CUIL del titular, cónyuge (opcional), "agregar más interesados", padrón y padrón 2 (opcional). Botón "Verificar Padrón y CUIT".
- **Para Milagrosa y Menem el padrón no se escribe: se elige de una nómina fija** que trae Catastro de su base (`consultarNominaPadrones.php`, agrupada por plano). Para Pierri es texto libre.
- Al enviar, el portal devuelve el número de expediente. Errores posibles: padrón inexistente, padrón ya usado, padrón intervenido, archivo repetido, mail o teléfono inválido.
- "Mis Trámites Web" lista: N° expediente, fecha de presentación, padrón, CUIL, estado, fecha de observación, documentos adjuntos. Hay **Solicitud de Prórroga** (se sube un PDF).
- Cada técnico ve solo lo que cargó él (Carlos, André, Gastón tienen cuentas propias). Las altas de municipios se piden a sistemas@dgc-tuc.gov.ar.

## Qué pide cada paso según la ley

### Paso 1 — Documentación del solicitante (igual en los 3, cambian los formularios)
- Formulario de solicitud + Declaración jurada (de la ley elegida)
- Origen y año de la posesión (va dentro del formulario)
- DNI y CUIL/CUIT de solicitantes y cónyuge o conviviente
- Casados: acta de matrimonio certificada por el Registro Civil
- Viudos: acta de matrimonio + acta de defunción, certificadas
- Divorciados: sentencia certificada por el juzgado, o acta de matrimonio con la marginal de la sentencia (fecha y juzgado)
- Convivientes: constancia policial original, o acta ante escribano certificada, o acta de unión convivencial del Registro Civil
- Actas de nacimiento del solicitante, del cónyuge y de los padres de ambos. **Según Carlos, para Milagrosa y Menem no van las de los padres** (el portal las sigue pidiendo por error); ahí van las del grupo familiar.

### Paso 2 — Individualización del inmueble (igual en los 3)
- Coordenadas según instructivo (formato `-26.832206,-65.195481`)
- Croquis según instructivo: manzana con calles, terreno marcado con medidas en metros, distancia a la esquina, una referencia visible, numeración municipal, imagen satelital opcional
- Un PDF con 4 fotos: 1 frente, 1 contrafrente, 2 interiores

### Paso 3 — Acreditar la posesión (cambia por ley)
- **Pierri:** período del 31/12/2005 al 01/01/2009, más el año en curso. Sirven: boleto de compraventa, cesión de derechos posesorios, servicios o impuestos (Edet, Gasnor, SAT, DGR, tasa municipal) **con ticket de pago**, históricos sellados por el emisor, acta de nacimiento del período, recibos de sueldo con domicilio, facturas de materiales con domicilio. La web pública agrega certificados médicos y escolares (estos últimos con acta de nacimiento que pruebe el vínculo).
- **5670 La Milagrosa:** certificado de residencia policial + servicios o impuestos con ticket. **Mínimo 3 años antes de la fecha de inicio del expediente y mínimo 2 pruebas distintas por año.**
- **8162 Menem:** certificado de residencia policial + servicios o impuestos con ticket. **Mínimo 5 años antes de la fecha exigida por ley (origen anterior a 2003) y ocupación actual: mínimo 2 pruebas distintas del año en curso.**

### Paso 4 — Verificación municipal (igual en los 3)
- Formulario de **Relevamiento Social de 4 hojas** (`portal-Formulario_LEY_24374_RelevamientoSocial.pdf`):
  1. Marco normativo (ley provincial, decreto), fecha, N° expte, solicitantes 1 y 2 con cónyuges y grupo familiar de cada uno (nombre, DNI, edad, vínculo, ocupación)
  2. Inmueble: capital o interior, domicilio, localidad, departamento, padrón, coordenadas, antecedentes de dominio (matrícula, libro, folio, serie, año); entorno urbano o rural, infraestructura, accesos; ocupación exclusiva o compartida; presencia del ocupante y signos de residencia; croquis
  3. Características: tipología, destino, estado, materiales, servicios, mejoras, observaciones
  4. Fotos del inmueble
  - Cada hoja la firman los solicitantes y el responsable del relevamiento.
  - **Ojo:** la web pública publica una versión vieja de 2 hojas. La que vale es la del portal.

## Formularios: lo que cambia entre leyes

- **Solicitud Pierri:** solicitantes 1 y 2 + cónyuges, inmueble (capital o interior, domicilio), datos catastrales (circunscripción, sección, manzana, parcela, padrón, matrícula, orden, antecedente de dominio). Anexo I para hasta 3 solicitantes más.
- **Solicitud 5670:** solicitantes 1 y 2 + cónyuges + **grupo familiar de cada solicitante** (3 por solicitante). Sin datos del inmueble.
- **Solicitud 8162:** solicitantes + cónyuges + grupo familiar (3) + inmueble **según Plano N° 67.856/2013** (domicilio, padrón, manzana, lote); hoja 2 con observaciones y fotos.
- **DDJJ Pierri:** domicilio, localidad y departamento del inmueble, solicitantes, origen de la posesión (compra u otro) y fecha de inicio.
- **DDJJ 5670:** "declaro ser actual ocupante del inmueble ubicado en", solicitantes + grupo familiar; hoja 2: **¿cuenta con documentación del IPVDU? sí o no** + juramento.
- **DDJJ 8162:** "declaro ser poseedor", solicitantes + grupo familiar; hoja 2: origen de la posesión (compra u otro, anterior a 2003) y fecha de inicio.

## Reglas de diseño definidas por Gabriel

1. **La ley se elige primero y manda.** Define los formularios de cada paso, la lista de documentos del paso 1 (cruzada con el estado civil) y los años de prueba del paso 3.
2. **Un dato se carga una sola vez.** El expediente tiene una única ficha (personas, cónyuges, grupo familiar, inmueble, posesión). Los formularios de todos los pasos se llenan desde esa ficha. Lo que se cargó en un paso aparece ya completo en los siguientes, con un aviso: "Estos datos vienen del paso N, revisalos".
3. **Si un dato cambia después**, se actualiza en todos los formularios. Si alguno ya estaba impreso o firmado, el sistema avisa que hay que reimprimirlo y volver a firmarlo.

## Archivos en esta carpeta

- `formularios-oficiales/`: los PDF de la web pública (1 a 5) y los del portal (`portal-*`). **Para llenar se usan los `portal-*`**, que son los que pide hoy Catastro. La solicitud Pierri del panel actual es idéntica a la del portal.
- `js-catastro/`: scripts públicos del formulario de Catastro, guardados como referencia de sus reglas. No se usan en nuestro código.

## Pendiente de relevar

- Acceso GIS (`aplicaciones.catastrotucuman.gov.ar/acceso-seguro/login_gis.html`), de donde se copian los datos catastrales por padrón. Usa otro ingreso.
- La nómina de padrones de Milagrosa y Menem: conviene pedirle a Catastro el listado (Excel) para cargarlo en nuestro sistema y buscar por lote o beneficiario.

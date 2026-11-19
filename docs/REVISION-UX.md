# Revisión de punta a punta (18-nov-2026)

Recorrido en local con usuarios `@prueba.local`. Expedientes de prueba: **BRS-2026-0009** (Pierri, soltera) y **BRS-2026-0010** (La Milagrosa, casado, sin DNI).
Regla: se arregla **un punto por vez**, con OK de Gabriel, probando cada uno.

## Graves: pueden hacer que Catastro rechace o demore el expediente

1. ✅ *Resuelto 18-nov: sección "Datos de Catastro" en la ficha.* **El padrón no se puede cargar después de abrir el expediente.** En la ficha dice "llega en la próxima etapa" y en el formulario está bloqueado ("se cambia desde la ficha"). Si no se cargó al abrir, no hay forma de ponerlo. *Reproducir:* BRS-2026-0009 → Inmueble.
2. ✅ *Resuelto 18-nov: aviso en la ficha con links, punto en "Antes de aprobar" y aviso antes de imprimir (`src/lib/datos-obligatorios.ts`). Con esto el punto 3 queda avisado, aunque sigue cargándose en la declaración jurada.* **No se controlan los datos obligatorios.** Se puede imprimir la solicitud y la declaración jurada con casilleros vacíos (padrón, DNI, CUIL, origen y fecha de la posesión, localidad). "Antes de aprobar" y "Falta traer" solo miran documentos, no datos. *Reproducir:* BRS-2026-0010 se abrió sin DNI y no aparece ningún aviso.
3. **El origen y la fecha de inicio de la posesión solo se cargan dentro de la declaración jurada.** No están en la ficha ni en lo que falta: es fácil olvidarlos. *Reproducir:* BRS-2026-0009 → Declaración jurada → Compra/Otro sin marcar, y ningún aviso.
4. ✅ *Resuelto 18-nov: campo Correo y teléfono/correo en datos para copiar.* **Faltan datos que pide el portal:** el correo del solicitante, que el portal valida. Además, "Datos para copiar" en Catastro no muestra el teléfono.
5. **La Milagrosa y Menem: en el portal, el padrón se elige de una lista fija de Catastro**, pero acá se escribe libre. Hay riesgo de cargar un padrón que no está en esa lista. Hay que pedirle el listado a Catastro y cargarlo.
6. **A confirmar con Carlos:** en La Milagrosa y Menem el sistema no pide el acta de nacimiento del propio solicitante ni la del cónyuge, solo las del grupo familiar. Además, siguen sin confirmar las reglas de años de Menem.

## Medios: confunden o hacen perder tiempo

7. ✅ *Resuelto 18-nov: las escritas cumplen el requisito y el PDF del paso 2 lleva la hoja sola.* **Las coordenadas se piden dos veces:** escritas en Inmueble y como documento a subir en el paso 2. El paso sigue en "Falta" aunque ya estén escritas.
8. ✅ *Resuelto 18-nov: al abrir (y al entrar a la ficha si estaba vacío) se pone el barrio de la ley y su localidad; se puede cambiar en Inmueble.* **El barrio no se elige solo según la ley** (La Milagrosa → barrio La Milagrosa; Menem → Presidente Menem). Mientras no se elija, la localidad sale vacía en la declaración jurada.
9. ✅ *Resuelto 18-nov: recuadro "Próximo paso" arriba de la ficha, con botón, según el estado y el rol (`src/lib/proximo-paso.ts`).* **No hay un "qué sigue".** La ficha muestra los 14 requisitos juntos y no marca cuál es el próximo paso. Conviene poner arriba un "Próximo paso" con un botón.
10. ✅ *Resuelto 18-nov: al tocar cualquier link con cambios pendientes, primero guarda y después sale (si falla, pregunta); con el Atrás del navegador manda lo pendiente al cerrar.* **El autoguardado no cubre salir por el menú** en los 2 segundos siguientes a escribir, y en ese caso no avisa.

## Leves

11. ✅ *Resuelto 18-nov: el autoguardado espera a que DNI, CUIL y fechas estén completos; el CUIL sin guiones se completa solo.* Con el autoguardado, si el CUIL está a medio escribir puede aparecer el error de formato antes de que se termine de escribir.
12. ✅ *Resuelto 18-nov: errores de la base traducidos (`src/lib/errores.ts`) y textos de "próxima etapa" cambiados.* Hay textos técnicos que un cliente no debería ver ("llega en la próxima etapa").

## Lo que se probó y anda bien

- Al enviar a revisión con documentos faltantes, avisa cuántos faltan.
- Las personas y los documentos se pueden quitar, con confirmación.
- La lista de documentos cambia según el estado civil: casado pide el acta de matrimonio y avisa que falta el cónyuge.
- La Milagrosa exige el grupo familiar y pide 2 pruebas distintas por año (2023 a 2025).
- Datos nuevos del titular, Atrás y Continuar, autoguardado y salto del Anexo I.

# Segunda vuelta (18-nov-2026)

Recorrido completo con **BRS-2026-0047** (Menem, local): abrir con fotos del DNI → celular → enviar a revisión (armado) → aprobar (subdirección) → firmar los 4 pasos (dirección) → presentar → observación → prórroga → reingreso → aceptado.

## Graves

13. ✅ *Resuelto: pide confirmación y dice qué falta.* **Aprobar no pide confirmación aunque falten cosas.** Se aprobó con 14 documentos y 4 datos faltantes en un solo clic. "Enviar a revisión" sí avisa; "Aprobar" debería avisar igual (o no dejar).
14. ✅ *Resuelto: los dos piden confirmación.* **"Marcar como firmado" y "Catastro lo aceptó" van en un clic, sin confirmar.** "Aceptado" es el estado final: un clic de más no se puede deshacer.

## Medios

15. ✅ *Resuelto: "Corregí lo observado y reingresalo antes del …".* **"Próximo paso" con prórroga pedida dice "Esperando la respuesta de Catastro"**, pero hay que corregir y reingresar antes de la fecha de la prórroga. (Error del punto 9.)
16. ✅ *Resuelto.* **"Próximo paso" en aprobado con los 4 firmados sigue diciendo "Firmá los PDF"**: debería decir "Marcalo como firmado".
17. ✅ *Resuelto: botón "Seguir sin ubicación" y coordenadas escritas a mano (quedan como "escrita a mano").* **Celular: si el GPS no da permiso, no hay "Siguiente" ni forma de escribir la ubicación.** Solo se sigue tocando los números de arriba, y no es obvio.
18. ✅ *Resuelto: aviso con la lista y confirmación antes de registrar.* **Registrar la presentación y el reingreso no avisan de los datos vacíos** (CUIL, teléfono, correo, domicilio del inmueble: en "Datos para copiar" figuran "Sin cargar").
19. ✅ *Resuelto: botón "Abrir el portal de Catastro". Además se corrigió el link al GIS: Catastro lo movió a `servicios.catastrotucuman.gov.ar` y el viejo daba 404.* **Falta un link al portal de Catastro** en "Presentar en el portal de Catastro".

## Leves

20. ✅ *Resuelto: miniaturas numeradas, se ven grandes y se puede sacar cada una.* Al subir fotos, antes de guardar solo se ven los nombres de archivo, sin miniatura para ver si salió legible.
21. ✅ *Resuelto (también en cig-db).* Textos internos a la vista: "A confirmar con Carlos." (reglas de Menem, sale de la configuración de la ley) y "Cuando tengamos la lista, se va a elegir de ahí." (padrón de La Milagrosa y Menem).

## Anduvo bien

- 2 fotos se unen en un PDF de 41 KB y quedan en el requisito.
- Foto de DNI ilegible: avisa "No se pudo leer el código… la foto queda guardada igual" y deja cargar a mano.
- Al abrir un Menem el barrio queda "Presidente Menem" con su localidad (punto 8).
- Celular: la respuesta escrita a mano sube al terminar y pasa a la ficha (ocupación).
- PDF sin firma digital: rechazado con mensaje claro. Con firma: se guardan los 4 y habilita "Marcar como firmado".
- Presentación, observación (con vencimiento calculado), prórroga, reingreso y aceptado cambian el estado bien; el "Próximo paso" acompaña en cada uno (salvo 15 y 16).

## No probado todavía

Lectura del código de un DNI real (hace falta una foto de un DNI de verdad), relevamiento sin señal, fotos y croquis desde el celular, abrir los PDF firmados bajados.

## Lo que queda (no depende del código)

- **5.** Pedirle a Catastro el listado de padrones de La Milagrosa y Menem para cargarlo.
- **6.** Confirmar con Carlos las actas de nacimiento del solicitante y el cónyuge en La Milagrosa y Menem, y las reglas de años de Menem.
- **3.** Decidir con Carlos si el origen y la fecha de la posesión se pasan a la ficha (hoy se cargan en la declaración jurada, con aviso).
- **Probar con Carlos:** la lectura del código de un DNI real con su celular, el relevamiento sin señal y las fotos/croquis desde el celular.

Nota: en local, BRS-2026-0010 quedó "Reingresado" y BRS-2026-0047 "Aceptado" por esta prueba.

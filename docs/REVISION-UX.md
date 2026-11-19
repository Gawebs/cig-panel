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

11. Con el autoguardado, si el CUIL está a medio escribir puede aparecer el error de formato antes de que se termine de escribir.
12. Hay textos técnicos que un cliente no debería ver ("llega en la próxima etapa").

## Lo que se probó y anda bien

- Al enviar a revisión con documentos faltantes, avisa cuántos faltan.
- Las personas y los documentos se pueden quitar, con confirmación.
- La lista de documentos cambia según el estado civil: casado pide el acta de matrimonio y avisa que falta el cónyuge.
- La Milagrosa exige el grupo familiar y pide 2 pruebas distintas por año (2023 a 2025).
- Datos nuevos del titular, Atrás y Continuar, autoguardado y salto del Anexo I.

## No probado todavía

Subida real de fotos y lectura del DNI, aplicación del celular (`/campo`), firma de la Dirección, presentación, observación, prórroga y reingreso. Va en una segunda vuelta.

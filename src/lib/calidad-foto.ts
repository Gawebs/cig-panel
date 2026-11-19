/**
 * Medición rápida de una imagen de la cámara, para guiar a quien saca la foto en el momento.
 * Función pura: recibe los píxeles (como ImageData) y no depende del navegador.
 */

export interface Pixeles {
  data: Uint8ClampedArray | Uint8Array
  width: number
  height: number
}

export interface Medicion {
  /** Brillo promedio, 0 a 255. */
  luz: number
  /** Nitidez: varianza del borde (Laplaciano). Más alto = más nítido. */
  nitidez: number
  /** Parte de la imagen quemada por un reflejo, 0 a 1. */
  reflejo: number
}

export function medirImagen({ data, width, height }: Pixeles): Medicion {
  const n = width * height
  const gris = new Float32Array(n)
  let suma = 0
  let quemados = 0
  for (let i = 0, j = 0; j < n; i += 4, j++) {
    const g = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
    gris[j] = g
    suma += g
    if (g > 248) quemados++
  }
  let s = 0
  let s2 = 0
  let m = 0
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const k = y * width + x
      const lap = 4 * gris[k] - gris[k - 1] - gris[k + 1] - gris[k - width] - gris[k + width]
      s += lap
      s2 += lap * lap
      m++
    }
  }
  const media = m ? s / m : 0
  return {
    luz: n ? suma / n : 0,
    nitidez: m ? s2 / m - media * media : 0,
    reflejo: n ? quemados / n : 0,
  }
}

export type TipoFoto = 'documento' | 'vivienda'

export interface Consejo {
  lista: boolean
  texto: string
}

// Umbrales sobre una muestra de 320 px de ancho. Los documentos piden más nitidez que una fachada.
const NITIDEZ_MINIMA: Record<TipoFoto, number> = { documento: 120, vivienda: 45 }

/** Qué decirle a la persona según la medición. */
export function consejoFoto(m: Medicion, tipo: TipoFoto): Consejo {
  if (m.luz < 55) return { lista: false, texto: 'Falta luz: acercate a una ventana o prendé una luz.' }
  if (tipo === 'documento' && m.reflejo > 0.06) return { lista: false, texto: 'Hay un reflejo: inclinalo un poco o alejalo de la luz directa.' }
  if (m.luz > 235) return { lista: false, texto: 'Hay demasiada luz: evitá el sol de frente.' }
  if (m.nitidez < NITIDEZ_MINIMA[tipo]) {
    return {
      lista: false,
      texto: tipo === 'documento' ? 'Está borroso: quedate quieto y acercalo hasta que llene el recuadro.' : 'Está movido: quedate quieto un momento.',
    }
  }
  return { lista: true, texto: tipo === 'documento' ? 'Bien: se ve claro.' : 'Bien: sacá la foto.' }
}

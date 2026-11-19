import { describe, expect, it } from 'vitest'
import { consejoFoto, medirImagen } from './calidad-foto'

function imagen(ancho: number, alto: number, valor: (x: number, y: number) => number) {
  const data = new Uint8ClampedArray(ancho * alto * 4)
  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) {
      const v = valor(x, y)
      const i = (y * ancho + x) * 4
      data[i] = data[i + 1] = data[i + 2] = v
      data[i + 3] = 255
    }
  }
  return { data, width: ancho, height: alto }
}

describe('Calidad de la foto', () => {
  it('oscura', () => {
    const m = medirImagen(imagen(64, 40, () => 20))
    expect(consejoFoto(m, 'documento').lista).toBe(false)
    expect(consejoFoto(m, 'documento').texto).toMatch(/luz/)
  })
  it('lisa (borrosa)', () => {
    const m = medirImagen(imagen(64, 40, (x) => 100 + x))
    expect(consejoFoto(m, 'documento').texto).toMatch(/borroso/)
  })
  it('con bordes marcados (nítida)', () => {
    const m = medirImagen(imagen(64, 40, (x, y) => ((x >> 2) + (y >> 2)) % 2 ? 200 : 60))
    expect(consejoFoto(m, 'documento').lista).toBe(true)
    expect(consejoFoto(m, 'vivienda').lista).toBe(true)
  })
  it('reflejo en un documento', () => {
    const m = medirImagen(imagen(64, 40, (x, y) => (x < 20 ? 255 : ((x + y) % 2 ? 200 : 60))))
    expect(consejoFoto(m, 'documento').texto).toMatch(/reflejo/)
  })
})

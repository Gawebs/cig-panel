import { describe, expect, it } from 'vitest'
import { nombreFirmado, tieneFirmaDigital } from './firma'

const pdf = (cuerpo: string) => new TextEncoder().encode(`%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\n${cuerpo}\n%%EOF`)

describe('tieneFirmaDigital', () => {
  it('reconoce un PDF firmado', () => {
    const firmado = pdf('5 0 obj\n<< /Type /Sig /Filter /Adobe.PPKLite /SubFilter /adbe.pkcs7.detached /ByteRange [0 840 17224 1520] /Contents <3082> >>\nendobj')
    expect(tieneFirmaDigital(firmado)).toBe(true)
  })
  it('reconoce firmas CAdES sin /Type explícito', () => {
    expect(tieneFirmaDigital(pdf('<< /SubFilter /ETSI.CAdES.detached /ByteRange [ 0 10 20 30 ] >>'))).toBe(true)
  })
  it('rechaza el PDF sin firmar', () => {
    expect(tieneFirmaDigital(pdf('2 0 obj\n<< /Type /Page >>\nendobj'))).toBe(false)
  })
  it('rechaza un campo de firma vacío (sin firmar todavía)', () => {
    expect(tieneFirmaDigital(pdf('<< /FT /Sig /T (Firma1) >>'))).toBe(false)
  })
  it('arma el nombre del archivo firmado', () => {
    expect(nombreFirmado(2, 'BRS-2026-0001')).toBe('P2-BRS-2026-0001-firmado.pdf')
  })
})

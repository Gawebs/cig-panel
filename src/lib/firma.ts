/**
 * Control de que un PDF venga firmado digitalmente.
 *
 * Un PDF con firma digital (la de la Dirección, con cualquier herramienta: Adobe, el firmador
 * de la ONTI, un token) tiene un diccionario de firma con "/ByteRange" y "/Contents".
 * Esto no valida el certificado: confirma que el archivo subido es el firmado y no el original.
 * La validez del certificado la controla Catastro al recibirlo.
 */
export function tieneFirmaDigital(bytes: Uint8Array): boolean {
  // Los diccionarios de firma son texto ASCII dentro del PDF (fuera de los flujos comprimidos).
  let texto = ''
  for (let i = 0; i < bytes.length; i += 0x8000) texto += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  const rango = /\/ByteRange\s*\[\s*\d+\s+\d+\s+\d+\s+\d+\s*\]/.test(texto)
  const firma = /\/Type\s*\/Sig\b/.test(texto) || /\/SubFilter\s*\/(adbe\.pkcs7|ETSI\.CAdES)/i.test(texto)
  return rango && firma
}

/** Nombre del archivo firmado de cada paso, como lo acepta el portal (sin repetir nombres entre pasos). */
export function nombreFirmado(paso: number, numeroInterno: string): string {
  return `P${paso}-${numeroInterno}-firmado.pdf`
}

import type { NextConfig } from 'next'

// En el proyecto de Vercel del panel anterior las variables se llaman VITE_*: se aceptan las dos.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? ''
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY ?? ''
const supabase = SUPABASE_URL
const supabaseWs = supabase.replace(/^http/, 'ws')
const desarrollo = process.env.NODE_ENV !== 'production'

// Política de contenido: el sitio solo habla con su propio dominio y con su base de Supabase.
// 'wasm-unsafe-eval' lo necesitan los lectores locales (texto del DNI y voz), que corren en WebAssembly.
const politica = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'${desarrollo ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${supabase}`,
  `media-src 'self' blob: ${supabase}`,
  "font-src 'self'",
  `connect-src 'self' blob: data: ${supabase} ${supabaseWs}`,
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(desarrollo ? [] : ['upgrade-insecure-requests']),
].join('; ')

const nextConfig: NextConfig = {
  poweredByHeader: false,
  env: {
    NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: SUPABASE_ANON,
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: politica },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Cámara (DNI y fotos), micrófono (entrevista) y ubicación (GPS) solo para el propio sitio.
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(self), geolocation=(self), payment=()' },
          ...(desarrollo ? [] : [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' }]),
        ],
      },
    ]
  },
}

export default nextConfig

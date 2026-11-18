import type { MetadataRoute } from 'next'

// Aplicación instalable para los relevadores: abre directo en la pantalla de relevamiento.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'CIG Relevamiento',
    short_name: 'Relevamiento',
    description: 'Relevamiento de inmuebles para regularización dominial, con o sin señal.',
    start_url: '/campo',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f4f7f9',
    theme_color: '#1f5ca8',
    lang: 'es-AR',
    icons: [
      { src: '/icono-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icono-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icono-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}

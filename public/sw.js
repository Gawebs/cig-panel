// Trabajo sin señal para la aplicación de relevamiento (/campo).
// - La pantalla /campo: primero la red; sin señal, la última copia guardada.
// - Código y recursos con nombre fijo por versión (/_next/static, /vendor): primero lo guardado.
// - No toca los datos (Supabase) ni los envíos al servidor: esos los maneja la aplicación
//   guardando todo en el celular y sincronizando cuando hay conexión.
const VERSION = 'cig-campo-v1'
const PAGINAS = `${VERSION}-paginas`
const RECURSOS = `${VERSION}-recursos`

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const nombres = await caches.keys()
      await Promise.all(nombres.filter((n) => !n.startsWith(VERSION)).map((n) => caches.delete(n)))
      await self.clients.claim()
    })(),
  )
})

function esRecursoFijo(url) {
  return (
    url.pathname.startsWith('/_next/static/') ||
    (url.pathname.startsWith('/vendor/') && !url.pathname.startsWith('/vendor/modelos/')) ||
    /^\/icono-\d+\.png$/.test(url.pathname) ||
    url.pathname === '/manifest.webmanifest'
  )
}

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return

  // Pantalla de relevamiento
  if (req.mode === 'navigate' && (url.pathname === '/campo' || url.pathname.startsWith('/campo/'))) {
    event.respondWith(
      (async () => {
        try {
          const resp = await fetch(req)
          // Solo se guarda la pantalla real (no la de ingreso si la sesión venció).
          if (resp.ok && !resp.redirected) {
            const cache = await caches.open(PAGINAS)
            await cache.put('/campo', resp.clone())
          }
          return resp
        } catch {
          const guardada = await caches.match('/campo', { cacheName: PAGINAS })
          return guardada ?? new Response('Sin conexión. Abrí la aplicación una vez con señal para poder usarla sin conexión.', {
            status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' },
          })
        }
      })(),
    )
    return
  }

  if (esRecursoFijo(url)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(RECURSOS)
        const guardado = await cache.match(req)
        if (guardado) return guardado
        const resp = await fetch(req)
        if (resp.ok) await cache.put(req, resp.clone())
        return resp
      })(),
    )
  }
})

import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Pantallas para quien no inició sesión
const GUEST_ROUTES = ['/ingresar']

function matches(pathname: string, routes: string[]) {
  return routes.some((route) => pathname === route || pathname.startsWith(`${route}/`))
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options))
        },
      },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const isGuestRoute = matches(pathname, GUEST_ROUTES)

  if (!user && !isGuestRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/ingresar'
    url.search = ''
    return NextResponse.redirect(url)
  }

  if (user && isGuestRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  // Fuera del control de sesión: archivos públicos del producto (código, iconos, motor de voz, formularios en blanco).
  // api/latido: el cron diario que mantiene despierta la base (no lee datos).
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/latido|vendor/|sw\\.js|manifest\\.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|pdf)$).*)'],
}

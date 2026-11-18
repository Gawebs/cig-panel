import { createClient } from '@supabase/supabase-js'

// Latido diario (cron de Vercel, ver vercel.json): una escritura chica para que
// Supabase no pause la base por falta de uso mientras esté en el plan gratuito.
export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
  const { data, error } = await supabase.rpc('latido')
  if (error) {
    console.error('latido', error.message)
    return Response.json({ ok: false }, { status: 500 })
  }
  return Response.json({ ok: true, ultimo: data })
}

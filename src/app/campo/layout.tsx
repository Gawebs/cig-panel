import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Relevamiento · CIG',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'Relevamiento', statusBarStyle: 'default' },
}

// Aplicación del relevador: funciona sin señal. No usa el armado del panel (que necesita conexión).
export default function CampoLayout({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-1 flex-col">{children}</div>
}

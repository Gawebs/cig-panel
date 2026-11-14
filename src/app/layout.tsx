import type { Metadata, Viewport } from 'next'
import { Nunito_Sans, Questrial } from 'next/font/google'
import './globals.css'

const questrial = Questrial({ variable: '--font-questrial', weight: '400', subsets: ['latin'] })
const nunito = Nunito_Sans({ variable: '--font-nunito', subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'CIG Regularización Dominial',
  description: 'Armado, revisión y presentación de expedientes de escrituración social ante Catastro de Tucumán.',
}

export const viewport: Viewport = {
  themeColor: '#1f5fae',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={`${questrial.variable} ${nunito.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  )
}

import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Camp Tournament',
  description: 'Лагерен турнир с точки, игри и achievements'
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="bg">
      <body>{children}</body>
    </html>
  )
}

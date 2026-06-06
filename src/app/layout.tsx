import type { Metadata, Viewport } from "next"
import "./globals.css"
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister"

export const metadata: Metadata = {
  title: "Controle de Contas",
  description: "Gestão financeira pessoal",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Conta+",
  },
  icons: {
    icon: [
      { url: "/api/icon?s=192", sizes: "192x192", type: "image/png" },
      { url: "/api/icon?s=512", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/api/icon?s=180", sizes: "180x180", type: "image/png" },
    ],
  },
}

export const viewport: Viewport = {
  themeColor: "#0A0A0A",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
      <body className="bg-gray-50 text-gray-900 antialiased">
        <ServiceWorkerRegister />
        {children}
      </body>
    </html>
  )
}

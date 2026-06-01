/**
 * app/layout.tsx
 * Layout raíz de Motion Arcade.
 * Configuración de metadatos y fuentes para toda la app.
 */

import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Motion Arcade — Juegos con tu cuerpo',
  description:
    'Plataforma de videojuegos controlados por movimientos corporales. Sin apps nativas. Todo desde el navegador con MediaPipe y Phaser.js.',
  keywords: ['videojuegos', 'mediapipe', 'motion control', 'phaser', 'esp32', 'nextjs'],
  authors: [{ name: 'Motion Arcade' }],
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#050510',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full`}
    >
      <body className="min-h-full bg-gray-950 antialiased">{children}</body>
    </html>
  );
}

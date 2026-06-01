/**
 * next.config.ts
 * Configuración de Next.js 16 para Motion Arcade.
 *
 * DECISIONES:
 * - transpilePackages: Phaser usa ESM puro; Next necesita transpilarlo
 * - turbopack: configuración vacía para silenciar el warning de Turbopack
 *   cuando no se necesita configuración especial
 * - headers: COOP necesario para cámara en contextos cross-origin
 */

import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['phaser'],

  // Turbopack es el bundler por defecto en Next.js 16.
  // Configuración vacía para activarlo explícitamente sin warnings.
  turbopack: {},

  headers: async () => [
    {
      source: '/(.*)',
      headers: [
        { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
      ],
    },
  ],
};

export default nextConfig;

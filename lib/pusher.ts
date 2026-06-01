/**
 * lib/pusher.ts
 * Clientes Pusher para servidor y cliente.
 *
 * DISEÑO: Separamos cliente y servidor en el mismo archivo
 * usando lazy initialization para evitar instanciar Pusher
 * server-side en el navegador (y viceversa).
 *
 * El cliente usa pusher-js (WebSocket).
 * El servidor usa el SDK oficial pusher (REST API para triggers).
 */

// ---- Cliente (navegador) ----
import PusherClient from 'pusher-js';

let pusherClientInstance: PusherClient | null = null;

export function getPusherClient(): PusherClient {
  if (!pusherClientInstance) {
    pusherClientInstance = new PusherClient(
      process.env.NEXT_PUBLIC_PUSHER_KEY!,
      {
        cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
        // Desactivar logs en producción
        enabledTransports: ['ws', 'wss'],
      }
    );
  }
  return pusherClientInstance;
}

// ---- Servidor (API Routes) ----
// Solo se importa server-side; en el cliente este módulo no se ejecuta.
type PusherServerInstance = { trigger: (ch: string, ev: string, data: unknown) => Promise<void> };
let pusherServerInstance: PusherServerInstance | null = null;

export async function getPusherServer() {
  if (pusherServerInstance) return pusherServerInstance;

  // Importación dinámica para evitar bundling en el cliente
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const PusherMod = await import('pusher');
  const Pusher = PusherMod.default ?? PusherMod;
  pusherServerInstance = new (Pusher as unknown as new (opts: {
    appId: string; key: string; secret: string; cluster: string; useTLS: boolean;
  }) => { trigger: (ch: string, ev: string, data: unknown) => Promise<void> })({
    appId: process.env.PUSHER_APP_ID!,
    key: process.env.NEXT_PUBLIC_PUSHER_KEY!,
    secret: process.env.PUSHER_SECRET!,
    cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
    useTLS: true,
  });

  return pusherServerInstance;
}

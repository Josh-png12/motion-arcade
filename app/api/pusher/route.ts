/**
 * app/api/pusher/route.ts
 * API Route para disparar eventos Pusher hacia el ESP32.
 *
 * DISEÑO: El cliente nunca habla directo con Pusher server-side
 * (eso requeriría exponer el PUSHER_SECRET). En cambio, el navegador
 * hace un POST a esta ruta y el servidor dispara el trigger.
 *
 * Rate limiting básico: máximo 30 requests/segundo por IP.
 * Suficiente para una feria universitaria, sin costos de Redis.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPusherServer } from '@/lib/pusher';
import { PUSHER_CHANNEL } from '@/types/pusher.types';
import type { PusherEventName, PusherTriggerResponse } from '@/types/pusher.types';

// Rate limiting simple en memoria (se resetea con cada deploy)
const requestCounts = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 30; // requests por segundo por IP
const RATE_WINDOW = 1000; // ms

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = requestCounts.get(ip);

  if (!record || now > record.resetAt) {
    requestCounts.set(ip, { count: 1, resetAt: now + RATE_WINDOW });
    return true;
  }

  if (record.count >= RATE_LIMIT) return false;
  record.count++;
  return true;
}

const VALID_EVENTS: Set<PusherEventName> = new Set([
  'player_ready',
  'game_start',
  'combo',
  'score',
  'game_over',
  'error',
]);

export async function POST(req: NextRequest): Promise<NextResponse<PusherTriggerResponse>> {
  // Obtener IP para rate limiting
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] ?? 'unknown';

  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { success: false, error: 'Rate limit excedido' },
      { status: 429 }
    );
  }

  let body: { event?: unknown; data?: unknown; timestamp?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: 'JSON inválido' }, { status: 400 });
  }

  const { event, data, timestamp } = body;

  if (!event || !VALID_EVENTS.has(event as PusherEventName)) {
    return NextResponse.json(
      { success: false, error: `Evento inválido: ${event}` },
      { status: 400 }
    );
  }

  try {
    const pusher = await getPusherServer();
    await pusher.trigger(PUSHER_CHANNEL, event as string, {
      event,
      data: data ?? {},
      timestamp: timestamp ?? Date.now(),
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[API/pusher] Error triggering event:', err);
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

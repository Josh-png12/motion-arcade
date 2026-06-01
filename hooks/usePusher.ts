/**
 * hooks/usePusher.ts
 * Hook para enviar eventos al ESP32 vía Pusher Channels.
 *
 * DISEÑO: El hook encapsula la lógica de la API route /api/pusher
 * para que los juegos solo llamen `triggerEvent('game_start')`.
 * Los errores se manejan silenciosamente para no interrumpir el gameplay.
 */

'use client';

import { useCallback, useRef } from 'react';
import type { PusherEventName } from '@/types/pusher.types';

interface TriggerOptions {
  data?: Record<string, unknown>;
}

interface UsePusherReturn {
  triggerEvent: (event: PusherEventName, options?: TriggerOptions) => void;
}

export function usePusher(): UsePusherReturn {
  // Cola para evitar múltiples requests simultáneos al mismo endpoint
  const pendingRef = useRef<Set<string>>(new Set());

  const triggerEvent = useCallback(
    (event: PusherEventName, options: TriggerOptions = {}) => {
      // Evitar spam: máximo 1 request por tipo de evento en vuelo
      if (pendingRef.current.has(event)) return;
      pendingRef.current.add(event);

      fetch('/api/pusher', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event,
          data: options.data,
          timestamp: Date.now(),
        }),
      })
        .then(async res => {
          if (!res.ok) {
            const body = await res.text();
            console.warn(`[Pusher] Error enviando '${event}':`, body);
          }
        })
        .catch(err => {
          // Errores de red no deben parar el juego
          console.warn('[Pusher] Error de red:', err);
        })
        .finally(() => {
          pendingRef.current.delete(event);
        });
    },
    []
  );

  return { triggerEvent };
}

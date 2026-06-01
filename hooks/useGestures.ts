/**
 * hooks/useGestures.ts
 * Hook optimizado: HAND_POSITION no causa re-renders de React.
 *
 * PROBLEMA ANTERIOR:
 * HAND_POSITION se emitía 30 veces/segundo → setGestureState() → re-render.
 * Con 30fps esto significaba 30 re-renders/segundo solo para actualizar posición.
 *
 * SOLUCIÓN:
 * - HAND_POSITION actualiza solo un ref (sin re-render).
 * - Los eventos discretos (JUMP, SLICE, etc.) siguen actualizando estado React.
 * - handPositionRef queda disponible para componentes que lo necesiten sin suscribirse.
 * - El callback onGesture sigue recibiendo TODOS los eventos (incluyendo HAND_POSITION).
 */

'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { gestureDetector } from '@/gestures/detector';
import type {
  GestureEvent, GestureState, GestureCallback, NormalizedPosition,
} from '@/types/gesture.types';

interface UseGesturesReturn {
  /** Estado discreto: se actualiza solo en gestos puntuales (no en HAND_POSITION) */
  gestureState: GestureState;
  /** Último evento discreto recibido */
  lastEvent: GestureEvent | null;
  /** Posición de manos en tiempo real via ref (sin re-render) */
  handPositionRef: React.RefObject<{
    left: NormalizedPosition | null;
    right: NormalizedPosition | null;
  }>;
}

export function useGestures(onGesture?: GestureCallback): UseGesturesReturn {
  const [gestureState, setGestureState] = useState<GestureState>(
    gestureDetector.getState()
  );
  const [lastEvent, setLastEvent] = useState<GestureEvent | null>(null);

  // Ref de posición: actualizado 30fps sin causar re-renders
  const handPositionRef = useRef<{
    left: NormalizedPosition | null;
    right: NormalizedPosition | null;
  }>({ left: null, right: null });

  // Mantener la referencia al callback actual sin re-suscribir
  const callbackRef = useRef(onGesture);
  callbackRef.current = onGesture;

  // Handler estable — no cambia entre renders
  const handler = useCallback((event: GestureEvent) => {
    if (event.type === 'HAND_POSITION') {
      // Ruta rápida: actualizar ref, NO actualizar estado React
      handPositionRef.current = {
        left:  event.leftHand  ?? null,
        right: event.rightHand ?? null,
      };
      // Aun así notificamos al callback (Phaser lo usa para posición de cursor)
      callbackRef.current?.(event);
      return;
    }

    // Eventos discretos: sí actualizan estado React (≤ 1-2 veces/segundo real)
    setLastEvent(event);
    setGestureState(gestureDetector.getState());
    callbackRef.current?.(event);
  }, []); // sin dependencias — handler nunca cambia

  useEffect(() => {
    return gestureDetector.onGesture(handler);
  }, [handler]);

  return { gestureState, lastEvent, handPositionRef };
}

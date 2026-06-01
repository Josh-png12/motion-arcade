/**
 * components/gestures/GestureVisualizer.tsx
 * Muestra el estado actual de los gestos detectados.
 *
 * DISEÑO: Panel de debug/feedback visual que muestra en tiempo real
 * qué gestos se están detectando. Útil durante las instrucciones del
 * juego para que el jugador calibre su posición.
 */

'use client';

import { useGestures } from '@/hooks/useGestures';
import type { GestureEvent } from '@/types/gesture.types';

interface GestureVisualizerProps {
  className?: string;
}

function GestureTag({ label, active }: { label: string; active: boolean }) {
  return (
    <span
      className={`px-2 py-0.5 rounded text-xs font-mono transition-all duration-150 ${
        active
          ? 'bg-green-500 text-black shadow-[0_0_8px_rgba(74,222,128,0.8)]'
          : 'bg-gray-800 text-gray-500'
      }`}
    >
      {label}
    </span>
  );
}

export function GestureVisualizer({ className = '' }: GestureVisualizerProps) {
  const { gestureState, lastEvent } = useGestures();

  return (
    <div className={`bg-gray-900/90 rounded-xl p-3 ${className}`}>
      <p className="text-gray-400 text-xs font-mono mb-2 uppercase tracking-wider">
        Gestos Detectados
      </p>

      {/* Estado del jugador */}
      <div className="flex items-center gap-2 mb-3">
        <div
          className={`w-2 h-2 rounded-full ${
            gestureState.playerDetected ? 'bg-green-400 animate-pulse' : 'bg-red-500'
          }`}
        />
        <span className="text-xs text-gray-300">
          {gestureState.playerDetected ? 'Jugador detectado' : 'Sin jugador'}
        </span>
      </div>

      {/* Tags de gestos activos */}
      <div className="flex flex-wrap gap-1">
        <GestureTag label="↑ Mano Izq" active={lastEvent?.type === 'LEFT_HAND_UP'} />
        <GestureTag label="↑ Mano Der" active={lastEvent?.type === 'RIGHT_HAND_UP'} />
        <GestureTag label="✋✋ Ambas" active={lastEvent?.type === 'BOTH_HANDS_UP'} />
        <GestureTag label="⬆ Saltar" active={gestureState.isJumping} />
        <GestureTag label="⬇ Agachar" active={gestureState.isCrouching} />
        <GestureTag label="← Izq" active={gestureState.isMovingLeft} />
        <GestureTag label="→ Der" active={gestureState.isMovingRight} />
        <GestureTag label="⟵ Slice" active={lastEvent?.type === 'SLICE_LEFT'} />
        <GestureTag label="⟶ Slice" active={lastEvent?.type === 'SLICE_RIGHT'} />
      </div>

      {/* Posición de manos */}
      {(gestureState.leftHandPosition || gestureState.rightHandPosition) && (
        <div className="mt-2 text-xs font-mono text-gray-400">
          {gestureState.leftHandPosition && (
            <div>
              L: ({gestureState.leftHandPosition.x.toFixed(2)},{' '}
              {gestureState.leftHandPosition.y.toFixed(2)})
            </div>
          )}
          {gestureState.rightHandPosition && (
            <div>
              R: ({gestureState.rightHandPosition.x.toFixed(2)},{' '}
              {gestureState.rightHandPosition.y.toFixed(2)})
            </div>
          )}
        </div>
      )}
    </div>
  );
}

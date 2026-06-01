/**
 * components/ui/GestureInstructions.tsx
 * Pantalla de instrucciones de gestos antes de iniciar el juego.
 * Muestra los gestos requeridos con animaciones visuales.
 */

'use client';

import { useState, useEffect } from 'react';
import type { GameMetadata } from '@/types/game.types';

interface GestureInstructionsProps {
  game: GameMetadata;
  onReady: () => void;
  isPlayerDetected: boolean;
}

const GESTURE_ICONS: Record<string, { icon: string; label: string }> = {
  SLICE_LEFT: { icon: '⟵✋', label: 'Desliza mano izquierda' },
  SLICE_RIGHT: { icon: '✋⟶', label: 'Desliza mano derecha' },
  HAND_POSITION: { icon: '✋↕', label: 'Mueve la mano arriba/abajo' },
  LEFT_HAND_UP: { icon: '✋↑', label: 'Levanta mano izquierda' },
  RIGHT_HAND_UP: { icon: '↑✋', label: 'Levanta mano derecha' },
  BOTH_HANDS_UP: { icon: '✋↑↑✋', label: 'Levanta ambas manos' },
  JUMP: { icon: '⬆️', label: 'Salta' },
  CROUCH: { icon: '⬇️', label: 'Agáchate' },
  MOVE_LEFT: { icon: '⬅️', label: 'Muévete a la izquierda' },
  MOVE_RIGHT: { icon: '➡️', label: 'Muévete a la derecha' },
  PUNCH_LEFT: { icon: '👊←', label: 'Golpe izquierdo' },
  PUNCH_RIGHT: { icon: '→👊', label: 'Golpe derecho' },
};

export function GestureInstructions({
  game,
  onReady,
  isPlayerDetected,
}: GestureInstructionsProps) {
  const [countdown, setCountdown] = useState<number | null>(null);

  useEffect(() => {
    if (!isPlayerDetected || countdown !== null) return;
    // Inicia cuenta regresiva cuando se detecta al jugador
    setCountdown(3);
  }, [isPlayerDetected, countdown]);

  useEffect(() => {
    if (countdown === null) return;
    if (countdown === 0) {
      onReady();
      return;
    }
    const t = setTimeout(() => setCountdown(c => (c !== null ? c - 1 : null)), 1000);
    return () => clearTimeout(t);
  }, [countdown, onReady]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-950 px-6 py-8">
      {/* Título del juego */}
      <div className={`bg-gradient-to-r ${game.accentColor} bg-clip-text text-transparent mb-2`}>
        <h1 className="text-4xl font-black text-center">{game.title}</h1>
      </div>
      <p className="text-gray-400 text-center mb-6 max-w-xs">{game.description}</p>

      {/* Dificultad */}
      <div className="mb-6 flex gap-4 text-sm">
        <span className="bg-gray-800 px-3 py-1 rounded-full text-gray-300">
          🎮 {game.difficulty}
        </span>
        <span className="bg-gray-800 px-3 py-1 rounded-full text-gray-300">
          ⏱ {game.avgDuration}
        </span>
      </div>

      {/* Gestos requeridos */}
      <div className="w-full max-w-sm mb-8">
        <p className="text-gray-500 text-xs font-mono uppercase mb-3 text-center">
          Controles
        </p>
        <div className="grid grid-cols-2 gap-2">
          {game.requiredGestures.map(gesture => {
            const info = GESTURE_ICONS[gesture];
            if (!info) return null;
            return (
              <div
                key={gesture}
                className="bg-gray-800/80 border border-white/5 rounded-xl p-3 flex items-center gap-3"
              >
                <span className="text-2xl">{info.icon}</span>
                <span className="text-gray-300 text-xs">{info.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Estado del jugador */}
      <div className="mb-6">
        {!isPlayerDetected ? (
          <div className="flex items-center gap-2 text-yellow-400">
            <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
            <span className="text-sm">Colócate frente a la cámara...</span>
          </div>
        ) : countdown !== null ? (
          <div className="text-center">
            <div className="text-6xl font-black text-white animate-bounce mb-2">
              {countdown === 0 ? '¡GO!' : countdown}
            </div>
            <p className="text-green-400 text-sm">¡Jugador detectado!</p>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-green-400">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-sm">¡Listo! Iniciando...</span>
          </div>
        )}
      </div>

      {/* Botón manual */}
      <button
        onClick={onReady}
        className={`px-8 py-3 rounded-xl font-bold text-sm transition-all ${
          isPlayerDetected
            ? `bg-gradient-to-r ${game.accentColor} text-white shadow-lg hover:scale-105`
            : 'bg-gray-800 text-gray-500 cursor-not-allowed'
        }`}
      >
        {isPlayerDetected ? '▶ Empezar ahora' : 'Esperando jugador...'}
      </button>
    </div>
  );
}

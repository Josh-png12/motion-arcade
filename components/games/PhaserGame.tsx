/**
 * components/games/PhaserGame.tsx
 * Wrapper React para una escena de Phaser.
 *
 * DISEÑO: Monta/desmonta el juego Phaser correctamente en el
 * ciclo de vida de React. El canvas de Phaser se inserta en un div
 * y se destruye al desmontar para evitar memory leaks.
 *
 * El componente puentea el sistema de gestos de React con las
 * escenas de Phaser enviando eventos y estado de forma segura.
 */

'use client';

import { useEffect, useRef, useCallback } from 'react';
import type Phaser from 'phaser';
import type { BaseGame, BaseGameCallbacks } from '@/games/base/BaseGame';
import type { GestureEvent } from '@/types/gesture.types';
import { useGestures } from '@/hooks/useGestures';

interface PhaserGameProps {
  SceneClass: new () => BaseGame;
  callbacks: BaseGameCallbacks;
  className?: string;
}

export function PhaserGame({ SceneClass, callbacks, className = '' }: PhaserGameProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const sceneRef = useRef<BaseGame | null>(null);
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  // Todos los eventos de gesto van directamente a la escena Phaser.
  // HAND_POSITION: BaseGame.handleGestureEvent actualiza gestureState inline → sin re-render.
  // Eventos discretos: onGestureEvent del juego hijo los procesa.
  const handleGesture = useCallback((event: GestureEvent) => {
    sceneRef.current?.handleGestureEvent(event);
  }, []);

  // Solo nos suscribimos para tener gestureState (usado en instrucciones y HUD).
  // El estado de la escena Phaser se actualiza directamente vía handleGesture.
  const { gestureState } = useGestures(handleGesture);

  // Sync de estado discreto: solo ocurre cuando cambia gestureState (≤ 1-2 veces/s)
  // No ocurre en HAND_POSITION gracias al filtro en useGestures.
  useEffect(() => {
    sceneRef.current?.updateGestureState(gestureState);
  }, [gestureState]);

  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;

    async function initPhaser() {
      const PhaserLib = (await import('phaser')).default;
      if (cancelled || !containerRef.current) return;

      const container = containerRef.current;
      const { width, height } = container.getBoundingClientRect();

      const scene = new SceneClass();
      sceneRef.current = scene;

      // Configurar callbacks con ref para que siempre apunten a los actuales
      scene.setCallbacks({
        onScore: (p, c) => callbacksRef.current.onScore(p, c),
        onLoseLife: () => callbacksRef.current.onLoseLife(),
        onGameOver: () => callbacksRef.current.onGameOver(),
        onLevelUp: () => callbacksRef.current.onLevelUp(),
      });

      const game = new PhaserLib.Game({
        type: PhaserLib.AUTO,
        width: Math.round(width) || 400,
        height: Math.round(height) || 600,
        backgroundColor: '#050510',
        parent: container,
        scene: [scene],
        physics: {
          default: 'arcade',
          arcade: { gravity: { x: 0, y: 0 }, debug: false },
        },
        scale: {
          mode: PhaserLib.Scale.FIT,
          autoCenter: PhaserLib.Scale.CENTER_BOTH,
        },
        // Ocultar banner de Phaser en consola
        banner: false,
      });

      gameRef.current = game;
    }

    initPhaser();

    return () => {
      cancelled = true;
      // destroyGame is protected — call via the scene's own lifecycle
      if (sceneRef.current) {
        try { (sceneRef.current as unknown as { destroyGame(): void }).destroyGame(); } catch {}
      }
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
        sceneRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [SceneClass]);

  return (
    <div
      ref={containerRef}
      className={`w-full h-full ${className}`}
      style={{ touchAction: 'none' }}
    />
  );
}

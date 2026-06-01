/**
 * hooks/useGame.ts
 * Hook principal que orquesta el estado del juego, gestos y Pusher.
 *
 * DISEÑO: Centraliza la lógica que es común a todos los juegos:
 * - Estado de la partida (score, lives, etc.)
 * - Integración con Pusher para el ESP32
 * - Timer de partida
 * - Detección de game over
 */

'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useGestures } from './useGestures';
import { usePusher } from './usePusher';
import type { GameState, GameId } from '@/types/game.types';
import type { GestureEvent } from '@/types/gesture.types';

interface UseGameOptions {
  gameId: GameId;
  initialLives?: number;
  onGesture?: (event: GestureEvent) => void;
  onGameOver?: (state: GameState) => void;
}

interface UseGameReturn {
  gameState: GameState;
  gestureState: ReturnType<typeof useGestures>['gestureState'];
  lastEvent: GestureEvent | null;
  startGame: () => void;
  pauseGame: () => void;
  resumeGame: () => void;
  endGame: () => void;
  addScore: (points: number, isCombo?: boolean) => void;
  loseLife: () => void;
  nextLevel: () => void;
}

export function useGame({
  gameId,
  initialLives = 3,
  onGesture,
  onGameOver,
}: UseGameOptions): UseGameReturn {
  const [gameState, setGameState] = useState<GameState>({
    status: 'idle',
    score: 0,
    lives: initialLives,
    level: 1,
    combo: 0,
    timeElapsed: 0,
  });

  const { triggerEvent } = usePusher();
  const { gestureState, lastEvent } = useGestures(onGesture);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const comboTimerRef = useRef<NodeJS.Timeout | null>(null);
  const gameStateRef = useRef(gameState);
  gameStateRef.current = gameState;

  // Timer de partida (incrementa cada segundo)
  useEffect(() => {
    if (gameState.status === 'playing') {
      timerRef.current = setInterval(() => {
        setGameState(prev => ({ ...prev, timeElapsed: prev.timeElapsed + 1 }));
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [gameState.status]);

  const startGame = useCallback(() => {
    setGameState({
      status: 'playing',
      score: 0,
      lives: initialLives,
      level: 1,
      combo: 0,
      timeElapsed: 0,
    });
    triggerEvent('game_start', { data: { gameId } });
  }, [gameId, initialLives, triggerEvent]);

  const pauseGame = useCallback(() => {
    setGameState(prev =>
      prev.status === 'playing' ? { ...prev, status: 'paused' } : prev
    );
  }, []);

  const resumeGame = useCallback(() => {
    setGameState(prev =>
      prev.status === 'paused' ? { ...prev, status: 'playing' } : prev
    );
  }, []);

  const endGame = useCallback(() => {
    setGameState(prev => {
      const newState = { ...prev, status: 'game_over' as const };
      onGameOver?.(newState);
      return newState;
    });
    triggerEvent('game_over');
  }, [onGameOver, triggerEvent]);

  const addScore = useCallback(
    (points: number, isCombo = false) => {
      setGameState(prev => {
        if (prev.status !== 'playing') return prev;
        const newCombo = isCombo ? prev.combo + 1 : 0;
        const multiplier = Math.max(1, Math.floor(newCombo / 3));
        const actualPoints = points * multiplier;
        return {
          ...prev,
          score: prev.score + actualPoints,
          combo: newCombo,
        };
      });

      // Notificar ESP32
      if (isCombo && gameStateRef.current.combo > 2) {
        triggerEvent('combo', { data: { combo: gameStateRef.current.combo } });
      } else {
        triggerEvent('score', { data: { score: gameStateRef.current.score + points } });
      }

      // Resetear combo timer
      if (comboTimerRef.current) clearTimeout(comboTimerRef.current);
      if (isCombo) {
        comboTimerRef.current = setTimeout(() => {
          setGameState(prev => ({ ...prev, combo: 0 }));
        }, 2000);
      }
    },
    [triggerEvent]
  );

  const loseLife = useCallback(() => {
    setGameState(prev => {
      if (prev.status !== 'playing') return prev;
      const newLives = prev.lives - 1;
      if (newLives <= 0) {
        const finalState = { ...prev, lives: 0, status: 'game_over' as const };
        onGameOver?.(finalState);
        triggerEvent('game_over');
        return finalState;
      }
      return { ...prev, lives: newLives };
    });
  }, [onGameOver, triggerEvent]);

  const nextLevel = useCallback(() => {
    setGameState(prev => ({ ...prev, level: prev.level + 1 }));
  }, []);

  return {
    gameState,
    gestureState,
    lastEvent,
    startGame,
    pauseGame,
    resumeGame,
    endGame,
    addScore,
    loseLife,
    nextLevel,
  };
}

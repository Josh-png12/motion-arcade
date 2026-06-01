/**
 * components/games/GameController.tsx
 * Carga y monta el juego Phaser correcto según el gameId.
 *
 * DISEÑO: Switch centralizado que mapea gameId → SceneClass.
 * Al agregar un nuevo juego, solo hay que importar su clase aquí.
 */

'use client';

import { useMemo } from 'react';
import { PhaserGame } from './PhaserGame';
import type { GameId } from '@/types/game.types';
import type { BaseGameCallbacks } from '@/games/base/BaseGame';

// Importaciones directas de las escenas
import { FruitSlashGame } from '@/games/fruit-slash/FruitSlashGame';
import { PongMotionGame } from '@/games/pong-motion/PongMotionGame';
import { DodgeRunnerGame } from '@/games/dodge-runner/DodgeRunnerGame';
import { SimonMotionGame } from '@/games/simon-motion/SimonMotionGame';

const GAME_SCENES: Record<GameId, new () => InstanceType<typeof import('@/games/base/BaseGame').BaseGame>> = {
  'fruit-slash': FruitSlashGame,
  'pong-motion': PongMotionGame,
  'dodge-runner': DodgeRunnerGame,
  'simon-motion': SimonMotionGame,
};

interface GameControllerProps {
  gameId: GameId;
  callbacks: BaseGameCallbacks;
}

export function GameController({ gameId, callbacks }: GameControllerProps) {
  const SceneClass = useMemo(() => GAME_SCENES[gameId], [gameId]);

  if (!SceneClass) {
    return (
      <div className="flex items-center justify-center h-full text-red-400">
        Juego no encontrado
      </div>
    );
  }

  return (
    <PhaserGame
      SceneClass={SceneClass as Parameters<typeof PhaserGame>[0]['SceneClass']}
      callbacks={callbacks}
      className="w-full h-full"
    />
  );
}

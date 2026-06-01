/**
 * lib/gameRegistry.ts
 * Registro central de juegos disponibles en Motion Arcade.
 *
 * DISEÑO: Para agregar un juego nuevo, solo hay que:
 * 1. Crear la carpeta en /games/[nuevo-juego]/
 * 2. Agregar su metadata aquí
 * El sistema de routing y carga es completamente automático.
 */

import type { GameMetadata, GameId } from '@/types/game.types';

export const GAME_REGISTRY: Record<GameId, GameMetadata> = {
  'fruit-slash': {
    id: 'fruit-slash',
    title: 'Fruit Slash',
    description: 'Corta frutas con tus manos como espadas. ¡Cuidado con las bombas!',
    thumbnail: '/assets/thumbnails/fruit-slash.png',
    difficulty: 'Fácil',
    requiredGestures: ['SLICE_LEFT', 'SLICE_RIGHT', 'HAND_POSITION'],
    accentColor: 'from-red-500 to-orange-400',
    avgDuration: '2-3 min',
  },
  'pong-motion': {
    id: 'pong-motion',
    title: 'Pong Motion',
    description: 'Mueve tu mano arriba y abajo para controlar la paleta. ¡Vence a la IA!',
    thumbnail: '/assets/thumbnails/pong-motion.png',
    difficulty: 'Fácil',
    requiredGestures: ['HAND_POSITION', 'LEFT_HAND_UP', 'RIGHT_HAND_UP'],
    accentColor: 'from-cyan-500 to-blue-400',
    avgDuration: '3-5 min',
  },
  'dodge-runner': {
    id: 'dodge-runner',
    title: 'Dodge Runner',
    description: 'Mueve tu cuerpo para esquivar obstáculos infinitos. ¡Sobrevive!',
    thumbnail: '/assets/thumbnails/dodge-runner.png',
    difficulty: 'Medio',
    requiredGestures: ['MOVE_LEFT', 'MOVE_RIGHT', 'JUMP', 'CROUCH'],
    accentColor: 'from-purple-500 to-pink-400',
    avgDuration: '2-4 min',
  },
  'simon-motion': {
    id: 'simon-motion',
    title: 'Simon Motion',
    description: 'Repite secuencias de poses corporales. Cada ronda es más difícil.',
    thumbnail: '/assets/thumbnails/simon-motion.png',
    difficulty: 'Difícil',
    requiredGestures: ['LEFT_HAND_UP', 'RIGHT_HAND_UP', 'BOTH_HANDS_UP', 'JUMP', 'CROUCH'],
    accentColor: 'from-green-500 to-teal-400',
    avgDuration: '3-6 min',
  },
};

export function getGameMetadata(id: GameId): GameMetadata | undefined {
  return GAME_REGISTRY[id];
}

export function getAllGames(): GameMetadata[] {
  return Object.values(GAME_REGISTRY);
}

export function isValidGameId(id: string): id is GameId {
  return id in GAME_REGISTRY;
}

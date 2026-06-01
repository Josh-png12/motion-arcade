/**
 * game.types.ts
 * Tipos compartidos para todos los juegos de Motion Arcade.
 *
 * DISEÑO: Interfaz común que todos los juegos implementan,
 * permitiendo que el sistema los cargue dinámicamente desde
 * gameRegistry sin conocer su implementación específica.
 */

import { GestureEvent, GestureState } from './gesture.types';

// IDs únicos de cada juego
export type GameId = 'fruit-slash' | 'pong-motion' | 'dodge-runner' | 'simon-motion';

// Metadata del juego para la UI (menú, tarjetas, etc.)
export interface GameMetadata {
  id: GameId;
  title: string;
  description: string;
  thumbnail: string;
  difficulty: 'Fácil' | 'Medio' | 'Difícil';
  // Gestos que este juego usa (para mostrar instrucciones)
  requiredGestures: string[];
  // Color temático del juego (clases Tailwind)
  accentColor: string;
  // Tiempo estimado de una partida
  avgDuration: string;
}

// Estado del juego durante la partida
export interface GameState {
  status: 'idle' | 'loading' | 'playing' | 'paused' | 'game_over';
  score: number;
  lives: number;
  level: number;
  combo: number;
  timeElapsed: number; // segundos
}

// Entrada que recibe el juego del sistema de gestos
export interface GameInput {
  gestureState: GestureState;
  latestEvent: GestureEvent | null;
}

// Resultado de una partida para el ranking
export interface GameResult {
  gameId: GameId;
  score: number;
  level: number;
  combo: number; // combo máximo alcanzado
  duration: number; // segundos
  playerName: string;
  timestamp: string; // ISO 8601
}

// Entrada del ranking de Supabase
export interface LeaderboardEntry {
  id: string;
  game_id: GameId;
  player_name: string;
  score: number;
  level: number;
  duration: number;
  created_at: string;
  rank?: number; // calculado al consultar
}

// Eventos que el juego envía al ESP32 vía Pusher
export type PusherGameEvent =
  | 'player_ready'
  | 'game_start'
  | 'combo'
  | 'score'
  | 'game_over'
  | 'error';

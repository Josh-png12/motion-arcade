/**
 * pusher.types.ts
 * Tipos para eventos de Pusher Channels.
 *
 * DISEÑO: Define el contrato de mensajes entre el navegador
 * y el ESP32. Todo evento tiene un shape estricto para evitar
 * bugs silenciosos al cambiar la API.
 */

// Canal principal de comunicación con el ESP32
export const PUSHER_CHANNEL = 'game-events' as const;

// Nombres de eventos en Pusher
export type PusherEventName =
  | 'player_ready'
  | 'game_start'
  | 'combo'
  | 'score'
  | 'game_over'
  | 'error';

// Payload de cada evento
export interface PusherEventPayload {
  event: PusherEventName;
  data?: {
    score?: number;
    combo?: number;
    gameId?: string;
    message?: string;
  };
  timestamp: number;
}

// Respuesta de la API route /api/pusher
export interface PusherTriggerResponse {
  success: boolean;
  error?: string;
}

// Configuración del cliente Pusher
export interface PusherClientConfig {
  key: string;
  cluster: string;
}

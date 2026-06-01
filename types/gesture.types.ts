/**
 * gesture.types.ts
 * Tipos para el sistema de gestos de Motion Arcade.
 */

export type GestureEventType =
  | 'LEFT_HAND_UP'
  | 'RIGHT_HAND_UP'
  | 'BOTH_HANDS_UP'
  | 'JUMP'
  | 'CROUCH'
  | 'MOVE_LEFT'
  | 'MOVE_RIGHT'
  | 'SLICE_LEFT'
  | 'SLICE_RIGHT'
  | 'PUNCH_LEFT'
  | 'PUNCH_RIGHT'
  | 'HAND_POSITION'
  | 'PLAYER_DETECTED'
  | 'PLAYER_LOST'
  | 'POSE_MATCH';

export interface NormalizedPosition {
  x: number;
  y: number;
}

export interface GestureEvent {
  type: GestureEventType;
  timestamp: number;
  leftHand?: NormalizedPosition;
  rightHand?: NormalizedPosition;
  velocity?: number;
  poseName?: string;
  confidence?: number;
}

export interface GestureState {
  playerDetected: boolean;
  leftHandPosition: NormalizedPosition | null;
  rightHandPosition: NormalizedPosition | null;
  bodyPosition: NormalizedPosition | null;
  isJumping: boolean;
  isCrouching: boolean;
  isMovingLeft: boolean;
  isMovingRight: boolean;
  // Velocidades — útiles para juegos que necesitan intensidad del gesto
  leftHandVelocity: number;   // velocidad horizontal de mano izquierda (0-1/frame)
  rightHandVelocity: number;
  hipVelocityY: number;       // velocidad vertical de cadera (negativo = subiendo)
  poseConfidence: number;     // confianza media de los landmarks principales (0-1)
}

export type GestureCallback = (event: GestureEvent) => void;

export interface GestureDetectorConfig {
  minConfidence: number;
  debounceMs: number;
  debug: boolean;
  /** Frames para promedio móvil de posición de manos (1 = sin suavizado) */
  smoothingFrames: number;
  /** Frames consecutivos requeridos para activar MOVE_LEFT/RIGHT */
  predictionFrames: number;
}

/** Métricas en tiempo real del detector (para panel de debug) */
export interface DetectionMetrics {
  fps: number;
  processingMs: number;
  poseConfidence: number;
  smoothingFrames: number;
  debounceMs: number;
}

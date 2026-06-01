/**
 * gestures/detector.ts
 * Convierte landmarks de MediaPipe en GestureEvents con latencia mínima.
 *
 * OPTIMIZACIONES v2:
 * - RingBuffer: promedio móvil de 3 frames para posiciones de manos (sin jitter)
 * - HipTracker: calcula velocidad vertical de cadera para JUMP anticipado
 * - Predicción de 2 frames para MOVE_LEFT/RIGHT (menos falsos positivos)
 * - debounceMs 80ms (antes 120-150ms)
 * - performance.now() una sola vez por frame
 * - Umbrales más sensibles: slice 0.06 (antes 0.08), hand_up 0.04 (antes 0.05)
 * - Detección de JUMP por velocidad (dispara antes del pico del salto)
 */

import type {
  GestureEvent,
  GestureState,
  GestureCallback,
  GestureDetectorConfig,
  NormalizedPosition,
  DetectionMetrics,
} from './types';

export interface Landmark {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

const L = {
  NOSE: 0,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
} as const;

// ── Utilidades de estructura de datos ───────────────────────────────────────

/** Buffer circular de tamaño fijo para promedio móvil — O(1) por operación */
class RingBuffer {
  private data: Float32Array;
  private idx = 0;
  private count = 0;

  constructor(private readonly size: number) {
    this.data = new Float32Array(size);
  }

  push(v: number): void {
    this.data[this.idx] = v;
    this.idx = (this.idx + 1) % this.size;
    if (this.count < this.size) this.count++;
  }

  average(): number {
    if (this.count === 0) return 0;
    let sum = 0;
    for (let i = 0; i < this.count; i++) sum += this.data[i];
    return sum / this.count;
  }

  /** Diferencia entre el valor más reciente y el más antiguo del buffer */
  delta(): number {
    if (this.count < 2) return 0;
    const newest = this.data[(this.idx - 1 + this.size) % this.size];
    const oldest = this.data[this.idx % this.size];
    return newest - oldest;
  }

  reset(): void {
    this.idx = 0;
    this.count = 0;
    this.data.fill(0);
  }

  get filled(): boolean { return this.count === this.size; }
}

/** Suaviza la posición de una mano y calcula su velocidad */
class HandTracker {
  private xBuf: RingBuffer;
  private yBuf: RingBuffer;
  private _velocityX = 0;
  private _velocityY = 0;

  constructor(smoothing: number) {
    this.xBuf = new RingBuffer(smoothing);
    this.yBuf = new RingBuffer(smoothing);
  }

  update(x: number, y: number): NormalizedPosition {
    // Velocidad = delta del último frame (antes de insertar el nuevo valor)
    this._velocityX = this.xBuf.delta();
    this._velocityY = this.yBuf.delta();
    this.xBuf.push(x);
    this.yBuf.push(y);
    return { x: this.xBuf.average(), y: this.yBuf.average() };
  }

  get velocityX(): number { return this._velocityX; }
  get velocityY(): number { return this._velocityY; }
  get speed(): number { return Math.abs(this._velocityX); }

  reset(): void {
    this.xBuf.reset();
    this.yBuf.reset();
    this._velocityX = 0;
    this._velocityY = 0;
  }
}

/** Rastrea la cadera para detectar saltos y agachadas */
class HipTracker {
  private yBuf: RingBuffer;
  private _baseline: number | null = null;
  private _calibCount = 0;
  private _calibSum = 0;
  private readonly CALIB_FRAMES = 45; // calibra durante ~1.5s a 30fps

  constructor() {
    this.yBuf = new RingBuffer(4);
  }

  update(y: number): void {
    this.yBuf.push(y);
    if (this._calibCount < this.CALIB_FRAMES) {
      this._calibSum += y;
      this._calibCount++;
      if (this._calibCount === this.CALIB_FRAMES) {
        this._baseline = this._calibSum / this._calibCount;
      }
    }
  }

  /** Desplazamiento respecto a la línea base (positivo = cadera más arriba) */
  get displacement(): number {
    if (this._baseline === null) return 0;
    return this._baseline - this.yBuf.average();
  }

  /** Velocidad vertical (negativo = subiendo, positivo = bajando) */
  get velocityY(): number {
    return this.yBuf.delta();
  }

  get isCalibrated(): boolean { return this._baseline !== null; }

  reset(): void {
    this.yBuf.reset();
    this._baseline = null;
    this._calibCount = 0;
    this._calibSum = 0;
  }
}

// ── Detector principal ───────────────────────────────────────────────────────

export class GestureDetector {
  private config: GestureDetectorConfig;
  private callbacks: GestureCallback[] = [];
  private state: GestureState;

  // Trackers
  private leftHand: HandTracker;
  private rightHand: HandTracker;
  private hip: HipTracker;

  // Estado interno de debounce y predicción
  private lastEventTime: Record<string, number> = {};
  private moveLeftFrames = 0;
  private moveRightFrames = 0;
  private frameCount = 0;

  // Métricas de rendimiento
  private _metrics: DetectionMetrics = {
    fps: 0,
    processingMs: 0,
    poseConfidence: 0,
    smoothingFrames: 3,
    debounceMs: 80,
  };
  private fpsFrameCount = 0;
  private fpsWindowStart = 0;

  constructor(config: Partial<GestureDetectorConfig> = {}) {
    this.config = {
      minConfidence: 0.5,
      debounceMs: 80,
      debug: false,
      smoothingFrames: 3,
      predictionFrames: 2,
      ...config,
    };

    this.state = this.makeEmptyState();
    this.leftHand  = new HandTracker(this.config.smoothingFrames);
    this.rightHand = new HandTracker(this.config.smoothingFrames);
    this.hip       = new HipTracker();
  }

  private makeEmptyState(): GestureState {
    return {
      playerDetected: false,
      leftHandPosition: null,
      rightHandPosition: null,
      bodyPosition: null,
      isJumping: false,
      isCrouching: false,
      isMovingLeft: false,
      isMovingRight: false,
      leftHandVelocity: 0,
      rightHandVelocity: 0,
      hipVelocityY: 0,
      poseConfidence: 0,
    };
  }

  onGesture(callback: GestureCallback): () => void {
    this.callbacks.push(callback);
    return () => { this.callbacks = this.callbacks.filter(cb => cb !== callback); };
  }

  getState(): GestureState { return this.state; }
  getMetrics(): DetectionMetrics { return this._metrics; }

  // Actualiza la configuración en caliente (desde el panel de debug)
  updateConfig(partial: Partial<GestureDetectorConfig>): void {
    this.config = { ...this.config, ...partial };
    this._metrics.smoothingFrames = this.config.smoothingFrames;
    this._metrics.debounceMs = this.config.debounceMs;
    // Recrear trackers si cambió el smoothing
    if (partial.smoothingFrames !== undefined) {
      this.leftHand  = new HandTracker(this.config.smoothingFrames);
      this.rightHand = new HandTracker(this.config.smoothingFrames);
    }
  }

  processPoseLandmarks(landmarks: Landmark[] | null): void {
    // Un único timestamp por frame — evita múltiples Date.now() calls
    const now = performance.now();
    this.frameCount++;

    // ── FPS del detector ────────────────────────────
    this.fpsFrameCount++;
    if (this.fpsWindowStart === 0) this.fpsWindowStart = now;
    const fpsElapsed = now - this.fpsWindowStart;
    if (fpsElapsed >= 1000) {
      this._metrics.fps = Math.round(this.fpsFrameCount * 1000 / fpsElapsed);
      this.fpsFrameCount = 0;
      this.fpsWindowStart = now;
    }

    // ── Sin landmarks: jugador no detectado ────────
    if (!landmarks || landmarks.length === 0) {
      if (this.state.playerDetected) {
        this.state.playerDetected = false;
        this.emit({ type: 'PLAYER_LOST', timestamp: now });
      }
      return;
    }

    const ls = landmarks[L.LEFT_SHOULDER];
    const rs = landmarks[L.RIGHT_SHOULDER];

    // Calcular confianza promedio de landmarks clave
    const confidence = this.avgVisibility(ls, rs,
      landmarks[L.LEFT_WRIST], landmarks[L.RIGHT_WRIST]);
    this.state.poseConfidence = confidence;
    this._metrics.poseConfidence = confidence;

    if (!this.isVis(ls) && !this.isVis(rs)) {
      if (this.state.playerDetected) {
        this.state.playerDetected = false;
        this.emit({ type: 'PLAYER_LOST', timestamp: now });
      }
      return;
    }

    if (!this.state.playerDetected) {
      this.state.playerDetected = true;
      this.emit({ type: 'PLAYER_DETECTED', timestamp: now });
    }

    const lw = landmarks[L.LEFT_WRIST];
    const rw = landmarks[L.RIGHT_WRIST];
    const lh = landmarks[L.LEFT_HIP];
    const rh = landmarks[L.RIGHT_HIP];

    // ── Cadera: posición, velocidad, salto/agachada ─
    if (this.isVis(lh) && this.isVis(rh)) {
      const hipX = (lh.x + rh.x) / 2;
      const hipY = (lh.y + rh.y) / 2;
      this.hip.update(hipY);
      this.state.bodyPosition = { x: hipX, y: hipY };
      this.state.hipVelocityY = this.hip.velocityY;

      if (this.hip.isCalibrated) {
        const disp = this.hip.displacement;
        const vel  = this.hip.velocityY; // negativo = subiendo

        // JUMP: velocidad rápida hacia arriba OR desplazamiento grande
        // La velocidad dispara ANTES del pico → respuesta anticipada
        const wasJumping = this.state.isJumping;
        this.state.isJumping = vel < -0.018 || disp > 0.10;
        if (this.state.isJumping && !wasJumping) {
          this.emitDebounced('JUMP', { type: 'JUMP', timestamp: now }, 300);
        }

        // CROUCH: cadera cae significativamente
        const wasCrouching = this.state.isCrouching;
        this.state.isCrouching = disp < -0.08;
        if (this.state.isCrouching && !wasCrouching) {
          this.emitDebounced('CROUCH', { type: 'CROUCH', timestamp: now }, 300);
        }
      }

      // MOVE_LEFT / MOVE_RIGHT con predicción de N frames
      // x espejado: bodyX < 0.28 = izquierda del frame = derecha del jugador
      const bodyX = 1 - hipX;
      if (bodyX < 0.30) {
        this.moveLeftFrames++;
        this.moveRightFrames = 0;
        if (this.moveLeftFrames >= this.config.predictionFrames && !this.state.isMovingLeft) {
          this.state.isMovingLeft = true;
          this.emitDebounced('MOVE_LEFT', { type: 'MOVE_LEFT', timestamp: now }, 200);
        }
      } else if (bodyX > 0.70) {
        this.moveRightFrames++;
        this.moveLeftFrames = 0;
        if (this.moveRightFrames >= this.config.predictionFrames && !this.state.isMovingRight) {
          this.state.isMovingRight = true;
          this.emitDebounced('MOVE_RIGHT', { type: 'MOVE_RIGHT', timestamp: now }, 200);
        }
      } else {
        this.moveLeftFrames  = Math.max(0, this.moveLeftFrames - 1);
        this.moveRightFrames = Math.max(0, this.moveRightFrames - 1);
        if (bodyX >= 0.35) this.state.isMovingLeft  = false;
        if (bodyX <= 0.65) this.state.isMovingRight = false;
      }
    }

    // ── Mano izquierda (espejo: = mano derecha del jugador) ─
    if (this.isVis(lw)) {
      const smoothed = this.leftHand.update(1 - lw.x, lw.y);
      this.state.leftHandPosition  = smoothed;
      this.state.leftHandVelocity  = this.leftHand.speed;

      // Slice: velocidad horizontal supera umbral
      const dx = this.leftHand.velocityX;
      if (Math.abs(dx) > 0.06) {
        // dx positivo en espacio espejado = mover hacia derecha
        const sliceType = dx < 0 ? 'SLICE_RIGHT' : 'SLICE_LEFT';
        this.emitDebounced(sliceType, {
          type: sliceType, timestamp: now,
          velocity: Math.abs(dx), leftHand: smoothed,
        }, this.config.debounceMs);
      }

      // Mano arriba: muñeca sobre el hombro
      if (this.isVis(ls) && lw.y < ls.y - 0.04) {
        this.emitDebounced('LEFT_HAND_UP',
          { type: 'LEFT_HAND_UP', timestamp: now }, this.config.debounceMs);
      }
    } else {
      this.state.leftHandPosition = null;
      this.state.leftHandVelocity = 0;
    }

    // ── Mano derecha ────────────────────────────────
    if (this.isVis(rw)) {
      const smoothed = this.rightHand.update(1 - rw.x, rw.y);
      this.state.rightHandPosition = smoothed;
      this.state.rightHandVelocity = this.rightHand.speed;

      const dx = this.rightHand.velocityX;
      if (Math.abs(dx) > 0.06) {
        const sliceType = dx < 0 ? 'SLICE_RIGHT' : 'SLICE_LEFT';
        this.emitDebounced(sliceType, {
          type: sliceType, timestamp: now,
          velocity: Math.abs(dx), rightHand: smoothed,
        }, this.config.debounceMs);
      }

      if (this.isVis(rs) && rw.y < rs.y - 0.04) {
        this.emitDebounced('RIGHT_HAND_UP',
          { type: 'RIGHT_HAND_UP', timestamp: now }, this.config.debounceMs);
      }
    } else {
      this.state.rightHandPosition = null;
      this.state.rightHandVelocity = 0;
    }

    // BOTH_HANDS_UP
    if (
      this.isVis(lw) && this.isVis(rw) &&
      this.isVis(ls) && this.isVis(rs) &&
      lw.y < ls.y - 0.04 && rw.y < rs.y - 0.04
    ) {
      this.emitDebounced('BOTH_HANDS_UP',
        { type: 'BOTH_HANDS_UP', timestamp: now }, this.config.debounceMs);
    }

    // HAND_POSITION: emite cada frame con posiciones suavizadas
    // Los juegos leen esto directamente — sin pasar por React state
    if (this.state.leftHandPosition || this.state.rightHandPosition) {
      this.emit({
        type: 'HAND_POSITION', timestamp: now,
        leftHand:  this.state.leftHandPosition  ?? undefined,
        rightHand: this.state.rightHandPosition ?? undefined,
      });
    }
  }

  private isVis(lm: Landmark | null | undefined): lm is Landmark {
    if (!lm) return false;
    return (lm.visibility ?? 1) >= this.config.minConfidence;
  }

  private avgVisibility(...lms: (Landmark | null | undefined)[]): number {
    const visible = lms.filter(l => l != null) as Landmark[];
    if (visible.length === 0) return 0;
    const sum = visible.reduce((a, l) => a + (l.visibility ?? 1), 0);
    return sum / visible.length;
  }

  /**
   * Emite un evento con debounce específico por tipo.
   * Cada tipo de gesto puede tener su propio debounce (ej: JUMP más lento que SLICE).
   */
  private emitDebounced(key: string, event: GestureEvent, debounceMs: number): void {
    const now = performance.now();
    const last = this.lastEventTime[key] ?? 0;
    if (now - last < debounceMs) return;
    this.lastEventTime[key] = now;
    this.emit(event);
  }

  private emit(event: GestureEvent): void {
    for (const cb of this.callbacks) {
      try { cb(event); } catch (e) { console.error('[GestureDetector]', e); }
    }
  }

  reset(): void {
    this.state = this.makeEmptyState();
    this.leftHand.reset();
    this.rightHand.reset();
    this.hip.reset();
    this.lastEventTime = {};
    this.moveLeftFrames = 0;
    this.moveRightFrames = 0;
    this.frameCount = 0;
  }
}

export const gestureDetector = new GestureDetector({
  minConfidence: 0.5,
  debounceMs: 80,
  smoothingFrames: 3,
  predictionFrames: 2,
  debug: process.env.NODE_ENV === 'development',
});

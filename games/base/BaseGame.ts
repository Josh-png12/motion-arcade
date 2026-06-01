/**
 * games/base/BaseGame.ts
 * Clase base Phaser — funcionalidad compartida por todos los juegos.
 *
 * CARACTERÍSTICAS v2 (demo real):
 * - Auto-pausa si el jugador abandona la cámara >3 segundos
 * - showLargeAnnouncement(): texto de impacto centrado (GO!, COMBO!, etc.)
 * - showCornerHint(): instrucción pequeña en esquina inferior
 * - showFloatingText() más grande y visible
 * - Partículas más densas y con más velocidad
 * - Overlay de pausa con overlay semitransparente
 */

import Phaser from 'phaser';
import type { GestureEvent, GestureState } from '@/types/gesture.types';

export interface BaseGameCallbacks {
  onScore: (points: number, isCombo?: boolean) => void;
  onLoseLife: () => void;
  onGameOver: () => void;
  onLevelUp: () => void;
}

export abstract class BaseGame extends Phaser.Scene {
  protected callbacks!: BaseGameCallbacks;
  protected gestureState: GestureState = {
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

  private audioCtx: AudioContext | null = null;

  // Auto-pausa por ausencia del jugador
  private _playerAbsentMs = 0;
  private _pausedForPlayer = false;
  private _pauseContainer?: Phaser.GameObjects.Container;
  private _pauseText?: Phaser.GameObjects.Text;
  private _pauseTween?: Phaser.Tweens.Tween;

  constructor(key: string) {
    super({ key });
  }

  setCallbacks(callbacks: BaseGameCallbacks) { this.callbacks = callbacks; }

  updateGestureState(state: GestureState) { this.gestureState = state; }

  handleGestureEvent(event: GestureEvent) {
    if (event.type === 'HAND_POSITION') {
      if (event.leftHand)  this.gestureState.leftHandPosition  = event.leftHand;
      if (event.rightHand) this.gestureState.rightHandPosition = event.rightHand;
      return;
    }
    this.onGestureEvent(event);
  }

  // ── Ciclo de vida ──────────────────────────────────────────

  preload() { this.preloadAssets(); }

  create() {
    this.setupBackground();
    this.initGame();
    this.setupPauseOverlay();
  }

  update(time: number, delta: number) {
    this.tickPlayerAbsence(delta);
    if (!this._pausedForPlayer) {
      this.updateGame(time, delta);
    }
  }

  // ── Pausa automática por ausencia ──────────────────────────

  private setupPauseOverlay() {
    const { width, height } = this.scale;

    const bg = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.7);

    const icon = this.add.text(width / 2, height / 2 - 50, '👀', {
      fontSize: '64px',
    }).setOrigin(0.5);

    this._pauseText = this.add.text(width / 2, height / 2 + 30, 'PAUSA', {
      fontSize: '48px',
      fontFamily: 'monospace',
      color: '#ffffff',
      stroke: '#7c3aed',
      strokeThickness: 4,
    }).setOrigin(0.5);

    const sub = this.add.text(width / 2, height / 2 + 90, 'Vuelve frente a la cámara', {
      fontSize: '20px',
      fontFamily: 'monospace',
      color: '#aaaaaa',
    }).setOrigin(0.5);

    this._pauseContainer = this.add.container(0, 0, [bg, icon, this._pauseText, sub]);
    this._pauseContainer.setDepth(200).setVisible(false);
  }

  private tickPlayerAbsence(delta: number) {
    if (this.gestureState.playerDetected) {
      this._playerAbsentMs = 0;
      if (this._pausedForPlayer) {
        this._pausedForPlayer = false;
        this._pauseContainer?.setVisible(false);
        this._pauseTween?.stop();
      }
      return;
    }
    this._playerAbsentMs += delta;
    if (this._playerAbsentMs > 3000 && !this._pausedForPlayer) {
      this._pausedForPlayer = true;
      this._pauseContainer?.setVisible(true);
      // Pulsar el texto
      if (this._pauseText) {
        this._pauseTween = this.tweens.add({
          targets: this._pauseText,
          alpha: 0.3,
          duration: 700,
          yoyo: true,
          repeat: -1,
        });
      }
    }
  }

  // ── Métodos abstractos ─────────────────────────────────────

  protected abstract preloadAssets(): void;
  protected abstract initGame(): void;
  protected abstract updateGame(time: number, delta: number): void;
  protected abstract onGestureEvent(event: GestureEvent): void;
  protected abstract destroyGame(): void;

  // ── Utilidades visuales ────────────────────────────────────

  protected setupBackground() {
    const { width, height } = this.scale;
    const bg = this.add.graphics();
    bg.fillStyle(0x05050f, 1);
    bg.fillRect(0, 0, width, height);
    // Cuadrícula sutil más visible
    bg.lineStyle(1, 0x1a1a40, 0.6);
    const g = 50;
    for (let x = 0; x <= width; x += g) bg.lineBetween(x, 0, x, height);
    for (let y = 0; y <= height; y += g) bg.lineBetween(0, y, width, y);
    bg.setDepth(-10);
  }

  protected createNeonText(
    x: number, y: number, text: string,
    color: number = 0x00ff88, size: number = 24
  ): Phaser.GameObjects.Text {
    const hex = '#' + color.toString(16).padStart(6, '0');
    return this.add.text(x, y, text, {
      fontSize: `${size}px`,
      fontFamily: 'monospace',
      color: hex,
      stroke: hex,
      strokeThickness: 1,
      shadow: { color: hex, blur: 12, fill: true },
    });
  }

  /** Texto grande centrado para anuncios: GO!, COMBO!, PERFECT! */
  protected showLargeAnnouncement(
    text: string, color = '#ffffff', duration = 900, yOffset = 0
  ) {
    const { width, height } = this.scale;
    const t = this.add.text(width / 2, height / 2 + yOffset, text, {
      fontSize: '72px',
      fontFamily: 'monospace',
      color,
      stroke: color,
      strokeThickness: 3,
      shadow: { color, blur: 20, fill: true },
    }).setOrigin(0.5).setDepth(150).setScale(0.4);

    this.tweens.add({
      targets: t,
      scaleX: 1, scaleY: 1,
      duration: 200,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.tweens.add({
          targets: t,
          alpha: 0,
          y: t.y - 40,
          delay: duration - 200,
          duration: 300,
          onComplete: () => t.destroy(),
        });
      },
    });
  }

  /** Texto pequeño con instrucción en esquina inferior izquierda */
  protected showCornerHint(text: string, color = '#555577', duration = 0) {
    const { height } = this.scale;
    const existing = this.children.getByName('corner-hint') as Phaser.GameObjects.Text | null;
    if (existing) existing.destroy();

    const t = this.add.text(10, height - 28, text, {
      fontSize: '13px',
      fontFamily: 'monospace',
      color,
    }).setDepth(50).setAlpha(0.7).setName('corner-hint');

    if (duration > 0) {
      this.time.delayedCall(duration, () => t.active && t.destroy());
    }
  }

  protected spawnParticles(x: number, y: number, color: number = 0xffff00, count = 16) {
    const particles = this.add.particles(x, y, '__DEFAULT', {
      speed: { min: 120, max: 320 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.8, end: 0 },
      lifespan: 700,
      quantity: count,
      tint: color,
      gravityY: 250,
    });
    this.time.delayedCall(100, () => {
      particles.stop();
      this.time.delayedCall(800, () => particles.destroy());
    });
  }

  protected showFloatingText(x: number, y: number, text: string, color = '#ffff00') {
    const t = this.add.text(x, y, text, {
      fontSize: '28px',
      fontFamily: 'monospace',
      color,
      stroke: color,
      strokeThickness: 2,
      shadow: { color, blur: 8, fill: true },
    }).setOrigin(0.5).setDepth(130);

    this.tweens.add({
      targets: t,
      y: y - 80,
      alpha: 0,
      duration: 900,
      ease: 'Power2',
      onComplete: () => t.destroy(),
    });
  }

  protected playSound(type: 'hit' | 'score' | 'combo' | 'death' | 'jump' | 'powerup') {
    try {
      if (!this.audioCtx) {
        this.audioCtx = new (
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
        )();
      }
      const ctx = this.audioCtx;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      switch (type) {
        case 'hit':
          osc.frequency.setValueAtTime(1046, now);
          osc.frequency.exponentialRampToValueAtTime(523, now + 0.1);
          gain.gain.setValueAtTime(0.35, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
          osc.start(now); osc.stop(now + 0.15);
          break;
        case 'score':
          osc.type = 'square';
          osc.frequency.setValueAtTime(523, now);
          osc.frequency.setValueAtTime(1046, now + 0.06);
          gain.gain.setValueAtTime(0.25, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
          osc.start(now); osc.stop(now + 0.25);
          break;
        case 'combo':
          osc.type = 'sawtooth';
          [660, 880, 1100, 1320].forEach((f, i) => {
            osc.frequency.setValueAtTime(f, now + i * 0.07);
          });
          gain.gain.setValueAtTime(0.4, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
          osc.start(now); osc.stop(now + 0.35);
          break;
        case 'death':
          osc.frequency.setValueAtTime(350, now);
          osc.frequency.exponentialRampToValueAtTime(80, now + 0.5);
          gain.gain.setValueAtTime(0.4, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
          osc.start(now); osc.stop(now + 0.5);
          break;
        case 'jump':
          osc.frequency.setValueAtTime(523, now);
          osc.frequency.exponentialRampToValueAtTime(1046, now + 0.18);
          gain.gain.setValueAtTime(0.28, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
          osc.start(now); osc.stop(now + 0.22);
          break;
        case 'powerup':
          osc.type = 'triangle';
          [440, 554, 659, 880].forEach((f, i) => {
            osc.frequency.setValueAtTime(f, now + i * 0.09);
          });
          gain.gain.setValueAtTime(0.3, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
          osc.start(now); osc.stop(now + 0.45);
          break;
      }
    } catch { /* sin interacción previa — ignorar */ }
  }

  protected flashScreen(color = 0xff0000, duration = 200) {
    const { width, height } = this.scale;
    const flash = this.add.rectangle(width / 2, height / 2, width, height, color, 0.45);
    flash.setDepth(100);
    this.tweens.add({
      targets: flash,
      alpha: 0,
      duration,
      onComplete: () => flash.destroy(),
    });
  }
}

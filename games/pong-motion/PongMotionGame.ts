/**
 * games/pong-motion/PongMotionGame.ts
 * Pong Motion — optimizado para demo con visión artificial.
 *
 * CAMBIOS v2:
 * - Paleta jugador: 120px alto × 16px ancho (era 90×12) → +33%
 * - Pelota: radio 13px (era 8px) → más visible
 * - Velocidad inicial: 200 px/s (era 280) → más manejable
 * - IA: 110 px/s (era 180) → ganable para el jugador
 * - Factor de seguimiento de paleta: 0.35 (era 0.2) → respuesta más rápida
 * - Cap de velocidad de pelota: 480 px/s máximo
 * - Indicador visual de qué mano usar (texto instructivo)
 * - Efecto neón en ambas paletas (glow)
 */

import Phaser from 'phaser';
import { BaseGame } from '../base/BaseGame';
import type { GestureEvent } from '@/types/gesture.types';

// Constantes del juego — aumentadas para mejor jugabilidad en demo
const PADDLE_W    = 16;   // era 12
const PADDLE_H    = 120;  // era 90 (+33%)
const BALL_R      = 13;   // era 8
const INITIAL_SPD = 200;  // era 280 — más lento al inicio
const AI_SPEED    = 110;  // era 180 — IA más lenta y ganable
const MAX_SPEED   = 480;  // tope de velocidad de la pelota
const TRACK_LERP  = 0.35; // factor de interpolación de paleta (era 0.2)

export class PongMotionGame extends BaseGame {
  private ball!: Phaser.GameObjects.Arc;
  private playerPaddle!: Phaser.GameObjects.Rectangle;
  private aiPaddle!: Phaser.GameObjects.Rectangle;
  private ballVelX = 0;
  private ballVelY = 0;
  private aiScore = 0;
  private playerScore = 0;
  private playerScoreText!: Phaser.GameObjects.Text;
  private aiScoreText!: Phaser.GameObjects.Text;
  private centerLine!: Phaser.GameObjects.Graphics;
  private aiSpeedCurrent = AI_SPEED;
  private rallies = 0;
  private ballTrail!: Phaser.GameObjects.Graphics;
  private ballPrevPos: { x: number; y: number } | null = null;

  // Glow de paleta jugador
  private playerGlow!: Phaser.GameObjects.Rectangle;

  constructor() { super('PongMotionGame'); }
  protected preloadAssets(): void {}

  protected initGame(): void {
    const { width, height } = this.scale;
    const cx = width / 2;
    const cy = height / 2;

    // Trail de la pelota
    this.ballTrail = this.add.graphics().setDepth(8);

    // Línea central punteada
    this.centerLine = this.add.graphics();
    this.drawCenterLine();

    // Glows de paletas (detrás de la paleta)
    this.playerGlow = this.add.rectangle(width - 32, cy, PADDLE_W + 16, PADDLE_H + 20, 0x00ff88, 0.15)
      .setDepth(8);
    this.add.rectangle(32, cy, PADDLE_W + 16, PADDLE_H + 20, 0xff4488, 0.15).setDepth(8);

    // Paleta del jugador (derecha) — verde neón
    this.playerPaddle = this.add.rectangle(width - 32, cy, PADDLE_W, PADDLE_H, 0x00ff88).setDepth(10);

    // Paleta IA (izquierda) — rosa
    this.aiPaddle = this.add.rectangle(32, cy, PADDLE_W, PADDLE_H, 0xff4488).setDepth(10);

    // Pelota blanca con radio mayor
    this.ball = this.add.circle(cx, cy, BALL_R, 0xffffff).setDepth(11);

    // Scores
    this.aiScoreText = this.createNeonText(cx - 80, 20, '0', 0xff4488, 56)
      .setOrigin(0.5, 0).setDepth(15);
    this.playerScoreText = this.createNeonText(cx + 80, 20, '0', 0x00ff88, 56)
      .setOrigin(0.5, 0).setDepth(15);

    // Labels de paletas
    this.createNeonText(width - 32, height - 25, 'TÚ', 0x00ff88, 13)
      .setOrigin(0.5).setDepth(15);
    this.createNeonText(32, height - 25, 'CPU', 0xff4488, 13)
      .setOrigin(0.5).setDepth(15);

    // Instrucción
    this.showCornerHint('↕ Mueve la mano arriba y abajo para controlar la paleta verde');

    // Lanzar pelota tras 1 segundo
    this.time.delayedCall(800, () => this.launchBall());
  }

  private drawCenterLine() {
    const { width, height } = this.scale;
    this.centerLine.clear();
    this.centerLine.lineStyle(2, 0x2a2a5a, 0.8);
    for (let y = 0; y < height; y += 24) {
      this.centerLine.lineBetween(width / 2, y, width / 2, y + 12);
    }
    this.centerLine.setDepth(5);
  }

  private launchBall() {
    const { width, height } = this.scale;
    this.ball.setPosition(width / 2, height / 2);
    this.ballPrevPos = null;

    // Ángulo ligero para evitar movimientos puramente horizontales
    const angle = Phaser.Math.FloatBetween(-0.4, 0.4);
    const dir   = Math.random() > 0.5 ? 1 : -1;
    this.ballVelX = Math.cos(angle) * INITIAL_SPD * dir;
    this.ballVelY = Math.sin(angle) * INITIAL_SPD;
    this.rallies  = 0;
  }

  protected updateGame(_time: number, delta: number): void {
    const dt = delta / 1000;
    const { width, height } = this.scale;

    // ── Paleta del jugador ───────────────────────────────────
    const handPos = this.gestureState.rightHandPosition ?? this.gestureState.leftHandPosition;
    if (handPos) {
      const targetY = handPos.y * height;
      const halfH   = PADDLE_H / 2;
      const clampedY = Phaser.Math.Clamp(targetY, halfH, height - halfH);
      // Interpolación más rápida (0.35 vs 0.2 anterior)
      this.playerPaddle.y += (clampedY - this.playerPaddle.y) * TRACK_LERP;
      this.playerGlow.y = this.playerPaddle.y;
    }

    // ── IA: sigue la pelota con velocidad limitada y margen de error ─
    // 20% de error aleatorio para hacerla más humana y ganable
    const targetAiY = this.ball.y + Phaser.Math.FloatBetween(-15, 15);
    const aiDiff    = targetAiY - this.aiPaddle.y;
    const aiMove    = Phaser.Math.Clamp(aiDiff, -this.aiSpeedCurrent * dt, this.aiSpeedCurrent * dt);
    this.aiPaddle.y += aiMove;

    // ── Trail de la pelota ───────────────────────────────────
    this.ballTrail.clear();
    if (this.ballPrevPos) {
      const speed = Math.sqrt(this.ballVelX ** 2 + this.ballVelY ** 2);
      const alpha = Math.min(speed / MAX_SPEED, 0.7);
      this.ballTrail.lineStyle(BALL_R * 1.5, 0xffffff, alpha * 0.4);
      this.ballTrail.lineBetween(this.ballPrevPos.x, this.ballPrevPos.y, this.ball.x, this.ball.y);
    }
    this.ballPrevPos = { x: this.ball.x, y: this.ball.y };

    // ── Mover pelota ─────────────────────────────────────────
    this.ball.x += this.ballVelX * dt;
    this.ball.y += this.ballVelY * dt;

    // Rebotar en paredes top/bottom
    if (this.ball.y - BALL_R <= 0) {
      this.ball.y = BALL_R;
      this.ballVelY = Math.abs(this.ballVelY);
      this.playSound('hit');
    }
    if (this.ball.y + BALL_R >= height) {
      this.ball.y = height - BALL_R;
      this.ballVelY = -Math.abs(this.ballVelY);
      this.playSound('hit');
    }

    // ── Colisión paleta jugador ──────────────────────────────
    const py = this.playerPaddle.x;
    if (
      this.ball.x + BALL_R >= py - PADDLE_W / 2 &&
      this.ball.x <= py + PADDLE_W &&
      Math.abs(this.ball.y - this.playerPaddle.y) < PADDLE_H / 2 + BALL_R
    ) {
      const newSpeed = Math.min(Math.sqrt(this.ballVelX ** 2 + this.ballVelY ** 2) * 1.06, MAX_SPEED);
      this.ballVelX = -Math.abs(newSpeed);
      const relY = (this.ball.y - this.playerPaddle.y) / (PADDLE_H / 2);
      this.ballVelY = relY * newSpeed * 0.8;
      this.ball.x = py - PADDLE_W / 2 - BALL_R - 1;
      this.rallies++;
      this.playSound('hit');
      this.spawnParticles(this.ball.x, this.ball.y, 0x00ff88, 8);
      this.callbacks.onScore(10 + this.rallies * 3, this.rallies >= 3);
    }

    // ── Colisión paleta IA ───────────────────────────────────
    const ay = this.aiPaddle.x;
    if (
      this.ball.x - BALL_R <= ay + PADDLE_W / 2 &&
      this.ball.x >= ay - PADDLE_W &&
      Math.abs(this.ball.y - this.aiPaddle.y) < PADDLE_H / 2 + BALL_R
    ) {
      const newSpeed = Math.min(Math.sqrt(this.ballVelX ** 2 + this.ballVelY ** 2) * 1.03, MAX_SPEED);
      this.ballVelX = Math.abs(newSpeed);
      const relY = (this.ball.y - this.aiPaddle.y) / (PADDLE_H / 2);
      this.ballVelY = relY * newSpeed * 0.7;
      this.ball.x = ay + PADDLE_W / 2 + BALL_R + 1;
      this.playSound('hit');
    }

    // ── Puntos ───────────────────────────────────────────────
    // IA anota (pelota sale por la derecha)
    if (this.ball.x > width + BALL_R) {
      this.aiScore++;
      this.aiScoreText.setText(String(this.aiScore));
      this.playSound('death');
      this.flashScreen(0xff0000, 250);
      this.callbacks.onLoseLife();
      this.time.delayedCall(800, () => this.launchBall());
    }

    // Jugador anota (pelota sale por la izquierda)
    if (this.ball.x < -BALL_R) {
      this.playerScore++;
      this.playerScoreText.setText(String(this.playerScore));
      this.playSound('score');
      this.showLargeAnnouncement('¡PUNTO!', '#00ff88', 600);
      this.callbacks.onScore(50, true);

      // Aumentar dificultad progresivamente (IA más rápida)
      if (this.playerScore % 3 === 0) {
        this.aiSpeedCurrent = Math.min(this.aiSpeedCurrent + 20, 300);
        this.callbacks.onLevelUp();
      }
      this.time.delayedCall(800, () => this.launchBall());
    }

    // Color de la pelota según velocidad
    const spd = Math.sqrt(this.ballVelX ** 2 + this.ballVelY ** 2);
    const t   = Math.min((spd - INITIAL_SPD) / (MAX_SPEED - INITIAL_SPD), 1);
    this.ball.setFillStyle(
      Phaser.Display.Color.GetColor(255, Math.round(255 * (1 - t * 0.7)), Math.round(255 * (1 - t)))
    );
  }

  protected onGestureEvent(_e: GestureEvent): void {
    // Pong solo usa HAND_POSITION (continuo)
  }

  protected destroyGame(): void {}
}

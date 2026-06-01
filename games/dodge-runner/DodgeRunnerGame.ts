/**
 * games/dodge-runner/DodgeRunnerGame.ts
 * Dodge Runner — optimizado para demo con visión artificial.
 *
 * CAMBIOS v2:
 * - Jugador 64px (era 40px) → más visible
 * - Obstáculos 54px (era 38px) → más legibles
 * - Velocidad inicial 160 px/s (era 250) → más tiempo de reacción
 * - Spawn cada 2400ms (era 1500ms) → menos presión inicial
 * - Carriles con color en lugar de solo líneas
 * - Hitbox de colisión: window de 50px Y (era 40px) pero más tolerante en X
 * - Invencibilidad 800ms tras colisión (anti-doble hit)
 * - Instrucciones en pantalla más claras
 * - Personaje cambia de emoji según la acción
 */

import Phaser from 'phaser';
import { BaseGame } from '../base/BaseGame';
import type { GestureEvent } from '@/types/gesture.types';

type LaneIndex = 0 | 1 | 2;

interface Obstacle {
  sprite: Phaser.GameObjects.Text;
  label: Phaser.GameObjects.Text;
  type: 'low' | 'high' | 'wall';
  lane: LaneIndex;
  speed: number;
  passed: boolean;
}

// Posiciones X de los 3 carriles (normalizado)
const LANES_X = [0.2, 0.5, 0.8];

// Colores de los carriles
const LANE_COLORS = [0x3344ff, 0x8800ff, 0xff3388];

const OBSTACLE_DEFS: Array<{
  emoji: string; type: Obstacle['type']; hint: string; color: string;
}> = [
  { emoji: '🪨', type: 'low',  hint: '⬆SALTA',   color: '#88aaff' },
  { emoji: '🌵', type: 'low',  hint: '⬆SALTA',   color: '#88aaff' },
  { emoji: '⚡', type: 'high', hint: '⬇AGACHA',  color: '#ffaa44' },
  { emoji: '🌀', type: 'high', hint: '⬇AGACHA',  color: '#ffaa44' },
  { emoji: '🧱', type: 'wall', hint: '↔CAMBIA',  color: '#ff6666' },
];

export class DodgeRunnerGame extends BaseGame {
  private playerLane: LaneIndex = 1;
  private playerY = 0;
  private playerSprite!: Phaser.GameObjects.Text;
  private obstacles: Obstacle[] = [];
  private spawnTimer!: Phaser.Time.TimerEvent;
  private obstacleSpeed = 160;     // era 250
  private isJumping = false;
  private isCrouching = false;
  private isInvincible = false;    // invencibilidad tras colisión
  private jumpTween: Phaser.Tweens.Tween | null = null;
  private distanceTraveled = 0;
  private distanceText!: Phaser.GameObjects.Text;
  private isTransitioning = false;

  // Decoración de carriles
  private laneHighlights: Phaser.GameObjects.Rectangle[] = [];
  private groundLine!: Phaser.GameObjects.Graphics;

  constructor() { super('DodgeRunnerGame'); }
  protected preloadAssets(): void {}

  protected initGame(): void {
    const { width, height } = this.scale;
    this.playerY = height * 0.72;

    // Fondo de carriles con colores sutiles
    LANES_X.forEach((xFrac, i) => {
      const laneW = width * 0.22;
      const bg = this.add.rectangle(xFrac * width, height / 2, laneW, height, LANE_COLORS[i], 0.04)
        .setDepth(0);
      this.laneHighlights.push(bg);

      // Línea lateral del carril
      const lines = this.add.graphics().setDepth(1);
      lines.lineStyle(1, LANE_COLORS[i], 0.25);
      const lx = xFrac * width;
      lines.lineBetween(lx - laneW / 2, 0, lx - laneW / 2, height);
      lines.lineBetween(lx + laneW / 2, 0, lx + laneW / 2, height);
    });

    // Suelo
    this.groundLine = this.add.graphics().setDepth(3);
    this.groundLine.lineStyle(3, 0x4444bb, 0.9);
    this.groundLine.lineBetween(0, height * 0.85, width, height * 0.85);
    this.groundLine.fillStyle(0x000022, 0.3);
    this.groundLine.fillRect(0, height * 0.85, width, height * 0.15);

    // Jugador — 64px, más visible
    this.playerSprite = this.add.text(
      LANES_X[this.playerLane] * width, this.playerY,
      '🏃', { fontSize: '64px' }
    ).setOrigin(0.5).setDepth(15);

    // Indicador de carril activo (flechas bajo el jugador)
    this.updateLaneIndicator();

    // Distancia
    this.distanceText = this.createNeonText(10, 50, '0m', 0xcc88ff, 18).setOrigin(0, 0);

    // Instrucción en esquina
    this.showCornerHint('⬅→ Muévete | ⬆ Salta piedras | ⬇ Agáchate ante relámpagos');

    // Spawn inicial con delay para que el jugador se prepare
    this.time.delayedCall(2000, () => this.startSpawning());

    // Aumentar velocidad cada 12s (era 8s)
    this.time.addEvent({
      delay: 12000,
      repeat: -1,
      callback: () => {
        this.obstacleSpeed = Math.min(this.obstacleSpeed + 20, 480);
        const cur = (this.spawnTimer as unknown as { delay: number }).delay;
        const newDelay = Math.max(900, cur - 80);
        this.spawnTimer.destroy();
        this.startSpawning(newDelay);
        this.callbacks.onLevelUp();
        this.showLargeAnnouncement('¡VELOCIDAD!', '#ff8800', 700);
      },
    });
  }

  private startSpawning(delay = 2400) {
    this.spawnTimer = this.time.addEvent({
      delay,
      repeat: -1,
      callback: this.spawnObstacle,
      callbackScope: this,
    });
  }

  private spawnObstacle() {
    const { width } = this.scale;
    const def = OBSTACLE_DEFS[Phaser.Math.Between(0, OBSTACLE_DEFS.length - 1)];
    const lane = Phaser.Math.Between(0, 2) as LaneIndex;
    const x = LANES_X[lane] * width;

    const sprite = this.add.text(x, -60, def.emoji, {
      fontSize: '54px', // era 38px
    }).setOrigin(0.5).setDepth(10);

    // Etiqueta de instrucción sobre el obstáculo
    const label = this.add.text(x, -110, def.hint, {
      fontSize: '14px',
      fontFamily: 'monospace',
      color: def.color,
    }).setOrigin(0.5).setDepth(11).setAlpha(0.85);

    this.obstacles.push({
      sprite, label,
      type: def.type, lane,
      speed: this.obstacleSpeed * Phaser.Math.FloatBetween(0.88, 1.12),
      passed: false,
    });
  }

  private updateLaneIndicator() {
    // Actualizar highlight del carril activo
    this.laneHighlights.forEach((h, i) => {
      h.setFillStyle(LANE_COLORS[i], i === this.playerLane ? 0.12 : 0.04);
    });
  }

  protected updateGame(_time: number, delta: number): void {
    const dt = delta / 1000;
    const { height } = this.scale;

    // Distancia y score continuo (reducido para no spamear)
    this.distanceTraveled += this.obstacleSpeed * dt * 0.1;
    if (Math.round(this.distanceTraveled) % 5 === 0) {
      this.distanceText.setText(`${Math.round(this.distanceTraveled)}m`);
    }
    // Score discreto cada ~2 segundos de juego
    if (Math.round(this.distanceTraveled * 10) % 20 === 0) {
      this.callbacks.onScore(5, false);
    }

    // Mover obstáculos
    const toRemove: Obstacle[] = [];
    for (const obs of this.obstacles) {
      obs.sprite.y += obs.speed * dt;
      obs.label.y  += obs.speed * dt;

      // Check colisión: ventana de 55px en Y, carril del jugador
      if (
        obs.lane === this.playerLane &&
        Math.abs(obs.sprite.y - this.playerY) < 55 &&
        !this.isTransitioning &&
        !this.isInvincible &&
        !obs.passed
      ) {
        const blocked =
          (obs.type === 'low'  && !this.isJumping)   ||
          (obs.type === 'high' && !this.isCrouching)  ||
           obs.type === 'wall';

        if (blocked) {
          obs.passed = true;
          this.handleCollision(obs.sprite.x, obs.sprite.y);
        }
      }

      // Marcar como pasado cuando sale por abajo
      if (obs.sprite.y > height + 80) {
        if (!obs.passed) {
          obs.passed = true;
          this.callbacks.onScore(15, false); // bonus por sobrevivir obstáculo
        }
        toRemove.push(obs);
      }
    }

    for (const obs of toRemove) {
      obs.sprite.destroy();
      obs.label.destroy();
      this.obstacles = this.obstacles.filter(o => o !== obs);
    }
  }

  private handleCollision(x: number, y: number) {
    this.playSound('death');
    this.flashScreen(0xff0000, 300);
    this.spawnParticles(x, y, 0xff4400, 18);
    this.playerSprite.setText('💥');

    // Invencibilidad temporal para evitar hits en cadena
    this.isInvincible = true;
    this.time.delayedCall(800, () => {
      this.isInvincible = false;
      if (this.playerSprite.active) this.playerSprite.setText('🏃');
    });

    // Parpadeo visual durante invencibilidad
    this.tweens.add({
      targets: this.playerSprite,
      alpha: 0.3,
      duration: 120,
      yoyo: true,
      repeat: 3,
      onComplete: () => { if (this.playerSprite.active) this.playerSprite.setAlpha(1); },
    });

    this.callbacks.onLoseLife();
  }

  private moveToLane(lane: LaneIndex) {
    if (this.isTransitioning || lane === this.playerLane) return;
    const { width } = this.scale;
    this.playerLane = lane;
    this.isTransitioning = true;
    this.updateLaneIndicator();

    this.tweens.add({
      targets: this.playerSprite,
      x: LANES_X[lane] * width,
      duration: 180,
      ease: 'Sine.easeInOut',
      onComplete: () => { this.isTransitioning = false; },
    });
    this.playSound('hit');
  }

  private doJump() {
    if (this.isJumping) return;
    this.isJumping = true;
    this.playSound('jump');
    this.playerSprite.setText('🦘');

    this.jumpTween = this.tweens.add({
      targets: this.playerSprite,
      y: this.playerY - 110,
      duration: 320,
      ease: 'Sine.easeOut',
      yoyo: true,
      onComplete: () => {
        this.isJumping = false;
        this.playerSprite.setText('🏃');
        this.playerSprite.y = this.playerY;
      },
    });
  }

  private doCrouch() {
    if (this.isCrouching) return;
    this.isCrouching = true;
    this.playerSprite.setText('🧎');
    // Visualmente agacharse
    this.tweens.add({ targets: this.playerSprite, scaleY: 0.65, duration: 100 });

    this.time.delayedCall(650, () => {
      this.isCrouching = false;
      this.playerSprite.setText('🏃');
      this.tweens.add({ targets: this.playerSprite, scaleY: 1, duration: 100 });
    });
  }

  protected onGestureEvent(event: GestureEvent): void {
    switch (event.type) {
      case 'MOVE_LEFT':
        this.moveToLane(Math.max(0, this.playerLane - 1) as LaneIndex);
        break;
      case 'MOVE_RIGHT':
        this.moveToLane(Math.min(2, this.playerLane + 1) as LaneIndex);
        break;
      case 'JUMP':
        this.doJump();
        break;
      case 'CROUCH':
        this.doCrouch();
        break;
    }
  }

  protected destroyGame(): void {
    if (this.spawnTimer) this.spawnTimer.destroy();
    if (this.jumpTween) this.jumpTween.stop();
    for (const o of this.obstacles) { o.sprite.destroy(); o.label.destroy(); }
    this.obstacles = [];
  }
}

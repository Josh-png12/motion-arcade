/**
 * games/fruit-slash/FruitSlashGame.ts
 * Fruit Slash — optimizado para demo con visión artificial.
 *
 * CAMBIOS v2 (jugabilidad real):
 * - Frutas 60px (era 40px) → 50% más grandes, fácil de ver
 * - Hitbox 70px radio (era 45px) → más generoso para detección de manos
 * - Velocidad inicial 420-580 px/s (era 200-320) → arco natural y tiempo en pantalla
 * - Gravedad reducida a 280 (era 400) → frutas permanecen más tiempo en zona de juego
 * - 3 frutas iniciales al arrancar → siempre hay algo que cortar
 * - Spawn cada 900ms (era 1200ms) → flujo constante
 * - Bombas: 8% (era 15%) → menos castigo en demo
 * - Miss penalty: cada 5 misses (era cada 3) → más indulgente
 * - Trail de manos visible (rastro al mover)
 * - Cortes detectados tanto por hitbox continua como por eventos SLICE
 */

import Phaser from 'phaser';
import { BaseGame } from '../base/BaseGame';
import type { GestureEvent } from '@/types/gesture.types';

interface FruitData {
  sprite: Phaser.GameObjects.Text;
  velocityX: number;
  velocityY: number;
  isBomb: boolean;
  sliced: boolean;
  value: number;
  justSliced: boolean; // protección contra doble-corte
}

// Frutas con sus valores de puntos
const FRUITS = ['🍎', '🍊', '🍋', '🍇', '🍓', '🍑', '🥭', '🍍', '🫐', '🍒'];
const FRUIT_VALUES = [10, 15, 20, 25, 30, 20, 35, 40, 30, 25];

// Radio de hitbox para detección de corte — generoso por visión artificial
const HIT_RADIUS = 70;

// Gravedad: menor que la real para que las frutas se queden más en pantalla
const GRAVITY = 280;

export class FruitSlashGame extends BaseGame {
  private fruits: FruitData[] = [];
  private leftHandCursor!: Phaser.GameObjects.Text;
  private rightHandCursor!: Phaser.GameObjects.Text;
  private spawnTimer!: Phaser.Time.TimerEvent;
  private difficulty = 1;
  private missCount = 0;

  // Trail de manos para efecto visual
  private leftPrev: { x: number; y: number } | null = null;
  private rightPrev: { x: number; y: number } | null = null;
  private trailGraphics!: Phaser.GameObjects.Graphics;

  constructor() { super('FruitSlashGame'); }

  protected preloadAssets(): void {}

  protected initGame(): void {
    const { width, height } = this.scale;

    // Canvas de trail (debajo de todo excepto el fondo)
    this.trailGraphics = this.add.graphics().setDepth(8);

    // Cursores de manos — más grandes y visibles
    this.leftHandCursor = this.add.text(width * 0.3, height / 2, '🖐', {
      fontSize: '52px',
    }).setOrigin(0.5).setDepth(22).setAlpha(0.9);

    this.rightHandCursor = this.add.text(width * 0.7, height / 2, '🖐', {
      fontSize: '52px',
    }).setOrigin(0.5).setDepth(22).setAlpha(0.9).setScale(-1, 1);

    // Zona de peligro inferior
    const danger = this.add.graphics();
    danger.lineStyle(2, 0xff2222, 0.4);
    danger.lineBetween(0, height - 70, width, height - 70);
    danger.fillStyle(0xff0000, 0.05);
    danger.fillRect(0, height - 70, width, 70);
    danger.setDepth(4);

    // Instrucción en esquina
    this.showCornerHint('✂️ Mueve las manos para cortar frutas — evita las bombas 💣');

    // Lanzar 3 frutas iniciales inmediatamente para que haya algo que cortar
    this.time.delayedCall(400, () => this.spawnFruit(width * 0.25, false));
    this.time.delayedCall(700, () => this.spawnFruit(width * 0.5, false));
    this.time.delayedCall(1000, () => this.spawnFruit(width * 0.75, false));

    // Spawn continuo
    this.startSpawning();

    // Aumentar dificultad cada 20s
    this.time.addEvent({
      delay: 20000,
      repeat: -1,
      callback: () => {
        this.difficulty = Math.min(this.difficulty + 0.25, 3.5);
        const newDelay = Math.max(500, 900 - this.difficulty * 120);
        this.spawnTimer.destroy();
        this.startSpawning(newDelay);
        this.showLargeAnnouncement('¡MÁS RÁPIDO!', '#ff8800', 800);
      },
    });
  }

  private startSpawning(delay = 900) {
    const { width } = this.scale;
    this.spawnTimer = this.time.addEvent({
      delay,
      repeat: -1,
      callback: () => {
        if (!this.scene.isActive()) return;
        // Probabilidad de bomba: 8% base, sube solo a 14% máximo
        const isBomb = Math.random() < Math.min(0.08 + this.difficulty * 0.02, 0.14);
        const x = Phaser.Math.Between(80, width - 80);
        this.spawnFruit(x, isBomb);
      },
    });
  }

  private spawnFruit(x: number, isBomb: boolean) {
    const { height } = this.scale;
    const idx = Phaser.Math.Between(0, FRUITS.length - 1);
    const emoji = isBomb ? '💣' : FRUITS[idx];
    const value = isBomb ? 0 : FRUIT_VALUES[idx];

    // Inicio desde debajo de la pantalla
    const sprite = this.add.text(x, height + 40, emoji, {
      fontSize: '60px', // 50% más grande que los 40px originales
    }).setOrigin(0.5).setDepth(10);

    // Velocidad de subida: 420-580 px/s → arco parabólico natural
    const baseSpeed = Phaser.Math.FloatBetween(420, 580) * (1 + (this.difficulty - 1) * 0.15);
    // Componente horizontal para arcos interesantes
    const vx = Phaser.Math.FloatBetween(-80, 80);

    this.fruits.push({
      sprite,
      velocityX: vx,
      velocityY: -baseSpeed,
      isBomb,
      sliced: false,
      justSliced: false,
      value,
    });
  }

  protected updateGame(_time: number, delta: number): void {
    const dt = delta / 1000;
    const { width, height } = this.scale;

    // Limpiar trail del frame anterior
    this.trailGraphics.clear();

    // Actualizar cursores de manos con trail visual
    const lh = this.gestureState.leftHandPosition;
    const rh = this.gestureState.rightHandPosition;

    if (lh) {
      const nx = lh.x * width;
      const ny = lh.y * height;
      this.leftHandCursor.setPosition(nx, ny).setAlpha(0.9);

      // Trail: línea desde posición anterior
      if (this.leftPrev) {
        this.trailGraphics.lineStyle(6, 0x00eeff, 0.6);
        this.trailGraphics.lineBetween(this.leftPrev.x, this.leftPrev.y, nx, ny);
      }
      this.leftPrev = { x: nx, y: ny };
    } else {
      this.leftPrev = null;
      this.leftHandCursor.setAlpha(0.3);
    }

    if (rh) {
      const nx = rh.x * width;
      const ny = rh.y * height;
      this.rightHandCursor.setPosition(nx, ny).setAlpha(0.9);

      if (this.rightPrev) {
        this.trailGraphics.lineStyle(6, 0xff88ff, 0.6);
        this.trailGraphics.lineBetween(this.rightPrev.x, this.rightPrev.y, nx, ny);
      }
      this.rightPrev = { x: nx, y: ny };
    } else {
      this.rightPrev = null;
      this.rightHandCursor.setAlpha(0.3);
    }

    // Mover frutas con física parabólica
    const toRemove: FruitData[] = [];
    for (const fruit of this.fruits) {
      if (fruit.sliced) continue;
      fruit.sprite.x += fruit.velocityX * dt;
      fruit.sprite.y += fruit.velocityY * dt;
      fruit.velocityY += GRAVITY * dt;

      // Rotación natural
      fruit.sprite.rotation += (fruit.velocityX > 0 ? 1.8 : -1.8) * dt;

      if (fruit.sprite.y > height + 80) {
        if (!fruit.isBomb) {
          this.missCount++;
          // Penalizar cada 5 misses (antes era cada 3)
          if (this.missCount % 5 === 0) {
            this.callbacks.onLoseLife();
            this.flashScreen(0xff0000, 200);
          }
        }
        toRemove.push(fruit);
      }
    }

    for (const f of toRemove) {
      f.sprite.destroy();
      this.fruits = this.fruits.filter(fr => fr !== f);
    }

    // Detección de colisión continua con manos
    this.checkHandCollisions();
  }

  private checkHandCollisions() {
    const { width, height } = this.scale;
    const hands: { x: number; y: number }[] = [];

    if (this.gestureState.leftHandPosition) {
      hands.push({
        x: this.gestureState.leftHandPosition.x * width,
        y: this.gestureState.leftHandPosition.y * height,
      });
    }
    if (this.gestureState.rightHandPosition) {
      hands.push({
        x: this.gestureState.rightHandPosition.x * width,
        y: this.gestureState.rightHandPosition.y * height,
      });
    }

    for (const hand of hands) {
      for (const fruit of this.fruits) {
        if (fruit.sliced || fruit.justSliced) continue;
        const dist = Phaser.Math.Distance.Between(
          hand.x, hand.y, fruit.sprite.x, fruit.sprite.y
        );
        if (dist < HIT_RADIUS) {
          this.sliceFruit(fruit, hand.x, hand.y);
        }
      }
    }
  }

  private sliceFruit(fruit: FruitData, x: number, y: number) {
    fruit.sliced = true;
    fruit.justSliced = true; // evitar doble-corte en el mismo frame

    if (fruit.isBomb) {
      this.playSound('death');
      this.spawnParticles(x, y, 0xff4400, 24);
      this.flashScreen(0xff0000, 350);
      this.showLargeAnnouncement('💥 BOMBA', '#ff4444', 700);
      this.callbacks.onLoseLife();
    } else {
      this.playSound('hit');
      this.spawnParticles(x, y, 0xffcc00, 14);
      this.showFloatingText(x, y - 20, `+${fruit.value}`, '#ffff44');
      this.callbacks.onScore(fruit.value, true);
    }

    // Animación de corte: partir y desvanecer
    this.tweens.add({
      targets: fruit.sprite,
      scaleX: 0,
      scaleY: 1.3,
      alpha: 0,
      duration: 220,
      ease: 'Power2',
      onComplete: () => {
        fruit.sprite.destroy();
        this.fruits = this.fruits.filter(f => f !== fruit);
      },
    });
  }

  protected onGestureEvent(event: GestureEvent): void {
    const { width, height } = this.scale;

    if (event.type === 'SLICE_LEFT' || event.type === 'SLICE_RIGHT') {
      // Efecto visual de slash en la posición de la mano correspondiente
      const hand = event.leftHand ?? event.rightHand;
      const cx = hand ? hand.x * width : width / 2;
      const cy = hand ? hand.y * height : height / 2;
      this.showSlashEffect(cx, cy, event.type === 'SLICE_RIGHT');
    }
  }

  private showSlashEffect(x: number, y: number, toRight: boolean) {
    const g = this.add.graphics().setDepth(26);
    const len = 100;
    // Trazo principal blanco
    g.lineStyle(5, 0xffffff, 0.9);
    g.lineBetween(
      toRight ? x - len : x + len, y - 12,
      toRight ? x + len : x - len, y + 12
    );
    // Brillo secundario cian
    g.lineStyle(2, 0x00eeff, 0.7);
    g.lineBetween(
      toRight ? x - len * 0.8 : x + len * 0.8, y - 5,
      toRight ? x + len * 0.8 : x - len * 0.8, y + 5
    );
    this.tweens.add({
      targets: g, alpha: 0, duration: 250,
      onComplete: () => g.destroy(),
    });
  }

  protected destroyGame(): void {
    if (this.spawnTimer) this.spawnTimer.destroy();
    for (const f of this.fruits) f.sprite.destroy();
    this.fruits = [];
  }
}

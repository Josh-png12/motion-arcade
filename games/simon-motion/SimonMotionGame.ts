/**
 * games/simon-motion/SimonMotionGame.ts
 * Simon Motion — optimizado para demo con visión artificial.
 *
 * CAMBIOS v2:
 * - timeLimit: 4500ms por pose (era 3000ms) → más tiempo para ejecutar
 * - Mostrar cada pose 1100ms (era 800ms) → más legible la secuencia
 * - Gap entre poses: 400ms (era 300ms)
 * - Display de pose: 130px (era 100px) + fondo de color por pose
 * - Tarjeta de instrucción: muestra icon + nombre + gesto requerido
 * - Barra de tiempo cambia de color: verde→amarillo→rojo
 * - No reducir tiempo mínimo de 2500ms (era 1200ms) → demo más accesible
 * - Historial visual de la secuencia (puntos de colores)
 * - Efecto "¡CORRECTO!" más prominente
 */

import Phaser from 'phaser';
import { BaseGame } from '../base/BaseGame';
import type { GestureEvent, GestureEventType } from '@/types/gesture.types';

interface SimonPose {
  id: string;
  icon: string;
  label: string;
  description: string; // descripción más clara del gesto
  gestureType: GestureEventType;
  color: number;
  hexColor: string;
}

const POSES: SimonPose[] = [
  {
    id: 'left',   icon: '🙋',  label: 'MANO IZQUIERDA',
    description: 'Levanta tu\nmano izquierda',
    gestureType: 'LEFT_HAND_UP',  color: 0xff4488, hexColor: '#ff4488',
  },
  {
    id: 'right',  icon: '🙋',  label: 'MANO DERECHA',
    description: 'Levanta tu\nmano derecha',
    gestureType: 'RIGHT_HAND_UP', color: 0x44aaff, hexColor: '#44aaff',
  },
  {
    id: 'both',   icon: '🙌',  label: 'AMBAS MANOS',
    description: 'Levanta\nambas manos',
    gestureType: 'BOTH_HANDS_UP', color: 0xffaa00, hexColor: '#ffaa00',
  },
  {
    id: 'jump',   icon: '⬆️',  label: 'SALTA',
    description: 'Da un salto\nhacia arriba',
    gestureType: 'JUMP',          color: 0x44ff88, hexColor: '#44ff88',
  },
];

type GamePhase = 'showing' | 'waiting' | 'success' | 'fail' | 'idle';

export class SimonMotionGame extends BaseGame {
  private sequence: SimonPose[] = [];
  private playerIndex = 0;
  private phase: GamePhase = 'idle';
  private timeLimit = 4500;         // era 3000ms
  private minTimeLimit = 2500;      // era 1200ms — más accesible
  private timeLimitTimer: Phaser.Time.TimerEvent | null = null;

  // UI elements
  private poseCard!: Phaser.GameObjects.Container;
  private cardBg!: Phaser.GameObjects.Rectangle;
  private poseIcon!: Phaser.GameObjects.Text;
  private poseName!: Phaser.GameObjects.Text;
  private poseDesc!: Phaser.GameObjects.Text;
  private instructionText!: Phaser.GameObjects.Text;
  private roundText!: Phaser.GameObjects.Text;
  private timerBar!: Phaser.GameObjects.Rectangle;
  private timerBarBg!: Phaser.GameObjects.Rectangle;
  private sequenceDots: Phaser.GameObjects.Arc[] = [];

  constructor() { super('SimonMotionGame'); }
  protected preloadAssets(): void {}

  protected initGame(): void {
    const { width, height } = this.scale;
    const cx = width / 2;

    // ── Tarjeta central de pose (card grande y visible) ────────────
    this.cardBg = this.add.rectangle(cx, height / 2 - 20, width * 0.7, height * 0.4, 0x111133, 1)
      .setStrokeStyle(3, 0x4444aa)
      .setDepth(9);

    this.poseIcon = this.add.text(cx, height / 2 - 70, '?', {
      fontSize: '130px',
    }).setOrigin(0.5).setDepth(10);

    this.poseName = this.add.text(cx, height / 2 + 30, '', {
      fontSize: '28px',
      fontFamily: 'monospace',
      color: '#ffffff',
      stroke: '#ffffff',
      strokeThickness: 1,
      align: 'center',
    }).setOrigin(0.5).setDepth(10);

    this.poseDesc = this.add.text(cx, height / 2 + 75, '', {
      fontSize: '16px',
      fontFamily: 'monospace',
      color: '#aaaaaa',
      align: 'center',
    }).setOrigin(0.5).setDepth(10);

    // Contenedor de tarjeta (para animar en conjunto)
    this.poseCard = this.add.container(0, 0, [
      this.cardBg, this.poseIcon, this.poseName, this.poseDesc,
    ]).setDepth(9);

    // ── Textos de estado ────────────────────────────────────────────
    this.instructionText = this.createNeonText(cx, 80, '¡Observa la secuencia!', 0xaaaaaa, 20)
      .setOrigin(0.5).setDepth(12);

    this.roundText = this.createNeonText(cx, 35, 'Ronda 1', 0xffff00, 26)
      .setOrigin(0.5).setDepth(12);

    // ── Barra de tiempo ─────────────────────────────────────────────
    const barW = width - 60;
    this.timerBarBg = this.add.rectangle(cx, height - 35, barW, 16, 0x111133)
      .setStrokeStyle(1, 0x333366)
      .setDepth(10);
    this.timerBar = this.add.rectangle(30 + barW / 2, height - 35, barW, 16, 0x44ff88)
      .setDepth(11);

    // Instrucción en esquina
    this.showCornerHint('Repite la secuencia de gestos en el mismo orden');

    // Comenzar primera ronda
    this.time.delayedCall(1200, () => this.startRound());
  }

  // ── Secuencia de poses ─────────────────────────────────────────────

  private startRound() {
    const nextPose = POSES[Phaser.Math.Between(0, POSES.length - 1)];
    this.sequence.push(nextPose);
    this.playerIndex = 0;
    this.phase = 'showing';

    this.roundText.setText(`Ronda ${this.sequence.length}`);
    this.instructionText.setText('¡Observa la secuencia!').setColor('#aaaaaa');
    this.updateSequenceDots(-1); // sin selección activa

    // Mostrar "MIRA" antes de la secuencia
    this.showLargeAnnouncement('OBSERVA', '#aaaaee', 700, -80);
    this.time.delayedCall(800, () => this.showSequence(0));
  }

  private showSequence(index: number) {
    if (index >= this.sequence.length) {
      this.time.delayedCall(700, () => this.waitForPlayer());
      return;
    }

    const pose = this.sequence[index];
    this.highlightCard(pose, index + 1);

    // Mostrar cada pose 1100ms (era 800ms)
    this.time.delayedCall(1100, () => {
      this.clearCard();
      // Gap entre poses: 400ms
      this.time.delayedCall(400, () => this.showSequence(index + 1));
    });
  }

  private highlightCard(pose: SimonPose, stepNumber: number) {
    // Fondo de la tarjeta con el color de la pose
    this.cardBg
      .setFillStyle(Phaser.Display.Color.HexStringToColor(pose.hexColor).color, 0.18)
      .setStrokeStyle(4, pose.color);

    this.poseIcon
      .setText(pose.icon)
      .setStyle({ color: pose.hexColor });

    this.poseName
      .setText(`${stepNumber}. ${pose.label}`)
      .setStyle({ color: pose.hexColor });

    this.poseDesc.setText(pose.description).setAlpha(0.8);

    // Pulso de entrada en la tarjeta
    this.tweens.add({
      targets: this.poseCard,
      scaleX: 1.04, scaleY: 1.04,
      duration: 150,
      yoyo: true,
    });
  }

  private clearCard() {
    this.cardBg.setFillStyle(0x111133).setStrokeStyle(2, 0x4444aa);
    this.poseIcon.setText('').setStyle({ color: '#555577' });
    this.poseName.setText('');
    this.poseDesc.setText('');
  }

  private waitForPlayer() {
    this.phase = 'waiting';
    this.playerIndex = 0;

    const expected = this.sequence[0];
    this.showExpected(expected, 0);
    this.instructionText
      .setText(`¡Ahora hazlo! Pose ${this.playerIndex + 1} de ${this.sequence.length}`)
      .setColor('#44ff88');

    this.updateSequenceDots(0);
    this.startPoseTimer();
  }

  private showExpected(pose: SimonPose, step: number) {
    // Muestra la pose esperada con ? en el icono (no spoilear pero dar color)
    this.cardBg
      .setFillStyle(Phaser.Display.Color.HexStringToColor(pose.hexColor).color, 0.10)
      .setStrokeStyle(4, pose.color);

    this.poseIcon.setText('?').setStyle({ color: pose.hexColor, fontSize: '130px' });
    this.poseName.setText(`${step + 1}. ${pose.label}`).setStyle({ color: pose.hexColor });
    this.poseDesc.setText(pose.description).setAlpha(0.7);
  }

  private startPoseTimer() {
    const { width } = this.scale;
    const barW = width - 60;
    if (this.timeLimitTimer) this.timeLimitTimer.destroy();

    // Reiniciar barra
    this.timerBar.width = barW;
    this.timerBar.x = 30 + barW / 2;
    this.timerBar.setFillStyle(0x44ff88); // verde al inicio
    this.tweens.killTweensOf(this.timerBar);

    // Animar barra reduciéndose
    this.tweens.add({
      targets: this.timerBar,
      width: 0,
      x: 30,
      duration: this.timeLimit,
      ease: 'Linear',
      onUpdate: () => {
        // Cambiar color según el tiempo restante
        const pct = this.timerBar.width / barW;
        if (pct < 0.25)      this.timerBar.setFillStyle(0xff3333); // rojo
        else if (pct < 0.5)  this.timerBar.setFillStyle(0xffaa00); // naranja
        else                 this.timerBar.setFillStyle(0x44ff88); // verde
      },
    });

    this.timeLimitTimer = this.time.delayedCall(this.timeLimit, () => {
      if (this.phase === 'waiting') this.handleFail();
    });
  }

  private handlePoseSuccess() {
    const pose = this.sequence[this.playerIndex];

    // Mostrar icono real (¡correcto!)
    this.poseIcon.setText(pose.icon).setStyle({ color: pose.hexColor });
    this.poseName.setStyle({ color: '#44ff88' });

    this.playSound('score');
    this.spawnParticles(this.scale.width / 2, this.scale.height / 2 - 20, pose.color, 18);
    this.showLargeAnnouncement('✓', pose.hexColor, 500, -60);
    this.callbacks.onScore(60 * this.sequence.length, true);

    this.playerIndex++;
    this.updateSequenceDots(this.playerIndex);

    if (this.playerIndex >= this.sequence.length) {
      this.handleSequenceComplete();
    } else {
      // Siguiente pose de la secuencia
      const next = this.sequence[this.playerIndex];
      this.instructionText
        .setText(`¡Correcto! Pose ${this.playerIndex + 1} de ${this.sequence.length}`)
        .setColor('#44ff88');

      this.time.delayedCall(500, () => {
        if (this.phase === 'waiting') {
          this.showExpected(next, this.playerIndex);
          this.startPoseTimer();
        }
      });
    }
  }

  private handleSequenceComplete() {
    this.phase = 'success';
    if (this.timeLimitTimer) this.timeLimitTimer.destroy();
    this.tweens.killTweensOf(this.timerBar);

    this.instructionText.setText('¡SECUENCIA COMPLETA!').setColor('#ffff00');
    this.poseIcon.setText('🎉').setStyle({ color: '#ffff00' });
    this.poseName.setText('¡PERFECTO!').setStyle({ color: '#ffff00' });
    this.showLargeAnnouncement('¡PERFECTO!', '#ffff00', 1200);
    this.playSound('combo');
    this.callbacks.onScore(300 * this.sequence.length, true);
    this.callbacks.onLevelUp();

    // Reducir tiempo límite, pero no por debajo de minTimeLimit
    this.timeLimit = Math.max(this.minTimeLimit, this.timeLimit - 200);

    this.time.delayedCall(2200, () => this.startRound());
  }

  private handleFail() {
    this.phase = 'fail';
    this.playSound('death');
    this.flashScreen(0xff0000, 350);

    const expected = this.sequence[this.playerIndex];
    this.poseIcon.setText(expected.icon).setStyle({ color: '#ff4444' });
    this.poseName.setText(`ERA: ${expected.label}`).setStyle({ color: '#ff4444' });
    this.poseDesc.setText(expected.description);
    this.showLargeAnnouncement('✗ TIEMPO', '#ff4444', 800);

    this.callbacks.onLoseLife();

    // Repetir la misma secuencia (no resetear la longitud)
    this.time.delayedCall(2200, () => {
      this.playerIndex = 0;
      this.phase = 'showing';
      this.instructionText.setText('¡Observa de nuevo!').setColor('#aaaaaa');
      this.showSequence(0);
    });
  }

  /** Indicadores de progreso de la secuencia actual (puntitos de colores) */
  private updateSequenceDots(currentIndex: number) {
    // Destruir puntitos anteriores
    for (const d of this.sequenceDots) d.destroy();
    this.sequenceDots = [];

    const { width, height } = this.scale;
    const total  = this.sequence.length;
    const dotR   = 7;
    const spacing = 20;
    const startX = width / 2 - ((total - 1) * spacing) / 2;

    this.sequence.forEach((pose, i) => {
      const x = startX + i * spacing;
      const y = height - 60;
      const done = i < currentIndex;
      const active = i === currentIndex;

      const dot = this.add.circle(x, y, dotR, done ? pose.color : (active ? 0xffffff : 0x333355))
        .setDepth(12)
        .setAlpha(done || active ? 1 : 0.4);

      if (active) {
        this.tweens.add({
          targets: dot, scaleX: 1.4, scaleY: 1.4,
          duration: 400, yoyo: true, repeat: -1,
        });
      }

      this.sequenceDots.push(dot);
    });
  }

  protected updateGame(_time: number, _delta: number): void {}

  protected onGestureEvent(event: GestureEvent): void {
    if (this.phase !== 'waiting') return;

    const expected = this.sequence[this.playerIndex];
    if (event.type === expected.gestureType) {
      if (this.timeLimitTimer) this.timeLimitTimer.destroy();
      this.tweens.killTweensOf(this.timerBar);
      this.handlePoseSuccess();
    }
  }

  protected destroyGame(): void {
    if (this.timeLimitTimer) this.timeLimitTimer.destroy();
    for (const d of this.sequenceDots) d.destroy();
    this.sequence = [];
  }
}

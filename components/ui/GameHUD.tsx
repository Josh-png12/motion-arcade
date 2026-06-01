/**
 * components/ui/GameHUD.tsx
 * HUD (Heads-Up Display) mostrado durante el gameplay.
 * Muestra score, vidas, nivel y combo.
 */

'use client';

import type { GameState } from '@/types/game.types';

interface GameHUDProps {
  gameState: GameState;
  gameName: string;
  onPause?: () => void;
}

function Heart({ filled }: { filled: boolean }) {
  return (
    <span className={`text-lg ${filled ? 'text-red-500' : 'text-gray-700'}`}>
      {filled ? '❤️' : '🖤'}
    </span>
  );
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function GameHUD({ gameState, gameName, onPause }: GameHUDProps) {
  return (
    <div className="absolute top-0 left-0 right-0 z-30 px-4 py-2">
      <div className="flex items-center justify-between bg-black/60 backdrop-blur-sm rounded-xl px-4 py-2 border border-white/10">
        {/* Score */}
        <div className="text-left">
          <p className="text-gray-400 text-xs font-mono uppercase">Score</p>
          <p className="text-white font-bold text-xl font-mono">
            {gameState.score.toLocaleString()}
          </p>
        </div>

        {/* Centro: nombre + nivel */}
        <div className="text-center">
          <p className="text-gray-300 text-xs font-mono">{gameName}</p>
          <p className="text-yellow-400 text-sm font-bold">Nv. {gameState.level}</p>
        </div>

        {/* Vidas + tiempo */}
        <div className="text-right">
          <div className="flex justify-end gap-0.5 mb-0.5">
            {Array.from({ length: 3 }).map((_, i) => (
              <Heart key={i} filled={i < gameState.lives} />
            ))}
          </div>
          <p className="text-gray-400 text-xs font-mono">{formatTime(gameState.timeElapsed)}</p>
        </div>

        {/* Botón pausa */}
        {onPause && (
          <button
            onClick={onPause}
            className="ml-3 text-gray-400 hover:text-white text-lg transition-colors"
            aria-label="Pausar"
          >
            ⏸
          </button>
        )}
      </div>

      {/* Combo banner */}
      {gameState.combo >= 3 && (
        <div className="text-center mt-1 animate-bounce">
          <span className="bg-yellow-400 text-black font-bold px-3 py-0.5 rounded-full text-sm">
            🔥 COMBO ×{Math.floor(gameState.combo / 3) + 1}
          </span>
        </div>
      )}
    </div>
  );
}

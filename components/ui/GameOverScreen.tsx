/**
 * components/ui/GameOverScreen.tsx
 * Pantalla de Game Over con score final, ranking y opciones.
 */

'use client';

import { useState, useEffect } from 'react';
import type { GameState, GameId, LeaderboardEntry } from '@/types/game.types';

interface GameOverScreenProps {
  gameState: GameState;
  gameId: GameId;
  gameName: string;
  onRestart: () => void;
  onMainMenu: () => void;
}

export function GameOverScreen({
  gameState,
  gameId,
  gameName,
  onRestart,
  onMainMenu,
}: GameOverScreenProps) {
  const [playerName, setPlayerName] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [rank, setRank] = useState<number | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [saving, setSaving] = useState(false);

  // Cargar leaderboard al montar
  useEffect(() => {
    fetch(`/api/leaderboard?gameId=${gameId}&limit=5`)
      .then(r => r.json())
      .then(data => setLeaderboard(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [gameId]);

  async function handleSubmitScore() {
    if (!playerName.trim() || saving) return;
    setSaving(true);

    try {
      const res = await fetch('/api/leaderboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameId,
          playerName: playerName.trim(),
          score: gameState.score,
          level: gameState.level,
          duration: gameState.timeElapsed,
        }),
      });

      if (res.ok) {
        setSubmitted(true);
        // Recargar leaderboard
        const lb = await fetch(`/api/leaderboard?gameId=${gameId}&limit=5`).then(r => r.json());
        if (Array.isArray(lb)) {
          setLeaderboard(lb);
          const myRank = lb.findIndex((e: LeaderboardEntry) => e.player_name === playerName.trim()) + 1;
          if (myRank > 0) setRank(myRank);
        }
      }
    } catch {
      console.error('Error guardando score');
    } finally {
      setSaving(false);
    }
  }

  function formatTime(s: number) {
    return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md">
      <div className="w-full max-w-md mx-4 bg-gray-900 border border-red-500/30 rounded-2xl p-6 shadow-[0_0_40px_rgba(239,68,68,0.2)]">
        {/* Título */}
        <div className="text-center mb-6">
          <h2 className="text-4xl font-black text-red-500 mb-1 animate-pulse">GAME OVER</h2>
          <p className="text-gray-400 text-sm">{gameName}</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { label: 'Score', value: gameState.score.toLocaleString() },
            { label: 'Nivel', value: gameState.level },
            { label: 'Tiempo', value: formatTime(gameState.timeElapsed) },
          ].map(({ label, value }) => (
            <div key={label} className="bg-black/40 rounded-xl p-3 text-center border border-white/5">
              <p className="text-gray-500 text-xs font-mono uppercase">{label}</p>
              <p className="text-white font-bold text-xl">{value}</p>
            </div>
          ))}
        </div>

        {/* Guardar score */}
        {!submitted ? (
          <div className="mb-6">
            <p className="text-gray-300 text-sm mb-2 text-center">¿Guardar en el ranking?</p>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Tu nombre (máx 20 chars)"
                maxLength={20}
                value={playerName}
                onChange={e => setPlayerName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSubmitScore()}
                className="flex-1 bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-green-400"
              />
              <button
                onClick={handleSubmitScore}
                disabled={!playerName.trim() || saving}
                className="px-4 py-2 bg-green-500 hover:bg-green-400 disabled:bg-gray-700 text-black font-bold rounded-lg text-sm transition-colors"
              >
                {saving ? '...' : '✓'}
              </button>
            </div>
          </div>
        ) : (
          <div className="mb-6 text-center">
            <p className="text-green-400 font-bold">¡Score guardado!</p>
            {rank && <p className="text-gray-400 text-sm mt-1">Posición #{rank}</p>}
          </div>
        )}

        {/* Mini leaderboard */}
        {leaderboard.length > 0 && (
          <div className="mb-6">
            <p className="text-gray-500 text-xs font-mono uppercase mb-2">Top 5</p>
            {leaderboard.slice(0, 5).map((entry, i) => (
              <div
                key={entry.id}
                className={`flex justify-between items-center py-1 px-2 rounded text-sm ${
                  entry.player_name === playerName
                    ? 'bg-yellow-400/10 border border-yellow-400/30'
                    : ''
                }`}
              >
                <span className="text-gray-400 w-6">{i + 1}.</span>
                <span className="text-white flex-1">{entry.player_name}</span>
                <span className="text-yellow-400 font-mono">{entry.score.toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}

        {/* Botones */}
        <div className="flex gap-3">
          <button
            onClick={onRestart}
            className="flex-1 py-3 bg-green-500 hover:bg-green-400 text-black font-bold rounded-xl transition-colors"
          >
            ↺ Jugar otra vez
          </button>
          <button
            onClick={onMainMenu}
            className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded-xl transition-colors"
          >
            🏠 Menú
          </button>
        </div>
      </div>
    </div>
  );
}

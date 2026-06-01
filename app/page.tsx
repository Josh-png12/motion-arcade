/**
 * app/page.tsx
 * Menú principal de Motion Arcade.
 *
 * DISEÑO: Pantalla de inicio estilo arcade con:
 * - Animación del título con efecto neón parpadeante
 * - Grid de tarjetas de juegos con gradientes
 * - QR code para que otros se unan desde sus celulares
 * - Modo demo automático tras 15s de inactividad
 * - Ranking en tiempo real via Supabase
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import QRCode from 'react-qr-code';
import { getAllGames } from '@/lib/gameRegistry';
import type { GameMetadata, GameId, LeaderboardEntry } from '@/types/game.types';

const GAMES = getAllGames();
const DEMO_TIMEOUT = 15_000;

export default function HomePage() {
  const router = useRouter();
  const [selectedGame, setSelectedGame] = useState<GameMetadata | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [activeLeaderboard, setActiveLeaderboard] = useState<GameId>('fruit-slash');
  const [showQR, setShowQR] = useState(false);
  const [demoCountdown, setDemoCountdown] = useState<number | null>(null);
  const [currentUrl, setCurrentUrl] = useState('');

  useEffect(() => {
    setCurrentUrl(window.location.origin);
  }, []);

  useEffect(() => {
    fetch(`/api/leaderboard?gameId=${activeLeaderboard}&limit=5`)
      .then(r => r.json())
      .then(data => setLeaderboard(Array.isArray(data) ? data : []))
      .catch(() => setLeaderboard([]));
  }, [activeLeaderboard]);

  const resetDemoTimer = useCallback(() => {
    setDemoCountdown(null);
  }, []);

  useEffect(() => {
    const events = ['mousemove', 'keydown', 'touchstart', 'click'];
    events.forEach(e => window.addEventListener(e, resetDemoTimer));

    let timeout: ReturnType<typeof setTimeout>;
    let interval: ReturnType<typeof setInterval>;

    function startDemo() {
      let count = 5;
      setDemoCountdown(count);
      interval = setInterval(() => {
        count--;
        setDemoCountdown(count);
        if (count <= 0) {
          clearInterval(interval);
          router.push(`/game/${GAMES[0].id}`);
        }
      }, 1000);
    }

    timeout = setTimeout(startDemo, DEMO_TIMEOUT);

    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
      events.forEach(e => window.removeEventListener(e, resetDemoTimer));
    };
  }, [router, resetDemoTimer]);

  return (
    <main className="min-h-screen bg-gray-950 text-white overflow-x-hidden">
      {/* Fondo animado */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-indigo-900/20 via-gray-950 to-gray-950" />
        <svg className="absolute inset-0 w-full h-full opacity-5" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#6366f1" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <header className="text-center mb-10">
          <div className="inline-block mb-3">
            <span className="text-xs font-mono text-green-400 tracking-[0.3em] uppercase bg-green-400/10 px-3 py-1 rounded-full border border-green-400/20">
              ▶ Versión 1.0 — Feria Universitaria
            </span>
          </div>
          <h1 className="text-6xl sm:text-7xl font-black tracking-tighter mb-3">
            <span className="text-white drop-shadow-[0_0_30px_rgba(99,102,241,0.8)]">
              MOTION
            </span>{' '}
            <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              ARCADE
            </span>
          </h1>
          <p className="text-gray-400 text-lg max-w-md mx-auto">
            Controla videojuegos con tu cuerpo. Sin apps. Sin mandos. Solo tú y la cámara.
          </p>
        </header>

        {/* Grid de juegos */}
        <section className="mb-10">
          <h2 className="text-gray-500 text-xs font-mono uppercase tracking-widest mb-4">
            — Selecciona un juego —
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {GAMES.map(game => (
              <GameCard
                key={game.id}
                game={game}
                isSelected={selectedGame?.id === game.id}
                onClick={() => setSelectedGame(game)}
              />
            ))}
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Leaderboard */}
          <div className="lg:col-span-2 bg-gray-900/60 border border-white/5 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-gray-300 font-bold">🏆 Ranking Global</h3>
              <div className="flex gap-1 flex-wrap">
                {GAMES.map(g => (
                  <button
                    key={g.id}
                    onClick={() => setActiveLeaderboard(g.id)}
                    className={`px-2 py-1 rounded text-xs font-mono transition-colors ${
                      activeLeaderboard === g.id
                        ? 'bg-indigo-600 text-white'
                        : 'text-gray-500 hover:text-gray-300'
                    }`}
                  >
                    {g.title.split(' ')[0]}
                  </button>
                ))}
              </div>
            </div>
            {leaderboard.length === 0 ? (
              <p className="text-gray-600 text-sm text-center py-6">
                Sin scores aún — ¡sé el primero!
              </p>
            ) : (
              <div className="space-y-2">
                {leaderboard.map((entry, i) => (
                  <div
                    key={entry.id}
                    className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0"
                  >
                    <span className={`w-6 text-center font-bold text-sm ${
                      i === 0 ? 'text-yellow-400' : i === 1 ? 'text-gray-300' : i === 2 ? 'text-amber-600' : 'text-gray-600'
                    }`}>
                      {i + 1}
                    </span>
                    <span className="flex-1 text-white text-sm truncate">{entry.player_name}</span>
                    <span className="text-indigo-400 font-mono text-sm font-bold">
                      {entry.score.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Panel lateral */}
          <div className="flex flex-col gap-4">
            <button
              onClick={() => {
                const game = selectedGame ?? GAMES[0];
                router.push(`/game/${game.id}`);
              }}
              className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-black text-lg rounded-2xl shadow-[0_0_30px_rgba(99,102,241,0.4)] transition-all hover:scale-105 active:scale-95"
            >
              {selectedGame
                ? `▶ JUGAR ${selectedGame.title.toUpperCase()}`
                : '▶ JUGAR AHORA'}
            </button>

            <button
              onClick={() => setShowQR(!showQR)}
              className="w-full py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium rounded-xl transition-colors border border-white/5"
            >
              📱 {showQR ? 'Ocultar QR' : 'QR para unirse'}
            </button>

            {showQR && currentUrl && (
              <div className="bg-white p-4 rounded-xl flex flex-col items-center gap-2">
                <QRCode value={currentUrl} size={140} />
                <p className="text-gray-500 text-xs text-center break-all">{currentUrl}</p>
              </div>
            )}

            <div className="bg-gray-900/60 border border-white/5 rounded-xl p-4">
              <p className="text-gray-500 text-xs font-mono uppercase mb-2">Hardware ESP32</p>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <p className="text-green-400 text-xs font-mono">Canal: game-events</p>
              </div>
              <p className="text-gray-600 text-xs">LEDs físicos via Pusher WebSocket</p>
            </div>

            <div className="bg-gray-900/60 border border-white/5 rounded-xl p-4 text-xs text-gray-500 space-y-1">
              <p className="font-mono text-gray-400 mb-2">Tecnologías</p>
              <p>🧠 MediaPipe Pose + Hands</p>
              <p>🎮 Phaser.js v3</p>
              <p>⚡ Pusher Channels</p>
              <p>📊 Supabase Realtime</p>
              <p>🔲 ESP32 + 4 LEDs</p>
            </div>
          </div>
        </div>
      </div>

      {/* Demo countdown */}
      {demoCountdown !== null && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-sm border border-yellow-400/30 rounded-full px-6 py-3 z-50 animate-pulse">
          <p className="text-yellow-400 text-sm font-mono">
            Modo demo en {demoCountdown}s... muévete para cancelar
          </p>
        </div>
      )}
    </main>
  );
}

function GameCard({
  game,
  isSelected,
  onClick,
}: {
  game: GameMetadata;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <Link href={`/game/${game.id}`} onClick={onClick}>
      <div
        className={`group relative rounded-2xl border transition-all duration-300 cursor-pointer overflow-hidden h-full ${
          isSelected
            ? 'border-indigo-500 shadow-[0_0_20px_rgba(99,102,241,0.4)]'
            : 'border-white/5 hover:border-white/20'
        }`}
      >
        <div className={`absolute inset-0 bg-gradient-to-br ${game.accentColor} opacity-10 group-hover:opacity-20 transition-opacity`} />
        <div className="relative p-5">
          <div className="flex justify-between items-start mb-3">
            <span className="text-xs font-mono text-gray-400 bg-white/5 px-2 py-0.5 rounded-full">
              {game.difficulty}
            </span>
            <span className="text-gray-600 text-xs">{game.avgDuration}</span>
          </div>
          <h3 className="font-black text-lg text-white mb-1 group-hover:text-indigo-300 transition-colors">
            {game.title}
          </h3>
          <p className="text-gray-500 text-xs leading-relaxed mb-3">{game.description}</p>
          <div className="flex flex-wrap gap-1">
            {game.requiredGestures.slice(0, 2).map(g => (
              <span key={g} className="text-xs bg-white/5 px-2 py-0.5 rounded font-mono text-gray-500">
                {g}
              </span>
            ))}
          </div>
        </div>
      </div>
    </Link>
  );
}

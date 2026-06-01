/**
 * app/game/[gameId]/page.tsx
 * Página de juego dinámica — carga el juego según el ID de la ruta.
 *
 * DISEÑO: Next.js App Router con parámetro dinámico [gameId].
 * El juego se carga lazy para evitar importar Phaser en el bundle inicial.
 * La cámara y el juego comparten el mismo estado de gestos vía el singleton
 * GestureDetector, sin necesidad de props drilling.
 */

'use client';

import { use, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { isValidGameId, getGameMetadata } from '@/lib/gameRegistry';
import { CameraView } from '@/components/camera/CameraView';
import { GameHUD } from '@/components/ui/GameHUD';
import { GameOverScreen } from '@/components/ui/GameOverScreen';
import { GestureInstructions } from '@/components/ui/GestureInstructions';
import { useGame } from '@/hooks/useGame';
import { usePusher } from '@/hooks/usePusher';
import type { MediaPipeStatus } from '@/hooks/useMediaPipe';
import type { GameState, GameId } from '@/types/game.types';

// Importación dinámica del GameController para evitar SSR de Phaser
const GameController = dynamic(
  () => import('@/components/games/GameController').then(m => m.GameController),
  { ssr: false }
);

interface PageProps {
  params: Promise<{ gameId: string }>;
}

export default function GamePage({ params }: PageProps) {
  const { gameId } = use(params);
  const router = useRouter();

  if (!isValidGameId(gameId)) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 text-xl mb-4">Juego no encontrado: {gameId}</p>
          <button
            onClick={() => router.push('/')}
            className="px-6 py-3 bg-gray-800 text-white rounded-xl"
          >
            Volver al menú
          </button>
        </div>
      </div>
    );
  }

  return <ValidGamePage gameId={gameId} />;
}

function ValidGamePage({ gameId }: { gameId: GameId }) {
  const router = useRouter();
  const metadata = getGameMetadata(gameId)!;
  const [cameraStatus, setCameraStatus] = useState<MediaPipeStatus>('idle');
  const [gamePhase, setGamePhase] = useState<'instructions' | 'playing' | 'over'>('instructions');
  const { triggerEvent } = usePusher();

  const handleGameOver = useCallback((state: GameState) => {
    setGamePhase('over');
    void state; // se usa en GameOverScreen
  }, []);

  const {
    gameState,
    gestureState,
    startGame,
    loseLife,
    addScore,
    nextLevel,
    endGame,
  } = useGame({
    gameId,
    initialLives: 3,
    onGameOver: handleGameOver,
  });

  function handleReady() {
    startGame();
    setGamePhase('playing');
    triggerEvent('game_start');
  }

  function handleRestart() {
    setGamePhase('instructions');
  }

  return (
    <div className="fixed inset-0 bg-gray-950 overflow-hidden">
      {/* Cámara: siempre activa en el rincón */}
      <div
        className={`fixed z-40 transition-all duration-500 ${
          gamePhase === 'playing'
            ? 'bottom-4 right-4 w-36 h-28 rounded-xl shadow-lg border border-white/10'
            : 'inset-0'
        }`}
      >
        <CameraView
          enabled
          showDebug={false}
          onStatusChange={setCameraStatus}
          className="w-full h-full"
        />
      </div>

      {/* Pantalla de instrucciones */}
      {gamePhase === 'instructions' && (
        <div className="fixed inset-0 z-30 bg-gray-950">
          <GestureInstructions
            game={metadata}
            onReady={handleReady}
            isPlayerDetected={gestureState.playerDetected && cameraStatus === 'running'}
          />
        </div>
      )}

      {/* Juego activo */}
      {gamePhase === 'playing' && (
        <>
          <div className="fixed inset-0 z-10">
            <GameController
              gameId={gameId}
              callbacks={{
                onScore: addScore,
                onLoseLife: loseLife,
                onGameOver: endGame,
                onLevelUp: nextLevel,
              }}
            />
          </div>
          <div className="fixed inset-0 z-20 pointer-events-none">
            <GameHUD
              gameState={gameState}
              gameName={metadata.title}
              onPause={undefined}
            />
          </div>
        </>
      )}

      {/* Pantalla de Game Over */}
      {gamePhase === 'over' && (
        <GameOverScreen
          gameState={gameState}
          gameId={gameId}
          gameName={metadata.title}
          onRestart={handleRestart}
          onMainMenu={() => router.push('/')}
        />
      )}

      {/* Botón volver (siempre visible) */}
      <button
        onClick={() => router.push('/')}
        className="fixed top-4 left-4 z-50 bg-black/60 backdrop-blur-sm px-3 py-2 rounded-lg text-gray-400 hover:text-white text-sm transition-colors border border-white/10"
      >
        ← Menú
      </button>
    </div>
  );
}

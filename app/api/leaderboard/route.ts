/**
 * app/api/leaderboard/route.ts
 * API Route para ranking online con Supabase.
 *
 * GET  /api/leaderboard?gameId=fruit-slash&limit=10  → top scores
 * POST /api/leaderboard  { gameId, playerName, score, level, duration } → guarda score
 */

import { NextRequest, NextResponse } from 'next/server';
import { getLeaderboard, saveScore } from '@/lib/supabase';
import type { GameId, GameResult } from '@/types/game.types';
import type { LeaderboardEntry } from '@/types/game.types';

export async function GET(req: NextRequest): Promise<NextResponse<LeaderboardEntry[] | { error: string }>> {
  const { searchParams } = new URL(req.url);
  const gameId = searchParams.get('gameId') as GameId | null;
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '10'), 50);

  if (!gameId) {
    return NextResponse.json({ error: 'gameId requerido' }, { status: 400 });
  }

  const entries = await getLeaderboard(gameId, limit);
  return NextResponse.json(entries, {
    headers: {
      // Cache de 30 segundos — el ranking no cambia con cada request
      'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
    },
  });
}

export async function POST(req: NextRequest): Promise<NextResponse<{ success: boolean; error?: string }>> {
  let body: Partial<GameResult>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: 'JSON inválido' }, { status: 400 });
  }

  const { gameId, playerName, score, level, duration } = body;

  if (!gameId || !playerName || score === undefined) {
    return NextResponse.json(
      { success: false, error: 'Campos requeridos: gameId, playerName, score' },
      { status: 400 }
    );
  }

  // Sanear entrada: nombre máx 20 chars, score no negativo
  const sanitized: GameResult = {
    gameId,
    playerName: String(playerName).slice(0, 20).trim(),
    score: Math.max(0, Number(score)),
    level: Math.max(1, Number(level ?? 1)),
    duration: Math.max(0, Number(duration ?? 0)),
    combo: 0,
    timestamp: new Date().toISOString(),
  };

  const ok = await saveScore(sanitized);
  if (!ok) {
    return NextResponse.json(
      { success: false, error: 'Error guardando score (Supabase no configurado)' },
      { status: 503 }
    );
  }

  return NextResponse.json({ success: true });
}

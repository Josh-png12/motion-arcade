/**
 * lib/supabase.ts
 * Cliente de Supabase para el ranking online.
 *
 * DISEÑO: Singleton para reutilizar la conexión WebSocket
 * de Supabase. La tabla leaderboard tiene RLS habilitado
 * permitiendo INSERT y SELECT sin autenticación (anon key).
 *
 * Schema SQL necesario en Supabase:
 *
 * CREATE TABLE leaderboard (
 *   id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
 *   game_id TEXT NOT NULL,
 *   player_name TEXT NOT NULL CHECK (char_length(player_name) <= 20),
 *   score INTEGER NOT NULL DEFAULT 0,
 *   level INTEGER NOT NULL DEFAULT 1,
 *   duration INTEGER NOT NULL DEFAULT 0,
 *   created_at TIMESTAMPTZ DEFAULT NOW()
 * );
 *
 * -- Índice para consultas de ranking por juego
 * CREATE INDEX idx_leaderboard_game_score ON leaderboard(game_id, score DESC);
 *
 * -- RLS: cualquiera puede leer y escribir (feria universitaria)
 * ALTER TABLE leaderboard ENABLE ROW LEVEL SECURITY;
 * CREATE POLICY "Public read" ON leaderboard FOR SELECT USING (true);
 * CREATE POLICY "Public insert" ON leaderboard FOR INSERT WITH CHECK (true);
 */

import { createClient } from '@supabase/supabase-js';
import type { LeaderboardEntry, GameResult, GameId } from '@/types/game.types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

// Si no están configuradas las variables, devolvemos un cliente mock
// para que la app funcione sin Supabase durante desarrollo
let supabaseInstance: ReturnType<typeof createClient> | null = null;

export function getSupabase() {
  if (!supabaseInstance && supabaseUrl && supabaseAnonKey) {
    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey);
  }
  return supabaseInstance;
}

// Guarda resultado de una partida en el ranking
export async function saveScore(result: GameResult): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) {
    console.warn('[Supabase] No configurado — score no guardado');
    return false;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from('leaderboard').insert({
    game_id: result.gameId,
    player_name: result.playerName,
    score: result.score,
    level: result.level,
    duration: result.duration,
  });

  if (error) {
    console.error('[Supabase] Error guardando score:', error.message);
    return false;
  }
  return true;
}

// Obtiene el top 10 para un juego específico
export async function getLeaderboard(gameId: GameId, limit = 10): Promise<LeaderboardEntry[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('leaderboard')
    .select('*')
    .eq('game_id', gameId)
    .order('score', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[Supabase] Error obteniendo leaderboard:', (error as { message: string }).message);
    return [];
  }

  // Añadimos el rank calculado
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data as any[]) ?? []).map((entry: Record<string, unknown>, index: number) => ({
    ...entry,
    rank: index + 1,
  })) as LeaderboardEntry[];
}

// Obtiene la posición de un score específico para un juego
export async function getScoreRank(gameId: GameId, score: number): Promise<number> {
  const supabase = getSupabase();
  if (!supabase) return 0;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count, error } = await (supabase as any)
    .from('leaderboard')
    .select('*', { count: 'exact', head: true })
    .eq('game_id', gameId)
    .gt('score', score);

  if (error) return 0;
  return (count ?? 0) + 1;
}

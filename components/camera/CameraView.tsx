/**
 * components/camera/CameraView.tsx
 * Vista de cámara optimizada con:
 * - Flash en el borde cuando se detecta un gesto
 * - FPS de detección separado del FPS del juego
 * - Panel de debug con métricas y sliders de configuración
 * - Skeleton overlay con interpolación entre frames
 */

'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { useMediaPipe, type MediaPipeStatus } from '@/hooks/useMediaPipe';
import { useGestures } from '@/hooks/useGestures';
import { gestureDetector } from '@/gestures/detector';
import type { GestureEvent } from '@/types/gesture.types';

interface CameraViewProps {
  enabled?: boolean;
  /** Muestra skeleton, FPS de detección y panel de debug */
  showDebug?: boolean;
  onStatusChange?: (status: MediaPipeStatus) => void;
  className?: string;
}

// Colores de flash por tipo de gesto
const GESTURE_FLASH: Partial<Record<string, string>> = {
  JUMP:         'rgba(74,222,128,0.5)',   // verde
  CROUCH:       'rgba(251,191,36,0.5)',   // amarillo
  MOVE_LEFT:    'rgba(96,165,250,0.5)',   // azul
  MOVE_RIGHT:   'rgba(96,165,250,0.5)',
  SLICE_LEFT:   'rgba(248,113,113,0.6)',  // rojo
  SLICE_RIGHT:  'rgba(248,113,113,0.6)',
  LEFT_HAND_UP: 'rgba(167,139,250,0.5)', // violeta
  RIGHT_HAND_UP:'rgba(167,139,250,0.5)',
  BOTH_HANDS_UP:'rgba(251,113,133,0.6)', // rosa
};

export function CameraView({
  enabled = true,
  showDebug = false,
  onStatusChange,
  className = '',
}: CameraViewProps) {
  const videoRef    = useRef<HTMLVideoElement>(null);
  const overlayRef  = useRef<HTMLCanvasElement>(null);

  // Flash de gesto: color y si está activo
  const [flashColor, setFlashColor] = useState<string | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { status, error, detectionFps, processingMs } = useMediaPipe({
    videoRef,
    overlayCanvasRef: showDebug ? overlayRef : undefined,
    enabled,
  });

  useEffect(() => { onStatusChange?.(status); }, [status, onStatusChange]);

  // Suscribirse a gestos para el flash visual
  const onGestureFlash = useCallback((event: GestureEvent) => {
    const color = GESTURE_FLASH[event.type];
    if (!color) return;
    setFlashColor(color);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlashColor(null), 220);
  }, []);

  useGestures(onGestureFlash);

  // Limpiar timer al desmontar
  useEffect(() => () => {
    if (flashTimer.current) clearTimeout(flashTimer.current);
  }, []);

  return (
    <div
      className={`relative overflow-hidden rounded-xl ${className}`}
      style={{
        // Flash de borde: transición CSS ultra rápida
        boxShadow: flashColor ? `0 0 0 3px ${flashColor}, 0 0 20px ${flashColor}` : undefined,
        transition: 'box-shadow 80ms ease-out',
      }}
    >
      {/* Video espejado — display a 640x480, MediaPipe procesa a 320x240 internamente */}
      <video
        ref={videoRef}
        className="w-full h-full object-cover scale-x-[-1]"
        playsInline
        muted
        autoPlay
      />

      {/* Canvas overlay para skeleton (solo en modo debug) */}
      {showDebug && (
        <canvas
          ref={overlayRef}
          className="absolute inset-0 w-full h-full scale-x-[-1] pointer-events-none"
          style={{ opacity: 0.85 }}
        />
      )}

      {/* Flash overlay en el borde del área de video */}
      {flashColor && (
        <div
          className="absolute inset-0 pointer-events-none rounded-xl"
          style={{
            background: `radial-gradient(ellipse at center, transparent 60%, ${flashColor} 100%)`,
          }}
        />
      )}

      {/* Overlay de estado (loading, error, etc.) */}
      {status !== 'running' && <StatusOverlay status={status} error={error} />}

      {/* Barra superior: indicadores siempre visibles cuando está activo */}
      {status === 'running' && (
        <div className="absolute top-2 left-2 right-2 flex items-center justify-between">
          {/* Indicador LIVE */}
          <div className="flex items-center gap-1.5 bg-black/60 backdrop-blur-sm rounded px-2 py-1">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-green-400 font-mono text-xs">LIVE</span>
          </div>

          {/* FPS de detección */}
          {showDebug && (
            <div className="bg-black/60 backdrop-blur-sm rounded px-2 py-1 flex gap-3">
              <span className="text-green-400 font-mono text-xs">
                {detectionFps} fps
              </span>
              <span className="text-yellow-400 font-mono text-xs">
                {processingMs}ms
              </span>
            </div>
          )}
        </div>
      )}

      {/* Panel de debug con sliders (solo en modo debug y corriendo) */}
      {showDebug && status === 'running' && <DebugPanel />}
    </div>
  );
}

// ── Overlay de estado ───────────────────────────────────────────────────────

function StatusOverlay({ status, error }: { status: MediaPipeStatus; error: string | null }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm rounded-xl">
      {status === 'loading' && (
        <>
          <div className="w-10 h-10 border-4 border-green-400 border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-green-400 font-mono text-sm">Iniciando MediaPipe...</p>
          <p className="text-gray-400 text-xs mt-1 text-center px-4">
            Descargando modelo lite (~3MB)
          </p>
        </>
      )}
      {status === 'no_camera' && (
        <>
          <span className="text-4xl mb-3">📷</span>
          <p className="text-red-400 font-bold text-center px-4">Permiso de cámara denegado</p>
          <p className="text-gray-400 text-xs mt-2 text-center px-4">
            Activa la cámara en ajustes del navegador y recarga
          </p>
        </>
      )}
      {status === 'error' && (
        <>
          <span className="text-4xl mb-3">⚠️</span>
          <p className="text-red-400 font-bold">Error de cámara</p>
          <p className="text-gray-400 text-xs mt-2 text-center px-4">{error}</p>
        </>
      )}
      {status === 'idle' && (
        <p className="text-gray-600 font-mono text-sm">Cámara inactiva</p>
      )}
    </div>
  );
}

// ── Panel de debug con sliders ──────────────────────────────────────────────

function DebugPanel() {
  const metrics = gestureDetector.getMetrics();

  const [open, setOpen]         = useState(false);
  const [debounce, setDebounce] = useState(80);
  const [smoothing, setSmoothing] = useState(3);
  const [confidence, setConfidence] = useState(50);

  function apply() {
    gestureDetector.updateConfig({
      debounceMs:     debounce,
      smoothingFrames: smoothing,
      minConfidence:   confidence / 100,
    });
  }

  // Indicador de confianza de pose (siempre visible en debug)
  const conf = Math.round(metrics.poseConfidence * 100);
  const confColor = conf > 70 ? 'text-green-400' : conf > 40 ? 'text-yellow-400' : 'text-red-400';

  return (
    <div className="absolute bottom-2 left-2 right-2">
      {/* Barra de confianza siempre visible */}
      <div className="flex items-center gap-2 mb-1">
        <div className="flex-1 h-1 bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-200"
            style={{
              width: `${conf}%`,
              background: conf > 70 ? '#4ade80' : conf > 40 ? '#facc15' : '#f87171',
            }}
          />
        </div>
        <span className={`font-mono text-xs ${confColor}`}>{conf}%</span>
      </div>

      {/* Toggle del panel */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full text-xs font-mono text-gray-500 hover:text-gray-300 bg-black/40 rounded py-0.5 transition-colors"
      >
        {open ? '▲ cerrar config' : '▼ ajustar detección'}
      </button>

      {open && (
        <div className="mt-1 bg-black/80 backdrop-blur-sm rounded-lg p-3 space-y-3">
          <Slider
            label="Debounce"
            value={debounce}
            min={40} max={200} step={10}
            unit="ms"
            onChange={setDebounce}
          />
          <Slider
            label="Suavizado"
            value={smoothing}
            min={1} max={6} step={1}
            unit=" frames"
            onChange={setSmoothing}
          />
          <Slider
            label="Confianza mín."
            value={confidence}
            min={30} max={80} step={5}
            unit="%"
            onChange={setConfidence}
          />
          <button
            onClick={apply}
            className="w-full py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded transition-colors"
          >
            Aplicar
          </button>
        </div>
      )}
    </div>
  );
}

function Slider({
  label, value, min, max, step, unit, onChange,
}: {
  label: string; value: number; min: number; max: number;
  step: number; unit: string; onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex justify-between mb-1">
        <span className="text-gray-400 text-xs font-mono">{label}</span>
        <span className="text-white text-xs font-mono">{value}{unit}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full h-1 accent-indigo-500 cursor-pointer"
      />
    </div>
  );
}

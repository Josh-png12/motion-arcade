/**
 * hooks/useMediaPipe.ts
 * MediaPipe Pose optimizado para latencia mínima (<50ms).
 *
 * OPTIMIZACIONES:
 * 1. modelComplexity 0 (lite): ~8-15ms vs ~20-40ms del full model
 * 2. Canvas de proceso interno 320x240: el video se muestra a 640x480,
 *    MediaPipe recibe frames reducidos — menos píxeles = inferencia más rápida.
 * 3. FPS calculado con setInterval (no setState en cada frame).
 * 4. Frame skipping: si el frame anterior aún procesa, salta el actual.
 * 5. Canvas de overlay redimensionado UNA sola vez (no en cada onResults).
 * 6. Cleanup completo: para tracks del stream y cancela RAF.
 */

'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { gestureDetector, type Landmark } from '@/gestures/detector';

export type MediaPipeStatus = 'idle' | 'loading' | 'running' | 'error' | 'no_camera';

// Resolución del canvas interno que MediaPipe procesa.
// El video se muestra a 640x480 pero la inferencia corre en 320x240.
const PROCESS_W = 320;
const PROCESS_H = 240;

interface UseMediaPipeOptions {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  /** Canvas opcional para dibujar el skeleton (overlay). Solo si showDebug=true. */
  overlayCanvasRef?: React.RefObject<HTMLCanvasElement | null>;
  enabled?: boolean;
}

interface UseMediaPipeReturn {
  status: MediaPipeStatus;
  error: string | null;
  /** FPS del loop de detección (actualizado 1 vez/segundo) */
  detectionFps: number;
  /** Tiempo de procesamiento del último frame en ms */
  processingMs: number;
}

export function useMediaPipe({
  videoRef,
  overlayCanvasRef,
  enabled = true,
}: UseMediaPipeOptions): UseMediaPipeReturn {
  const [status, setStatus]       = useState<MediaPipeStatus>('idle');
  const [error, setError]         = useState<string | null>(null);
  const [detectionFps, setDetectionFps] = useState(0);
  const [processingMs, setProcessingMs] = useState(0);

  // Refs: no causan re-renders al actualizarse
  const poseRef       = useRef<unknown>(null);
  const cameraRef     = useRef<unknown>(null);
  const streamRef     = useRef<MediaStream | null>(null);
  const isProcessing  = useRef(false);
  const frameCount    = useRef(0);
  const lastFrameMs   = useRef(0);
  const overlayReady  = useRef(false); // canvas de overlay ya dimensionado

  const cleanup = useCallback(() => {
    // Detener la cámara utility de MediaPipe
    const cam = cameraRef.current as { stop?: () => void } | null;
    cam?.stop?.();
    cameraRef.current = null;
    poseRef.current   = null;

    // Detener todos los tracks del stream (apaga la luz de cámara)
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;

    isProcessing.current = false;
    overlayReady.current = false;
  }, []);

  useEffect(() => {
    if (!enabled) {
      cleanup();
      setStatus('idle');
      return;
    }

    let cancelled = false;

    async function init() {
      setStatus('loading');

      try {
        // ── 1. Solicitar cámara a 640x480 (calidad de display) ──────────
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'user',
            width:  { ideal: 640, max: 1280 },
            height: { ideal: 480, max: 720  },
            frameRate: { ideal: 60, min: 30 }, // pedir 60fps; acepta 30
          },
          audio: false,
        });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }

        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();

        // ── 2. Canvas interno de proceso (320x240, off-screen) ──────────
        const processCanvas = document.createElement('canvas');
        processCanvas.width  = PROCESS_W;
        processCanvas.height = PROCESS_H;
        const processCtx = processCanvas.getContext('2d', { willReadFrequently: false })!;

        // ── 3. Importar MediaPipe dinámicamente (evita SSR) ─────────────
        const { Pose, POSE_CONNECTIONS } = await import('@mediapipe/pose');
        const { Camera }                 = await import('@mediapipe/camera_utils');
        const { drawConnectors, drawLandmarks } = await import('@mediapipe/drawing_utils');
        if (cancelled) return;

        // ── 4. Configurar Pose — modelo LITE para mínima latencia ───────
        const pose = new Pose({
          locateFile: (file: string) =>
            `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
        });

        pose.setOptions({
          modelComplexity: 0,          // 0=LITE ~8-15ms | 1=full ~20-40ms | 2=heavy
          smoothLandmarks: true,       // suavizado interno de MediaPipe
          enableSegmentation: false,   // no necesitamos máscara de fondo
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });

        // ── 5. Callback de resultados ────────────────────────────────────
        pose.onResults((results: { poseLandmarks?: Landmark[] }) => {
          if (cancelled) return;

          const frameEnd = performance.now();
          lastFrameMs.current = frameEnd - lastFrameMs.current; // duración real del frame
          isProcessing.current = false;
          frameCount.current++;

          // Alimentar detector de gestos (siempre, sin condición de debug)
          gestureDetector.processPoseLandmarks(results.poseLandmarks ?? null);

          // Dibujar skeleton en overlay canvas (solo si está montado)
          const canvas = overlayCanvasRef?.current;
          if (canvas && results.poseLandmarks) {
            // Dimensionar el canvas una sola vez (evita reflow en cada frame)
            if (!overlayReady.current) {
              canvas.width  = video.videoWidth  || 640;
              canvas.height = video.videoHeight || 480;
              overlayReady.current = true;
            }
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.clearRect(0, 0, canvas.width, canvas.height);
              drawConnectors(ctx, results.poseLandmarks, POSE_CONNECTIONS, {
                color: '#00ff88', lineWidth: 2,
              });
              drawLandmarks(ctx, results.poseLandmarks, {
                color: '#ff0088', lineWidth: 1, radius: 3,
              });
            }
          }
        });

        poseRef.current = pose;

        // ── 6. Camera utility: frame loop de MediaPipe ──────────────────
        // onFrame recibe el video y nosotros lo escalamos ANTES de enviar.
        // El Camera se configura a 640x480 (display), pero MediaPipe
        // procesa el canvas de 320x240 que dibujamos aquí.
        const camera = new Camera(video, {
          onFrame: async () => {
            // Frame skipping: si el anterior aún está en proceso, saltar
            if (isProcessing.current) return;
            isProcessing.current = true;
            lastFrameMs.current  = performance.now();

            // Escalar el frame del video a la resolución de proceso
            processCtx.drawImage(video, 0, 0, PROCESS_W, PROCESS_H);

            const p = poseRef.current as {
              send?: (o: { image: HTMLCanvasElement }) => Promise<void>
            } | null;
            if (p?.send) await p.send({ image: processCanvas });
          },
          width: 640,
          height: 480,
        });

        cameraRef.current = camera;
        await camera.start();
        if (!cancelled) setStatus('running');

        // ── 7. Actualizar FPS y latencia cada segundo (sin re-render/frame)
        const fpsInterval = setInterval(() => {
          if (cancelled) { clearInterval(fpsInterval); return; }
          setDetectionFps(frameCount.current);
          setProcessingMs(Math.round(lastFrameMs.current * 10) / 10);
          frameCount.current = 0;
        }, 1000);

        // Limpiar el intervalo cuando el effect se desmonta
        return () => clearInterval(fpsInterval);

      } catch (err) {
        if (cancelled) return;
        console.error('[MediaPipe]', err);
        if (err instanceof DOMException && err.name === 'NotAllowedError') {
          setStatus('no_camera');
          setError('Permiso de cámara denegado. Actívalo en ajustes del navegador.');
        } else {
          setStatus('error');
          setError(err instanceof Error ? err.message : 'Error iniciando cámara');
        }
      }
    }

    const cleanupInterval = init();

    return () => {
      cancelled = true;
      cleanup();
      // Cancelar el intervalo de FPS si init() lo devolvió
      cleanupInterval?.then?.(fn => fn?.());
    };
  }, [enabled, videoRef, overlayCanvasRef, cleanup]);

  return { status, error, detectionFps, processingMs };
}

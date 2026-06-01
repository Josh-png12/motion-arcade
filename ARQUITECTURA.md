# Arquitectura de Motion Arcade

## Diagrama general del sistema

```
┌─────────────────────────────────────────────────────────────────┐
│                    CELULAR DEL JUGADOR                          │
│                                                                 │
│  ┌─────────────┐    ┌─────────────────┐    ┌──────────────┐   │
│  │   Cámara    │───►│  MediaPipe Pose │───►│  Gesture     │   │
│  │  frontal    │    │  (WebAssembly)  │    │  Detector    │   │
│  └─────────────┘    └─────────────────┘    └──────┬───────┘   │
│                                                   │            │
│  ┌─────────────────────────────────────────────────▼───────┐  │
│  │              JUEGO (Phaser.js en canvas)                 │  │
│  │  Fruit Slash / Pong Motion / Dodge Runner / Simon Motion │  │
│  └─────────────────────────────────────────────────────────┘  │
│                              │                                  │
│                    POST /api/pusher                             │
│                              │                                  │
└──────────────────────────────┼──────────────────────────────────┘
                               │
                   ┌───────────▼──────────────┐
                   │    Vercel (Next.js API)   │
                   │   /api/pusher route.ts    │
                   └───────────┬──────────────┘
                               │
                   ┌───────────▼──────────────┐
                   │   Pusher Channels Cloud   │
                   │   Canal: "game-events"    │
                   └───────────┬──────────────┘
                               │  WebSocket
                   ┌───────────▼──────────────┐
                   │      ESP32 DevKit V1      │
                   │                          │
                   │  🟢 GPIO2  LED Verde      │
                   │  🔵 GPIO5  LED Azul       │
                   │  🟡 GPIO18 LED Amarillo   │
                   │  🔴 GPIO4  LED Rojo       │
                   └──────────────────────────┘

                   ┌──────────────────────────┐
                   │        Supabase          │
                   │   Tabla: leaderboard     │◄── POST /api/leaderboard
                   └──────────────────────────┘
```

## Diagrama de capas del frontend

```
┌────────────────────────────────────────────────────────────┐
│                    CAPA DE PRESENTACIÓN                    │
│   app/page.tsx (menú)  ·  app/game/[gameId]/page.tsx       │
│   components/ui/  ·  components/camera/  ·  components/games/ │
└─────────────────────────────┬──────────────────────────────┘
                              │
┌─────────────────────────────▼──────────────────────────────┐
│                    CAPA DE HOOKS                            │
│  useMediaPipe · useGestures · usePusher · useGame          │
└────────────────────┬────────────────────┬──────────────────┘
                     │                    │
        ┌────────────▼──────┐  ┌─────────▼──────────────┐
        │  CAPA DE GESTOS   │  │   CAPA DE JUEGOS        │
        │  gestures/        │  │   games/*/              │
        │  detector.ts      │  │   BaseGame.ts           │
        │  types.ts         │  │   FruitSlashGame.ts     │
        └────────────┬──────┘  │   PongMotionGame.ts     │
                     │         │   DodgeRunnerGame.ts    │
        ┌────────────▼──────┐  │   SimonMotionGame.ts   │
        │  MEDIAPIPE WASM   │  └─────────────────────────┘
        │  (CDN jsdelivr)   │
        └───────────────────┘
```

## Flujo de datos de un frame de cámara

```
60fps
  │
  ▼
Video element
  │  (src = getUserMedia stream)
  ▼
MediaPipe Camera
  │  (llama send() por frame)
  ▼
MediaPipe Pose.send()
  │  (inferencia WebAssembly ~8ms en móvil moderno)
  ▼
pose.onResults()
  │  landmarks: [{x,y,z,visibility}, ...×33]
  ▼
GestureDetector.processPoseLandmarks()
  │  Aplica reglas de umbral y debounce
  ▼
GestureEvent[] emitted
  │  {type:'JUMP', timestamp:..., ...}
  ▼
BaseGame.handleGestureEvent()
  │  Llama a onGestureEvent() del juego hijo
  ▼
FruitSlashGame.onGestureEvent()
  │  Lógica específica del juego
  ▼
callbacks.onScore() / onLoseLife()
  │
  ▼
useGame hook (React state)
  │  +  usePusher hook
  ▼
POST /api/pusher
  ▼
Pusher → ESP32 WebSocket → LED animation
```

## Flujo de inicio de un juego

```
Usuario selecciona juego
       │
       ▼
/game/[gameId] page.tsx
       │
       ├── Monta CameraView (solicita permiso de cámara)
       │         │
       │         └── useMediaPipe → inicia MediaPipe
       │
       ├── Muestra GestureInstructions
       │         │
       │         └── gestureState.playerDetected → cuenta regresiva 3s
       │
       ▼
  Jugador en posición → handleReady()
       │
       ├── startGame() → gameState.status = 'playing'
       ├── triggerEvent('game_start') → ESP32 LED azul
       │
       └── Monta GameController → PhaserGame → carga SceneClass
```

## Gestión de estado

```
React State (useGame):
  gameState: { score, lives, level, combo, timeElapsed, status }
       ↑
  addScore() · loseLife() · nextLevel() · endGame()
       ↑
  callbacks de BaseGame (llamados desde Phaser)
       ↑
  Lógica del juego (FruitSlashGame, etc.)

GestureDetector (singleton):
  Independiente del ciclo de React
  Se actualiza cada frame de cámara
  Los hooks se suscriben via onGesture()
```

## Decisiones de diseño clave

### ¿Por qué singleton para GestureDetector?
El detector procesa datos de cámara a 30-60fps. Si fuera un estado de React,
cada frame dispararía re-renders costosos. Al ser un singleton imperativo,
solo notifica a los suscriptores cuando cambia algo relevante.

### ¿Por qué Pusher en lugar de WebSocket directo?
Pusher maneja la reconexión automática, el protocolo de subscripción y
la presencia en múltiples dispositivos. Para el ESP32, el cliente WebSocket
es simple ya que el protocolo de Pusher está bien documentado.

### ¿Por qué Phaser.js y no Three.js o Canvas puro?
Phaser incluye física de arcade, gestión de escenas, sistema de tweens y
partículas listos para usar. Para juegos 2D es más productivo que Canvas puro.
Three.js sería excesivo para estos juegos 2D.

### ¿Por qué MediaPipe Pose y no TensorFlow.js?
MediaPipe Pose está optimizado para detección de poses en tiempo real,
incluye el modelo preentrenado y tiene WebAssembly acelerado. TF.js requiere
entrenar o adaptar modelos propios para esta tarea.

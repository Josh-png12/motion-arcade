# Motion Arcade 🎮

> Plataforma web de videojuegos controlados por movimientos corporales.
> Sin apps nativas. Solo tú, la cámara del celular y tu cuerpo.

[![Next.js](https://img.shields.io/badge/Next.js-15-black)](https://nextjs.org)
[![MediaPipe](https://img.shields.io/badge/MediaPipe-Pose-blue)](https://mediapipe.dev)
[![Phaser](https://img.shields.io/badge/Phaser-3-orange)](https://phaser.io)
[![Pusher](https://img.shields.io/badge/Pusher-Channels-purple)](https://pusher.com)

---

## ¿Qué es?

Motion Arcade detecta movimientos corporales con la cámara del celular
(MediaPipe Pose) y los convierte en controles de videojuego. Los juegos
corren directamente en el navegador con Phaser.js, y un ESP32 con LEDs
indica el estado del juego en tiempo real vía Pusher WebSocket.

## Juegos incluidos

| Juego | Control | Dificultad |
|-------|---------|-----------|
| 🍎 **Fruit Slash** | Mueve las manos para cortar frutas | Fácil |
| 🏓 **Pong Motion** | Mano arriba/abajo controla la paleta | Fácil |
| 🏃 **Dodge Runner** | Mueve tu cuerpo para esquivar obstáculos | Medio |
| 🎯 **Simon Motion** | Repite secuencias de poses corporales | Difícil |

## Tecnologías

- **Frontend**: Next.js 15 + React + TypeScript + TailwindCSS
- **Visión Artificial**: MediaPipe Pose (ejecución local en el navegador)
- **Motor de Juegos**: Phaser.js 3
- **Comunicación Tiempo Real**: Pusher Channels (plan Sandbox gratuito)
- **Base de Datos**: Supabase (ranking online, plan gratuito)
- **Hardware**: ESP32 DevKit V1 + 4 LEDs + resistencias 220Ω

## Instalación rápida

```bash
# 1. Instalar dependencias
npm install

# 2. Configurar variables de entorno
# Editar .env.local con tus credenciales de Pusher y Supabase

# 3. Ejecutar en desarrollo
npm run dev

# 4. Abrir en el celular (reemplaza con tu IP local)
# http://192.168.x.x:3000
```

Consulta [INSTALACION.md](INSTALACION.md) para instrucciones completas.

## Estructura del proyecto

```
motion-arcade/
├── app/                     # Next.js App Router
│   ├── api/pusher/          # Trigger eventos al ESP32
│   ├── api/leaderboard/     # Ranking con Supabase
│   └── game/[gameId]/       # Página dinámica de cada juego
├── components/
│   ├── camera/              # CameraView + MediaPipe
│   ├── games/               # PhaserGame wrapper
│   ├── gestures/            # Visualizador de gestos
│   └── ui/                  # HUD, GameOver, instrucciones
├── games/
│   ├── base/                # BaseGame (clase Phaser padre)
│   ├── fruit-slash/         # Juego Fruit Slash
│   ├── pong-motion/         # Juego Pong Motion
│   ├── dodge-runner/        # Juego Dodge Runner
│   └── simon-motion/        # Juego Simon Motion
├── gestures/                # MediaPipe → GestureEvents
├── hooks/                   # useMediaPipe, usePusher, useGestures, useGame
├── lib/                     # pusher.ts, supabase.ts, gameRegistry.ts
├── types/                   # TypeScript estricto
└── esp32/firmware/          # Firmware Arduino para ESP32
    ├── motion_arcade_esp32.ino
    ├── config.h
    ├── led_controller.h
    └── pusher_client.h
```

## Conexiones ESP32

```
GPIO 2  → R220Ω → LED VERDE    → GND  (sistema listo)
GPIO 4  → R220Ω → LED ROJO     → GND  (error / game over)
GPIO 5  → R220Ω → LED AZUL     → GND  (juego activo)
GPIO 18 → R220Ω → LED AMARILLO → GND  (score / combo)
```

## Agregar un nuevo juego

1. Crear `games/mi-juego/MiJuegoGame.ts` extendiendo `BaseGame`
2. Implementar: `preloadAssets()`, `initGame()`, `updateGame()`, `onGestureEvent()`
3. Agregar metadata en `lib/gameRegistry.ts`
4. Importar en `components/games/GameController.tsx`

Ver [GESTOS.md](GESTOS.md) para referencia de gestos disponibles.

---

Proyecto desarrollado para Feria Universitaria 2026.

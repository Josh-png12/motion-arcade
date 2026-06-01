# Firmware ESP32 — Motion Arcade v2.0

> Firmware con configuración WiFi/Pusher sin credenciales hardcodeadas.
> Primera vez: conectar, escanear QR del portal, configurar y listo.
> Siguientes veces: enciende y se conecta automáticamente.

---

## Hardware necesario

| Componente | Cantidad | Especificación |
|------------|----------|----------------|
| ESP32 DevKit V1 | 1 | 38 pines, cualquier fabricante |
| Protoboard | 1 | 830 puntos |
| LED Verde | 1 | 5mm |
| LED Rojo | 1 | 5mm |
| LED Azul | 1 | 5mm |
| LED Amarillo | 1 | 5mm |
| Resistencia | 4 | 220Ω (rojo-rojo-marrón) |
| Cable USB | 1 | Micro-USB (para programar y alimentar) |
| Cables M-M | 10+ | Para protoboard |

---

## Esquema de conexiones

```
ESP32 DevKit V1
┌──────────────────────────────────────┐
│  GPIO2  ──►──[220Ω]──►──[🟢 VERDE  ]──► GND │
│  GPIO4  ──►──[220Ω]──►──[🔴 ROJO   ]──► GND │
│  GPIO5  ──►──[220Ω]──►──[🔵 AZUL   ]──► GND │
│  GPIO18 ──►──[220Ω]──►──[🟡 AMARILLO]─► GND │
│  GPIO0  ── Botón BOOT (integrado)            │
│  GND    ──► Rail (-) del protoboard          │
└──────────────────────────────────────┘

► = Ánodo del LED (pata LARGA)
[220Ω] = Resistencia limitadora
GND = Cátodo del LED (pata CORTA)
```

---

## LEDs — Significado

| LED | Pin | Estado del sistema | Evento de juego |
|-----|-----|--------------------|-----------------|
| 🟢 Verde parpadeando lento | 2 | **Modo AP activo** — portal de config abierto | — |
| 🟢 Verde fijo | 2 | Conectado a WiFi | `player_ready` |
| 🔵 Azul fijo | 5 | — | `game_start` |
| 🟡 Amarillo parpadeo | 18 | — | `score` / `combo` |
| 🔴 Rojo parpadeo rápido | 4 | Error / sin WiFi | `game_over` / `error` |
| 🔴+🟢 alternando | 4+2 | Reset en progreso | — |

---

## Instalación del entorno

### 1. Arduino IDE 2.x
Descargar desde [arduino.cc/en/software](https://www.arduino.cc/en/software)

### 2. Soporte para ESP32
`File → Preferences → Additional boards manager URLs`:
```
https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
```
`Tools → Board → Boards Manager → buscar "esp32" → instalar`

### 3. Librerías (Tools → Manage Libraries)

| Librería | Autor | Versión |
|----------|-------|---------|
| **WiFiManager** | tzapu / tablatronics | 2.0.17+ |
| **WebSockets** | Markus Sattler | 2.4.0+ |
| **ArduinoJson** | Benoit Blanchon | 6.x |
| Preferences | (incluida en ESP32 core) | — |

> Al buscar WiFiManager, asegúrate de seleccionar el de **tzapu**, no otros forks.

---

## Flashear el ESP32

1. Conectar el ESP32 por USB
2. `Tools → Board → ESP32 Dev Module`
3. `Tools → Port → COM X` (Windows) o `/dev/ttyUSB0` (Linux/Mac)
4. Configuración recomendada:
   - Upload Speed: `115200`
   - Flash Size: `4MB (32Mb)`
   - CPU Frequency: `240MHz`
5. Abrir `esp32/firmware/motion_arcade_esp32.ino`
6. **Upload** → esperar a que termine

> No hay que editar `config.h` para poner credenciales WiFi.
> Todo se configura a través del portal web la primera vez.

---

## Primera configuración (diagrama de flujo)

```
┌─────────────────────────────────────────────────────────────┐
│                    PRIMERA VEZ                              │
└─────────────────────────────────────────────────────────────┘

Encender ESP32
      │
      ▼
Secuencia LED de prueba (barrido de LEDs)
      │
      ▼
¿Botón BOOT presionado? ──SÍ──► Esperar 3s ──► Borrar config ──► Reiniciar
      │ NO
      ▼
¿Hay credenciales WiFi guardadas?
      │
    NO ─────────────────────────────────────────────────────┐
      │                                                     │
      ▼                                                     ▼
Crear Access Point                              Conectar a red guardada
"MotionArcade-Setup" / "arcade2024"                        │
      │                                                     │
🟢 LED verde parpadeo lento                        ¿Conectó?
      │                                          SÍ │    NO │
Serial muestra:                                    │        ▼
"Conecta tu celular..."                            │   Portal AP (idem izq.)
      │
      ▼
Usuario conecta celular a "MotionArcade-Setup"
      │
      ▼
Abre 192.168.4.1 en el navegador
      │
      ▼
Portal muestra:
  ┌─────────────────────────────────┐
  │  Motion Arcade — Config WiFi    │
  │                                 │
  │  Red WiFi:    [____________]    │
  │  Contraseña:  [____________]    │
  │                                 │
  │  Pusher App Key:                │
  │  [49dadffc1e88101d33da    ]     │  ← Pre-relleno
  │                                 │
  │  Pusher Cluster:                │
  │  [us2                    ]     │  ← Pre-relleno
  │                                 │
  │  [        Guardar        ]      │
  └─────────────────────────────────┘
      │
      ▼
ESP32 guarda credenciales en flash y conecta
      │
      ▼
🟢 LED verde fijo (1s) → apagado
      │
      ▼
Pusher WebSocket conectado
      │
      ▼
🟢 LED verde fijo (señal de "listo")
      │
      ▼
Sistema operativo — esperando eventos del juego
```

---

## Usos siguientes (ya configurado)

```
Encender ESP32
      │
      ▼
Leer credenciales WiFi y Pusher desde flash
      │
      ▼
Conectar automáticamente en ~3 segundos
      │
      ▼
Pusher conectado → listo para recibir eventos
```

No hay nada que hacer. Solo encender.

---

## Resetear credenciales (cambiar WiFi)

### Método: Botón BOOT físico

1. Con el ESP32 **apagado**, mantener presionado el botón **BOOT** (GPIO0)
2. Conectar el USB (encender)
3. Los LEDs empiezan a **alternar rojo/verde**
4. Mantener presionado **3 segundos** hasta que todos los LEDs parpadeen rápido
5. Soltar — el ESP32 borra la config y reinicia en modo AP

### En la feria universitaria: cambiar al WiFi del lugar

1. Seguir el método anterior (reset con BOOT)
2. Conectar al AP `MotionArcade-Setup`
3. Ingresar la red y contraseña del WiFi de la feria
4. Los campos de Pusher ya vienen pre-rellenos — no hay que cambiarlos
5. Guardar → listo

> Tiempo estimado del proceso: **menos de 2 minutos**

---

## Verificar funcionamiento (Serial Monitor)

`Tools → Serial Monitor → 115200 baud`

### Primera vez (modo AP):
```
╔═══════════════════════════════════╗
║   Motion Arcade — ESP32 FW v2.0   ║
║   Feria Universitaria 2026        ║
╚═══════════════════════════════════╝
[LED] 4 pines configurados
[LED] Secuencia de prueba...
[Prefs] Pusher Key:     49dadffc1e88101d33da
[Prefs] Pusher Cluster: us2

╔══════════════════════════════════════════╗
║   MODO CONFIGURACION ACTIVO              ║
║  Red WiFi : MotionArcade-Setup           ║
║  Password : arcade2024                   ║
║  Abrir    : 192.168.4.1                  ║
╚══════════════════════════════════════════╝
```

### Tras configurar (arranque normal):
```
╔═══════════════════════════════════╗
║   Motion Arcade — ESP32 FW v2.0   ║
╚═══════════════════════════════════╝
[Prefs] Pusher Key:     49dadffc1e88101d33da
[Prefs] Pusher Cluster: us2

╔══════════════════════════════════════════╗
║          WiFi CONECTADO                  ║
║  Red  : MiRedWiFi                        ║
║  IP   : 192.168.1.42                     ║
║  RSSI : -52 dBm                          ║
╚══════════════════════════════════════════╝

[Pusher] Conectando a ws-us2.pusher.com/app/...
[Pusher] WebSocket conectado
[Pusher] -> suscribiendome a game-events
[Pusher] Suscrito a canal: game-events
[Setup] Inicializacion completa — esperando eventos del juego...
```

### Durante el juego:
```
[Pusher] <- game_start
[Pusher] <- score
[Pusher] <- combo!
[Pusher] <- game_over
```

### Reset con BOOT:
```
[Reset] Boton BOOT detectado — mantener 3s para borrar config...
[Reset] 1500 / 3000 ms...
[Reset] *** BORRANDO CONFIGURACION ***
[Prefs] Credenciales Pusher borradas — usando defaults
[Reset] Listo — reiniciando en modo configuracion...
```

---

## Solución de problemas

| Síntoma | Causa probable | Solución |
|---------|---------------|----------|
| No aparece "MotionArcade-Setup" | El ESP32 tiene red guardada | Resetear con BOOT |
| Portal 192.168.4.1 no abre | Celular no conectó al AP | Desactivar datos móviles y reconectar |
| LED verde nunca se enciende fijo | Red WiFi 5GHz | El ESP32 solo soporta 2.4GHz |
| "No recibe eventos del juego" | Pusher key/cluster incorrectos | Resetear y reconfigurar campos Pusher |
| Error de compilación | Librería WiFiManager no instalada | Instalar **WiFiManager by tzapu** |
| Puerto COM no aparece | Driver USB faltante | Instalar CP210x o CH340 según la placa |
| LED rojo infinito en loop | Contraseña WiFi incorrecta | Resetear y reconfigurar |

---

## Archivos del firmware

| Archivo | Descripción |
|---------|-------------|
| `motion_arcade_esp32.ino` | Programa principal: setup, loop, WiFiManager, callbacks |
| `config.h` | Constantes estáticas (pines, nombres AP, timeouts) |
| `preferences_manager.h` | Lectura/escritura de credenciales Pusher en NVS flash |
| `led_controller.h` | Animaciones de LEDs no-bloqueantes |
| `pusher_client.h` | Cliente WebSocket Pusher con credenciales dinámicas |

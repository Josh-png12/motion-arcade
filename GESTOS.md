# Referencia de Gestos — Motion Arcade

## Arquitectura del sistema de gestos

```
Cámara → MediaPipe Pose → GestureDetector → GestureEvent → Juego
                                    ↓
                            GestureState (continuo)
```

El `GestureDetector` (en `gestures/detector.ts`) convierte landmarks
crudos de MediaPipe en eventos estandarizados que los juegos consumen.

## Eventos disponibles

### Eventos de estado del jugador

| Evento | Cuándo se emite |
|--------|----------------|
| `PLAYER_DETECTED` | Jugador entra en el campo de la cámara |
| `PLAYER_LOST` | Jugador sale del campo o baja visibilidad |

### Eventos de manos

| Evento | Condición | Uso típico |
|--------|-----------|-----------|
| `LEFT_HAND_UP` | Muñeca izquierda supera el hombro izquierdo | Activar objeto izquierdo |
| `RIGHT_HAND_UP` | Muñeca derecha supera el hombro derecho | Activar objeto derecho |
| `BOTH_HANDS_UP` | Ambas muñecas superan sus hombros | Acción especial / power-up |
| `HAND_POSITION` | Cada frame (continuo) | Controlar paleta, apuntar |
| `SLICE_LEFT` | Velocidad horizontal > umbral hacia izquierda | Golpe de slash |
| `SLICE_RIGHT` | Velocidad horizontal > umbral hacia derecha | Golpe de slash |
| `PUNCH_LEFT` | (reservado, pendiente de implementar) | Golpe de puño |
| `PUNCH_RIGHT` | (reservado) | Golpe de puño |

### Eventos corporales

| Evento | Condición | Umbral |
|--------|-----------|--------|
| `JUMP` | Centro de cadera sube >12% de la pantalla vs. base | Umbral calibrado primeros 30 frames |
| `CROUCH` | Centro de cadera baja >10% vs. base | — |
| `MOVE_LEFT` | Centro de cadera en X < 35% de pantalla | Zona izquierda |
| `MOVE_RIGHT` | Centro de cadera en X > 65% de pantalla | Zona derecha |

### Evento especial

| Evento | Uso |
|--------|-----|
| `POSE_MATCH` | Simon Motion — coincide pose esperada |

## GestureState (continuo)

El `GestureState` se actualiza cada frame y está disponible sin suscribirse a eventos:

```typescript
interface GestureState {
  playerDetected: boolean;
  leftHandPosition: { x: number; y: number } | null;  // 0-1 normalizado
  rightHandPosition: { x: number; y: number } | null;
  bodyPosition: { x: number; y: number } | null;
  isJumping: boolean;
  isCrouching: boolean;
  isMovingLeft: boolean;
  isMovingRight: boolean;
}
```

## Cómo usar los gestos en un juego

### Opción 1: Eventos discretos (mejor para acciones puntuales)

```typescript
// En tu escena Phaser, override onGestureEvent:
protected onGestureEvent(event: GestureEvent): void {
  if (event.type === 'JUMP') {
    this.doJump();
  }
  if (event.type === 'SLICE_LEFT') {
    this.checkSlice(event.leftHand?.x, event.leftHand?.y);
  }
}
```

### Opción 2: Estado continuo (mejor para movimiento suave)

```typescript
// En updateGame(), leer this.gestureState directamente:
protected updateGame(time: number, delta: number): void {
  if (this.gestureState.leftHandPosition) {
    const { x, y } = this.gestureState.leftHandPosition;
    this.playerSprite.x = x * this.scale.width;
  }
}
```

### Opción 3: Hook de React (para componentes fuera de Phaser)

```typescript
const { gestureState, lastEvent } = useGestures((event) => {
  if (event.type === 'LEFT_HAND_UP') {
    console.log('¡Mano izquierda arriba!');
  }
});
```

## Configuración del detector

Parámetros ajustables en `gestures/detector.ts`:

```typescript
const gestureDetector = new GestureDetector({
  minConfidence: 0.6,  // Umbral mínimo de visibilidad de landmark (0-1)
  debounceMs: 120,     // Tiempo mínimo entre eventos del mismo tipo
  debug: false,        // Mostrar landmarks en canvas
});
```

## Agregar un nuevo gesto

1. Agregar el tipo en `types/gesture.types.ts`:
```typescript
export type GestureEventType = 
  | ... 
  | 'MI_GESTO_NUEVO';
```

2. Implementar la detección en `gestures/detector.ts`:
```typescript
// Dentro de processPoseLandmarks():
if (/* condición basada en landmarks */) {
  this.emitDebounced('MI_GESTO_NUEVO', {
    type: 'MI_GESTO_NUEVO',
    timestamp: Date.now(),
  });
}
```

3. Usarlo en tu juego vía `onGestureEvent()`.

## Coordenadas de MediaPipe

```
(0,0) ──────────── (1,0)
  │                  │
  │   Campo cámara   │
  │   (espejado)     │
  │                  │
(0,1) ──────────── (1,1)
```

**Importante**: las coordenadas están espejadas horizontalmente para que
el movimiento del jugador sea intuitivo (mano derecha del jugador = x mayor).
El eje Y va de arriba (0) a abajo (1).

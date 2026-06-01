/**
 * led_controller.h
 * Controlador de LEDs con animaciones no-bloqueantes para Motion Arcade.
 *
 * DISEÑO: Usa millis() en lugar de delay() para que el ESP32 pueda
 * procesar WiFiManager, WebSocket y Serial de forma concurrente.
 *
 * Estados de LED según el sistema:
 *   Verde lento parpadeo  → Modo AP activo, esperando configuración
 *   Verde fijo            → Conectado a WiFi correctamente
 *   Azul fijo             → Juego en ejecución (evento game_start)
 *   Amarillo parpadeo     → Score / combo recibido
 *   Rojo parpadeo rápido  → Error / game_over / fallo de conexión
 */

#ifndef LED_CONTROLLER_H
#define LED_CONTROLLER_H

#include <Arduino.h>
#include "config.h"

class LedController {
private:
  struct BlinkState {
    bool          active       = false;
    int           count        = 0;       // 0 = infinito
    int           intervalMs   = 300;
    bool          currentState = false;
    unsigned long lastToggle   = 0;
  };

  BlinkState _blinks[4]; // índice: 0=verde, 1=rojo, 2=azul, 3=amarillo
  const int  _pins[4] = { LED_GREEN, LED_RED, LED_BLUE, LED_YELLOW };

  int pinToIndex(int pin) const {
    for (int i = 0; i < 4; i++) if (_pins[i] == pin) return i;
    return -1;
  }

public:
  void begin() {
    for (int i = 0; i < 4; i++) {
      pinMode(_pins[i], OUTPUT);
      digitalWrite(_pins[i], LOW);
    }
    Serial.println("[LED] 4 pines configurados");
  }

  // ── Control directo ────────────────────────────────
  void on(int pin) {
    int i = pinToIndex(pin);
    if (i < 0) return;
    _blinks[i].active = false;
    digitalWrite(pin, HIGH);
  }

  void off(int pin) {
    int i = pinToIndex(pin);
    if (i < 0) return;
    _blinks[i].active = false;
    digitalWrite(pin, LOW);
  }

  void allOff() {
    for (int i = 0; i < 4; i++) {
      _blinks[i].active = false;
      digitalWrite(_pins[i], LOW);
    }
  }

  void allOn() {
    for (int i = 0; i < 4; i++) {
      _blinks[i].active = false;
      digitalWrite(_pins[i], HIGH);
    }
  }

  // ── Parpadeo no-bloqueante ─────────────────────────
  // count=0 → infinito; count>0 → N parpadeos y apaga
  void blink(int pin, int intervalMs = BLINK_SLOW_MS, int count = 0) {
    int i = pinToIndex(pin);
    if (i < 0) return;
    _blinks[i] = { true, count * 2, intervalMs, false, millis() };
  }

  // Llama en cada iteración de loop() para animar los LEDs
  void update() {
    unsigned long now = millis();
    for (int i = 0; i < 4; i++) {
      BlinkState& b = _blinks[i];
      if (!b.active) continue;
      if (now - b.lastToggle < (unsigned long)b.intervalMs) continue;

      b.currentState = !b.currentState;
      digitalWrite(_pins[i], b.currentState ? HIGH : LOW);
      b.lastToggle = now;

      if (b.count > 0) {
        b.count--;
        if (b.count == 0) {
          b.active = false;
          digitalWrite(_pins[i], LOW);
        }
      }
    }
  }

  // ── Secuencias de estado ───────────────────────────

  // Barrido al iniciar (verificación visual del circuito)
  void testSequence() {
    Serial.println("[LED] Secuencia de prueba...");
    for (int rep = 0; rep < 2; rep++) {
      for (int i = 0; i < 4; i++) {
        digitalWrite(_pins[i], HIGH);
        delay(150);
        digitalWrite(_pins[i], LOW);
      }
    }
    allOn();
    delay(500);
    allOff();
    Serial.println("[LED] Secuencia completada");
  }

  // MODO AP: verde parpadeando lento → esperando configuración por portal
  void apMode() {
    allOff();
    blink(LED_GREEN, BLINK_SLOW_MS, 0); // infinito hasta que conecte
  }

  // CONECTANDO: verde rápido → intentando conectar a red guardada
  void connecting() {
    allOff();
    blink(LED_GREEN, 150, 0);
  }

  // CONECTADO: verde fijo breve → confirmación visual
  void connected() {
    allOff();
    on(LED_GREEN);
  }

  // RESET: alterna rojo/verde para indicar que se está borrando la config
  void resetFeedback(bool progress) {
    allOff();
    if (progress) {
      on(LED_RED);
    } else {
      on(LED_GREEN);
    }
  }

  // ERROR WIFI: rojo parpadeando rápido
  void wifiError() {
    allOff();
    blink(LED_RED, BLINK_FAST_MS, 0);
  }

  // ── Efectos de juego ──────────────────────────────

  void playerReady() {
    allOff();
    on(LED_GREEN);
  }

  void gameStart() {
    allOff();
    on(LED_BLUE);
  }

  void scoreEffect() {
    blink(LED_YELLOW, BLINK_FAST_MS, BLINK_COUNT);
  }

  void comboEffect() {
    blink(LED_YELLOW, 80, 6);
  }

  void gameOver() {
    allOff();
    blink(LED_RED, BLINK_FAST_MS, 5);
  }

  void errorEffect() {
    allOff();
    blink(LED_RED, BLINK_FAST_MS, 0);
  }
};

#endif // LED_CONTROLLER_H

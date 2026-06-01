/**
 * config.h
 * Constantes estáticas del firmware Motion Arcade v2.0.
 *
 * IMPORTANTE: Las credenciales WiFi y Pusher ya NO van aquí.
 * Se guardan en la flash del ESP32 (NVS) mediante WiFiManager y
 * la clase PreferencesManager. Solo hay que flashear una vez.
 *
 * =============================================
 * ESQUEMA DE CONEXIONES EN PROTOBOARD
 * =============================================
 *
 * ESP32 DevKit V1         Protoboard
 * ─────────────────────────────────────────────
 * Pin 2  (GPIO2)  ──→ R220Ω ──→ LED VERDE   ──→ GND
 * Pin 4  (GPIO4)  ──→ R220Ω ──→ LED ROJO    ──→ GND
 * Pin 5  (GPIO5)  ──→ R220Ω ──→ LED AZUL    ──→ GND
 * Pin 18 (GPIO18) ──→ R220Ω ──→ LED AMARILLO ─→ GND
 * Pin 0  (GPIO0)  ── BOOT button (ya integrado en la placa) ──→ GND
 * GND             ──→ Rail negativo del protoboard
 *
 * =============================================
 * LIBRERÍAS REQUERIDAS (Arduino Library Manager)
 * =============================================
 * - WiFiManager by tzapu          v2.0.17+
 *   Library Manager → buscar "WiFiManager" → autor tzapu/tablatronics
 *
 * - WebSocketsClient by Markus Sattler  v2.4.0+
 *   Library Manager → buscar "WebSockets" → autor Markus Sattler
 *
 * - ArduinoJson by Benoit Blanchon  v6.x
 *   Library Manager → buscar "ArduinoJson" → autor Benoit Blanchon
 *
 * Preferences.h viene incluida con el ESP32 Arduino core.
 *
 * Board: ESP32 Dev Module | Upload Speed: 115200 | Flash: 4MB
 * =============================================
 */

#ifndef CONFIG_H
#define CONFIG_H

// ── Pines de LEDs ──────────────────────────────────
#define LED_GREEN   2    // Verde:    sistema listo / AP configurado
#define LED_RED     4    // Rojo:     error / game over / fallo WiFi
#define LED_BLUE    5    // Azul:     juego en ejecución
#define LED_YELLOW  18   // Amarillo: score / combo / logro

// ── Botón de reset (pin BOOT del ESP32 DevKit V1) ──
// Mantener presionado RESET_HOLD_MS al encender → borra toda la config
#define BOOT_BUTTON_PIN  0
#define RESET_HOLD_MS    3000   // 3 segundos

// ── Portal de configuración WiFiManager ────────────
#define AP_SSID          "MotionArcade-Setup"
#define AP_PASSWORD      "arcade2024"
#define PORTAL_TIMEOUT_S 300    // 5 minutos: si nadie configura, reinicia

// ── Canal Pusher (fijo, no configurable por el usuario) ──
#define PUSHER_CHANNEL   "game-events"
#define PUSHER_PORT      80

// ── Valores por defecto de Pusher (pre-rellenos en el portal) ──
// El usuario los verá ya listos en el formulario de configuración.
#define PUSHER_KEY_DEFAULT     "49dadffc1e88101d33da"
#define PUSHER_CLUSTER_DEFAULT "us2"

// ── Namespace de Preferences en NVS flash ──────────
#define PREFS_NAMESPACE  "motion_arcade"
#define PREFS_KEY_PKEY   "pusher_key"
#define PREFS_KEY_PCLUST "pusher_clust"

// ── Timings ────────────────────────────────────────
#define BLINK_FAST_MS   100
#define BLINK_SLOW_MS   400
#define BLINK_COUNT       3
#define WIFI_CHECK_MS  5000   // Revisar estado WiFi cada 5s en loop()

// ── Serial ─────────────────────────────────────────
#define SERIAL_BAUD 115200

#endif // CONFIG_H

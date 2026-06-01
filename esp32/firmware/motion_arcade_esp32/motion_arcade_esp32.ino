// ============================================================
// Motion Arcade ESP32 v3.0
// - Intenta conectar a WiFi con WiFiManager
// - Si conecta: recibe eventos de Pusher y enciende LEDs
// - Si NO conecta: modo offline con animación automática de LEDs
// ============================================================
// CONEXIONES:
//   GPIO 2  → R220Ω → LED VERDE    → GND
//   GPIO 4  → R220Ω → LED ROJO     → GND
//   GPIO 5  → R220Ω → LED AZUL     → GND
//   GPIO 18 → R220Ω → LED AMARILLO → GND
//   GPIO 0  → Botón BOOT (reset de config)
// ============================================================
// LIBRERÍAS (instalar en Arduino Library Manager):
//   - WiFiManager by tzapu
//   - WebSockets by Markus Sattler
//   - ArduinoJson by Benoit Blanchon
// ============================================================

#include <WiFi.h>
#include <WiFiManager.h>
#include <WebSocketsClient.h>
#include <ArduinoJson.h>
#include <Preferences.h>

// ── PINES ──────────────────────────────────────────────────
#define LED_VERDE    2
#define LED_ROJO     4
#define LED_AZUL     5
#define LED_AMARILLO 18
#define BOOT_BUTTON  0

// ── CONFIGURACIÓN ──────────────────────────────────────────
#define AP_SSID          "MotionArcade-Setup"
#define AP_PASSWORD      "arcade2024"
#define PORTAL_TIMEOUT   90       // segundos esperando configuración
#define RESET_HOLD_MS    3000     // ms para factory reset
#define WIFI_CHECK_MS    5000     // ms entre chequeos de WiFi
#define SERIAL_BAUD      115200

// Pusher por defecto (se puede cambiar en el portal)
#define DEFAULT_PUSHER_KEY     "49dadffc1e88101d33da"
#define DEFAULT_PUSHER_CLUSTER "us2"

// ── VARIABLES GLOBALES ──────────────────────────────────────
WiFiManager wm;
WebSocketsClient wsClient;
Preferences prefs;

bool wifiConnected   = false;
bool pusherConnected = false;
bool offlineMode     = false;

unsigned long lastWifiCheck  = 0;
unsigned long lastOfflineTick = 0;
int offlineStep = 0;

String pusherKey     = DEFAULT_PUSHER_KEY;
String pusherCluster = DEFAULT_PUSHER_CLUSTER;

WiFiManagerParameter* paramKey     = nullptr;
WiFiManagerParameter* paramCluster = nullptr;

// ── CONTROL DE LEDS ────────────────────────────────────────
void ledsOff() {
  digitalWrite(LED_VERDE, LOW);
  digitalWrite(LED_ROJO, LOW);
  digitalWrite(LED_AZUL, LOW);
  digitalWrite(LED_AMARILLO, LOW);
}

void ledsOn() {
  digitalWrite(LED_VERDE, HIGH);
  digitalWrite(LED_ROJO, HIGH);
  digitalWrite(LED_AZUL, HIGH);
  digitalWrite(LED_AMARILLO, HIGH);
}

void blinkLed(int pin, int veces, int ms) {
  for (int i = 0; i < veces; i++) {
    digitalWrite(pin, HIGH); delay(ms);
    digitalWrite(pin, LOW);  delay(ms);
  }
}

void testSequence() {
  Serial.println("[LED] Secuencia de prueba...");
  int leds[] = {LED_VERDE, LED_AZUL, LED_AMARILLO, LED_ROJO};
  for (int i = 0; i < 4; i++) {
    digitalWrite(leds[i], HIGH); delay(200);
    digitalWrite(leds[i], LOW);
  }
  ledsOn(); delay(300); ledsOff();
  Serial.println("[LED] Secuencia completada");
}

// ── MODO OFFLINE: animación automática ─────────────────────
// Simula eventos de juego para que los LEDs se vean activos
void tickOfflineMode() {
  unsigned long now = millis();
  if (now - lastOfflineTick < 800) return;
  lastOfflineTick = now;

  ledsOff();

  switch (offlineStep) {
    case 0:
      digitalWrite(LED_VERDE, HIGH);           // Sistema listo
      break;
    case 1:
      digitalWrite(LED_VERDE, HIGH);
      digitalWrite(LED_AZUL, HIGH);            // Juego iniciado
      break;
    case 2:
      digitalWrite(LED_AZUL, HIGH);
      digitalWrite(LED_AMARILLO, HIGH);        // Punto anotado
      break;
    case 3:
      digitalWrite(LED_AZUL, HIGH);            // Sigue en juego
      break;
    case 4:
      digitalWrite(LED_AZUL, HIGH);
      digitalWrite(LED_AMARILLO, HIGH);        // Combo
      break;
    case 5:
      digitalWrite(LED_AZUL, HIGH);
      break;
    case 6:
      digitalWrite(LED_ROJO, HIGH);            // Game Over
      break;
    case 7:
      ledsOff();
      break;
    case 8:
      digitalWrite(LED_VERDE, HIGH);           // Listo de nuevo
      break;
  }

  offlineStep = (offlineStep + 1) % 9;
}

// ── EVENTO PUSHER → LEDS ───────────────────────────────────
void handleGameEvent(String event) {
  Serial.printf("[Pusher] Evento: %s\n", event.c_str());
  ledsOff();

  if (event == "player_ready") {
    digitalWrite(LED_VERDE, HIGH);
  }
  else if (event == "game_start") {
    digitalWrite(LED_VERDE, HIGH);
    digitalWrite(LED_AZUL, HIGH);
  }
  else if (event == "score") {
    digitalWrite(LED_AZUL, HIGH);
    blinkLed(LED_AMARILLO, 1, 150);
    digitalWrite(LED_AZUL, HIGH);
  }
  else if (event == "combo") {
    digitalWrite(LED_AZUL, HIGH);
    blinkLed(LED_AMARILLO, 3, 80);
    digitalWrite(LED_AZUL, HIGH);
  }
  else if (event == "game_over") {
    blinkLed(LED_ROJO, 4, 120);
    digitalWrite(LED_VERDE, HIGH);
  }
  else if (event == "error") {
    blinkLed(LED_ROJO, 6, 80);
    digitalWrite(LED_VERDE, HIGH);
  }
}

// ── WEBSOCKET PUSHER ───────────────────────────────────────
void onWebSocketEvent(WStype_t type, uint8_t* payload, size_t length) {
  switch (type) {
    case WStype_CONNECTED:
      pusherConnected = true;
      Serial.println("[Pusher] WebSocket conectado");
      digitalWrite(LED_VERDE, HIGH);
      // Suscribirse al canal
      wsClient.sendTXT("{\"event\":\"pusher:subscribe\",\"data\":{\"channel\":\"game-events\"}}");
      break;

    case WStype_DISCONNECTED:
      pusherConnected = false;
      Serial.println("[Pusher] WebSocket desconectado");
      break;

    case WStype_TEXT: {
      String msg = String((char*)payload);
      StaticJsonDocument<512> doc;
      if (deserializeJson(doc, msg) == DeserializationError::Ok) {
        String event = doc["event"] | "";
        if (event == "pusher:connection_established") {
          Serial.println("[Pusher] Conexion establecida");
        } else if (event.startsWith("pusher:")) {
          // Ignorar eventos internos de Pusher
        } else {
          // Evento del juego
          JsonVariant data = doc["data"];
          String gameEvent = "";
          if (data.is<JsonObject>()) {
            gameEvent = data["event"] | event;
          } else if (data.is<const char*>()) {
            StaticJsonDocument<256> inner;
            if (deserializeJson(inner, data.as<String>()) == DeserializationError::Ok) {
              gameEvent = inner["event"] | event;
            }
          }
          if (gameEvent.length() > 0) handleGameEvent(gameEvent);
        }
      }
      break;
    }
    default: break;
  }
}

void connectPusher() {
  String host = "ws-" + pusherCluster + ".pusher.com";
  String path = "/app/" + pusherKey + "?protocol=7&client=esp32&version=1.0&flash=false";
  Serial.printf("[Pusher] Conectando a %s%s\n", host.c_str(), path.c_str());
  wsClient.begin(host.c_str(), 80, path.c_str());
  wsClient.onEvent(onWebSocketEvent);
  wsClient.setReconnectInterval(5000);
}

// ── RESET DE CONFIGURACIÓN ─────────────────────────────────
void checkResetButton() {
  pinMode(BOOT_BUTTON, INPUT_PULLUP);
  if (digitalRead(BOOT_BUTTON) == HIGH) return;

  Serial.println("[Reset] Botón BOOT detectado — mantener 3s para borrar config...");
  unsigned long t = millis();
  bool confirmed = false;

  while (digitalRead(BOOT_BUTTON) == LOW) {
    bool toggle = ((millis() - t) / 200) % 2 == 0;
    ledsOff();
    if (toggle) digitalWrite(LED_ROJO, HIGH);
    else        digitalWrite(LED_VERDE, HIGH);
    delay(50);
    if (millis() - t >= RESET_HOLD_MS) { confirmed = true; break; }
  }

  if (!confirmed) { ledsOff(); return; }

  for (int i = 0; i < 6; i++) { ledsOn(); delay(120); ledsOff(); delay(120); }

  prefs.begin("motion", false);
  prefs.clear();
  prefs.end();
  wm.resetSettings();

  Serial.println("[Reset] Config borrada — reiniciando...");
  delay(1000);
  ESP.restart();
}

// ── CALLBACKS WIFIMANAGER ──────────────────────────────────
void onAPMode(WiFiManager*) {
  Serial.println("\n[WiFi] Modo AP activo");
  Serial.printf("  Red: %s  Pass: %s\n", AP_SSID, AP_PASSWORD);
  Serial.println("  Abre: 192.168.4.1 en tu celular");
  blinkLed(LED_VERDE, 2, 300);
}

void onSaveParams() {
  String newKey     = String(paramKey->getValue());     newKey.trim();
  String newCluster = String(paramCluster->getValue()); newCluster.trim();

  if (newKey.length() > 0)     pusherKey     = newKey;
  if (newCluster.length() > 0) pusherCluster = newCluster;

  prefs.begin("motion", false);
  prefs.putString("pusher_key",     pusherKey);
  prefs.putString("pusher_cluster", pusherCluster);
  prefs.end();

  Serial.printf("[Prefs] Guardado — Key: %s | Cluster: %s\n",
                pusherKey.c_str(), pusherCluster.c_str());
}

// ── SETUP ──────────────────────────────────────────────────
void setup() {
  Serial.begin(SERIAL_BAUD);
  delay(500);

  Serial.println("\n╔═══════════════════════════════════╗");
  Serial.println("║   Motion Arcade — ESP32 v3.0      ║");
  Serial.println("║   WiFi + Offline Mode             ║");
  Serial.println("╚═══════════════════════════════════╝");

  // 1. Configurar LEDs
  pinMode(LED_VERDE, OUTPUT);
  pinMode(LED_ROJO, OUTPUT);
  pinMode(LED_AZUL, OUTPUT);
  pinMode(LED_AMARILLO, OUTPUT);
  ledsOff();
  testSequence();

  // 2. Verificar botón reset
  checkResetButton();

  // 3. Cargar credenciales guardadas
  prefs.begin("motion", true);
  pusherKey     = prefs.getString("pusher_key",     DEFAULT_PUSHER_KEY);
  pusherCluster = prefs.getString("pusher_cluster", DEFAULT_PUSHER_CLUSTER);
  prefs.end();
  Serial.printf("[Prefs] Key: %s | Cluster: %s\n", pusherKey.c_str(), pusherCluster.c_str());

  // 4. Configurar WiFiManager
  paramKey     = new WiFiManagerParameter("pusher_key",     "Pusher App Key",         pusherKey.c_str(),     40);
  paramCluster = new WiFiManagerParameter("pusher_cluster", "Pusher Cluster (ej: us2)", pusherCluster.c_str(), 10);
  wm.addParameter(paramKey);
  wm.addParameter(paramCluster);
  wm.setAPCallback(onAPMode);
  wm.setSaveParamsCallback(onSaveParams);
  wm.setTitle("Motion Arcade — Configuracion");
  wm.setConfigPortalTimeout(PORTAL_TIMEOUT);
  wm.setConfigPortalBlocking(false);

  // 5. Intentar conectar
  Serial.println("[WiFi] Intentando conectar...");
  digitalWrite(LED_VERDE, HIGH);

  bool connected = wm.autoConnect(AP_SSID, AP_PASSWORD);

  // Esperar hasta PORTAL_TIMEOUT segundos
  unsigned long waitStart = millis();
  while (WiFi.status() != WL_CONNECTED) {
    wm.process();

    // Parpadeo verde mientras espera
    bool tog = (millis() / 400) % 2 == 0;
    digitalWrite(LED_VERDE, tog ? HIGH : LOW);

    // Si pasó el timeout, ir a modo offline
    if (millis() - waitStart > (unsigned long)(PORTAL_TIMEOUT + 5) * 1000UL) {
      Serial.println("[WiFi] Timeout — activando modo OFFLINE");
      offlineMode = true;
      ledsOff();
      break;
    }
    delay(10);
  }

  if (WiFi.status() == WL_CONNECTED) {
    wifiConnected = true;
    offlineMode   = false;
    Serial.printf("[WiFi] Conectado! IP: %s\n", WiFi.localIP().toString().c_str());
    digitalWrite(LED_VERDE, HIGH);
    delay(500);
    ledsOff();
    connectPusher();
  } else if (!offlineMode) {
    // Falló sin timeout (otro error)
    Serial.println("[WiFi] No conectado — modo OFFLINE");
    offlineMode = true;
  }

  if (offlineMode) {
    Serial.println("╔══════════════════════════════════════╗");
    Serial.println("║   MODO OFFLINE ACTIVO                ║");
    Serial.println("║   LEDs animándose automáticamente    ║");
    Serial.println("║   Para configurar WiFi, reinicia y   ║");
    Serial.println("║   conecta a: MotionArcade-Setup      ║");
    Serial.println("╚══════════════════════════════════════╝");
    blinkLed(LED_AMARILLO, 3, 200);
  }

  delete paramKey;
  delete paramCluster;
  paramKey = paramCluster = nullptr;
}

// ── LOOP ───────────────────────────────────────────────────
void loop() {
  unsigned long now = millis();

  if (offlineMode) {
    // Modo offline: animar LEDs automáticamente
    tickOfflineMode();
    return;
  }

  // Modo online: procesar WebSocket
  if (wifiConnected && WiFi.status() == WL_CONNECTED) {
    wsClient.loop();
  }

  // Chequear WiFi periódicamente
  if (now - lastWifiCheck > WIFI_CHECK_MS) {
    lastWifiCheck = now;

    if (WiFi.status() != WL_CONNECTED) {
      Serial.println("[WiFi] Conexion perdida — reconectando...");
      blinkLed(LED_ROJO, 2, 150);
      WiFi.reconnect();

      unsigned long rt = millis();
      while (WiFi.status() != WL_CONNECTED && millis() - rt < 8000) {
        delay(300);
      }

      if (WiFi.status() == WL_CONNECTED) {
        Serial.printf("[WiFi] Reconectado — IP: %s\n", WiFi.localIP().toString().c_str());
        connectPusher();
      } else {
        Serial.println("[WiFi] Reconexion fallida — continuando en modo online degradado");
      }
    }
  }
}

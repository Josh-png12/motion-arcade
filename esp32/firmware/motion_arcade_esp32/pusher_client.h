/**
 * pusher_client.h
 * Cliente Pusher WebSocket con credenciales dinámicas.
 *
 * CAMBIO v2.0: begin() ahora recibe appKey y cluster como String
 * en lugar de leerlos de #defines. Esto permite configurarlos
 * en tiempo de ejecución desde la flash (PreferencesManager).
 *
 * PROTOCOLO PUSHER (WebSocket sobre HTTP):
 *   WS → ws-{cluster}.pusher.com:80/app/{key}?protocol=7&...
 *   1. Recibir pusher:connection_established
 *   2. Enviar pusher:subscribe  { "channel": "game-events" }
 *   3. Recibir eventos del juego
 *   4. Responder ping/pong cada 30s para mantener la conexión
 */

#ifndef PUSHER_CLIENT_H
#define PUSHER_CLIENT_H

#include <WebSocketsClient.h>
#include <ArduinoJson.h>
#include "config.h"
#include "led_controller.h"

class PusherClient {
private:
  WebSocketsClient  _ws;
  LedController&    _leds;
  String            _appKey;
  String            _cluster;
  String            _wsHost;    // calculado en begin()
  String            _wsPath;    // calculado en begin()
  bool              _connected  = false;
  bool              _subscribed = false;
  unsigned long     _lastPingMs = 0;

  static const int  PING_INTERVAL_MS = 30000;
  static PusherClient* _instance;

  // ── Callback estático requerido por WebSocketsClient ──────────
  static void wsEventHandler(WStype_t type, uint8_t* payload, size_t length) {
    if (_instance) _instance->handleWsEvent(type, payload, length);
  }

  void handleWsEvent(WStype_t type, uint8_t* payload, size_t length) {
    switch (type) {
      case WStype_DISCONNECTED:
        _connected  = false;
        _subscribed = false;
        Serial.println("[Pusher] Desconectado — reconectando...");
        break;

      case WStype_CONNECTED:
        _connected = true;
        Serial.println("[Pusher] WebSocket conectado");
        break;

      case WStype_TEXT:
        handleMessage((char*)payload, length);
        break;

      case WStype_ERROR:
        Serial.printf("[Pusher] Error WS: %s\n",
                      payload ? (char*)payload : "desconocido");
        break;

      default:
        break;
    }
  }

  void handleMessage(const char* payload, size_t length) {
    DynamicJsonDocument doc(512);
    DeserializationError err = deserializeJson(doc, payload, length);
    if (err) {
      Serial.printf("[Pusher] JSON invalido: %s\n", err.c_str());
      return;
    }

    const char* event = doc["event"];
    if (!event) return;

    Serial.printf("[Pusher] <- %s\n", event);

    // ── Protocolo Pusher ──────────────────────────────
    if (strcmp(event, "pusher:connection_established") == 0) {
      subscribeToChannel();
    }
    else if (strcmp(event, "pusher:ping") == 0) {
      _ws.sendTXT("{\"event\":\"pusher:pong\",\"data\":{}}");
    }
    else if (strcmp(event, "pusher_internal:subscription_succeeded") == 0) {
      _subscribed = true;
      Serial.printf("[Pusher] Suscrito a canal: %s\n", PUSHER_CHANNEL);
      _leds.playerReady();
    }

    // ── Eventos del juego Motion Arcade ───────────────
    else if (strcmp(event, "player_ready") == 0) {
      _leds.playerReady();
    }
    else if (strcmp(event, "game_start") == 0) {
      _leds.gameStart();
    }
    else if (strcmp(event, "score") == 0) {
      _leds.scoreEffect();
    }
    else if (strcmp(event, "combo") == 0) {
      Serial.println("[Pusher] COMBO!");
      _leds.comboEffect();
    }
    else if (strcmp(event, "game_over") == 0) {
      _leds.gameOver();
    }
    else if (strcmp(event, "error") == 0) {
      _leds.errorEffect();
    }
  }

  void subscribeToChannel() {
    // {"event":"pusher:subscribe","data":{"channel":"game-events"}}
    DynamicJsonDocument sub(256);
    sub["event"] = "pusher:subscribe";
    sub.createNestedObject("data")["channel"] = PUSHER_CHANNEL;

    String msg;
    serializeJson(sub, msg);
    _ws.sendTXT(msg);
    Serial.printf("[Pusher] -> suscribiendome a %s\n", PUSHER_CHANNEL);
  }

public:
  PusherClient(LedController& leds) : _leds(leds) {
    _instance = this;
  }

  /**
   * Inicializa la conexión WebSocket con credenciales dinámicas.
   * Construye el host y path de Pusher a partir de key y cluster.
   */
  void begin(const String& appKey, const String& cluster) {
    _appKey  = appKey;
    _cluster = cluster;

    // ws-us2.pusher.com
    _wsHost = "ws-" + cluster + ".pusher.com";

    // /app/{key}?protocol=7&client=esp32&version=2.0&flash=false
    _wsPath = "/app/" + appKey +
              "?protocol=7&client=esp32&version=2.0&flash=false";

    Serial.printf("[Pusher] Conectando a %s%s\n",
                  _wsHost.c_str(), _wsPath.c_str());

    _ws.begin(_wsHost.c_str(), PUSHER_PORT, _wsPath.c_str());
    _ws.onEvent(wsEventHandler);
    _ws.setReconnectInterval(3000);
    _ws.enableHeartbeat(15000, 3000, 2);
  }

  void loop() {
    _ws.loop();

    // Ping manual adicional cada 30s (Pusher cierra conexiones inactivas)
    if (_connected && _subscribed) {
      unsigned long now = millis();
      if (now - _lastPingMs > PING_INTERVAL_MS) {
        _ws.sendTXT("{\"event\":\"pusher:ping\",\"data\":{}}");
        _lastPingMs = now;
      }
    }
  }

  bool isConnected()  { return _connected;  }
  bool isSubscribed() { return _subscribed; }

  // Útil para mostrar info en Serial
  String getHost()    { return _wsHost; }
  String getKey()     { return _appKey.substring(0, 8) + "..."; } // no loggear key completa
};

PusherClient* PusherClient::_instance = nullptr;

#endif // PUSHER_CLIENT_H

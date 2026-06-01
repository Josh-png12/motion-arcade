/**
 * preferences_manager.h
 * Almacenamiento de credenciales Pusher en la flash NVS del ESP32.
 *
 * DISEÑO: Usa la librería Preferences (incluida en ESP32 Arduino core)
 * que escribe en la partición NVS (Non-Volatile Storage) del SoC.
 * Los datos sobreviven cortes de luz y reinicios.
 *
 * WiFiManager guarda las credenciales WiFi en su propio namespace NVS
 * de forma automática; nosotros solo gestionamos las de Pusher.
 *
 * Estructura en NVS:
 *   namespace "motion_arcade" {
 *     "pusher_key"   : String  (App Key de Pusher)
 *     "pusher_clust" : String  (Cluster de Pusher, ej. "us2")
 *   }
 */

#ifndef PREFERENCES_MANAGER_H
#define PREFERENCES_MANAGER_H

#include <Preferences.h>
#include "config.h"

class PreferencesManager {
private:
  Preferences _prefs;
  String _pusherKey;
  String _pusherCluster;
  bool   _loaded = false;

public:
  // Inicializa y carga los valores guardados (o usa defaults si es la primera vez)
  void begin() {
    _prefs.begin(PREFS_NAMESPACE, false); // false = lectura/escritura

    // Leer valores guardados; usar defaults si están vacíos
    _pusherKey     = _prefs.getString(PREFS_KEY_PKEY,   PUSHER_KEY_DEFAULT);
    _pusherCluster = _prefs.getString(PREFS_KEY_PCLUST, PUSHER_CLUSTER_DEFAULT);

    _loaded = true;

    Serial.printf("[Prefs] Pusher Key:     %s\n", _pusherKey.c_str());
    Serial.printf("[Prefs] Pusher Cluster: %s\n", _pusherCluster.c_str());
  }

  // ── Getters ──────────────────────────────────────
  String getPusherKey()     { return _pusherKey; }
  String getPusherCluster() { return _pusherCluster; }

  // Indica si los valores son los defaults (nunca se configuró manualmente)
  bool usingDefaults() {
    return _pusherKey == PUSHER_KEY_DEFAULT &&
           _pusherCluster == PUSHER_CLUSTER_DEFAULT;
  }

  // ── Setters (persisten en flash) ─────────────────
  void setPusherKey(const String& key) {
    if (key.length() == 0) return;
    _pusherKey = key;
    _prefs.putString(PREFS_KEY_PKEY, key);
    Serial.printf("[Prefs] Pusher Key guardada: %s\n", key.c_str());
  }

  void setPusherCluster(const String& cluster) {
    if (cluster.length() == 0) return;
    _pusherCluster = cluster;
    _prefs.putString(PREFS_KEY_PCLUST, cluster);
    Serial.printf("[Prefs] Pusher Cluster guardado: %s\n", cluster.c_str());
  }

  // Actualiza ambos solo si cambiaron (evita escrituras innecesarias en flash)
  void updateIfChanged(const String& newKey, const String& newCluster) {
    bool changed = false;

    if (newKey.length() > 0 && newKey != _pusherKey) {
      setPusherKey(newKey);
      changed = true;
    }
    if (newCluster.length() > 0 && newCluster != _pusherCluster) {
      setPusherCluster(newCluster);
      changed = true;
    }

    if (changed) {
      Serial.println("[Prefs] Credenciales Pusher actualizadas en flash");
    } else {
      Serial.println("[Prefs] Sin cambios en credenciales Pusher");
    }
  }

  // Borra SOLO las credenciales Pusher del namespace
  // (WiFiManager borra las de WiFi con wm.resetSettings())
  void clearPusherCredentials() {
    _prefs.remove(PREFS_KEY_PKEY);
    _prefs.remove(PREFS_KEY_PCLUST);
    _pusherKey     = PUSHER_KEY_DEFAULT;
    _pusherCluster = PUSHER_CLUSTER_DEFAULT;
    Serial.println("[Prefs] Credenciales Pusher borradas — usando defaults");
  }

  // Cierra el namespace (llamar antes de ESP.restart() o cuando ya no se necesite)
  void end() {
    _prefs.end();
  }
};

#endif // PREFERENCES_MANAGER_H

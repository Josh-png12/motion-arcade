# Guía de Instalación — Motion Arcade

## Requisitos previos

- Node.js 18+ (recomendado: LTS)
- npm 9+
- Cuenta en [Pusher](https://pusher.com) (plan Sandbox gratuito)
- Cuenta en [Supabase](https://supabase.com) (plan gratuito) — *opcional*
- Arduino IDE 2.x — *solo para el ESP32*

---

## 1. Clonar e instalar

```bash
git clone <URL_DEL_REPO>
cd motion-arcade
npm install
```

---

## 2. Configurar variables de entorno

Edita `.env.local` en la raíz del proyecto:

```env
# Pusher Channels (obligatorio)
NEXT_PUBLIC_PUSHER_KEY=49dadffc1e88101d33da
NEXT_PUBLIC_PUSHER_CLUSTER=us2
PUSHER_APP_ID=2161844
PUSHER_SECRET=tu_secret_de_pusher

# Supabase (opcional — el ranking no funciona sin esto)
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

Para obtener el `PUSHER_SECRET`:
1. Inicia sesión en [pusher.com/dashboard](https://dashboard.pusher.com)
2. Selecciona tu app → Keys → copia el `secret`

---

## 3. Configurar Supabase (opcional)

1. Crea un proyecto en [supabase.com](https://supabase.com)
2. Ve a **SQL Editor** y ejecuta:

```sql
CREATE TABLE leaderboard (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id TEXT NOT NULL,
  player_name TEXT NOT NULL CHECK (char_length(player_name) <= 20),
  score INTEGER NOT NULL DEFAULT 0,
  level INTEGER NOT NULL DEFAULT 1,
  duration INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_leaderboard_game_score 
  ON leaderboard(game_id, score DESC);

ALTER TABLE leaderboard ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read"   ON leaderboard FOR SELECT USING (true);
CREATE POLICY "Public insert" ON leaderboard FOR INSERT WITH CHECK (true);
```

3. Ve a **Settings → API** y copia:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public key` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

---

## 4. Ejecutar en desarrollo

```bash
npm run dev
```

La app estará en `http://localhost:3000`

**Para acceder desde el celular** (en la misma red WiFi):
```bash
# Obtener tu IP local
ipconfig  # Windows
ifconfig  # Mac/Linux

# Abrir en el celular:
http://192.168.X.X:3000
```

> **Importante**: la cámara solo funciona en HTTPS o localhost.
> Para desarrollo en red local, usa ngrok o el modo HTTPS de Next.js.

---

## 5. Flashear el ESP32

Ver instrucciones completas en [FIRMWARE_ESP32.md](FIRMWARE_ESP32.md).

Resumen rápido:
1. Instalar [Arduino IDE 2.x](https://www.arduino.cc/en/software)
2. Agregar soporte ESP32: `Preferences → Additional Boards → agregar URL`
3. Instalar librerías: `WebSocketsClient` y `ArduinoJson`
4. Editar `esp32/firmware/config.h` con tus credenciales WiFi
5. Abrir `esp32/firmware/motion_arcade_esp32.ino` y flashear

---

## 6. Build para producción

```bash
npm run build
npm start
```

Para despliegue en Vercel, ver [DEPLOYMENT.md](DEPLOYMENT.md).

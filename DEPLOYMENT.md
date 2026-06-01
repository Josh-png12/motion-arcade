# Despliegue en Vercel — Motion Arcade

## Prerequisitos

- Cuenta en [Vercel](https://vercel.com) (gratuita)
- Repositorio en GitHub/GitLab/Bitbucket

## Pasos

### 1. Subir el código a GitHub

```bash
git init
git add .
git commit -m "feat: Motion Arcade inicial"
git remote add origin https://github.com/tuusuario/motion-arcade.git
git push -u origin main
```

### 2. Importar en Vercel

1. Ve a [vercel.com/new](https://vercel.com/new)
2. Importa tu repositorio de GitHub
3. Framework: **Next.js** (detectado automáticamente)
4. Click en **Deploy** (sin configurar variables aún)

### 3. Configurar variables de entorno

En el dashboard de Vercel:
`Settings → Environment Variables`

| Variable | Valor |
|----------|-------|
| `NEXT_PUBLIC_PUSHER_KEY` | `49dadffc1e88101d33da` |
| `NEXT_PUBLIC_PUSHER_CLUSTER` | `us2` |
| `PUSHER_APP_ID` | `2161844` |
| `PUSHER_SECRET` | Tu secret de Pusher |
| `NEXT_PUBLIC_SUPABASE_URL` | Tu URL de Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Tu anon key de Supabase |

Después de agregar las variables: **Redeploy** desde la pestaña Deployments.

### 4. Configurar dominio personalizado (opcional)

`Settings → Domains → Add` → agregar tu dominio.

## Variables por entorno

Vercel permite configurar variables por entorno (Development/Preview/Production).
Las variables `NEXT_PUBLIC_*` son visibles en el cliente — nunca pongas secrets ahí.

| Variable | Dev | Preview | Prod |
|----------|-----|---------|------|
| `NEXT_PUBLIC_PUSHER_KEY` | ✅ | ✅ | ✅ |
| `PUSHER_SECRET` | ✅ | ✅ | ✅ |
| `NEXT_PUBLIC_SUPABASE_*` | ✅ | ✅ | ✅ |

## Verificar el despliegue

Una vez desplegado, verificar:

1. **Menú principal**: `https://tu-app.vercel.app`
2. **API Pusher**: `POST https://tu-app.vercel.app/api/pusher` debe responder 200
3. **API Leaderboard**: `GET https://tu-app.vercel.app/api/leaderboard?gameId=fruit-slash`
4. **Juego**: `https://tu-app.vercel.app/game/fruit-slash`

## Limitaciones del plan gratuito de Vercel

- Bandwidth: 100GB/mes
- Serverless function duration: 10s
- Regiones: US East (las API routes de Pusher se ejecutan aquí)

## Configurar el ESP32 para producción

Actualizar `esp32/firmware/config.h` si cambias el dominio:
```cpp
// El ESP32 no necesita saber el dominio de Vercel
// Solo necesita las credenciales de Pusher (que son las mismas)
#define PUSHER_APP_KEY  "49dadffc1e88101d33da"
#define PUSHER_CLUSTER  "us2"
```

El ESP32 se conecta directamente a Pusher (no a Vercel), por lo que
el dominio de despliegue no afecta al firmware.

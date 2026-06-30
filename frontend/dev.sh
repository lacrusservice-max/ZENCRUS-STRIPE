#!/bin/bash
# ZENCRUS Dev Launcher — funciona desde cualquier red
# Uso: ./dev.sh

export NVM_DIR="$HOME/.nvm"
source "$NVM_DIR/nvm.sh"

BACKEND_PORT=5000
TUNNEL_URL_FILE="/tmp/zencrus_tunnel_url.txt"
LOG_FILE="/tmp/zencrus_backend_tunnel.log"

echo ""
echo "╔══════════════════════════════════════╗"
echo "║      ZENCRUS DEV LAUNCHER v2         ║"
echo "╚══════════════════════════════════════╝"
echo ""

# 1. Verificar que el backend está corriendo
echo "▸ Verificando backend..."
if ! curl -s http://localhost:$BACKEND_PORT/api/health > /dev/null 2>&1; then
  echo "  ⚠ Backend no responde — arrancando con pm2..."
  pm2 start zencrus-backend 2>/dev/null
  sleep 3
fi
echo "  ✓ Backend OK en puerto $BACKEND_PORT"

# 2. Levantar túnel para el backend en background
echo ""
echo "▸ Abriendo túnel para el backend (funciona desde cualquier red)..."
lt --port $BACKEND_PORT > "$LOG_FILE" 2>&1 &
LT_PID=$!

# Esperar a que el túnel esté listo y obtener la URL
sleep 4
TUNNEL_URL=$(grep -o 'https://[^ ]*' "$LOG_FILE" | head -1)

if [ -z "$TUNNEL_URL" ]; then
  echo "  ⚠ Túnel tardando... esperando 5s más..."
  sleep 5
  TUNNEL_URL=$(grep -o 'https://[^ ]*' "$LOG_FILE" | head -1)
fi

if [ -z "$TUNNEL_URL" ]; then
  echo "  ✗ Túnel falló. Usando IP local (solo funciona en casa)."
  export EXPO_PUBLIC_API_URL="http://192.168.100.19:5000/api"
else
  export EXPO_PUBLIC_API_URL="${TUNNEL_URL}/api"
  echo "$TUNNEL_URL" > "$TUNNEL_URL_FILE"
  echo "  ✓ Backend público en: $EXPO_PUBLIC_API_URL"
fi

# 3. Levantar Expo con túnel
echo ""
echo "▸ Iniciando Expo con túnel..."
echo "  API → $EXPO_PUBLIC_API_URL"
echo ""

cleanup() {
  echo ""
  echo "▸ Cerrando túnel del backend..."
  kill $LT_PID 2>/dev/null
  exit 0
}
trap cleanup INT TERM

EXPO_TOKEN=ykT1ML0oGlt2pZGpt77no5hL0G8QAu3aZRf_40T0 \
EXPO_PUBLIC_API_URL="$EXPO_PUBLIC_API_URL" \
npx expo start --tunnel

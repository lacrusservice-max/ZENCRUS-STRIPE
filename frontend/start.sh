#!/bin/bash
# ===========================================================
# ZENCRUS — Arranque (pm2 mantiene todo siempre vivo)
# ===========================================================
UDID="7DEFBFE2-0B26-4EAA-A136-6015AF0CA9DB"
ROOT_DIR="$(dirname "$0")/.."

LAN_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "localhost")

echo ""
echo "══════════════════════════════════════════"
echo "  ZENCRUS  |  IP: $LAN_IP"
echo "══════════════════════════════════════════"

# ── Asegurar que pm2 tenga los procesos ──────────────────────
cd "$ROOT_DIR"
BACKEND_STATUS=$(pm2 jlist 2>/dev/null | python3 -c "import sys,json; ps=json.load(sys.stdin); s=[p['pm2_env']['status'] for p in ps if p['name']=='zencrus-backend']; print(s[0] if s else 'missing')" 2>/dev/null)
METRO_STATUS=$(pm2 jlist 2>/dev/null | python3 -c "import sys,json; ps=json.load(sys.stdin); s=[p['pm2_env']['status'] for p in ps if p['name']=='zencrus-metro']; print(s[0] if s else 'missing')" 2>/dev/null)

if [ "$BACKEND_STATUS" = "online" ] && [ "$METRO_STATUS" = "online" ]; then
  echo "► Servicios ya corriendo (pm2)"
  echo "  Backend: ✓  |  Metro: ✓"
else
  echo "► Iniciando servicios con pm2..."
  pm2 start ecosystem.config.js 2>/dev/null || pm2 restart ecosystem.config.js

  echo "► Esperando backend..."
  for i in $(seq 1 20); do
    curl -s --max-time 1 http://localhost:5000/api/health > /dev/null 2>&1 && break
    sleep 1
  done

  echo "► Esperando Metro..."
  for i in $(seq 1 30); do
    curl -s --max-time 1 http://localhost:8081/status 2>/dev/null | grep -q "running" && break
    sleep 2
  done
fi

# ── Simulador ────────────────────────────────────────────────
echo ""
echo "► Abriendo iOS Simulator..."
xcrun simctl boot "$UDID" 2>/dev/null
open -a Simulator
sleep 2
xcrun simctl openurl "$UDID" "exp://localhost:8081"

echo ""
echo "══════════════════════════════════════════"
echo "  ✓ Listo"
echo "  Celular: exp://$LAN_IP:8081"
echo "  Recarga: ⌘+R"
echo "══════════════════════════════════════════"
echo ""

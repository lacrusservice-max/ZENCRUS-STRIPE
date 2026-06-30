#!/bin/bash
# NutriAI Fit — Iniciar entorno de desarrollo completo
# Uso: ./start-dev.sh

ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "🚀 Iniciando NutriAI Fit..."
echo ""

# 1. Backend
echo "▶ Iniciando backend (puerto 5000)..."
if lsof -ti:5000 > /dev/null 2>&1; then
  echo "  ✓ Backend ya corriendo en :5000"
else
  cd "$ROOT/backend" && npm run dev &
  BACKEND_PID=$!
  sleep 4
  echo "  ✓ Backend iniciado (PID $BACKEND_PID)"
fi

echo ""

# 2. Expo iOS Simulator
echo "▶ Iniciando Expo con iOS Simulator..."
cd "$ROOT/frontend"
npx expo start --ios

echo ""
echo "✅ Dev environment listo!"

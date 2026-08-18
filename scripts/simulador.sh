#!/bin/bash
#
# ABRIR ZENCRUS EN EL SIMULADOR, CON EL TECLADO QUE FUNCIONA
# ─────────────────────────────────────────────────────────
#
# ── El problema que resuelve ────────────────────────────────────────────────
# Con el teclado del Mac conectado al simulador, la distribución española no
# mapea la `@` ni la `?`: el campo sencillamente IGNORA la tecla. Escribir un
# correo dejaba «lacrusservice» y descartaba todo lo que venía después de la
# arroba, y parecía un fallo de la app.
#
# ── Por qué no basta con el ajuste ──────────────────────────────────────────
# `ConnectHardwareKeyboard` solo se LEE al arrancar Simulator.app, y Simulator
# vuelca sus preferencias al SALIR, así que puede pisar el valor que acabas de
# escribir. Ponerlo a mano una vez no aguanta: hay que escribirlo con la app
# cerrada y volver a abrirla. Eso es lo único que hace este script de especial.
#
# Uso:  ./scripts/simulador.sh [UDID]

set -uo pipefail

UDID="${1:-970F20D8-7653-4CF4-AB57-8A5CE7D47E10}"
URL_METRO="${URL_METRO:-exp://127.0.0.1:8081}"

# `timeout` no existe en macOS y simctl se cuelga cuando el device arranca a
# medias, así que hace falta un cortacircuitos propio.
to() { local s=$1; shift; perl -e 'alarm shift; exec @ARGV' "$s" "$@"; }

echo "▶ Teclado: desconectando el del Mac para que salga el de pantalla"
osascript -e 'tell application "Simulator" to quit' 2>/dev/null
for _ in $(seq 1 10); do
  pgrep -f "Simulator.app/Contents/MacOS/Simulator" >/dev/null || break
  sleep 0.5
done
pkill -f "Simulator.app/Contents/MacOS/Simulator" 2>/dev/null

# Con la app YA cerrada: aquí es donde el valor se queda puesto.
defaults write com.apple.iphonesimulator ConnectHardwareKeyboard -bool false
echo "  ✓ ConnectHardwareKeyboard = $(defaults read com.apple.iphonesimulator ConnectHardwareKeyboard)"

echo "▶ Arrancando el simulador"
to 40 xcrun simctl shutdown "$UDID" >/dev/null 2>&1
to 90 xcrun simctl boot "$UDID" >/dev/null 2>&1

# `bootstatus` espera a los servicios internos. Sin esto, simctl acepta
# comandos y se queda colgado: el device figura «Booted» y no responde.
to 200 xcrun simctl bootstatus "$UDID" -b >/dev/null 2>&1
echo "  ✓ arrancado y respondiendo"

open -a Simulator --args -CurrentDeviceUDID "$UDID"
sleep 3

# Reduce Motion apaga las animaciones de Reanimated, y esta app es casi toda
# animación: verificarla con esto encendido es no verla.
to 20 xcrun simctl spawn "$UDID" defaults write com.apple.Accessibility ReduceMotionEnabled -bool false >/dev/null 2>&1
echo "  ✓ animaciones activas (Reduce Motion apagado)"

echo "▶ Abriendo ZENCRUS en Expo Go"
to 30 xcrun simctl openurl "$UDID" "$URL_METRO" >/dev/null 2>&1 \
  && echo "  ✓ $URL_METRO" \
  || echo "  ✗ no se pudo abrir — ¿está Metro en el 8081?"

echo ""
echo "Listo. El teclado de iOS sale en pantalla: la @ y la ? se tocan."

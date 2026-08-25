/**
 * CICLO · LA PUERTA
 * ═══════════════════════════════════════════════════════════════════════════
 * Un único sitio por el que se entra a las seis pantallas del módulo, y por
 * tanto un único sitio donde se decide quién entra.
 *
 * ── Dos cerrojos distintos y no hay que confundirlos ───────────────────────
 * El primero es de EXISTENCIA: para una cuenta sin el módulo, el ciclo no está
 * apagado, está ausente. Se sale de la ruta sin explicar nada, porque una
 * pantalla que dice «no tienes acceso a esto» confirma que «esto» existe —el
 * mismo motivo por el que la API responde 404 y nunca 403.
 *
 * El segundo es de PRIVACIDAD: quien sí tiene el módulo puede exigir su huella
 * cada vez que entra, aunque el teléfono ya esté desbloqueado. Es el único
 * rincón de ZENCRUS con ese nivel, y está donde debe estar.
 *
 * ── Por qué aquí y no en cada pantalla ─────────────────────────────────────
 * Porque si el cerrojo se copia en seis sitios, tarde o temprano se añade una
 * séptima pantalla y alguien olvida ponerlo. Un enlace profundo a
 * `/salud/ciclo/historial` entraría directo. Con el cerrojo en el layout, la
 * pantalla nueva nace protegida.
 */

import { useEffect, useState, useCallback } from 'react'
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native'
import { Stack, router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useAuthStore } from '@/store/authStore'
import { usePrivacyStore } from '@/store/privacyStore'
import { tieneCiclo } from '@/features/salud/acceso'
import { authenticateWithBiometrics } from '@/services/authService'
import { base, space, radius, family, type as tipo, PHASES } from '@/theme/salud/tokens'
import { Screen } from '@/components/ui/Screen'

const TONO = PHASES.ovulatoria.accent

export default function LayoutCiclo() {
  const user = useAuthStore(s => s.user)
  const cargandoSesion = useAuthStore(s => s.isLoading)
  const bloqueo = usePrivacyStore(s => s.menstrualLockEnabled)

  const [abierto, setAbierto] = useState(!bloqueo)
  const [verificando, setVerificando] = useState(false)
  const [fallo, setFallo] = useState(false)

  const permitido = tieneCiclo(user)

  /* Salir, sin mensaje. Se hace en un efecto y no durante el render porque
     navegar mientras se renderiza deja al router a medias. */
  useEffect(() => {
    if (cargandoSesion) return
    if (!permitido) router.replace('/(tabs)/salud')
  }, [permitido, cargandoSesion])

  const desbloquear = useCallback(async () => {
    setVerificando(true)
    setFallo(false)
    const ok = await authenticateWithBiometrics()
    setVerificando(false)
    if (ok) setAbierto(true)
    else setFallo(true)
  }, [])

  useEffect(() => {
    if (!bloqueo) { setAbierto(true); return }
    if (permitido && !abierto) void desbloquear()
    // Solo al montar: reintentar en cada render abriría un bucle de biometría.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bloqueo, permitido])

  if (cargandoSesion || !permitido) {
    return (
      <Screen tint={TONO}>
        <View style={s.centro}><ActivityIndicator color={base.textLow} /></View>
      </Screen>
    )
  }

  if (!abierto) {
    return (
      <Screen tint={TONO}>
        <View style={s.centro}>
          <View style={[s.icono, { borderColor: `${TONO}55` }]}>
            <Ionicons name="lock-closed" size={26} color={TONO} />
          </View>
          <Text style={s.titulo}>Sección privada</Text>
          <Text style={s.texto}>
            Pediste que esto se abriera solo contigo. Confirma tu identidad para entrar.
          </Text>
          {fallo ? (
            <Text style={s.fallo}>No se pudo verificar. Prueba otra vez.</Text>
          ) : null}
          <Pressable
            onPress={() => void desbloquear()}
            disabled={verificando}
            style={({ pressed }) => [s.boton, { backgroundColor: TONO }, pressed && { opacity: 0.75 }]}
            accessibilityRole="button"
          >
            <Ionicons name="finger-print" size={17} color="#fff" />
            <Text style={s.botonTxt}>{verificando ? 'Verificando…' : 'Desbloquear'}</Text>
          </Pressable>
          <Pressable onPress={() => router.back()} hitSlop={10} style={s.salir}>
            <Text style={s.salirTxt}>Salir</Text>
          </Pressable>
        </View>
      </Screen>
    )
  }

  return <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }} />
}

const s = StyleSheet.create({
  centro: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: space.xl, gap: space.sm,
  },
  icono: {
    width: 64, height: 64, borderRadius: radius.pill, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center', marginBottom: space.sm,
  },
  titulo: { fontFamily: family.uiSemi, fontSize: tipo.ui.xl, color: base.textHi },
  texto: {
    fontFamily: family.ui, fontSize: tipo.ui.sm, color: base.textMid,
    textAlign: 'center', lineHeight: tipo.ui.sm * 1.6, maxWidth: 300,
  },
  fallo: { fontFamily: family.ui, fontSize: tipo.ui.xs, color: base.danger },
  boton: {
    flexDirection: 'row', alignItems: 'center', gap: space.sm,
    marginTop: space.md, paddingHorizontal: space.xl, height: 48, borderRadius: radius.pill,
  },
  botonTxt: { fontFamily: family.uiSemi, fontSize: tipo.ui.md, color: '#fff' },
  salir: { marginTop: space.sm, padding: space.sm },
  salirTxt: { fontFamily: family.ui, fontSize: tipo.ui.sm, color: base.textLow },
})

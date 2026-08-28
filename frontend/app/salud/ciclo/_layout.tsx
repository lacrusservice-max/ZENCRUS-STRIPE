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
import { Stack, router, usePathname } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useAuthStore } from '@/store/authStore'
import { usePrivacyStore } from '@/store/privacyStore'
import { tieneCiclo } from '@/features/salud/acceso'
import { authenticateWithBiometrics } from '@/services/authService'
import { base, space, radius, family, type as tipo, PHASES } from '@/theme/salud/tokens'
import { Screen } from '@/components/ui/Screen'
import { BarraCiclo } from '@/components/salud/ciclo/BarraCiclo'
import { useCicloStore } from '@/store/cicloStore'
import { useAvisosDelCiclo } from '@/features/salud/ciclo/useAvisos'
import { estadoDeHoy, apartadoHoy } from '@/features/salud/ciclo/checkin'
import { hoyLocal } from '@/utils/fechas'

const TONO = PHASES.ovulatoria.accent

export default function LayoutCiclo() {
  const user = useAuthStore(s => s.user)
  const cargandoSesion = useAuthStore(s => s.isLoading)
  const bloqueo = usePrivacyStore(s => s.menstrualLockEnabled)
  const ruta = usePathname()

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

  /* ── El check-in del día ─────────────────────────────────────────────────
     Va en la puerta y no en la portada para que aparezca se entre por donde se
     entre: por la portada, por un enlace al calendario o volviendo de otra
     pestaña. Puesto solo en la portada, quien tiene por costumbre entrar
     directo a Calendario no lo vería nunca.

     Se comprueba una sola vez por montaje. Reevaluarlo en cada cambio de
     pantalla haría que apareciera al volver de cualquier sitio, que es lo que
     convierte una buena pantalla en una molestia. */
  const [checkinVisto, setCheckinVisto] = useState(false)
  const logs = useCicloStore(s => s.logs)
  const cargado = useCicloStore(s => s.cargado)
  const cargar = useCicloStore(s => s.load)

  /* Los avisos se reprograman aquí porque los que cuelgan de la predicción
     caducan en cuanto ella registra sangrado. Puesto en la pantalla de
     ajustes solo se corregirían al entrar ahí, que es casi nunca. */
  useAvisosDelCiclo(permitido)

  /* ── Cargar el historial, si nadie lo ha hecho ya ──────────────────────
     Vivía SOLO en el hub de Salud, así que solo tenía historial quien entraba
     por ahí. Quien llegaba directo —un enlace profundo, una notificación, la
     app restaurando en esta pestaña— veía «Todavía no puedo predecir» con sus
     cuatro periodos guardados en el teléfono, y encima con una invitación a
     volver a meterlos.

     Va en el layout y no en cada pantalla por lo mismo que el resto de
     puertas: son once pantallas y bastaría con que a una se le olvidara. */
  useEffect(() => {
    if (!permitido || cargado) return
    void cargar()
  }, [permitido, cargado, cargar])

  useEffect(() => {
    if (checkinVisto || !abierto || !permitido || !cargado) return
    if (SIN_CHECKIN.some(r => ruta.startsWith(r))) return

    let vivo = true
    void (async () => {
      const hoy = hoyLocal()
      const apartado = await apartadoHoy(hoy)
      if (!vivo) return
      setCheckinVisto(true)
      const { procede } = estadoDeHoy(logs[hoy], apartado)
      if (procede) router.replace('/salud/ciclo/hoy')
    })()
    return () => { vivo = false }
    // Solo al abrirse el módulo: ver el comentario de arriba.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto, permitido, cargado, checkinVisto])

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

  /* El alta y el registro diario son flujos de pantalla completa con su propio
     cierre: la barra ahí estorbaría y además invitaría a escaparse a media
     captura de datos, dejando el registro a medias. */
  const conBarra = !SIN_BARRA.some(r => ruta.startsWith(r))

  return (
    <View style={s.flex}>
      <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
        {/* Las cinco pestañas se sustituyen entre sí; deslizarlas de lado haría
            parecer que una está «dentro» de otra, y son hermanas. */}
        {PESTANAS.map(n => (
          <Stack.Screen key={n} name={n} options={{ animation: 'none' }} />
        ))}
      </Stack>
      {conBarra ? <BarraCiclo /> : null}
    </View>
  )
}

const PESTANAS = ['index', 'calendario', 'ajustes', 'estadisticas', 'comunidad']
const SIN_BARRA = ['/salud/ciclo/alta', '/salud/ciclo/registrar', '/salud/ciclo/hoy']

/* Dónde NO se puede interrumpir con el check-in: en el propio check-in —sería
   un bucle—, en el alta —todavía no hay nada que registrar— y en el registro
   diario, que ya es la versión larga de lo mismo. */
const SIN_CHECKIN = ['/salud/ciclo/hoy', '/salud/ciclo/alta', '/salud/ciclo/registrar']

const s = StyleSheet.create({
  flex: { flex: 1 },
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

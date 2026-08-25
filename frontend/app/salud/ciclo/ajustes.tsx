/**
 * CICLO · AJUSTES
 * ═══════════════════════════════════════════════════════════════════════════
 * El modo de vida, la privacidad y el derecho a llevarse o borrar los datos.
 *
 * ── El modo de vida no es un filtro cosmético ──────────────────────────────
 * Decide si se predice, qué se enseña arriba y qué trackers aparecen. Alguien
 * en posparto o sin regla desde hace meses no necesita ver una cuenta atrás
 * hacia un periodo que no va a llegar: necesita que la app admita que no lo
 * sabe. Ver modos.ts.
 *
 * ── Y el borrado es de verdad ──────────────────────────────────────────────
 * Estos son los datos más sensibles de la app. «Borrar» tiene que borrar, no
 * ocultar, y tiene que poder hacerse sin escribir a nadie. Antes de borrar se
 * ofrece la exportación, porque irse no debería costar perder años de registro.
 */

import { useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, Pressable, Switch, Alert, Share,
} from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { Seccion, Placa, Filete, Eyebrow } from '@/components/salud/piezas'
import { useCicloStore } from '@/store/cicloStore'
import { usePrivacyStore } from '@/store/privacyStore'
import { useCiclo } from '@/features/salud/ciclo/useCiclo'
import { MODOS, MODO, type ModoVida } from '@/features/salud/ciclo/modos'
import { base, space, radius, family, type as tipo } from '@/theme/salud/tokens'
import { elegir, confirmar } from '@/utils/haptica'
import { Screen, ScreenHeader } from '@/components/ui/Screen'

export default function AjustesCiclo() {
  const load = useCicloStore(s => s.load)
  const logs = useCicloStore(s => s.logs)
  const inicios = useCicloStore(s => s.inicios)
  const modoActual = useCicloStore(s => s.perfil.modo)
  const setModo = useCicloStore(s => s.setModo)

  const bloqueo = usePrivacyStore(s => s.menstrualLockEnabled)
  const setBloqueo = usePrivacyStore(s => s.setMenstrualLock)

  const { tema, periodos } = useCiclo()
  const [exportando, setExportando] = useState(false)

  useEffect(() => { void load() }, [load])

  const dias = Object.keys(logs).length

  /**
   * Exportar es un derecho, no una cortesía.
   *
   * Sale JSON y no PDF: el PDF sirve para enseñárselo a alguien, el JSON para
   * llevárselo a otro sitio. Confundir las dos cosas es lo que hace que
   * «exportar tus datos» en muchas apps devuelva algo que no se puede
   * reimportar en ninguna parte.
   */
  const exportar = async () => {
    setExportando(true)
    try {
      const contenido = JSON.stringify({
        version: 1,
        exportado: new Date().toISOString(),
        modo: modoActual,
        iniciosDeclarados: inicios,
        periodos: periodos.map(p => ({
          inicio: p.inicio, fin: p.fin,
          diasSangrado: p.diasSangrado, duracionCiclo: p.duracionCiclo,
        })),
        registros: logs,
      }, null, 2)
      await Share.share({ message: contenido, title: 'Mis datos de ciclo · ZENCRUS' })
    } finally {
      setExportando(false)
    }
  }

  const borrar = () => {
    Alert.alert(
      'Borrar todo tu ciclo',
      `Se borrarán ${dias} días de registro y todos tus periodos, en este teléfono y en el servidor. No se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Exportar primero',
          onPress: () => void exportar(),
        },
        {
          text: 'Borrar',
          style: 'destructive',
          onPress: async () => {
            await useCicloStore.getState().borrarTodo()
            confirmar()
            router.back()
          },
        },
      ],
    )
  }

  return (
    <Screen tint={tema.accent}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 80 }}>
        <ScreenHeader
          back
          eyebrow="Zencrus · Ciclo"
          title="Ajustes"
          icon="options"
          color={tema.accent}
        />

        {/* ── Modo de vida ───────────────────────────────────────────── */}
        <Seccion
          eyebrow="Tu situación"
          titulo="Modo"
          color={tema.accent}
          nota="Cambia qué se calcula y qué aparece. Cambiarlo nunca borra nada de lo que ya has registrado."
        >
          <View style={s.modos}>
            {MODOS.map(id => (
              <FilaModo
                key={id}
                id={id}
                activo={id === modoActual}
                tono={tema.accent}
                onPress={() => { elegir(); void setModo(id) }}
              />
            ))}
          </View>
        </Seccion>

        {/* ── Privacidad ─────────────────────────────────────────────── */}
        <Seccion
          eyebrow="Privacidad"
          color={tema.accent}
          nota="Estos son los datos más sensibles que guarda ZENCRUS."
        >
          <Placa>
            <View style={s.fila}>
              <View style={s.flex}>
                <Text style={s.filaTitulo}>Pedir tu huella o cara al entrar</Text>
                <Text style={s.filaNota}>
                  Se pide cada vez que se abre esta sección, aunque el teléfono ya
                  esté desbloqueado.
                </Text>
              </View>
              <Switch
                value={bloqueo}
                onValueChange={v => { elegir(); setBloqueo(v) }}
                trackColor={{ false: base.surface3, true: `${tema.accent}99` }}
                thumbColor={bloqueo ? tema.accent : base.textLow}
              />
            </View>
            <Filete />
            <View style={s.notaPrivacidad}>
              <Ionicons name="shield-checkmark-outline" size={16} color={base.ok} />
              <Text style={s.notaPrivacidadTxt}>
                Este módulo no lleva ningún SDK de analítica de terceros: nada de lo
                que registras aquí se envía a nadie más que a tu propia cuenta.
              </Text>
            </View>
          </Placa>
        </Seccion>

        {/* ── Tus datos ──────────────────────────────────────────────── */}
        <Seccion eyebrow="Tus datos" color={tema.accent}>
          <Placa>
            <Pressable
              onPress={() => void exportar()}
              disabled={exportando || !dias}
              style={({ pressed }) => [s.accion, pressed && s.pulsado, !dias && s.desactivada]}
            >
              <Ionicons name="download-outline" size={18} color={tema.accent} />
              <View style={s.flex}>
                <Text style={[s.accionTxt, { color: tema.accent }]}>
                  {exportando ? 'Preparando…' : 'Llevarme mis datos'}
                </Text>
                <Text style={s.filaNota}>
                  {dias
                    ? `${dias} ${dias === 1 ? 'día registrado' : 'días registrados'} y ${periodos.length} ${periodos.length === 1 ? 'periodo' : 'periodos'}, en JSON.`
                    : 'Todavía no hay nada que exportar.'}
                </Text>
              </View>
            </Pressable>
            <Filete />
            <Pressable
              onPress={borrar}
              disabled={!dias}
              style={({ pressed }) => [s.accion, pressed && s.pulsado, !dias && s.desactivada]}
            >
              <Ionicons name="trash-outline" size={18} color={base.danger} />
              <View style={s.flex}>
                <Text style={[s.accionTxt, { color: base.danger }]}>Borrar todo mi ciclo</Text>
                <Text style={s.filaNota}>
                  Aquí y en el servidor. Sin pedir permiso a nadie y sin poder deshacerse.
                </Text>
              </View>
            </Pressable>
          </Placa>
        </Seccion>
      </ScrollView>
    </Screen>
  )
}

function FilaModo({ id, activo, tono, onPress }: {
  id: ModoVida; activo: boolean; tono: string; onPress: () => void
}) {
  const m = MODO[id]
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        s.modo,
        activo && { backgroundColor: `${tono}1A`, borderColor: tono },
        pressed && s.pulsado,
      ]}
      accessibilityRole="radio"
      accessibilityState={{ selected: activo }}
    >
      <Ionicons
        name={activo ? 'radio-button-on' : 'radio-button-off'}
        size={18}
        color={activo ? tono : base.textLow}
      />
      <View style={s.flex}>
        <Text style={[s.modoTitulo, activo && { color: base.textHi }]}>{m.label}</Text>
        <Text style={s.modoDesc}>{m.descripcion}</Text>
        {activo && !m.predice ? (
          <View style={s.modoAviso}>
            <Eyebrow color={tono}>Sin predicción</Eyebrow>
            <Text style={s.modoAvisoTxt}>{m.motivo}</Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  )
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  pulsado: { opacity: 0.7 },
  desactivada: { opacity: 0.4 },

  modos: { marginTop: space.md, gap: space.sm },
  modo: {
    flexDirection: 'row', gap: space.sm + 2, alignItems: 'flex-start',
    padding: space.md, borderRadius: radius.lg,
    backgroundColor: base.surface1, borderWidth: 1, borderColor: 'transparent',
  },
  modoTitulo: { fontFamily: family.uiSemi, fontSize: tipo.ui.md, color: base.textMid },
  modoDesc: { fontFamily: family.ui, fontSize: tipo.ui.xs, color: base.textLow, marginTop: 2 },
  modoAviso: { marginTop: space.sm, gap: 3 },
  modoAvisoTxt: {
    fontFamily: family.ui, fontSize: tipo.ui.xs, color: base.textMid,
    lineHeight: tipo.ui.xs * 1.55,
  },

  fila: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingBottom: space.md - 2 },
  filaTitulo: { fontFamily: family.uiMedium, fontSize: tipo.ui.sm, color: base.textHi },
  filaNota: {
    fontFamily: family.ui, fontSize: tipo.ui.xs, color: base.textLow,
    marginTop: 2, lineHeight: tipo.ui.xs * 1.45,
  },

  notaPrivacidad: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-start', paddingTop: space.md - 2 },
  notaPrivacidadTxt: {
    flex: 1, fontFamily: family.ui, fontSize: tipo.ui.xs, color: base.textMid,
    lineHeight: tipo.ui.xs * 1.55,
  },

  accion: { flexDirection: 'row', gap: space.sm + 2, alignItems: 'flex-start', paddingVertical: space.md - 2 },
  accionTxt: { fontFamily: family.uiSemi, fontSize: tipo.ui.sm },
})

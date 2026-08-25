/**
 * COMUNIDAD · DENUNCIAR
 * ─────────────────────
 * Elegir un motivo, contar más si hace falta, y enviarlo.
 *
 * ── Por qué es una pantalla y no un menú ────────────────────────────────────
 * Los motivos son ocho. Un menú del sistema con ocho botones se convierte en
 * una lista gris sin jerarquía donde no se lee ninguno, y en Android ni cabe.
 * Aquí cada motivo tiene su sitio y se puede leer antes de tocar — que es lo
 * mínimo cuando lo que se está haciendo es acusar a alguien.
 *
 * ── Arriba, lo que estás denunciando ────────────────────────────────────────
 * Con su foto y su primera línea. Desde el menú de una tarjeta del muro se
 * llega aquí después de haber desplazado, y sin esto no hay forma de comprobar
 * que es la publicación que creías. Denunciar la equivocada no tiene deshacer.
 *
 * ── Denunciar no esconde nada ───────────────────────────────────────────────
 * Se dice en la propia pantalla, porque si no la expectativa es que el
 * contenido desaparezca y no desaparece: la denuncia va a una cola que revisa
 * una persona. Lo que sí quita el problema de delante ahora mismo es bloquear,
 * y por eso se ofrece justo después de enviar.
 */

import { useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert,
  KeyboardAvoidingView, Platform,
} from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { Image } from '@/components/ui/Imagen'
import * as Haptics from 'expo-haptics'
import { Screen, ScreenHeader } from '@/components/ui/Screen'
import { useAppTheme } from '@/context/ThemeContext'
import { Btn, confirmarBloqueo } from '@/components/social/Bits'
import * as S from '@/services/socialService'
import { TabBar } from '@/constants/layout'

export default function ReportScreen() {
  const T = useAppTheme()
  const { tipo, id, nombre, autorId, foto, resumen } = useLocalSearchParams<{
    tipo: S.ReportTarget
    id: string
    nombre?: string
    /** Quién publicó lo denunciado, para poder ofrecer bloquearle al final. */
    autorId?: string
    /** Miniatura y primera línea de lo denunciado, para poder reconocerlo. */
    foto?: string
    resumen?: string
  }>()

  const [motivo, setMotivo] = useState<S.ReportReason | null>(null)
  const [detalle, setDetalle] = useState('')
  const [enviando, setEnviando] = useState(false)

  const queEs = tipo === 'user' ? 'esta cuenta'
    : tipo === 'comment' ? 'este comentario'
    : tipo === 'message' ? 'este mensaje'
    : 'esta publicación'

  const enviar = async () => {
    if (!motivo || !id || enviando) return
    setEnviando(true)
    try {
      const r = await S.reportContent(tipo, id, motivo, detalle.trim() || undefined)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})

      // A quién se podría bloquear: la cuenta denunciada, o quien publicó lo
      // denunciado. Si no sabemos de quién es, no se ofrece.
      const aQuien = tipo === 'user' ? id : autorId

      Alert.alert(
        r.alreadyReported ? 'Ya nos lo habías contado' : 'Gracias por avisar',
        r.alreadyReported
          ? 'Esta denuncia ya estaba en la cola. No hace falta repetirla.'
          : 'Alguien lo va a revisar. No podemos contarte en qué queda, pero sí lo miramos.',
        aQuien
          ? [
              { text: 'Listo', style: 'cancel', onPress: () => router.back() },
              {
                text: 'Bloquear también',
                style: 'destructive',
                onPress: () => {
                  router.back()
                  confirmarBloqueo(aQuien, nombre)
                },
              },
            ]
          : [{ text: 'Listo', onPress: () => router.back() }],
      )
    } catch (e) {
      Alert.alert('No pudimos enviarla', S.errorText(e))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Screen>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScreenHeader
          back
          eyebrow="COMUNIDAD"
          title="Denunciar"
          subtitle={nombre ? `${queEs} de @${nombre}` : `Denunciar ${queEs}`}
          icon="flag"
        />

        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: TabBar.scrollInset }}
          keyboardShouldPersistTaps="handled"
        >
          {(!!foto || !!resumen) && (
            <View style={[s.queEs, { borderColor: T.glassBorder }]}>
              {!!foto && (
                <Image source={{ uri: foto }} style={s.queEsFoto} contentFit="cover" transition={160} />
              )}
              <View style={{ flex: 1 }}>
                <Text style={[s.queEsQuien, { color: T.ink }]} numberOfLines={1}>
                  {nombre ? `@${nombre}` : 'Cuenta ZENCRUS'}
                </Text>
                {!!resumen && (
                  <Text style={[s.queEsTxt, { color: T.ink3 }]} numberOfLines={2}>{resumen}</Text>
                )}
              </View>
            </View>
          )}

          <Text style={[s.etiqueta, { color: T.ink3 }]}>¿QUÉ PASA?</Text>

          {S.REPORT_REASONS.map((m, idx) => {
            const activo = motivo === m.key
            return (
              <View key={m.key}>
                {idx > 0 && <View style={[s.raya, { backgroundColor: T.glassBorder }]} />}
                <TouchableOpacity
                  style={s.opcion}
                  onPress={() => { Haptics.selectionAsync().catch(() => {}); setMotivo(m.key) }}
                  activeOpacity={0.7}
                >
                  <Text style={[s.opcionTxt, { color: activo ? T.ink : T.ink2 }]}>{m.label}</Text>
                  {activo && <Ionicons name="checkmark" size={17} color={T.accent} />}
                </TouchableOpacity>
              </View>
            )
          })}

          <Text style={[s.etiqueta, { color: T.ink3, marginTop: 22 }]}>
            ALGO MÁS QUE DEBERÍAMOS SABER (OPCIONAL)
          </Text>
          <View style={[s.caja, { backgroundColor: T.glass, borderColor: T.glassBorder }]}>
            <TextInput
              style={[s.input, { color: T.ink }]}
              placeholder="Cuéntanos lo que haga falta"
              placeholderTextColor={T.ink3}
              value={detalle}
              onChangeText={t => t.length <= 1000 && setDetalle(t)}
              multiline
              textAlignVertical="top"
            />
          </View>

          <View style={[s.nota, { backgroundColor: T.glass, borderColor: T.glassBorder }]}>
            <Ionicons name="information-circle-outline" size={16} color={T.ink3} />
            <Text style={[s.notaTxt, { color: T.ink3 }]}>
              Denunciar no oculta nada por sí solo, y la otra persona no se entera.
              Si quieres dejar de verla, bloquéala.
            </Text>
          </View>

        </ScrollView>

        {/* Anclado: los ocho motivos no caben en pantalla y con el botón al
            final del desplazamiento había que bajar del todo para enviar. */}
        <View style={[s.pie, { backgroundColor: T.bgSurface, borderColor: T.glassBorder }]}>
          <Btn label="Enviar denuncia" onPress={enviar} tone="solid" icon="flag"
            disabled={!motivo} loading={enviando} />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  )
}

const s = StyleSheet.create({
  queEs: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingBottom: 16, marginBottom: 18, borderBottomWidth: 1,
  },
  queEsFoto: { width: 52, height: 52, borderRadius: 9 },
  queEsQuien: { fontSize: 13, fontWeight: '700' },
  queEsTxt: { fontSize: 12, lineHeight: 17, marginTop: 3 },
  raya: { height: 1 },
  // El hueco de abajo es el de la píldora flotante: la barra de pestañas se
  // dibuja también en las pantallas hondas, y sin esto se comía el botón.
  pie: { padding: 16, paddingBottom: TabBar.scrollInset, borderTopWidth: 1 },
  etiqueta: { fontSize: 10, fontWeight: '900', letterSpacing: 2, marginBottom: 11 },
  // Sin caja: filas separadas por un filo. Ocho cajas apiladas se leen como
  // ocho botones y ninguno destaca.
  opcion: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 14 },
  opcionTxt: { flex: 1, fontSize: 14.5, fontWeight: '600' },
  caja: { borderRadius: 16, borderWidth: 1, padding: 14 },
  input: { fontSize: 15, lineHeight: 22, minHeight: 90 },
  nota: {
    flexDirection: 'row', gap: 10, alignItems: 'flex-start',
    padding: 14, borderRadius: 15, borderWidth: 1, marginTop: 18,
  },
  notaTxt: { flex: 1, fontSize: 12, lineHeight: 18 },
})

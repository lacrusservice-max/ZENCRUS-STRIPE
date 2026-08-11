/**
 * COMUNIDAD · PUBLICAR
 * ────────────────────
 * Crea una publicación o una historia.
 *
 * ── Los archivos suben ANTES de publicar ────────────────────────────────────
 * Al elegir una foto empieza su subida al bucket en segundo plano, mientras la
 * persona escribe el texto. Cuando pulsa «Publicar», lo normal es que ya estén
 * arriba y la publicación sea instantánea. Si subiera todo al pulsar, un vídeo
 * de veinte megas dejaría el botón girando medio minuto con la pantalla
 * bloqueada.
 *
 * ── Una historia es distinta ────────────────────────────────────────────────
 * Lleva exactamente un archivo, caduca en 24 horas y no admite texto suelto: lo
 * exige el servidor y aquí se refleja para no dejar mandar algo que va a ser
 * rechazado.
 */

import { useCallback, useState } from 'react'
import {
  View, Text, StyleSheet, TextInput, ScrollView, TouchableOpacity, Alert,
  KeyboardAvoidingView, Platform, ActivityIndicator, useWindowDimensions,
} from 'react-native'
import { Image } from 'expo-image'
import { router, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import * as Haptics from 'expo-haptics'
import { Screen, ScreenHeader } from '@/components/ui/Screen'
import { useAppTheme } from '@/context/ThemeContext'
import { useSocialStore } from '@/store/socialStore'
import { Btn } from '@/components/social/Bits'
import {
  uploadMedia, createPost, errorText, guessType,
  type NewPostMedia,
} from '@/services/socialService'

const MAX_PIEZAS = 5
const MAX_TEXTO = 2200

/** Una pieza elegida, con el estado de su subida. */
interface Pieza {
  uri: string
  width?: number
  height?: number
  durationMs?: number
  tipo: 'image' | 'video'
  estado: 'subiendo' | 'lista' | 'error'
  key?: string
  contentType?: string
}

export default function ComposeScreen() {
  const T = useAppTheme()
  const { width } = useWindowDimensions()
  const params = useLocalSearchParams<{ kind?: string }>()
  const esHistoria = params.kind === 'story'

  const [texto, setTexto] = useState('')
  const [piezas, setPiezas] = useState<Pieza[]>([])
  const [publica, setPublica] = useState(true)
  const [enviando, setEnviando] = useState(false)

  const prependPost = useSocialStore(s => s.prependPost)
  const loadStories = useSocialStore(s => s.loadStories)

  const tope = esHistoria ? 1 : MAX_PIEZAS

  // ── Elegir y subir ─────────────────────────────────────────────────────────

  const elegir = useCallback(async () => {
    const permiso = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permiso.granted) {
      Alert.alert(
        'Sin acceso a tus fotos',
        'Para publicar necesitamos permiso para ver tu galería. Puedes dárnoslo desde los ajustes del teléfono.',
      )
      return
    }

    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsMultipleSelection: !esHistoria,
      selectionLimit: tope - piezas.length,
      quality: 0.85,
      videoMaxDuration: 30,
    })
    if (res.canceled) return

    const nuevas: Pieza[] = res.assets.slice(0, tope - piezas.length).map(a => ({
      uri: a.uri,
      width: a.width,
      height: a.height,
      durationMs: a.duration ? Math.round(a.duration) : undefined,
      tipo: a.type === 'video' ? 'video' : 'image',
      estado: 'subiendo',
    }))

    setPiezas(p => [...p, ...nuevas])

    // Cada una sube por su cuenta: si una falla, las demás siguen.
    for (const pieza of nuevas) {
      uploadMedia(pieza.uri, esHistoria ? 'story' : 'post')
        .then(({ key, contentType }) => {
          setPiezas(p => p.map(x => x.uri === pieza.uri
            ? { ...x, estado: 'lista', key, contentType } : x))
        })
        .catch(e => {
          setPiezas(p => p.map(x => x.uri === pieza.uri ? { ...x, estado: 'error' } : x))
          Alert.alert('No pudimos subir el archivo', errorText(e))
        })
    }
  }, [piezas.length, esHistoria, tope])

  const quitar = (uri: string) => setPiezas(p => p.filter(x => x.uri !== uri))

  // ── Publicar ───────────────────────────────────────────────────────────────

  const listas = piezas.filter(p => p.estado === 'lista')
  const subiendo = piezas.some(p => p.estado === 'subiendo')
  const puede = esHistoria
    ? listas.length === 1 && !subiendo
    : (texto.trim().length > 0 || listas.length > 0) && !subiendo

  const publicar = async () => {
    if (!puede || enviando) return
    setEnviando(true)
    try {
      const media: NewPostMedia[] = listas.map(p => ({
        key: p.key!,
        contentType: p.contentType ?? guessType(p.uri),
        width: p.width,
        height: p.height,
        durationMs: p.durationMs,
      }))

      const post = await createPost({
        content: texto.trim() || undefined,
        kind: esHistoria ? 'story' : 'post',
        visibility: esHistoria ? 'followers' : (publica ? 'public' : 'followers'),
        media: media.length ? media : undefined,
      })

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
      if (esHistoria) loadStories()
      else prependPost(post)
      router.back()
    } catch (e) {
      Alert.alert('No pudimos publicar', errorText(e))
    } finally {
      setEnviando(false)
    }
  }

  // ── Interfaz ───────────────────────────────────────────────────────────────

  const ladoMiniatura = (width - 40 - 24) / 3

  return (
    <Screen>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={10}
      >
        <ScreenHeader
          back
          eyebrow="COMUNIDAD"
          title={esHistoria ? 'Nueva historia' : 'Nueva publicación'}
          subtitle={esHistoria ? 'Desaparece sola a las 24 horas' : undefined}
          icon={esHistoria ? 'flash' : 'create'}
          right={
            <Btn
              label="Publicar"
              onPress={publicar}
              tone="solid"
              small
              disabled={!puede}
              loading={enviando}
            />
          }
        />

        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: 60 }}
          keyboardShouldPersistTaps="handled"
        >
          {!esHistoria && (
            <View style={[s.caja, { backgroundColor: T.glass, borderColor: T.glassBorder }]}>
              <TextInput
                style={[s.input, { color: T.ink }]}
                placeholder="¿Qué quieres contar?"
                placeholderTextColor={T.ink3}
                value={texto}
                onChangeText={t => t.length <= MAX_TEXTO && setTexto(t)}
                multiline
                textAlignVertical="top"
                autoFocus={!piezas.length}
              />
              <Text style={[s.contador, { color: texto.length > MAX_TEXTO - 100 ? T.accent : T.ink3 }]}>
                {texto.length} / {MAX_TEXTO}
              </Text>
            </View>
          )}

          {/* Piezas elegidas */}
          <View style={s.rejilla}>
            {piezas.map(p => (
              <View
                key={p.uri}
                style={[
                  s.mini,
                  { width: ladoMiniatura, height: ladoMiniatura, borderColor: T.glassBorder },
                ]}
              >
                <Image source={{ uri: p.uri }} style={s.miniImg} contentFit="cover" />
                {p.estado === 'subiendo' && (
                  <View style={s.velo}>
                    <ActivityIndicator color="#fff" size="small" />
                    <Text style={s.veloTxt}>Subiendo…</Text>
                  </View>
                )}
                {p.estado === 'error' && (
                  <View style={[s.velo, { backgroundColor: 'rgba(255,31,61,0.55)' }]}>
                    <Ionicons name="alert-circle" size={19} color="#fff" />
                    <Text style={s.veloTxt}>Falló</Text>
                  </View>
                )}
                {p.tipo === 'video' && p.estado === 'lista' && (
                  <View style={s.videoMarca}>
                    <Ionicons name="videocam" size={12} color="#fff" />
                  </View>
                )}
                <TouchableOpacity style={s.quitar} onPress={() => quitar(p.uri)} hitSlop={8}>
                  <Ionicons name="close" size={13} color="#fff" />
                </TouchableOpacity>
              </View>
            ))}

            {piezas.length < tope && (
              <TouchableOpacity
                style={[
                  s.anadir,
                  { width: ladoMiniatura, height: ladoMiniatura, borderColor: T.glassBorder, backgroundColor: T.glass },
                ]}
                onPress={elegir}
                activeOpacity={0.75}
              >
                <Ionicons name="images-outline" size={22} color={T.ink3} />
                <Text style={[s.anadirTxt, { color: T.ink3 }]}>
                  {esHistoria ? 'Elegir' : `${piezas.length}/${tope}`}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {esHistoria && !piezas.length && (
            <Text style={[s.pista, { color: T.ink3 }]}>
              Una historia lleva exactamente una foto o un vídeo, y desaparece sola a las 24 horas.
            </Text>
          )}

          {/* Quién puede verla */}
          {!esHistoria && (
            <View style={{ marginTop: 22 }}>
              <Text style={[s.etiqueta, { color: T.ink3 }]}>QUIÉN PUEDE VERLA</Text>
              {[
                { v: true, icon: 'globe-outline', t: 'Todo el mundo', d: 'Sale en el muro «Para ti» de cualquiera' },
                { v: false, icon: 'people-outline', t: 'Solo mis seguidores', d: 'Únicamente quien ya me sigue' },
              ].map(o => {
                const activo = publica === o.v
                return (
                  <TouchableOpacity
                    key={String(o.v)}
                    style={[
                      s.opcion,
                      {
                        backgroundColor: activo ? `${T.accent}14` : T.glass,
                        borderColor: activo ? `${T.accent}3A` : T.glassBorder,
                      },
                    ]}
                    onPress={() => { Haptics.selectionAsync().catch(() => {}); setPublica(o.v) }}
                    activeOpacity={0.8}
                  >
                    <Ionicons name={o.icon as any} size={18} color={activo ? T.accent : T.ink3} />
                    <View style={{ flex: 1 }}>
                      <Text style={[s.opcionT, { color: activo ? T.ink : T.ink2 }]}>{o.t}</Text>
                      <Text style={[s.opcionD, { color: T.ink3 }]}>{o.d}</Text>
                    </View>
                    <View style={[
                      s.radio,
                      { borderColor: activo ? T.accent : T.ink4 },
                      activo && { backgroundColor: T.accent },
                    ]}>
                      {activo && <Ionicons name="checkmark" size={11} color="#fff" />}
                    </View>
                  </TouchableOpacity>
                )
              })}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  )
}

const s = StyleSheet.create({
  caja: { borderRadius: 20, borderWidth: 1, padding: 15 },
  input: { fontSize: 16, lineHeight: 23, minHeight: 110 },
  contador: { fontSize: 11, textAlign: 'right', marginTop: 8 },
  rejilla: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 16 },
  mini: { borderRadius: 15, borderWidth: 1, overflow: 'hidden' },
  miniImg: { width: '100%', height: '100%' },
  velo: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center', gap: 5,
  },
  veloTxt: { color: '#fff', fontSize: 10.5, fontWeight: '700' },
  videoMarca: {
    position: 'absolute', bottom: 6, left: 6,
    backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 7, padding: 4,
  },
  quitar: {
    position: 'absolute', top: 5, right: 5,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.68)',
    alignItems: 'center', justifyContent: 'center',
  },
  anadir: {
    borderRadius: 15, borderWidth: 1, borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  anadirTxt: { fontSize: 11, fontWeight: '700' },
  pista: { fontSize: 12.5, lineHeight: 19, marginTop: 14 },
  etiqueta: { fontSize: 10, fontWeight: '900', letterSpacing: 2, marginBottom: 10 },
  opcion: {
    flexDirection: 'row', alignItems: 'center', gap: 13,
    padding: 14, borderRadius: 17, borderWidth: 1, marginBottom: 10,
  },
  opcionT: { fontSize: 14, fontWeight: '700' },
  opcionD: { fontSize: 11.5, marginTop: 2 },
  radio: {
    width: 20, height: 20, borderRadius: 10, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
  },
})

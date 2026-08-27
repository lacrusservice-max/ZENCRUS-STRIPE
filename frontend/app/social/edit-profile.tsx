/**
 * COMUNIDAD · EDITAR PERFIL
 * ─────────────────────────
 * Portada, foto, nombre de usuario, nombre visible, biografía y privacidad.
 *
 * ── La portada se elige; antes se heredaba ──────────────────────────────────
 * La banda de arriba del perfil salía de la foto de tu última publicación. Se
 * veía bien, pero no había forma de decidirla: subías una foto de la comida y
 * la cabecera pasaba a ser eso. Ahora se elige aquí, y si no eliges ninguna se
 * sigue cayendo a la última publicación, que era el comportamiento de antes.
 *
 * ── El interruptor de privacidad avisa antes de abrir ───────────────────────
 * Pasar de privada a pública no pide confirmación: no expone nada que no
 * decidas publicar después. Al revés tampoco, pero se explica qué cambia — la
 * gente cree que cerrar la cuenta echa a quien ya la sigue, y no es así.
 *
 * ── Salir no tira lo escrito ────────────────────────────────────────────────
 * Guardar es un botón de la cabecera, justo al lado de la flecha de atrás. Sin
 * aviso, escribir la biografía y tocar la flecha —o deslizar desde el borde—
 * la borraba sin decir nada. `usePreventRemove` intercepta las tres salidas:
 * flecha, gesto y botón físico de Android.
 *
 * ── El usuario se comprueba al guardar, no al escribir ──────────────────────
 * El servidor devuelve 409 si ya está cogido y ese mensaje se enseña tal cual.
 * Preguntar en cada tecla si está libre sería una petición por letra, y el
 * limitador del servidor corta a las cien por cuarto de hora.
 */

import { useEffect, useMemo, useState } from 'react'
import {
  View, Text, StyleSheet, TextInput, ScrollView, TouchableOpacity, Alert,
  KeyboardAvoidingView, Platform, Switch, ActivityIndicator,
} from 'react-native'
import { router, useNavigation } from 'expo-router'
import { usePreventRemove } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import * as Haptics from 'expo-haptics'
import { Screen, ScreenHeader } from '@/components/ui/Screen'
import { useAppTheme } from '@/context/ThemeContext'
import { useSocialStore } from '@/store/socialStore'
import { Avatar, Btn } from '@/components/social/Bits'
import { Image } from '@/components/ui/Imagen'
import * as S from '@/services/socialService'
import { TabBar } from '@/constants/layout'

export default function EditProfileScreen() {
  const T = useAppTheme()
  const navigation = useNavigation()
  const me = useSocialStore(s => s.me)
  const patchMe = useSocialStore(s => s.patchMe)
  const loadMe = useSocialStore(s => s.loadMe)

  const [usuario, setUsuario] = useState('')
  const [nombre, setNombre] = useState('')
  const [bio, setBio] = useState('')
  const [privada, setPrivada] = useState(false)
  const [avatar, setAvatar] = useState<string | null>(null)   // lo que se ve
  const [claveNueva, setClaveNueva] = useState<string | null>(null)
  const [portada, setPortada] = useState<string | null>(null)
  const [clavePortada, setClavePortada] = useState<string | null>(null)
  const [subiendo, setSubiendo] = useState(false)
  const [subiendoPortada, setSubiendoPortada] = useState(false)
  const [guardando, setGuardando] = useState(false)
  /** Se enciende al guardar bien; el efecto de abajo es quien cierra. */
  const [saliendo, setSaliendo] = useState(false)

  useEffect(() => {
    if (!me) { loadMe(); return }
    setUsuario(me.username ?? '')
    setNombre(me.fullName ?? '')
    setBio(me.bio ?? '')
    setPrivada(me.isPrivate)
    setAvatar(me.avatar)
    setPortada(me.coverImage ?? null)
  }, [me?.id])

  /** Qué hay distinto respecto a lo que está guardado. */
  const sucio = useMemo(() => !!me && (
    usuario.trim().toLowerCase() !== (me.username ?? '')
    || nombre.trim() !== (me.fullName ?? '')
    || bio.trim() !== (me.bio ?? '')
    || privada !== me.isPrivate
    || !!claveNueva
    || (avatar === null && !!me.avatar)
    || !!clavePortada
    || (portada === null && !!me.coverImage)
  ), [me, usuario, nombre, bio, privada, claveNueva, avatar, clavePortada, portada])

  usePreventRemove(sucio && !guardando && !saliendo, ({ data }) => {
    Alert.alert(
      '¿Salir sin guardar?',
      'Lo que has cambiado se perderá.',
      [
        { text: 'Seguir editando', style: 'cancel' },
        {
          text: 'Salir igualmente',
          style: 'destructive',
          // `data.action` es la salida que se interceptó: repetirla la deja pasar.
          onPress: () => navigation.dispatch(data.action),
        },
      ],
    )
  })

  // Cerrar en un efecto y no dentro de `guardar`: así el aviso de arriba ya se
  // ha apagado cuando se navega, y no salta sobre nuestra propia salida.
  useEffect(() => { if (saliendo) router.back() }, [saliendo])

  const cambiarFoto = async () => {
    const permiso = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permiso.granted) {
      Alert.alert('Sin acceso a tus fotos', 'Dale permiso desde los ajustes del teléfono.')
      return
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.9,
    })
    if (res.canceled) return

    setAvatar(res.assets[0].uri)   // se ve al momento, aún sin subir
    setSubiendo(true)
    try {
      const { key } = await S.uploadMedia(res.assets[0].uri, 'avatar')
      setClaveNueva(key)
    } catch (e) {
      setAvatar(me?.avatar ?? null)
      Alert.alert('No pudimos subir la foto', S.errorText(e))
    } finally {
      setSubiendo(false)
    }
  }

  const cambiarPortada = async () => {
    const permiso = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permiso.granted) {
      Alert.alert('Sin acceso a tus fotos', 'Dale permiso desde los ajustes del teléfono.')
      return
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      // 16:9 porque es la proporción de la banda del perfil: recortar aquí
      // evita que la foto se corte sola y por sitios que no elegiste.
      mediaTypes: ['images'], allowsEditing: true, aspect: [16, 9], quality: 0.9,
    })
    if (res.canceled) return

    setPortada(res.assets[0].uri)
    setSubiendoPortada(true)
    try {
      const { key } = await S.uploadMedia(res.assets[0].uri, 'cover')
      setClavePortada(key)
    } catch (e) {
      setPortada(me?.coverImage ?? null)
      Alert.alert('No pudimos subir la portada', S.errorText(e))
    } finally {
      setSubiendoPortada(false)
    }
  }

  const quitarPortada = () => {
    setPortada(null)
    setClavePortada(null)
  }

  const quitarFoto = () => {
    setAvatar(null)
    setClaveNueva(null)
  }

  const guardar = async () => {
    if (guardando || subiendo || subiendoPortada) return
    const u = usuario.trim().toLowerCase()

    if (u && !/^[a-zA-Z0-9._]{3,24}$/.test(u)) {
      Alert.alert(
        'Ese usuario no vale',
        'Entre 3 y 24 caracteres, solo letras, números, punto y guion bajo. Sin espacios ni acentos.',
      )
      return
    }

    setGuardando(true)
    try {
      const patch: S.ProfilePatch = {
        fullName: nombre.trim(),
        bio: bio.trim(),
        isPrivate: privada,
      }
      if (u && u !== me?.username) patch.username = u
      // Solo se manda la foto si cambió: mandar la misma clave otra vez haría
      // que el servidor borrara el archivo y lo volviera a apuntar.
      if (claveNueva) patch.avatar = claveNueva
      else if (avatar === null && me?.avatar) patch.avatar = null

      if (clavePortada) patch.coverImage = clavePortada
      else if (portada === null && me?.coverImage) patch.coverImage = null

      await patchMe(patch)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
      setSaliendo(true)
    } catch (e: any) {
      Alert.alert(
        e?.response?.status === 409 ? 'Ese usuario ya está cogido' : 'No pudimos guardar',
        S.errorText(e),
      )
    } finally {
      setGuardando(false)
    }
  }

  const campo = (
    label: string, valor: string, set: (v: string) => void,
    props: any = {},
  ) => (
    <View style={{ marginBottom: 18 }}>
      <Text style={[s.etiqueta, { color: T.ink3 }]}>{label}</Text>
      <View style={[s.caja, { backgroundColor: T.glass, borderColor: T.glassBorder }]}>
        <TextInput
          style={[s.input, { color: T.ink }, props.multiline && { minHeight: 76 }]}
          value={valor}
          onChangeText={set}
          placeholderTextColor={T.ink3}
          {...props}
        />
      </View>
      {props.hint && <Text style={[s.pista, { color: T.ink3 }]}>{props.hint}</Text>}
    </View>
  )

  return (
    <Screen>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScreenHeader
          back
          eyebrow="COMUNIDAD"
          title="Editar perfil"
          icon="create"
          right={
            <Btn label="Guardar" onPress={guardar} tone="solid" small
              loading={guardando} disabled={subiendo || subiendoPortada} />
          }
        />

        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: TabBar.scrollInset }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Portada */}
          <Text style={[s.etiqueta, { color: T.ink3 }]}>PORTADA</Text>
          <TouchableOpacity
            style={[s.portadaCaja, { backgroundColor: T.glass, borderColor: T.glassBorder }]}
            onPress={cambiarPortada}
            activeOpacity={0.85}
            disabled={subiendoPortada}
          >
            {portada ? (
              <Image source={{ uri: portada }} style={s.portadaImg} contentFit="cover" transition={180} />
            ) : (
              <View style={s.portadaVacia}>
                <Ionicons name="image-outline" size={22} color={T.ink3} />
                <Text style={[s.portadaTxt, { color: T.ink3 }]}>
                  Sin portada: se usa tu última publicación
                </Text>
              </View>
            )}
            {subiendoPortada && (
              <View style={s.portadaCargando}>
                <ActivityIndicator color="#fff" />
              </View>
            )}
          </TouchableOpacity>
          <View style={s.portadaBotones}>
            <Btn label={portada ? 'Cambiar portada' : 'Elegir portada'} onPress={cambiarPortada}
              tone="soft" small icon="image-outline" disabled={subiendoPortada} />
            {!!portada && (
              <Btn label="Quitar" onPress={quitarPortada} tone="ghost" small icon="trash-outline" />
            )}
          </View>

          {/* Foto */}
          <View style={s.foto}>
            <TouchableOpacity onPress={cambiarFoto} activeOpacity={0.8} disabled={subiendo}>
              <Avatar profile={{ ...(me ?? {} as any), avatar }} size={92} />
              <View style={[s.camara, { backgroundColor: T.accent, borderColor: T.bg }]}>
                {subiendo
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Ionicons name="camera" size={15} color="#fff" />}
              </View>
            </TouchableOpacity>
            <View style={{ gap: 8, flex: 1 }}>
              <Btn label={subiendo ? 'Subiendo…' : 'Cambiar foto'} onPress={cambiarFoto}
                tone="soft" small icon="image-outline" disabled={subiendo} />
              {!!avatar && (
                <Btn label="Quitar foto" onPress={quitarFoto} tone="ghost" small icon="trash-outline" />
              )}
            </View>
          </View>

          {/* Se baja a minúsculas al teclear, no al guardar: el servidor lo
              hace igual, y verlo cambiar después es peor que verlo ya así. */}
          {campo('NOMBRE DE USUARIO', usuario, v => setUsuario(v.toLowerCase()), {
            placeholder: 'tu.usuario',
            autoCapitalize: 'none',
            autoCorrect: false,
            maxLength: 24,
            hint: 'Así te encuentran los demás. Sin espacios ni acentos.',
          })}

          {campo('NOMBRE VISIBLE', nombre, setNombre, {
            placeholder: 'Tu nombre',
            maxLength: 60,
          })}

          {campo('BIOGRAFÍA', bio, setBio, {
            placeholder: 'Cuenta algo de ti en pocas palabras',
            multiline: true,
            maxLength: 160,
            textAlignVertical: 'top',
            hint: `${bio.length} / 160`,
          })}

          {/* Privacidad */}
          <Text style={[s.etiqueta, { color: T.ink3, marginTop: 6 }]}>PRIVACIDAD</Text>
          <View style={[s.privacidad, { backgroundColor: T.glass, borderColor: T.glassBorder }]}>
            <View style={[s.icono, { backgroundColor: `${T.accent}18`, borderColor: `${T.accent}30` }]}>
              <Ionicons name={privada ? 'lock-closed' : 'globe-outline'} size={18} color={T.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.privTitulo, { color: T.ink }]}>Cuenta privada</Text>
              <Text style={[s.privTexto, { color: T.ink3 }]}>
                {privada
                  ? 'Solo quien aceptes ve tus publicaciones y tus seguidores.'
                  : 'Cualquiera puede ver lo que publiques como abierto.'}
              </Text>
            </View>
            <Switch
              value={privada}
              onValueChange={v => { Haptics.selectionAsync().catch(() => {}); setPrivada(v) }}
              trackColor={{ false: T.ink4, true: `${T.accent}88` }}
              thumbColor={privada ? T.accent : '#f2f3f5'}
            />
          </View>

          {privada && (
            <Text style={[s.pista, { color: T.ink3, marginTop: 10 }]}>
              Quien ya te sigue lo seguirá haciendo: cerrar la cuenta no echa a nadie.
            </Text>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  )
}

const s = StyleSheet.create({
  portadaCaja: {
    height: 132, borderRadius: 17, borderWidth: 1, overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center',
  },
  portadaImg: { width: '100%', height: '100%' },
  portadaVacia: { alignItems: 'center', gap: 8, paddingHorizontal: 24 },
  portadaTxt: { fontSize: 12, textAlign: 'center' },
  portadaCargando: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(5,5,5,0.45)', alignItems: 'center', justifyContent: 'center',
  },
  portadaBotones: { flexDirection: 'row', gap: 8, marginTop: 10, marginBottom: 26 },
  foto: { flexDirection: 'row', alignItems: 'center', gap: 20, marginBottom: 26 },
  camara: {
    position: 'absolute', bottom: -2, right: -2,
    width: 30, height: 30, borderRadius: 15, borderWidth: 3,
    alignItems: 'center', justifyContent: 'center',
  },
  etiqueta: { fontSize: 10, fontWeight: '900', letterSpacing: 2, marginBottom: 9 },
  caja: { borderRadius: 15, borderWidth: 1, paddingHorizontal: 14 },
  input: { fontSize: 15, paddingVertical: 13, lineHeight: 21 },
  pista: { fontSize: 11.5, marginTop: 7, lineHeight: 17 },
  privacidad: {
    flexDirection: 'row', alignItems: 'center', gap: 13,
    padding: 14, borderRadius: 17, borderWidth: 1,
  },
  icono: {
    width: 38, height: 38, borderRadius: 13, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  privTitulo: { fontSize: 14.5, fontWeight: '700' },
  privTexto: { fontSize: 11.5, marginTop: 3, lineHeight: 16 },
})

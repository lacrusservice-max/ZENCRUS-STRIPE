/**
 * COMUNIDAD · EDITAR PERFIL
 * ─────────────────────────
 * Foto, nombre de usuario, nombre visible, biografía y privacidad.
 *
 * ── El interruptor de privacidad avisa antes de abrir ───────────────────────
 * Pasar de privada a pública no pide confirmación: no expone nada que no
 * decidas publicar después. Al revés tampoco, pero se explica qué cambia — la
 * gente cree que cerrar la cuenta echa a quien ya la sigue, y no es así.
 *
 * ── El usuario se comprueba al guardar, no al escribir ──────────────────────
 * El servidor devuelve 409 si ya está cogido y ese mensaje se enseña tal cual.
 * Preguntar en cada tecla si está libre sería una petición por letra, y el
 * limitador del servidor corta a las cien por cuarto de hora.
 */

import { useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, TextInput, ScrollView, TouchableOpacity, Alert,
  KeyboardAvoidingView, Platform, Switch, ActivityIndicator,
} from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import * as Haptics from 'expo-haptics'
import { Screen, ScreenHeader } from '@/components/ui/Screen'
import { useAppTheme } from '@/context/ThemeContext'
import { useSocialStore } from '@/store/socialStore'
import { Avatar, Btn } from '@/components/social/Bits'
import * as S from '@/services/socialService'

export default function EditProfileScreen() {
  const T = useAppTheme()
  const me = useSocialStore(s => s.me)
  const patchMe = useSocialStore(s => s.patchMe)
  const loadMe = useSocialStore(s => s.loadMe)

  const [usuario, setUsuario] = useState('')
  const [nombre, setNombre] = useState('')
  const [bio, setBio] = useState('')
  const [privada, setPrivada] = useState(false)
  const [avatar, setAvatar] = useState<string | null>(null)   // lo que se ve
  const [claveNueva, setClaveNueva] = useState<string | null>(null)
  const [subiendo, setSubiendo] = useState(false)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (!me) { loadMe(); return }
    setUsuario(me.username ?? '')
    setNombre(me.fullName ?? '')
    setBio(me.bio ?? '')
    setPrivada(me.isPrivate)
    setAvatar(me.avatar)
  }, [me?.id])

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

  const quitarFoto = () => {
    setAvatar(null)
    setClaveNueva(null)
  }

  const guardar = async () => {
    if (guardando || subiendo) return
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

      await patchMe(patch)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
      router.back()
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
              loading={guardando} disabled={subiendo} />
          }
        />

        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: 60 }}
          keyboardShouldPersistTaps="handled"
        >
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

          {campo('NOMBRE DE USUARIO', usuario, setUsuario, {
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
              thumbColor={privada ? T.accent : '#f4f4f5'}
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

import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator,
} from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAuthStore } from '@/store/authStore'
import { Colors, Typography, Spacing, BorderRadius, Glass } from '@/constants/theme'

export default function ResetPasswordScreen() {
  const { token } = useLocalSearchParams<{ token: string }>()
  const resetPassword = useAuthStore(s => s.resetPassword)

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const handleReset = async () => {
    if (!token) {
      Alert.alert('Enlace inválido', 'El enlace de recuperación no es válido. Solicita uno nuevo.')
      return
    }
    if (password.length < 8) {
      Alert.alert('Contraseña muy corta', 'Debe tener al menos 8 caracteres.')
      return
    }
    if (password !== confirm) {
      Alert.alert('No coinciden', 'Las contraseñas no son iguales.')
      return
    }

    setLoading(true)
    try {
      await resetPassword(token, password)
      setDone(true)
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? 'El enlace expiró o ya fue usado. Solicita uno nuevo.'
      Alert.alert('Error', msg)
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.content}>
          <View style={s.iconWrap}>
            <Text style={s.iconTxt}>🔓</Text>
          </View>
          <Text style={s.title}>Contraseña actualizada</Text>
          <Text style={s.subtitle}>
            Tu contraseña fue cambiada exitosamente. Ya puedes iniciar sesión con tu nueva contraseña.
          </Text>
          <TouchableOpacity style={s.btn} onPress={() => router.replace('/(auth)/login')}>
            <Text style={s.btnTxt}>Iniciar sesión</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={s.container}>
      <View style={s.content}>
        <TouchableOpacity style={s.back} onPress={() => router.back()}>
          <Text style={s.backTxt}>← Volver</Text>
        </TouchableOpacity>

        <View style={s.iconWrap}>
          <Text style={s.iconTxt}>🔑</Text>
        </View>
        <Text style={s.title}>Nueva contraseña</Text>
        <Text style={s.subtitle}>
          Elige una contraseña segura de al menos 8 caracteres.
        </Text>

        <View style={s.card}>
          <Text style={s.label}>Nueva contraseña</Text>
          <View style={s.inputWrap}>
            <TextInput
              style={s.input}
              value={password}
              onChangeText={setPassword}
              placeholder="Mínimo 8 caracteres"
              placeholderTextColor={Colors.dark.textTertiary}
              secureTextEntry={!showPwd}
              autoCapitalize="none"
            />
            <TouchableOpacity onPress={() => setShowPwd(v => !v)} style={s.eyeBtn}>
              <Text style={s.eyeTxt}>{showPwd ? '🙈' : '👁'}</Text>
            </TouchableOpacity>
          </View>

          <Text style={[s.label, { marginTop: Spacing[4] }]}>Confirmar contraseña</Text>
          <TextInput
            style={s.input}
            value={confirm}
            onChangeText={setConfirm}
            placeholder="Repite la contraseña"
            placeholderTextColor={Colors.dark.textTertiary}
            secureTextEntry={!showPwd}
            autoCapitalize="none"
          />

          {password.length > 0 && (
            <View style={s.strength}>
              <StrengthBar password={password} />
            </View>
          )}
        </View>

        <TouchableOpacity
          style={[s.btn, loading && s.btnOff]}
          onPress={handleReset}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={s.btnTxt}>Cambiar contraseña</Text>
          }
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

function StrengthBar({ password }: { password: string }) {
  const score = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ].filter(Boolean).length

  const colors = ['#ff3b30', '#ff9f0a', '#30d158', '#30d158']
  const labels = ['Débil', 'Regular', 'Buena', 'Fuerte']

  return (
    <View style={str.wrap}>
      <View style={str.bars}>
        {[0, 1, 2, 3].map(i => (
          <View
            key={i}
            style={[str.bar, { backgroundColor: i < score ? colors[score - 1] : Colors.dark.border }]}
          />
        ))}
      </View>
      <Text style={[str.lbl, { color: score > 0 ? colors[score - 1] : Colors.dark.textTertiary }]}>
        {score > 0 ? labels[score - 1] : ''}
      </Text>
    </View>
  )
}

const str = StyleSheet.create({
  wrap:  { flexDirection: 'row', alignItems: 'center', gap: Spacing[3], marginTop: Spacing[2] },
  bars:  { flex: 1, flexDirection: 'row', gap: 4 },
  bar:   { flex: 1, height: 4, borderRadius: 2 },
  lbl:   { fontSize: Typography.fontSize.xs, fontWeight: '700', width: 52, textAlign: 'right' },
})

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark.background },
  content:   { flex: 1, paddingHorizontal: Spacing[6], paddingTop: Spacing[4] },
  back:      { marginBottom: Spacing[6] },
  backTxt:   { color: Colors.primary[400], fontSize: Typography.fontSize.sm, fontWeight: '600' },
  iconWrap:  { width: 72, height: 72, borderRadius: 36, backgroundColor: Glass.purpleTint, borderWidth: 1, borderColor: Glass.purpleBorder, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing[5] },
  iconTxt:   { fontSize: 32 },
  title:     { fontSize: Typography.fontSize['2xl'], fontWeight: '800', color: Colors.dark.text, marginBottom: Spacing[2] },
  subtitle:  { fontSize: Typography.fontSize.sm, color: Colors.dark.textSecondary, lineHeight: 20, marginBottom: Spacing[6] },
  card:      { backgroundColor: Glass.card, borderWidth: 1, borderColor: Glass.cardBorder, borderRadius: BorderRadius.xl, padding: Spacing[5], marginBottom: Spacing[5] },
  label:     { fontSize: Typography.fontSize.xs, fontWeight: '700', color: Colors.dark.textTertiary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: Spacing[2] },
  inputWrap: { flexDirection: 'row', alignItems: 'center' },
  input:     { flex: 1, backgroundColor: Colors.dark.surface, borderWidth: 1.5, borderColor: Colors.dark.border, borderRadius: BorderRadius.lg, paddingHorizontal: Spacing[4], paddingVertical: Spacing[3], fontSize: Typography.fontSize.base, color: Colors.dark.text },
  eyeBtn:    { position: 'absolute', right: Spacing[3], padding: Spacing[2] },
  eyeTxt:    { fontSize: 16 },
  strength:  { marginTop: Spacing[2] },
  btn:       { backgroundColor: Colors.primary[500], borderRadius: BorderRadius.lg, paddingVertical: Spacing[4], alignItems: 'center' },
  btnOff:    { opacity: 0.5 },
  btnTxt:    { color: '#fff', fontSize: Typography.fontSize.base, fontWeight: '800' },
})

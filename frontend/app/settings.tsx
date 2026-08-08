import { useState } from 'react'
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, Switch } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useAuthStore } from '@/store/authStore'
import { usePremiumStore } from '@/store/premiumStore'
import { useThemeStore } from '@/store/themeStore'
import { useAppTheme } from '@/context/ThemeContext'
import { Typography, Spacing, BorderRadius } from '@/constants/theme'
import { Screen, ScreenHeader } from '@/components/ui/Screen'

function NotifRow({ label, sub, value, onChange }: {
  label: string; sub: string; value: boolean; onChange: (v: boolean) => void
}) {
  const T = useAppTheme()
  return (
    <View style={[s.notifRow, { borderBottomColor: T.border }]}>
      <View style={{ flex: 1 }}>
        <Text style={[s.notifLabel, { color: T.ink }]}>{label}</Text>
        <Text style={[s.notifSub, { color: T.ink3 }]}>{sub}</Text>
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: T.accent, false: T.border }} thumbColor="#fff" />
    </View>
  )
}

function SettingRow({ icon, label, onPress, value, accent }: {
  icon: React.ComponentProps<typeof Ionicons>['name']
  label: string
  onPress?: () => void
  value?: React.ReactNode
  accent?: boolean
}) {
  const T = useAppTheme()
  return (
    <TouchableOpacity
      style={[s.settingRow, { borderBottomColor: T.border }]}
      onPress={onPress} activeOpacity={0.7} disabled={!onPress}
    >
      <View style={s.settingIconWrap}>
        <Ionicons name={icon} size={17} color={accent ? T.accent : T.ink2} />
      </View>
      <Text style={[s.settingLabel, { color: T.ink2 }, accent && { color: T.accent }]}>{label}</Text>
      {value ?? (onPress && <Ionicons name="chevron-forward" size={16} color={T.ink4} />)}
    </TouchableOpacity>
  )
}

export default function SettingsScreen() {
  const router = useRouter()
  const { logout } = useAuthStore()
  const { isPremium, aiMessagesToday, barcodeScanToday } = usePremiumStore()
  const T = useAppTheme()
  const { isDark, toggle } = useThemeStore()

  const [notifCheckIn, setNotifCheckIn] = useState(true)
  const [notifWater,   setNotifWater]   = useState(true)
  const [notifWorkout, setNotifWorkout] = useState(false)
  const [notifStreak,  setNotifStreak]  = useState(true)

  const handleLogout = () => {
    Alert.alert('Cerrar sesión', '¿Estás seguro?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Salir', style: 'destructive', onPress: logout },
    ])
  }

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: Spacing[5], paddingBottom: 120 }}>
        <ScreenHeader eyebrow="Zencrus · Perfil" title="Configuración" icon="settings" back />

        {/* Premium badge / upgrade */}
        {isPremium() ? (
          <TouchableOpacity
            style={[s.premBadge, { backgroundColor: T.accentSoft, borderColor: T.accentBorder }]}
            onPress={() => router.push('/subscription')} activeOpacity={0.8}
          >
            <Ionicons name="checkmark-circle" size={28} color={T.accent} />
            <View style={{ flex: 1 }}>
              <Text style={[s.premTitle, { color: T.ink }]}>ZENCRUS Premium activo</Text>
              <Text style={[s.premSub, { color: T.ink3 }]}>Toca para gestionar tu suscripción</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={T.ink3} />
          </TouchableOpacity>
        ) : (
          <View style={[s.upgradeCard, { backgroundColor: T.glass, borderColor: T.accentBorder }]}>
            <Text style={[s.upgradeTitle, { color: T.ink }]}>Desbloquea ZENCRUS Premium</Text>
            <Text style={[s.upgradeSub, { color: T.ink3 }]}>
              Coach IA ilimitado · Escáner sin límite · Reportes avanzados · Todos los desafíos
            </Text>
            <View style={s.countersRow}>
              {[
                { val: `${aiMessagesToday}/5`, lbl: 'IA hoy' },
                { val: `${barcodeScanToday}/5`, lbl: 'Scans hoy' },
                { val: '∞', lbl: 'Premium' },
              ].map(c => (
                <View key={c.lbl} style={[s.counter, { backgroundColor: T.bgSurface, borderColor: T.border }]}>
                  <Text style={[s.counterVal, { color: T.ink }]}>{c.val}</Text>
                  <Text style={[s.counterLbl, { color: T.ink3 }]}>{c.lbl}</Text>
                </View>
              ))}
            </View>
            <TouchableOpacity
              style={[s.upgradeBtn, { backgroundColor: T.accent }]}
              onPress={() => router.push('/subscription')}
            >
              <Ionicons name="flash" size={16} color="#fff" />
              <Text style={s.upgradeBtnTxt}>Ver planes y suscribirme</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Progreso — antes era la pestaña «Inicio» */}
        <TouchableOpacity
          style={[s.guideCard, { backgroundColor: T.accentSoft, borderColor: T.accentBorder }]}
          onPress={() => router.push('/progress')} activeOpacity={0.85}
        >
          <View style={[s.guideIcon, { backgroundColor: `${T.accent}18` }]}>
            <Ionicons name="stats-chart" size={22} color={T.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.guideTitle, { color: T.ink }]}>Progreso</Text>
            <Text style={[s.guideSub, { color: T.ink3 }]}>Score de salud, racha, nivel y actividad del día</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={T.ink3} />
        </TouchableOpacity>

        {/* Metas de energía — el dial gobierna meta, piso y macros */}
        <TouchableOpacity
          style={[s.guideCard, { backgroundColor: T.accentSoft, borderColor: T.accentBorder }]}
          onPress={() => router.push('/goals-energy')} activeOpacity={0.85}
        >
          <View style={[s.guideIcon, { backgroundColor: `${T.accent}18` }]}>
            <Ionicons name="flame" size={22} color={T.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.guideTitle, { color: T.ink }]}>Metas de energía</Text>
            <Text style={[s.guideSub, { color: T.ink3 }]}>Meta diaria, límite mínimo y reparto de macros</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={T.ink3} />
        </TouchableOpacity>

        {/* Guía de uso */}
        <TouchableOpacity
          style={[s.guideCard, { backgroundColor: T.accentSoft, borderColor: T.accentBorder }]}
          onPress={() => router.push('/guide')} activeOpacity={0.85}
        >
          <View style={[s.guideIcon, { backgroundColor: `${T.accent}18` }]}>
            <Ionicons name="book" size={22} color={T.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.guideTitle, { color: T.ink }]}>Guía de uso</Text>
            <Text style={[s.guideSub, { color: T.ink3 }]}>Aprende a usar cada sección de ZENCRUS paso a paso</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={T.ink3} />
        </TouchableOpacity>

        {/* Apariencia */}
        <Text style={[s.section, { color: T.ink }]}>Apariencia</Text>
        <SettingRow icon="moon" label="Tema oscuro" value={
          <Switch
            value={isDark}
            onValueChange={toggle}
            trackColor={{ true: T.accent, false: T.border }}
            thumbColor="#fff"
          />
        } />

        {/* Notificaciones */}
        <Text style={[s.section, { color: T.ink, marginTop: Spacing[5] }]}>Notificaciones</Text>
        <Text style={[s.sectionSub, { color: T.ink3 }]}>Recordatorios inteligentes para mantener tu racha</Text>
        <View style={[s.notifWrap, { backgroundColor: T.glass, borderColor: T.glassBorder }]}>
          <NotifRow label="Check-in matutino" sub="7:00 AM · Empieza tu día con intención"
            value={notifCheckIn} onChange={v => { setNotifCheckIn(v); Alert.alert(v ? 'Activado' : 'Desactivado', v ? 'Recibirás recordatorio a las 7:00 AM' : 'Sin recordatorio matutino') }} />
          <NotifRow label="Recordatorio de agua" sub="Cada 2h · 8AM a 10PM"
            value={notifWater} onChange={v => { setNotifWater(v); Alert.alert(v ? 'Activado' : 'Desactivado', v ? 'Recibirás recordatorios de hidratación' : 'Sin recordatorios de agua') }} />
          <NotifRow label="Hora de entrenar" sub="6:00 PM · ¿Hoy no has entrenado?"
            value={notifWorkout} onChange={v => { setNotifWorkout(v); Alert.alert(v ? 'Activado' : 'Desactivado', v ? 'Recordatorio a las 6PM' : 'Sin recordatorio de entreno') }} />
          <NotifRow label="Protección de racha" sub="9:00 PM · Solo si no has registrado actividad"
            value={notifStreak} onChange={v => { setNotifStreak(v); Alert.alert(v ? 'Activado' : 'Desactivado', v ? 'Recibirás aviso antes de perder tu racha' : 'Sin protección de racha') }} />
        </View>

        {/* Cuenta */}
        <Text style={[s.section, { color: T.ink, marginTop: Spacing[2] }]}>Cuenta</Text>
        <SettingRow icon="lock-closed" label="Cambiar contraseña" onPress={() => Alert.alert('Próximamente')} />
        <SettingRow icon="mail" label="Cambiar correo" onPress={() => Alert.alert('Próximamente')} />
        <SettingRow icon="resize" label="Unidades (kg / cm)" onPress={() => Alert.alert('Próximamente')} />

        <TouchableOpacity
          style={[s.logoutBtn, { borderColor: `${T.accent}55` }]}
          onPress={handleLogout}
        >
          <Text style={[s.logoutTxt, { color: T.accent }]}>Cerrar sesión</Text>
        </TouchableOpacity>

        <Text style={[s.version, { color: T.ink4 }]}>ZENCRUS v1.0.0 · by LACRUSS</Text>
      </ScrollView>
    </Screen>
  )
}

const s = StyleSheet.create({
  // Premium
  premBadge: { flexDirection: 'row', alignItems: 'center', gap: Spacing[3], borderRadius: BorderRadius.lg, padding: Spacing[4], borderWidth: 1, marginBottom: Spacing[4] },
  premTitle: { fontSize: Typography.fontSize.base, fontWeight: '800', marginBottom: 2 },
  premSub: { fontSize: Typography.fontSize.xs },
  upgradeCard: { borderRadius: BorderRadius.xl, padding: Spacing[5], borderWidth: 1, marginBottom: Spacing[5] },
  upgradeTitle: { fontSize: Typography.fontSize.lg, fontWeight: '900', marginBottom: Spacing[2] },
  upgradeSub: { fontSize: Typography.fontSize.xs, lineHeight: 18, marginBottom: Spacing[4] },
  countersRow: { flexDirection: 'row', gap: Spacing[3], marginBottom: Spacing[4] },
  counter: { flex: 1, borderRadius: BorderRadius.md, padding: Spacing[3], alignItems: 'center', borderWidth: 1 },
  counterVal: { fontSize: Typography.fontSize.lg, fontWeight: '900' },
  counterLbl: { fontSize: 10, marginTop: 2 },
  upgradeBtn: { flexDirection: 'row', gap: 8, borderRadius: BorderRadius.lg, padding: Spacing[4], alignItems: 'center', justifyContent: 'center' },
  upgradeBtnTxt: { color: '#fff', fontWeight: '900', fontSize: Typography.fontSize.base },
  // Guide
  guideCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing[3], borderWidth: 1, borderRadius: BorderRadius.lg, padding: Spacing[4], marginBottom: Spacing[5] },
  guideIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  guideTitle: { fontSize: Typography.fontSize.base, fontWeight: '800' },
  guideSub: { fontSize: Typography.fontSize.xs, marginTop: 2, lineHeight: 16 },
  // Notif
  notifWrap: { borderRadius: BorderRadius.lg, borderWidth: 1, overflow: 'hidden', marginBottom: Spacing[4] },
  notifRow: { flexDirection: 'row', alignItems: 'center', padding: Spacing[4], borderBottomWidth: 1 },
  notifLabel: { fontSize: Typography.fontSize.sm, fontWeight: '700', marginBottom: 2 },
  notifSub: { fontSize: Typography.fontSize.xs },
  // Settings rows
  settingRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing[4], borderBottomWidth: 1, gap: Spacing[3] },
  settingIconWrap: { width: 28, alignItems: 'center' },
  settingLabel: { flex: 1, fontSize: Typography.fontSize.sm, fontWeight: '500' },
  // Misc
  section: { fontSize: Typography.fontSize.base, fontWeight: '800', marginBottom: Spacing[1] },
  sectionSub: { fontSize: Typography.fontSize.xs, marginBottom: Spacing[4] },
  logoutBtn: { marginTop: Spacing[8], borderWidth: 1, borderRadius: BorderRadius.lg, padding: Spacing[4], alignItems: 'center' },
  logoutTxt: { fontSize: Typography.fontSize.base, fontWeight: '700' },
  version: { textAlign: 'center', marginTop: Spacing[4], fontSize: Typography.fontSize.xs },
})

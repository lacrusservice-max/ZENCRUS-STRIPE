import { useState, useEffect } from 'react'
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Alert, ActivityIndicator, TextInput, Image,
} from 'react-native'
import { useRouter } from 'expo-router'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as ImagePicker from 'expo-image-picker'
import { Ionicons } from '@expo/vector-icons'
import { useAuthStore } from '@/store/authStore'
import { tieneCiclo } from '@/features/salud/acceso'
import { useAchievementStore } from '@/store/achievementStore'
import { useRecipesStore } from '@/store/recipesStore'
import { Colors, Glass, Typography, Spacing, BorderRadius } from '@/constants/theme'
import { GlassCard, SectionLabel } from '@/components/ui/Glass'
import { Screen } from '@/components/ui/Screen'
import { limitesDe } from '@/utils/tramoCalorico'

const GOAL_LABELS: Record<string, string> = {
  lose_fat: '🔥 Bajar grasa',
  maintain: '⚖️ Mantener peso',
  gain_muscle: '💪 Ganar músculo',
}
const ACTIVITY_LABELS: Record<string, string> = {
  sedentary: 'Sedentario',
  lightly_active: 'Ligero',
  moderately_active: 'Moderado',
  very_active: 'Muy activo',
  extremely_active: 'Atleta',
}
const TRAINING_LABELS: Record<string, string> = {
  gym: '🏋️ Gimnasio', hyrox: '🏟️ HYROX', crossfit: '🔥 CrossFit',
  running: '🏃 Running', cycling: '🚴 Ciclismo', swimming: '🏊 Natación',
  yoga: '🧘 Yoga', combat: '🥊 Artes marciales', sports: '⚽ Deportes',
  calisthenics: '🤸 Calistenia', hiking: '🥾 Senderismo', none: '💤 Sin entrenamiento',
}

const ALLERGEN_OPTIONS = [
  { id: 'gluten',    label: 'Gluten',    emoji: '🌾' },
  { id: 'lactose',   label: 'Lácteos',   emoji: '🥛' },
  { id: 'nuts',      label: 'Nueces',    emoji: '🥜' },
  { id: 'shellfish', label: 'Mariscos',  emoji: '🦐' },
  { id: 'eggs',      label: 'Huevos',    emoji: '🥚' },
  { id: 'soy',       label: 'Soya',      emoji: '🌱' },
  { id: 'fish',      label: 'Pescado',   emoji: '🐟' },
  { id: 'sesame',    label: 'Sésamo',    emoji: '🌰' },
] as const

const INTOLERANCE_OPTIONS = [
  { id: 'dairy',     label: 'Intolerante a la lactosa', emoji: '🥛' },
  { id: 'fructose',  label: 'Fructosa',                 emoji: '🍎' },
  { id: 'fodmap',    label: 'FODMAP',                   emoji: '🥦' },
  { id: 'histamine', label: 'Histamina',                emoji: '🌸' },
  { id: 'nightshade',label: 'Solanáceas',               emoji: '🍅' },
] as const

const QUICK_LINKS = [
  { emoji: '📅', title: 'Plan de comidas', route: '/meal-planner' },
  { emoji: '🛒', title: 'Lista de compras', route: '/grocery' },
  { emoji: '🍽️', title: 'Recetas saludables', route: '/recipes' },
  { emoji: '⚔️', title: 'Duelos y retos', route: '/duels' },
] as const

// ── Sección plegable ────────────────────────────────────────────────────────

function CollapsibleSection({ title, subtitle, icon, children }: {
  title: string; subtitle?: string; icon: keyof typeof Ionicons.glyphMap; children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  return (
    <View style={cs.wrap}>
      <TouchableOpacity style={cs.head} onPress={() => setOpen(v => !v)} activeOpacity={0.75}>
        <View style={cs.iconBox}>
          <Ionicons name={icon} size={17} color={Colors.primary[400]} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={cs.title}>{title}</Text>
          {subtitle && <Text style={cs.subtitle}>{subtitle}</Text>}
        </View>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color="rgba(255,255,255,0.35)" />
      </TouchableOpacity>
      {open && <View style={cs.body}>{children}</View>}
    </View>
  )
}

const cs = StyleSheet.create({
  wrap: { backgroundColor: Glass.card, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: Glass.cardBorder, overflow: 'hidden', marginBottom: Spacing[3] },
  head: { flexDirection: 'row', alignItems: 'center', gap: Spacing[3], padding: Spacing[4] },
  iconBox: { width: 34, height: 34, borderRadius: 10, backgroundColor: `${Colors.primary[500]}18`, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: Typography.fontSize.sm, fontWeight: '800', color: '#fff' },
  subtitle: { fontSize: 11, color: 'rgba(255,255,255,0.42)', marginTop: 1 },
  body: { paddingHorizontal: Spacing[4], paddingBottom: Spacing[4] },
})

// ── Tarjeta de acceso del hub ──────────────────────────────────────────────────

function HubCard({ icon, title, subtitle, onPress, color = Colors.primary[500] }: {
  icon: keyof typeof Ionicons.glyphMap; title: string; subtitle: string; onPress: () => void; color?: string
}) {
  return (
    <TouchableOpacity style={hc.card} onPress={onPress} activeOpacity={0.8}>
      <View style={[hc.iconBox, { backgroundColor: `${color}18`, borderColor: `${color}30` }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <Text style={hc.title}>{title}</Text>
      <Text style={hc.sub}>{subtitle}</Text>
    </TouchableOpacity>
  )
}

const hc = StyleSheet.create({
  card: {
    width: '47%', backgroundColor: Glass.card, borderRadius: BorderRadius.lg, padding: Spacing[4],
    borderWidth: 1, borderColor: Glass.cardBorder, gap: 6,
  },
  iconBox: { width: 38, height: 38, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  title: { fontSize: Typography.fontSize.sm, fontWeight: '800', color: '#fff' },
  sub: { fontSize: 11, color: 'rgba(255,255,255,0.42)', lineHeight: 14 },
})

export default function ProfileScreen() {
  const router = useRouter()
  const { user, setUser } = useAuthStore()
  const { getCurrentLevel, totalXP, getUnlocked } = useAchievementStore()
  const { allergens: savedAllergens, intolerances: savedIntolerances, setAllergens, setIntolerances } = useRecipesStore()
  const goals = (user as any)?.goals ?? {}


  // ── Profile extras (persisted locally) ──────────────────────────────────────
  const [avatarUri,  setAvatarUri]  = useState<string | null>(null)
  const [nickname,   setNickname]   = useState('')
  const [bio,        setBio]        = useState('')
  const [interests,  setInterests]  = useState('')
  const [editingProfile, setEditingProfile] = useState(false)
  const [savingProfile,  setSavingProfile]  = useState(false)

  useEffect(() => {
    AsyncStorage.multiGet(['@zencrus_avatar', '@zencrus_nickname', '@zencrus_bio', '@zencrus_interests'])
      .then(pairs => {
        const map = Object.fromEntries(pairs.map(([k, v]) => [k, v]))
        if (map['@zencrus_avatar'])    setAvatarUri(map['@zencrus_avatar']!)
        if (map['@zencrus_nickname'])  setNickname(map['@zencrus_nickname']!)
        if (map['@zencrus_bio'])       setBio(map['@zencrus_bio']!)
        if (map['@zencrus_interests']) setInterests(map['@zencrus_interests']!)
      })
      .catch(() => {})
  }, [])

  const handlePickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!perm.granted) {
      Alert.alert('Permiso requerido', 'Necesitamos acceso a tu galería para cambiar tu foto.')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    })
    if (!result.canceled) {
      const uri = result.assets[0].uri
      setAvatarUri(uri)
      await AsyncStorage.setItem('@zencrus_avatar', uri)
    }
  }

  const saveProfileExtras = async () => {
    setSavingProfile(true)
    try {
      await AsyncStorage.multiSet([
        ['@zencrus_nickname',  nickname],
        ['@zencrus_bio',       bio],
        ['@zencrus_interests', interests],
      ])
      setEditingProfile(false)
      Alert.alert('Guardado', 'Tu perfil se actualizó correctamente.')
    } catch {
      Alert.alert('Error', 'No se pudo guardar.')
    } finally {
      setSavingProfile(false)
    }
  }

  // Allergens / intolerances
  const [allergens, setLocalAllergens] = useState<string[]>(savedAllergens)
  const [intolerances, setLocalIntolerances] = useState<string[]>(savedIntolerances)

  const toggleAllergen = (id: string) => {
    const updated = allergens.includes(id) ? allergens.filter(a => a !== id) : [...allergens, id]
    setLocalAllergens(updated)
    setAllergens(updated)
  }

  const toggleIntolerance = (id: string) => {
    const updated = intolerances.includes(id) ? intolerances.filter(a => a !== id) : [...intolerances, id]
    setLocalIntolerances(updated)
    setIntolerances(updated)
  }

  const level = getCurrentLevel()
  const unlocked = getUnlocked()

  /* Del MISMO módulo que usa Nutrición: si este resumen derivara el techo por
     su cuenta, podría enseñar un número distinto del que mide el plato. */
  const limites = limitesDe(goals)

  if (!user) return null

  return (
    <Screen>
      {/* Glass Header */}
      <View style={s.header}>
        <View style={s.highlight} pointerEvents="none" />
        <TouchableOpacity onPress={handlePickPhoto} activeOpacity={0.82} style={s.avatarWrap}>
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={s.avatarImg} />
          ) : (
            <View style={s.avatarFill}>
              <Text style={s.avatarTxt}>{user.full_name?.[0]?.toUpperCase() ?? '?'}</Text>
            </View>
          )}
          <View style={s.cameraBadge}>
            <Ionicons name="camera" size={12} color="#fff" />
          </View>
          <View style={s.levelBubble}>
            <Text style={s.levelEmoji}>{level.emoji}</Text>
          </View>
        </TouchableOpacity>

        <View style={{ flex: 1 }}>
          <Text style={s.name}>{user.full_name}</Text>
          {nickname ? <Text style={s.nickname}>@{nickname}</Text> : null}
          <Text style={s.email}>{user.email}</Text>
          <View style={s.headerBadges}>
            <View style={s.tierBadge}>
              <Text style={s.tierTxt}>{user.subscription_tier === 'premium' ? '⭐ Premium' : '🆓 Free'}</Text>
            </View>
            <View style={s.xpBadge}>
              <Text style={s.xpTxt}>{totalXP} XP · {unlocked.length} logros</Text>
            </View>
          </View>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: Spacing[5], paddingBottom: 100 }}>

        {/* ── Hub: accesos principales ── */}
        <View style={s.hubGrid}>
          <HubCard icon="flag" title="Objetivos" subtitle="Metas con fecha y seguimiento" onPress={() => router.push('/goals')} />
          {/* Todas las tarjetas usan el acento de marca: las que iban en blanco
              quedaban en gris carbón sobre fondo claro, sueltas entre las demás. */}
          <HubCard icon="trending-up" title="Estadísticas" subtitle="Peso, medidas y entrenos" onPress={() => router.push('/profile-stats')} />
          <HubCard icon="trophy" title="Insignias" subtitle={`${unlocked.length} desbloqueadas`} onPress={() => router.push('/achievements')} />
          <HubCard icon="settings" title="Configuración" subtitle="Cuenta, notificaciones y más" onPress={() => router.push('/settings')} />
        </View>

        {/* ── Información personal ── */}
        <CollapsibleSection title="Información personal" subtitle="Bio, apodo y datos físicos" icon="person">
          <GlassCard style={{ marginBottom: Spacing[4] }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing[3] }}>
              <SectionLabel>Información pública</SectionLabel>
              {!editingProfile ? (
                <TouchableOpacity onPress={() => setEditingProfile(true)} style={s.editIconBtn}>
                  <Ionicons name="pencil-outline" size={15} color={Colors.primary[400]} />
                  <Text style={s.editIconTxt}>Editar</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity onPress={saveProfileExtras} style={[s.editIconBtn, { borderColor: Colors.primary[500] }]} disabled={savingProfile}>
                  {savingProfile
                    ? <ActivityIndicator size="small" color={Colors.primary[400]} />
                    : <Ionicons name="checkmark" size={15} color={Colors.primary[400]} />}
                  <Text style={s.editIconTxt}>Guardar</Text>
                </TouchableOpacity>
              )}
            </View>

            {editingProfile ? (
              <View style={{ gap: Spacing[3] }}>
                <View style={s.profileField}>
                  <Text style={s.profileFieldLabel}>Apodo</Text>
                  <TextInput style={s.profileFieldInput} value={nickname} onChangeText={setNickname} placeholder="tu_apodo" placeholderTextColor="rgba(255,255,255,0.22)" autoCapitalize="none" />
                </View>
                <View style={s.profileField}>
                  <Text style={s.profileFieldLabel}>Biografía</Text>
                  <TextInput style={[s.profileFieldInput, { minHeight: 70, textAlignVertical: 'top' }]} value={bio} onChangeText={setBio} placeholder="Cuéntanos sobre ti..." placeholderTextColor="rgba(255,255,255,0.22)" multiline maxLength={160} />
                </View>
                <View style={s.profileField}>
                  <Text style={s.profileFieldLabel}>Intereses</Text>
                  <TextInput style={s.profileFieldInput} value={interests} onChangeText={setInterests} placeholder="fitness, nutrición, running..." placeholderTextColor="rgba(255,255,255,0.22)" />
                </View>
              </View>
            ) : (
              <View style={{ gap: Spacing[3] }}>
                {nickname ? (
                  <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                    <Ionicons name="at-outline" size={14} color="rgba(255,255,255,0.38)" />
                    <Text style={s.profileDisplayVal}>{nickname}</Text>
                  </View>
                ) : null}
                {bio ? (
                  <Text style={[s.profileDisplayVal, { opacity: 0.75, lineHeight: 20 }]}>{bio}</Text>
                ) : (
                  <Text style={s.profileEmptyHint}>Toca "Editar" para agregar tu bio</Text>
                )}
                {interests ? (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    {interests.split(',').map(i => i.trim()).filter(Boolean).map(i => (
                      <View key={i} style={s.interestChip}><Text style={s.interestChipTxt}>{i}</Text></View>
                    ))}
                  </View>
                ) : null}
              </View>
            )}
          </GlassCard>

          <SectionLabel style={{ marginBottom: Spacing[3] }}>Datos físicos</SectionLabel>
          <GlassCard>
            <InfoRow label="Objetivo" value={GOAL_LABELS[goals.main_goal] ?? '—'} />
            <InfoRow label="Peso actual" value={user.weight ? `${user.weight} kg` : '—'} />
            <InfoRow label="Peso objetivo" value={goals.target_weight ? `${goals.target_weight} kg` : '—'} />
            <InfoRow label="Altura" value={user.height ? `${user.height} cm` : '—'} />
            <InfoRow label="Edad" value={user.age ? `${user.age} años` : '—'} />
            <InfoRow label="Actividad" value={ACTIVITY_LABELS[user.activity_level ?? ''] ?? '—'} />
            <InfoRow label="Entrenamiento" value={(Array.isArray(goals.training_type) ? goals.training_type : goals.training_type ? [goals.training_type] : []).map((t: string) => TRAINING_LABELS[t] ?? t).join(', ') || '—'} />
            <InfoRow label="TDEE" value={goals.tdee ? `${goals.tdee} kcal` : '—'} />
            <InfoRow label="BMR" value={goals.bmr ? `${goals.bmr} kcal` : '—'} />
          </GlassCard>
        </CollapsibleSection>

        {/*
          ── Metas nutricionales · SOLO LECTURA ──
          Aquí había un segundo editor de metas, con sus propios controles de
          calorías, macros, fibra y comidas al día. Se ha quitado.

          El problema no era tener dos sitios: era que este NO enseñaba el mínimo
          ni el techo, que son los que gobiernan los cuatro tramos de color de
          Nutrición. Se podía subir la meta por encima del techo sin verlo, y lo
          único que devolvía el servidor era un 422 sin explicación posible desde
          esta pantalla, porque el dato que lo causaba no estaba aquí.

          Ahora esto resume lo que hay y manda a «Metas de energía», que enseña
          los tres límites juntos y encadenados.
        */}
        <CollapsibleSection title="Metas nutricionales" subtitle="Calorías, macros y límites del día" icon="nutrition">
          <View style={s.metasResumen}>
            <MetaFila etiqueta="Mínimo"  valor={`${(limites.minimo).toLocaleString('es-MX')} kcal`} />
            <MetaFila etiqueta="Meta"    valor={`${(limites.meta).toLocaleString('es-MX')} kcal`} destaca />
            <MetaFila etiqueta="Techo"   valor={`${(limites.techo).toLocaleString('es-MX')} kcal`} />
          </View>
          <View style={s.metasResumen}>
            <MetaFila etiqueta="Proteína" valor={`${goals.protein_g ?? 150} g`} />
            <MetaFila etiqueta="Carbos"   valor={`${goals.carbs_g ?? 200} g`} />
            <MetaFila etiqueta="Grasas"   valor={`${goals.fat_g ?? 65} g`} />
            <MetaFila etiqueta="Fibra"    valor={`${goals.fiber_g ?? 28} g`} />
            <MetaFila etiqueta="Comidas al día" valor={String(goals.meals_per_day ?? 3)} />
          </View>

          <TouchableOpacity
            style={s.irAMetas}
            onPress={() => router.push('/goals-energy')}
            activeOpacity={0.85}
          >
            <Text style={s.irAMetasTxt}>Cambiar mis metas</Text>
            <Text style={s.irAMetasFlecha}>›</Text>
          </TouchableOpacity>
        </CollapsibleSection>

        {/* ── Alergias / intolerancias ── */}
        <CollapsibleSection title="Alergias e intolerancias" subtitle="Filtra recetas según tus necesidades" icon="warning">
          <Text style={s.sectionTitle}>🚫 Alergias alimentarias</Text>
          <View style={al.grid}>
            {ALLERGEN_OPTIONS.map(({ id, label, emoji }) => (
              <TouchableOpacity key={id} style={[al.chip, allergens.includes(id) && al.chipOn]} onPress={() => toggleAllergen(id)}>
                <Text style={al.chipEmoji}>{emoji}</Text>
                <Text style={[al.chipTxt, allergens.includes(id) && al.chipTxtOn]}>{label}</Text>
                {allergens.includes(id) && <Text style={al.chipCheck}>✓</Text>}
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[s.sectionTitle, { marginTop: Spacing[4] }]}>⚠️ Intolerancias</Text>
          <View style={al.grid}>
            {INTOLERANCE_OPTIONS.map(({ id, label, emoji }) => (
              <TouchableOpacity key={id} style={[al.chip, intolerances.includes(id) && al.chipOn]} onPress={() => toggleIntolerance(id)}>
                <Text style={al.chipEmoji}>{emoji}</Text>
                <Text style={[al.chipTxt, intolerances.includes(id) && al.chipTxtOn]}>{label}</Text>
                {intolerances.includes(id) && <Text style={al.chipCheck}>✓</Text>}
              </TouchableOpacity>
            ))}
          </View>
        </CollapsibleSection>

        {/* ── Ciclo menstrual ──
            Solo para las cuentas que tienen el módulo. Para el resto la tarjeta
            no existe: no se enseña deshabilitada ni se enseña y luego se niega
            el paso. Ver features/salud/acceso.ts. */}
        {tieneCiclo(user) && (
          <TouchableOpacity style={al.navCard} onPress={() => router.push('/salud/ciclo')}>
            <Text style={al.navEmoji}>🌸</Text>
            <View style={{ flex: 1 }}>
              <Text style={al.navTitle}>Ciclo menstrual</Text>
              <Text style={al.navSub}>Predicciones, síntomas y nutrición por fase</Text>
            </View>
            <Text style={al.navArrow}>›</Text>
          </TouchableOpacity>
        )}

        {/* ── Accesos rápidos ── */}
        <Text style={[s.sectionTitle, { marginTop: Spacing[5] }]}>Accesos rápidos</Text>
        <View style={{ gap: Spacing[2] }}>
          {QUICK_LINKS.map(({ emoji, title, route }) => (
            <TouchableOpacity key={route} style={al.navCard} onPress={() => router.push(route as any)}>
              <Text style={al.navEmoji}>{emoji}</Text>
              <Text style={[al.navTitle, { flex: 1 }]}>{title}</Text>
              <Text style={al.navArrow}>›</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </Screen>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={ir.row}>
      <Text style={ir.label}>{label}</Text>
      <Text style={ir.value}>{value}</Text>
    </View>
  )
}
const ir = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: Spacing[3], borderBottomWidth: 1, borderBottomColor: Glass.cardBorder },
  label: { fontSize: Typography.fontSize.sm, color: 'rgba(255,255,255,0.5)', fontWeight: '500' },
  value: { fontSize: Typography.fontSize.sm, color: '#fff', fontWeight: '600', flex: 1, textAlign: 'right' },
})

const af = StyleSheet.create({
  wrap: { marginBottom: Spacing[4] },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing[2] },
  label: { fontSize: Typography.fontSize.sm, fontWeight: '700', color: '#fff' },
  note: { fontSize: Typography.fontSize.xs, color: 'rgba(255,255,255,0.38)' },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing[2] },
  btn: { width: 36, height: 36, borderRadius: 18, backgroundColor: Glass.elevated, borderWidth: 1, borderColor: Glass.cardBorder, alignItems: 'center', justifyContent: 'center' },
  btnTxt: { fontSize: 20, color: '#fff', fontWeight: '700', lineHeight: 24 },
  input: { flex: 1, backgroundColor: Glass.card, borderWidth: 1.5, borderColor: Glass.cardBorder, borderRadius: BorderRadius.base, padding: Spacing[3], fontSize: Typography.fontSize.xl, color: '#fff', textAlign: 'center', fontWeight: '700' },
  unit: { fontSize: Typography.fontSize.sm, color: 'rgba(255,255,255,0.5)', fontWeight: '600', minWidth: 36 },
})

// ── Allergen styles ───────────────────────────────────────────────────────────

const al = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing[2], marginBottom: Spacing[2] },
  chip: { flexDirection: 'row', alignItems: 'center', gap: Spacing[1], paddingHorizontal: Spacing[3], paddingVertical: Spacing[2], borderRadius: BorderRadius.full, backgroundColor: Glass.card, borderWidth: 1.5, borderColor: Glass.cardBorder },
  chipOn: { borderColor: Colors.accent.orange, backgroundColor: Colors.accent.orange + '15' },
  chipEmoji: { fontSize: 14 },
  chipTxt: { fontSize: Typography.fontSize.xs, color: 'rgba(255,255,255,0.55)', fontWeight: '600' },
  chipTxtOn: { color: Colors.accent.orange },
  chipCheck: { fontSize: 10, color: Colors.accent.green, fontWeight: '800' },
  navCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing[3], backgroundColor: Glass.card, borderRadius: BorderRadius.md, padding: Spacing[4], borderWidth: 1, borderColor: Glass.cardBorder, marginBottom: Spacing[2] },
  navEmoji: { fontSize: 20, width: 24 },
  navTitle: { fontSize: Typography.fontSize.sm, fontWeight: '700', color: '#fff' },
  navSub: { fontSize: Typography.fontSize.xs, color: 'rgba(255,255,255,0.42)', marginTop: 2 },
  navArrow: { fontSize: 20, color: 'rgba(255,255,255,0.3)', fontWeight: '700' },
})

// ── Styles ────────────────────────────────────────────────────────────────────

/** Una línea del resumen: etiqueta a la izquierda, cifra a la derecha. */
function MetaFila({ etiqueta, valor, destaca }: { etiqueta: string; valor: string; destaca?: boolean }) {
  return (
    <View style={s.metaFila}>
      <Text style={s.metaEtiqueta}>{etiqueta}</Text>
      <Text style={[s.metaValor, destaca && s.metaValorFuerte]}>{valor}</Text>
    </View>
  )
}

const s = StyleSheet.create({
  metasResumen: {
    borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    paddingHorizontal: 14, paddingVertical: 4, marginBottom: 10,
  },
  metaFila: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 9,
  },
  metaEtiqueta: { fontSize: 13, color: 'rgba(255,255,255,0.6)' },
  metaValor: { fontSize: 13.5, fontWeight: '700', color: '#fff', fontVariant: ['tabular-nums'] },
  metaValorFuerte: { fontSize: 15, fontWeight: '800' },
  irAMetas: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    height: 48, paddingHorizontal: 15, borderRadius: 14,
    backgroundColor: 'rgba(255,31,61,0.14)',
    borderWidth: 1, borderColor: 'rgba(255,31,61,0.36)',
  },
  irAMetasTxt: { fontSize: 14, fontWeight: '700', color: '#FF5871' },
  irAMetasFlecha: { fontSize: 19, color: '#FF5871', marginTop: -2 },

  header: {
    flexDirection: 'row', alignItems: 'center', padding: Spacing[5], gap: Spacing[4],
    borderBottomWidth: 1, borderBottomColor: Glass.cardBorder,
    backgroundColor: Glass.card, overflow: 'hidden',
  },
  highlight: { position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: Glass.cardHighlight },
  avatarWrap: { width: 72, height: 72, borderRadius: 36, position: 'relative' },
  avatarImg: { width: 72, height: 72, borderRadius: 36, borderWidth: 2.5, borderColor: Colors.primary[500] },
  avatarFill: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: Colors.primary[600],
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2.5, borderColor: `${Colors.primary[400]}60`,
  },
  avatarTxt: { fontSize: 28, fontWeight: '800', color: '#fff' },
  cameraBadge: {
    position: 'absolute', bottom: 1, right: 1,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: Colors.primary[500],
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: '#080808',
  },
  levelBubble: {
    position: 'absolute', top: -2, right: -2,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: '#080808',
    borderWidth: 1.5, borderColor: Glass.cardBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  levelEmoji: { fontSize: 12 },
  name: { fontFamily: Typography.fontFamily.display, fontSize: Typography.fontSize.xl + 4, letterSpacing: 0.2, color: '#fff' },
  nickname: { fontSize: Typography.fontSize.xs, color: Colors.primary[400], fontWeight: '600', marginTop: 1 },
  email: { fontSize: 10, color: 'rgba(255,255,255,0.38)', marginTop: 2 },
  headerBadges: { flexDirection: 'row', gap: Spacing[2], marginTop: Spacing[1], flexWrap: 'wrap' },
  tierBadge: { backgroundColor: Glass.purpleTint, paddingHorizontal: 8, paddingVertical: 3, borderRadius: BorderRadius.full, borderWidth: 1, borderColor: Glass.purpleBorder },
  tierTxt: { fontSize: 10, color: Colors.primary[300], fontWeight: '700' },
  xpBadge: { backgroundColor: `${Colors.accent.yellow}18`, paddingHorizontal: 8, paddingVertical: 3, borderRadius: BorderRadius.full, borderWidth: 1, borderColor: `${Colors.accent.yellow}40` },
  xpTxt: { fontSize: 10, color: Colors.accent.yellow, fontWeight: '700' },
  hubGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing[3], marginBottom: Spacing[5] },
  sectionTitle: { fontSize: Typography.fontSize.base, fontWeight: '800', color: '#fff', marginBottom: Spacing[1] },
  row: { flexDirection: 'row', gap: Spacing[2], marginBottom: Spacing[3] },
  recalcTxt: { fontSize: Typography.fontSize.sm, color: Colors.primary[400], fontWeight: '600' },
  saveBtn: { backgroundColor: Colors.primary[500], borderRadius: BorderRadius.lg, padding: Spacing[4], alignItems: 'center', shadowColor: Colors.primary[500], shadowOpacity: 0.35, shadowRadius: 12 },
  saveTxt: { fontSize: Typography.fontSize.base, fontWeight: '800', color: '#fff' },
  editIconBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: BorderRadius.full, borderWidth: 1, borderColor: Glass.cardBorder,
  },
  editIconTxt: { fontSize: 11, color: Colors.primary[400], fontWeight: '600' },
  profileField: { gap: 6 },
  profileFieldLabel: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.4)', letterSpacing: 1, textTransform: 'uppercase' },
  profileFieldInput: {
    backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: Glass.cardBorder,
    borderRadius: 12, paddingHorizontal: Spacing[4], paddingVertical: 12,
    fontSize: Typography.fontSize.sm, color: '#fff',
  },
  profileDisplayVal: { fontSize: Typography.fontSize.sm, color: 'rgba(255,255,255,0.78)', fontWeight: '500' },
  profileEmptyHint: { fontSize: Typography.fontSize.xs, color: 'rgba(255,255,255,0.25)', fontStyle: 'italic' },
  interestChip: {
    backgroundColor: Glass.purpleTint, borderRadius: BorderRadius.full,
    paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: Glass.purpleBorder,
  },
  interestChipTxt: { fontSize: 11, color: Colors.primary[300], fontWeight: '600' },
})

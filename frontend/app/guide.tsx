import { useState } from 'react'
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Image, LayoutAnimation, Platform, UIManager,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { Colors, Typography, Spacing, BorderRadius, Glass } from '@/constants/theme'
import { Screen, ScreenHeader } from '@/components/ui/Screen'

const logoBlanco = require('@/assets/images/logo-blanco.png')

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true)
}

type Ion = keyof typeof Ionicons.glyphMap

interface GuideStep { text: string }
interface GuideSection {
  id: string
  icon: Ion
  title: string
  tagline: string
  what: string
  steps: string[]
  tip?: string
  route?: string
}

const SECTIONS: GuideSection[] = [
  {
    id: 'inicio',
    icon: 'home',
    title: 'Inicio',
    tagline: 'Tu resumen del día',
    what: 'La pantalla principal reúne todo lo importante de hoy: calorías consumidas vs. tu meta, macros (proteína, carbohidratos, grasa), agua, pasos y tu racha activa.',
    steps: [
      'Revisa tu anillo de calorías: el centro muestra cuánto te queda por consumir hoy.',
      'Toca cualquier tarjeta de macro para ver el detalle y registrar alimentos.',
      'Tu racha (🔥) sube cada día que registras actividad. No la pierdas.',
      'Desliza hacia abajo para actualizar los datos en tiempo real.',
    ],
    tip: 'Registra tu primera comida antes de las 10 AM para mantener el hábito.',
  },
  {
    id: 'nutricion',
    icon: 'restaurant',
    title: 'Nutrición',
    tagline: 'Tu plan alimenticio personalizado',
    what: 'Aquí vive tu dieta generada por IA según tu perfil, objetivo y preferencias. Cada día tiene comidas con porciones exactas y sus macros calculados.',
    steps: [
      'Selecciona el día para ver tus comidas: desayuno, comida, cena y snacks.',
      'Toca una comida para ver ingredientes, cantidades y valores nutricionales.',
      'Marca cada comida como "consumida" para que cuente en tu resumen del día.',
      'Usa el escáner de código de barras para registrar productos empaquetados al instante.',
      '¿No te gusta una comida? Pídele a ZENA (Coach IA) que la cambie.',
    ],
    tip: 'Puedes decirle al chat: "cámbiame el desayuno por algo con avena" y lo actualiza solo.',
    route: '/(tabs)/nutrition',
  },
  {
    id: 'rutina',
    icon: 'barbell',
    title: 'Rutina',
    tagline: 'Tu entrenamiento a medida',
    what: 'Tu rutina de ejercicios adaptada a tu nivel, objetivo y días disponibles. Cada sesión tiene ejercicios, series, repeticiones y descansos.',
    steps: [
      'Elige el día de entrenamiento programado.',
      'Toca "Empezar" para entrar al modo activo con temporizador de descanso.',
      'Marca cada serie completada; la app registra tu progreso de cargas.',
      'Al terminar, guarda la sesión para ver tu historial y volumen semanal.',
    ],
    tip: 'Pídele a ZENA: "agrégame un día de pierna" o "hazme la rutina más intensa".',
    route: '/(tabs)/workout',
  },
  {
    id: 'progreso',
    icon: 'trending-up',
    title: 'Progreso',
    tagline: 'Mide tus resultados reales',
    what: 'Gráficas de tu evolución: peso, medidas corporales, fotos de progreso y cumplimiento de metas a lo largo del tiempo.',
    steps: [
      'Registra tu peso regularmente para ver la tendencia, no el número diario.',
      'Sube fotos de progreso para comparar visualmente semana a semana.',
      'Añade medidas (cintura, brazo, pierna) en la sección de Medidas.',
      'Genera reportes PDF con todo tu avance (función Premium).',
    ],
    tip: 'Tómate las fotos siempre con la misma luz y hora para comparaciones justas.',
    route: '/profile-stats',
  },
  {
    id: 'salud',
    icon: 'pulse',
    title: 'Salud',
    tagline: 'Pasos, sueño, hidratación y más',
    what: 'Todo lo relacionado a tu salud diaria en un solo lugar: pasos, sueño, hidratación, recuperación, hábitos y ciclo menstrual.',
    steps: [
      'Revisa tus pasos y horas de sueño del día en la parte superior.',
      'Registra tus vasos de agua directamente desde ahí.',
      'Haz check-in de energía, dolor muscular y estrés para tu score de recuperación.',
      'Marca tus hábitos diarios y mira tu racha por cada uno.',
    ],
    tip: 'Entre más consistente seas registrando, más preciso será tu score de recuperación.',
    route: '/(tabs)/salud',
  },
  {
    id: 'coach',
    icon: 'sparkles',
    title: 'Coach IA — ZENA',
    tagline: 'Tu entrenador y nutriólogo 24/7',
    what: 'ZENA es la inteligencia artificial de ZENCRUS. Conoce tu perfil completo y puede responder dudas, ajustar tu plan y darte consejos personalizados.',
    steps: [
      'Escríbele como le hablarías a un entrenador real: en lenguaje natural.',
      'Pídele cambios directos: "sube mis proteínas a 180g" y los aplica.',
      'Consulta lo que sea: "¿puedo comer esto?", "¿cómo hago sentadilla?".',
      'Pídele ideas: recetas, sustituciones, motivación o resolver dudas.',
    ],
    tip: 'ZENA puede modificar tu alimentación y rutina automáticamente. Solo pídeselo.',
    route: '/(tabs)/chat',
  },
  {
    id: 'comunidad',
    icon: 'people',
    title: 'Comunidad',
    tagline: 'Comparte y motívate con otros',
    what: 'El espacio social de ZENCRUS: publica tu progreso, sigue a otros usuarios, dale like, comenta e inspírate con la comunidad.',
    steps: [
      'Publica tus logros, fotos de progreso o comidas.',
      'Sigue cuentas que te inspiren y dale like a sus publicaciones.',
      'Comenta y conecta con personas con tus mismos objetivos.',
      'Participa en desafíos y duelos para competir de forma sana.',
    ],
    tip: 'La comunidad es privada de ZENCRUS: solo miembros, ambiente positivo.',
    route: '/(tabs)/social',
  },
]

const EXTRAS: { icon: Ion; title: string; desc: string; route: string }[] = [
  { icon: 'nutrition',      title: 'Meal Planner',   desc: 'Planifica tus comidas de la semana completa', route: '/meal-planner' },
  { icon: 'book',           title: 'Recetas',        desc: 'Biblioteca de recetas saludables con macros', route: '/recipes' },
  { icon: 'cart',           title: 'Lista de compras', desc: 'Genera tu súper según tu plan semanal', route: '/grocery' },
  { icon: 'body',           title: 'Medidas',        desc: 'Registra y sigue tus medidas corporales', route: '/measurements' },
  { icon: 'trophy',         title: 'Logros',         desc: 'Desbloquea insignias por tu constancia', route: '/achievements' },
  { icon: 'flame',          title: 'Duelos',         desc: 'Rétate contra otros usuarios', route: '/duels' },
  { icon: 'podium',         title: 'Rankings',       desc: 'Compite en la tabla de la comunidad', route: '/leaderboard' },
  { icon: 'heart',          title: 'Salud',          desc: 'Métricas de salud y bienestar', route: '/health-tracker' },
]

export default function GuideScreen() {
  const [open, setOpen] = useState<string | null>('inicio')

  const toggle = (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
    setOpen(prev => (prev === id ? null : id))
  }

  return (
    <Screen>
      <ScreenHeader
        back
        eyebrow="Zencrus · Ayuda"
        title="Guía de uso"
        subtitle="Aprende a usar cada sección paso a paso"
        icon="book"
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        {/* Hero */}
        <View style={s.hero}>
          <Image source={logoBlanco} style={s.heroLogo} resizeMode="contain" />
          <Text style={s.heroTitle}>Bienvenido a ZENCRUS</Text>
          <Text style={s.heroSub}>
            Tu ecosistema completo de nutrición y fitness con inteligencia artificial.
            Aquí te explicamos cómo aprovechar cada sección al máximo.
          </Text>
        </View>

        {/* Secciones principales */}
        <Text style={s.groupTitle}>Secciones principales</Text>

        {SECTIONS.map(sec => {
          const isOpen = open === sec.id
          return (
            <View key={sec.id} style={[s.accordion, isOpen && s.accordionOpen]}>
              <TouchableOpacity style={s.accHead} onPress={() => toggle(sec.id)} activeOpacity={0.7}>
                <View style={s.accIcon}>
                  <Ionicons name={sec.icon} size={20} color={Colors.primary[400]} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.accTitle}>{sec.title}</Text>
                  <Text style={s.accTagline}>{sec.tagline}</Text>
                </View>
                <Ionicons
                  name={isOpen ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color="rgba(255,255,255,0.4)"
                />
              </TouchableOpacity>

              {isOpen && (
                <View style={s.accBody}>
                  <Text style={s.accWhat}>{sec.what}</Text>

                  <Text style={s.accStepsLabel}>Cómo usarla</Text>
                  {sec.steps.map((step, i) => (
                    <View key={i} style={s.stepRow}>
                      <View style={s.stepNum}>
                        <Text style={s.stepNumTxt}>{i + 1}</Text>
                      </View>
                      <Text style={s.stepTxt}>{step}</Text>
                    </View>
                  ))}

                  {sec.tip && (
                    <View style={s.tipBox}>
                      <Ionicons name="bulb" size={15} color={Colors.accent.yellow} />
                      <Text style={s.tipTxt}>{sec.tip}</Text>
                    </View>
                  )}

                  {sec.route && (
                    <TouchableOpacity style={s.goBtn} onPress={() => router.push(sec.route as any)}>
                      <Text style={s.goBtnTxt}>Ir a {sec.title}</Text>
                      <Ionicons name="arrow-forward" size={15} color={Colors.primary[400]} />
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          )
        })}

        {/* Herramientas extra */}
        <Text style={[s.groupTitle, { marginTop: Spacing[8] }]}>Herramientas adicionales</Text>
        <Text style={s.groupSub}>Todo lo que ZENCRUS pone a tu disposición</Text>

        <View style={s.extrasGrid}>
          {EXTRAS.map(ex => (
            <TouchableOpacity key={ex.title} style={s.extraCard} onPress={() => router.push(ex.route as any)} activeOpacity={0.8}>
              <View style={s.extraIcon}>
                <Ionicons name={ex.icon} size={18} color={Colors.primary[400]} />
              </View>
              <Text style={s.extraTitle}>{ex.title}</Text>
              <Text style={s.extraDesc}>{ex.desc}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Cierre */}
        <View style={s.closing}>
          <Ionicons name="sparkles" size={22} color={Colors.primary[400]} />
          <Text style={s.closingTitle}>¿Aún tienes dudas?</Text>
          <Text style={s.closingSub}>
            Pregúntale directamente a ZENA, tu Coach IA. Está disponible 24/7 para ayudarte con lo que sea.
          </Text>
          <TouchableOpacity style={s.closingBtn} onPress={() => router.push('/(tabs)/chat')}>
            <Ionicons name="sparkles" size={16} color="#fff" />
            <Text style={s.closingBtnTxt}>Abrir Coach IA</Text>
          </TouchableOpacity>
        </View>

        <Text style={s.version}>ZENCRUS v1.0.0 · by LACRUSS</Text>
      </ScrollView>
    </Screen>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#080808' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing[4], paddingVertical: Spacing[3],
    borderBottomWidth: 1, borderBottomColor: Glass.cardBorder,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: Typography.fontSize.base, fontWeight: '800', color: '#fff' },
  scroll: { padding: Spacing[5], paddingBottom: Spacing[16] },

  // Hero
  hero: { alignItems: 'center', paddingVertical: Spacing[6], marginBottom: Spacing[4] },
  heroLogo: { width: 120, height: 44, marginBottom: Spacing[5] },
  heroTitle: { fontFamily: Typography.fontFamily.display, fontSize: Typography.fontSize['2xl'] + 4, letterSpacing: 0.3, color: '#fff', textAlign: 'center', marginBottom: Spacing[3] },
  heroSub: { fontSize: Typography.fontSize.sm, color: 'rgba(255,255,255,0.55)', textAlign: 'center', lineHeight: 21, paddingHorizontal: Spacing[2] },

  // Groups
  groupTitle: { fontFamily: Typography.fontFamily.displaySemiBold, fontSize: Typography.fontSize.lg + 2, letterSpacing: 0.2, color: '#fff', marginBottom: Spacing[1] },
  groupSub: { fontSize: Typography.fontSize.sm, color: 'rgba(255,255,255,0.45)', marginBottom: Spacing[4] },

  // Accordion
  accordion: { backgroundColor: Glass.card, borderWidth: 1, borderColor: Glass.cardBorder, borderRadius: BorderRadius.lg, marginBottom: Spacing[3], overflow: 'hidden' },
  accordionOpen: { borderColor: Glass.purpleBorder, backgroundColor: Glass.purpleTint },
  accHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing[3], padding: Spacing[4] },
  accIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: Glass.purpleTint, borderWidth: 1, borderColor: Glass.purpleBorder, alignItems: 'center', justifyContent: 'center' },
  accTitle: { fontSize: Typography.fontSize.base, fontWeight: '800', color: '#fff' },
  accTagline: { fontSize: Typography.fontSize.xs, color: 'rgba(255,255,255,0.45)', marginTop: 2 },

  accBody: { paddingHorizontal: Spacing[4], paddingBottom: Spacing[4] },
  accWhat: { fontSize: Typography.fontSize.sm, color: 'rgba(255,255,255,0.7)', lineHeight: 21, marginBottom: Spacing[4] },
  accStepsLabel: { fontSize: Typography.fontSize.xs, fontWeight: '800', color: Colors.primary[400], textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: Spacing[3] },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing[3], marginBottom: Spacing[3] },
  stepNum: { width: 22, height: 22, borderRadius: 11, backgroundColor: Colors.primary[600], alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  stepNumTxt: { fontSize: 11, fontWeight: '800', color: '#fff' },
  stepTxt: { flex: 1, fontSize: Typography.fontSize.sm, color: 'rgba(255,255,255,0.82)', lineHeight: 20 },

  tipBox: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing[2], backgroundColor: Glass.warningTint, borderRadius: BorderRadius.md, padding: Spacing[3], marginTop: Spacing[2] },
  tipTxt: { flex: 1, fontSize: Typography.fontSize.xs, color: 'rgba(255,255,255,0.75)', lineHeight: 18, fontStyle: 'italic' },

  goBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing[2], marginTop: Spacing[4], paddingVertical: Spacing[3], borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Glass.purpleBorder },
  goBtnTxt: { fontSize: Typography.fontSize.sm, fontWeight: '700', color: Colors.primary[400] },

  // Extras
  extrasGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing[3] },
  extraCard: { width: '47.5%', backgroundColor: Glass.card, borderWidth: 1, borderColor: Glass.cardBorder, borderRadius: BorderRadius.lg, padding: Spacing[4] },
  extraIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: Glass.purpleTint, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing[3] },
  extraTitle: { fontSize: Typography.fontSize.sm, fontWeight: '800', color: '#fff', marginBottom: 3 },
  extraDesc: { fontSize: Typography.fontSize.xs, color: 'rgba(255,255,255,0.45)', lineHeight: 16 },

  // Closing
  closing: { alignItems: 'center', backgroundColor: Glass.card, borderWidth: 1, borderColor: Glass.cardBorder, borderRadius: BorderRadius.xl, padding: Spacing[6], marginTop: Spacing[8] },
  closingTitle: { fontSize: Typography.fontSize.lg, fontWeight: '900', color: '#fff', marginTop: Spacing[3], marginBottom: Spacing[2] },
  closingSub: { fontSize: Typography.fontSize.sm, color: 'rgba(255,255,255,0.55)', textAlign: 'center', lineHeight: 20, marginBottom: Spacing[5] },
  closingBtn: { flexDirection: 'row', alignItems: 'center', gap: Spacing[2], backgroundColor: Colors.primary[500], borderRadius: BorderRadius.full, paddingHorizontal: Spacing[6], paddingVertical: Spacing[3] },
  closingBtnTxt: { fontSize: Typography.fontSize.sm, fontWeight: '800', color: '#fff' },

  version: { textAlign: 'center', fontSize: Typography.fontSize.xs, color: 'rgba(255,255,255,0.25)', marginTop: Spacing[8] },
})

/**
 * EL PERFIL DE ZENA
 * ─────────────────
 * Quién es la coach, qué sabe hacer y qué no. Se llega tocando su nombre en la
 * cabecera del chat, igual que en cualquier conversación.
 *
 * ── Por qué una pantalla y no un aviso ──────────────────────────────────────
 * Porque lo que hay que contar no cabe en un mensaje: de dónde salen los
 * números que usa, qué puede cambiar por su cuenta y —sobre todo— dónde está
 * el límite. Una IA de salud que no dice en voz alta que no sustituye a un
 * profesional deja esa conclusión al criterio de quien la lea.
 *
 * ── Lo que dice aquí es lo que hace ─────────────────────────────────────────
 * La lista de capacidades no es publicidad: cada línea corresponde a algo que
 * existe. Si mañana se le da una herramienta nueva, se añade aquí; si algo se
 * retira, se quita. Prometer en esta pantalla lo que la coach no puede hacer
 * es la forma más rápida de que deje de creerse lo demás.
 */

import { Image, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Screen, ScreenHeader } from '@/components/ui/Screen'
import { useAppTheme } from '@/context/ThemeContext'
import { Spacing, Typography } from '@/constants/theme'

type IconName = React.ComponentProps<typeof Ionicons>['name']

const SABE_HACER: { icon: IconName; titulo: string; detalle: string }[] = [
  {
    icon: 'restaurant-outline',
    titulo: 'Leer tu día',
    detalle: 'Calorías, macros, agua y lo que llevas comido hoy — sin que se lo cuentes.',
  },
  {
    icon: 'barbell-outline',
    titulo: 'Saber cómo entrenas',
    detalle: 'Tus sesiones, tus récords y qué te toca esta semana.',
  },
  {
    icon: 'flame-outline',
    titulo: 'Seguir tu constancia',
    detalle: 'Rachas, hábitos y peso, para hablar de lo que pasa y no de lo que crees que pasa.',
  },
  {
    icon: 'create-outline',
    titulo: 'Ajustar tu plan',
    detalle: 'Puede cambiar tus objetivos y tus metas de calorías y macros. Siempre te lo confirma antes.',
  },
]

const NO_HACE: string[] = [
  'No sustituye a un médico ni a una nutrióloga.',
  'No diagnostica, no receta y no ajusta ningún tratamiento.',
  'No propone ayunos prolongados ni déficits agresivos.',
  'No prohíbe alimentos: no cree en dietas, cree en la buena alimentación.',
]

export default function PerfilZena() {
  const T = useAppTheme()

  return (
    <Screen>
      <ScreenHeader back eyebrow="Zencrus · Coach IA" title="ZENA" />

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: Spacing[5], paddingBottom: Spacing[16] }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Retrato ── */}
        <View style={s.retrato}>
          <Image
            source={require('@/assets/images/zena.png')}
            style={s.cara}
            resizeMode="contain"
          />
          <Text style={[s.nombre, { color: T.ink }]}>ZENA</Text>
          <Text style={[s.rol, { color: T.accent }]}>COACH DE NUTRICIÓN Y FITNESS</Text>
          <Text style={[s.bio, { color: T.ink2 }]}>
            Tu coach de ZENCRUS. Conoce tu registro, tu entrenamiento y tus metas, y está
            para acompañarte hacia mejores hábitos — no para corregirte comida a comida.
          </Text>
        </View>

        {/* ── Qué sabe hacer ── */}
        <Text style={[s.seccion, { color: T.ink3 }]}>QUÉ PUEDE HACER</Text>
        {SABE_HACER.map(c => (
          <View key={c.titulo} style={[s.fila, { backgroundColor: T.glass, borderColor: T.glassBorder }]}>
            <View style={[s.caja, { backgroundColor: `${T.accent}1f`, borderColor: `${T.accent}30` }]}>
              <Ionicons name={c.icon} size={17} color={T.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.filaTitulo, { color: T.ink }]}>{c.titulo}</Text>
              <Text style={[s.filaDetalle, { color: T.ink3 }]}>{c.detalle}</Text>
            </View>
          </View>
        ))}

        {/* ── Dónde está el límite ── */}
        <Text style={[s.seccion, { color: T.ink3 }]}>DÓNDE ESTÁ EL LÍMITE</Text>
        <View style={[s.limites, { backgroundColor: T.glass, borderColor: T.glassBorder }]}>
          {NO_HACE.map(t => (
            <View key={t} style={s.limiteFila}>
              <View style={[s.punto, { backgroundColor: T.ink4 }]} />
              <Text style={[s.limiteTxt, { color: T.ink2 }]}>{t}</Text>
            </View>
          ))}
        </View>

        <Text style={[s.pie, { color: T.ink4 }]}>
          Si algo de lo que te diga no te cuadra con lo que te dijo tu médico, hazle caso a
          tu médico.
        </Text>
      </ScrollView>
    </Screen>
  )
}

const s = StyleSheet.create({
  retrato: { alignItems: 'center', paddingTop: Spacing[2], paddingBottom: Spacing[6] },
  cara: { width: 132, height: 132 },
  nombre: {
    fontFamily: Typography.fontFamily.display,
    fontSize: 34,
    letterSpacing: 0.5,
    marginTop: Spacing[3],
  },
  rol: { fontSize: 10, fontWeight: '900', letterSpacing: 2.4, marginTop: 4 },
  bio: {
    fontSize: Typography.fontSize.sm,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: Spacing[4],
    paddingHorizontal: Spacing[2],
  },

  seccion: {
    fontSize: 10, fontWeight: '900', letterSpacing: 2.2,
    marginTop: Spacing[5], marginBottom: Spacing[3],
  },

  fila: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    padding: Spacing[4], borderRadius: 16, borderWidth: 1,
    marginBottom: Spacing[2],
  },
  caja: {
    width: 34, height: 34, borderRadius: 11, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  filaTitulo: { fontSize: Typography.fontSize.sm, fontWeight: '700' },
  filaDetalle: { fontSize: Typography.fontSize.xs, lineHeight: 18, marginTop: 3 },

  limites: { padding: Spacing[4], borderRadius: 16, borderWidth: 1, gap: Spacing[3] },
  limiteFila: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  punto: { width: 5, height: 5, borderRadius: 3, marginTop: 7 },
  limiteTxt: { flex: 1, fontSize: Typography.fontSize.xs, lineHeight: 19 },

  pie: {
    fontSize: 11, lineHeight: 17, textAlign: 'center',
    marginTop: Spacing[5], paddingHorizontal: Spacing[3],
  },
})

/**
 * SALUD — cuatro puertas
 * ═══════════════════════════════════════════════════════════════════════════
 * Cuatro bloques y nada más. Es el mismo componente conceptual que el selector
 * de Entrena: un bloque grande, un nombre enorme y una sola cosa que tocar.
 *
 * ── Lo que se quitó, y por qué ─────────────────────────────────────────────
 * Había siete tarjetas del mismo peso y seis de ellas enseñaban un guion. El
 * problema no era que faltaran datos: era que la pantalla no tenía nada que
 * decir mientras no los hubiera, y siete cosas iguales no se leen, se hojean.
 *
 *   · Running se fue a Entrena, donde ya vive junto a Gym y Casa. Su tarjeta
 *     seguía siendo lo primero de esta pestaña y apuntaba a otra sección.
 *   · Sueño se funde con el check-in: las dos cosas se contestan en el mismo
 *     momento, al despertar, y preguntarlas por separado era pedir dos veces
 *     lo mismo.
 *   · Corazón, peso, ficha médica e historial caben en «Tu cuerpo», que es lo
 *     que son: lo que se mide de vez en cuando, no cada día.
 *
 * ── El icono manda y la cifra acompaña ─────────────────────────────────────
 * El icono grande de fondo está SIEMPRE, también cuando ya hay dato. La
 * primera versión lo sustituía por el número en cuanto había algo que enseñar,
 * y con eso el bloque cambiaba de aspecto según el día: la pantalla dejaba de
 * ser reconocible de un vistazo. Ahora lo único que cambia es la pastilla.
 *
 * ── Nada de adjetivos con género ───────────────────────────────────────────
 * El veredicto de recuperación dice «buena recuperación», no «recuperada».
 * Esta pestaña la abre todo el mundo.
 */

import { useEffect, useMemo } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, type Href } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { useHealthTrackerStore } from '@/store/healthTrackerStore'
import { useRecoveryStore } from '@/store/recoveryStore'
import { useHabitsStore } from '@/store/habitsStore'
import { useCicloStore } from '@/store/cicloStore'
import { useAuthStore } from '@/store/authStore'
import { useCiclo } from '@/features/salud/ciclo/useCiclo'
import { tieneCiclo } from '@/features/salud/acceso'
import { haceDias } from '@/utils/fechas'
import { elegir } from '@/utils/haptica'
import { Spacing } from '@/constants/theme'

type IconName = React.ComponentProps<typeof Ionicons>['name']

/**
 * La escala de rojo, la misma que Entrena y bajando pareja.
 *
 * El tercer color es siempre el casi-negro del fondo: sin él el degradado se
 * corta en seco contra la pantalla y el bloque parece un recorte pegado.
 */
const DEGRADADOS: Record<string, [string, string, string]> = {
  hoy:    ['#FF5C00', '#B33D00', '#0D0D10'],
  habito: ['#FF7A1F', '#B33D00', '#0D0D10'],
  ciclo:  ['#FFA45C', '#B33D00', '#0D0D10'],
  cuerpo: ['#B33D00', '#2A2C32', '#0D0D10'],
}

interface Puerta {
  id: keyof typeof DEGRADADOS
  nombre: string
  lema: string
  /** El icono grande del fondo. Siempre, haya dato o no. */
  icono: IconName
  /** La pastilla. `null` = todavía no hay nada medido, y no se pinta. */
  cifra: string | null
  unidad?: string
  ruta: Href
}

export default function SaludScreen() {
  const user = useAuthStore(s => s.user)
  const verCiclo = tieneCiclo(user)

  const cargarSalud = useHealthTrackerStore(s => s.load)
  const cargarRecuperacion = useRecoveryStore(s => s.load)
  const cargarHabitos = useHabitsStore(s => s.load)
  const habits = useHabitsStore(s => s.habits)
  const logs = useHabitsStore(s => s.logs)

  /**
   * El cálculo va DENTRO del selector, no en un `getState()` aparte.
   *
   * `getState()` devuelve el valor de ese instante y no suscribe a nada: la
   * pantalla enseñaba el score de cuando se montó y no se enteraba del
   * check-in recién hecho. Funcionaba solo cuando algo más provocaba un
   * render, que es la peor clase de fallo — el que aparece a veces.
   *
   * Aquí zustand ejecuta el selector en cada cambio del store y compara el
   * resultado: como es un número, solo se repinta cuando el score cambia de
   * verdad.
   */
  const score = useRecoveryStore(st => st.getRecoveryScore())
  const pulso = useHealthTrackerStore(st => st.getRestingHeartRate())

  const ciclo = useCiclo()

  useEffect(() => {
    void cargarSalud()
    void cargarRecuperacion()
    void cargarHabitos()
    // El ciclo solo se carga para quien lo tiene: para el resto no existe.
    if (verCiclo) void useCicloStore.getState().load()
  }, [cargarSalud, cargarRecuperacion, cargarHabitos, verCiclo])

  /**
   * Los hábitos de los últimos siete días: cumplidos sobre los que tocaban.
   *
   * `getWeekGrid()` devuelve una ventana móvil que termina hoy, no de lunes a
   * domingo. Eso importa para leer la cifra: «31 de 35» no es «llevo 31 esta
   * semana natural», es «de lo que tocaba en la última semana, hice 31».
   * La guarda de la fecha se queda por si algún día la ventana cambia.
   */
  const semana = useMemo(() => {
    if (!habits.length) return null
    let hechos = 0
    for (let i = 0; i < 7; i++) {
      const dia = logs[haceDias(i)] ?? {}
      hechos += habits.filter(h => dia[h.id]).length
    }
    return { hechos, tocaban: habits.length * 7 }
  }, [habits, logs])

  const puertas: Puerta[] = [
    {
      id: 'hoy',
      nombre: 'HOY',
      icono: 'sunny-outline',
      cifra: score != null ? String(score) : null,
      lema: score == null
        ? 'Check-in de la mañana'
        : score >= 75 ? 'Buena recuperación'
          : score >= 50 ? 'Recuperación media'
            : 'Recuperación baja',
      ruta: '/salud/recuperacion',
    },
    {
      id: 'habito',
      nombre: 'HÁBITOS',
      icono: 'checkmark-done-outline',
      cifra: semana ? String(semana.hechos) : null,
      unidad: semana ? `/${semana.tocaban}` : undefined,
      lema: semana ? 'Esta semana' : 'Sin hábitos creados',
      ruta: '/salud/habitos',
    },
    ...(verCiclo ? [{
      id: 'ciclo' as const,
      nombre: 'CICLO',
      icono: 'contrast-outline' as IconName,
      cifra: ciclo.prediccion ? String(ciclo.prediccion.diaDeCiclo) : null,
      lema: ciclo.prediccion ? `Fase ${ciclo.tema.label.toLowerCase()}` : 'Registra tu día',
      ruta: '/salud/ciclo' as Href,
    }] : []),
    {
      id: 'cuerpo',
      nombre: 'TU CUERPO',
      icono: 'body-outline',
      cifra: pulso != null ? String(pulso) : null,
      unidad: pulso != null ? 'lpm' : undefined,
      lema: pulso != null ? 'Pulso en reposo' : 'Pulso, peso y ficha médica',
      ruta: '/salud/cuerpo',
    },
  ]

  return (
    <View style={s.root}>
      <SafeAreaView style={s.safe} edges={['top']}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
          <View style={s.head}>
            <Text style={s.eyebrow}>ZENCRUS · SALUD</Text>
            <Text style={s.titulo}>¿Cómo{'\n'}estás hoy?</Text>
          </View>

          {puertas.map(p => <Bloque key={p.id} p={p} />)}
        </ScrollView>
      </SafeAreaView>
    </View>
  )
}

// ── El bloque ────────────────────────────────────────────────────────────────

function Bloque({ p }: { p: Puerta }) {
  const [a, b, c] = DEGRADADOS[p.id]

  return (
    <TouchableOpacity
      style={s.bloque}
      activeOpacity={0.86}
      onPress={() => { elegir(); router.push(p.ruta) }}
      accessibilityRole="button"
      accessibilityLabel={
        p.cifra
          ? `${p.nombre}. ${p.cifra}${p.unidad ?? ''}. ${p.lema}`
          : `${p.nombre}. ${p.lema}`
      }
    >
      <LinearGradient
        colors={[a, b, c]}
        locations={[0, 0.46, 1]}
        start={{ x: 0, y: 0.12 }}
        end={{ x: 1, y: 0.88 }}
        style={StyleSheet.absoluteFill}
      />
      {/* El brillo de arriba a la derecha. Es lo que separa un bloque de color
          de una mancha de color: le da una fuente de luz. */}
      <LinearGradient
        colors={['rgba(255,255,255,0.15)', 'transparent']}
        start={{ x: 0.92, y: 0 }}
        end={{ x: 0.35, y: 0.9 }}
        style={StyleSheet.absoluteFill}
      />

      {/* El icono grande. Va detrás de todo y no recibe toques. */}
      <View style={s.marca} pointerEvents="none">
        <Ionicons name={p.icono} size={88} color="#fff" />
      </View>

      {/* La pastilla vive arriba a la IZQUIERDA: arriba a la derecha se montaba
          encima del icono, y dos cosas en el mismo cuarto del bloque es lo que
          hace que una pantalla con pocos elementos parezca cargada. */}
      {p.cifra != null && (
        <View style={s.pastilla}>
          <Text style={s.pastillaCifra}>{p.cifra}</Text>
          {p.unidad ? <Text style={s.pastillaUnidad}>{p.unidad}</Text> : null}
        </View>
      )}

      <View style={s.textos}>
        <Text style={s.nombre}>{p.nombre}</Text>
        <Text style={s.lema}>{p.lema}</Text>
      </View>
    </TouchableOpacity>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#050505' },
  safe: { flex: 1 },
  scroll: { paddingBottom: 130 },

  head: { paddingHorizontal: Spacing[5], paddingTop: Spacing[4], paddingBottom: Spacing[5] },
  eyebrow: {
    fontFamily: 'Rajdhani_700Bold', fontSize: 11, color: '#FF5C00',
    letterSpacing: 2.8, marginBottom: Spacing[2],
  },
  titulo: {
    fontFamily: 'Inter_600SemiBold', fontSize: 36, lineHeight: 38,
    color: '#fff', letterSpacing: -1.2,
  },

  bloque: {
    marginHorizontal: Spacing[5], marginBottom: Spacing[3],
    height: 120, borderRadius: 20, overflow: 'hidden',
  },
  marca: {
    position: 'absolute', right: 16, top: 16,
    opacity: 0.24,
  },
  pastilla: {
    position: 'absolute', left: 18, top: 15,
    flexDirection: 'row', alignItems: 'baseline', gap: 4,
    paddingHorizontal: 11, paddingVertical: 5,
    borderRadius: 999, backgroundColor: 'rgba(5,5,5,0.30)',
  },
  pastillaCifra: {
    fontFamily: 'GeistMono_500Medium', fontSize: 15, color: '#fff',
    fontVariant: ['tabular-nums'],
  },
  pastillaUnidad: { fontFamily: 'Inter_400Regular', fontSize: 11, color: 'rgba(255,255,255,0.72)' },

  textos: { position: 'absolute', left: 18, bottom: 15, right: 116 },
  nombre: {
    /* El interlineado va POR ENCIMA del cuerpo a propósito. Con `lineHeight`
       igual al `fontSize`, React Native recorta lo que sobresale de la altura
       de mayúscula y la tilde de «HÁBITOS» desaparecía: en pantalla se leía
       «HABITOS». Es un fallo que solo se ve en las palabras acentuadas, así
       que pasa desapercibido hasta que alguien lo lee. */
    fontFamily: 'Rajdhani_700Bold', fontSize: 28, lineHeight: 34,
    color: '#fff', letterSpacing: 1.4,
  },
  lema: {
    fontFamily: 'Inter_400Regular', fontSize: 12.5,
    color: 'rgba(255,255,255,0.78)', marginTop: 4,
  },
})

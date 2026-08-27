/**
 * ENTRENA — la elección
 * ═════════════════════
 * Esta pestaña ya no es «el entrenamiento de hoy»: es la puerta con las tres
 * formas de entrenar que tiene ZENCRUS. Lo que había aquí antes vive ahora en
 * `app/workout/gym.tsx`, intacto.
 *
 * ── Por qué se elige cada vez que se entra ──────────────────────────────────
 * Porque las tres son maneras distintas de moverse, no pasos de un mismo flujo:
 * quien sale a correr un martes puede ir al gimnasio el miércoles, y recordar
 * la última elección obligaría a deshacerla la mitad de las veces. Tres puertas
 * grandes se tocan más rápido de lo que se lee un menú.
 *
 * ── El muro, en su versión de tres ──────────────────────────────────────────
 * Es la estructura que se eligió en los mockups: bloques a sangre, tipografía
 * enorme y cero cristal. Cada bloque lleva su ZENA de fondo — corriendo, en el
 * gimnasio y en casa — porque son la única imagen real de la marca.
 */

import { View, Text, StyleSheet, TouchableOpacity, ImageBackground, ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { elegir } from '@/utils/haptica'
import { Colors, Typography, Spacing } from '@/constants/theme'
import { NotaDeFase } from '@/components/salud/ciclo/NotaDeFase'

type IconName = React.ComponentProps<typeof Ionicons>['name']

const MODOS = [
  {
    id: 'gym',
    titulo: 'Gym',
    lema: 'Tu plan, tus series, tus récords',
    icono: 'barbell' as IconName,
    imagen: require('@/assets/images/zena-gym.jpg'),
    ruta: '/workout/gym' as const,
    tono: '#FF5C00',
  },
  {
    id: 'running',
    titulo: 'Al aire libre',
    lema: 'Correr, bici, caminar y montaña',
    icono: 'walk' as IconName,
    imagen: require('@/assets/images/zena-running.jpg'),
    ruta: '/aire-libre' as const,
    tono: '#FF7A1F',
  },
  {
    id: 'casa',
    titulo: 'En casa',
    lema: 'Sin material y sin excusas',
    icono: 'home' as IconName,
    imagen: require('@/assets/images/zena-casa.jpg'),
    ruta: '/workout/casa' as const,
    tono: '#FFA45C',
  },
]

export default function ElegirEntrenamiento() {
  return (
    <View style={s.root}>
      <SafeAreaView style={s.safe} edges={['top']}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.scroll}
        >
          <View style={s.head}>
            <Text style={s.eyebrow}>ZENCRUS · ENTRENA</Text>
            <Text style={s.titulo}>¿Cómo{'\n'}entrenas hoy?</Text>
          </View>

          {/* Antes de elegir el modo, no después: la nota sirve para decidir
              qué sesión hacer hoy, y puesta debajo de las tarjetas llegaría
              cuando ya se ha elegido. Se esconde sola si no procede. */}
          <View style={s.nota}>
            <NotaDeFase donde="entrena" />
          </View>

          {MODOS.map(m => (
            <TouchableOpacity
              key={m.id}
              style={s.bloque}
              activeOpacity={0.86}
              onPress={() => { elegir(); router.push(m.ruta) }}
              accessibilityRole="button"
              accessibilityLabel={`${m.titulo}. ${m.lema}`}
            >
              <ImageBackground source={m.imagen} style={s.fondo} imageStyle={s.fondoImg}>
                {/* El degradado no es decoración: sin él, el titular cae sobre
                    la parte clara de la foto y deja de leerse. */}
                <LinearGradient
                  colors={['rgba(5,5,5,0.25)', 'rgba(5,5,5,0.55)', 'rgba(5,5,5,0.92)']}
                  locations={[0, 0.45, 1]}
                  style={StyleSheet.absoluteFill}
                />
                <View style={s.contenido}>
                  <View style={[s.iconoCaja, { borderColor: `${m.tono}66`, backgroundColor: `${m.tono}22` }]}>
                    <Ionicons name={m.icono} size={16} color={m.tono} />
                  </View>
                  <View style={s.fila}>
                    <View style={s.textos}>
                      <Text style={s.bloqueTitulo}>{m.titulo}</Text>
                      <Text style={s.bloqueLema}>{m.lema}</Text>
                    </View>
                    <Ionicons name="arrow-forward" size={22} color="#fff" />
                  </View>
                </View>
              </ImageBackground>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </SafeAreaView>
    </View>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#050505' },
  safe: { flex: 1 },
  scroll: { paddingBottom: 130 },
  nota: { paddingHorizontal: 20, marginBottom: 14 },
  head: { paddingHorizontal: Spacing[5], paddingTop: Spacing[4], paddingBottom: Spacing[5] },
  eyebrow: {
    fontSize: 10, fontWeight: '900', color: Colors.primary[500],
    letterSpacing: 2.6, marginBottom: Spacing[2],
  },
  titulo: {
    fontFamily: Typography.fontFamily.display,
    fontSize: 40, lineHeight: 38, color: '#fff', letterSpacing: -0.8,
  },
  bloque: {
    marginHorizontal: Spacing[5], marginBottom: Spacing[3],
    borderRadius: 22, overflow: 'hidden', height: 176,
  },
  fondo: { flex: 1, justifyContent: 'flex-end' },
  fondoImg: { resizeMode: 'cover' },
  contenido: { padding: Spacing[4], gap: Spacing[3] },
  iconoCaja: {
    width: 32, height: 32, borderRadius: 11, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start',
  },
  fila: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: Spacing[3] },
  textos: { flex: 1 },
  bloqueTitulo: {
    fontFamily: Typography.fontFamily.display,
    fontSize: 34, lineHeight: 34, color: '#fff', letterSpacing: -0.6,
    textTransform: 'uppercase',
  },
  bloqueLema: { fontSize: 12.5, color: 'rgba(255,255,255,0.62)', marginTop: 3 },
})

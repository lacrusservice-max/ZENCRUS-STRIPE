/**
 * LA NOTA DE FASE
 * ═══════════════════════════════════════════════════════════════════════════
 * La única pieza del ciclo que sale de la sección del ciclo. Va en Nutrición y
 * en Entrena, en tema oscuro, y explica por qué HOY el cuerpo pide lo que pide.
 *
 * ── Por qué existe ─────────────────────────────────────────────────────────
 * Es la tesis del módulo entero: ninguna app cruza el ciclo con el
 * entrenamiento y la comida, y ZENCRUS puede porque ya tiene los tres datos.
 * Mientras el ciclo viva encerrado en sus nueve pantallas, esa ventaja no
 * existe para nadie.
 *
 * Y lo que resuelve es concreto: en fase lútea el metabolismo basal sube un
 * poco y el hambre sube DE VERDAD. Sin explicación, ese día se lee como falta
 * de fuerza de voluntad y es el día en que la gente abandona. Con ella, se lee
 * como lo que es.
 *
 * ── Se pinta sola o no se pinta ────────────────────────────────────────────
 * Devuelve `null` para quien no tiene el módulo, para quien no tiene historial
 * y en los modos que no predicen. Las pantallas que la usan NO preguntan nada:
 * si preguntaran, cada una tendría su propia versión de la regla y alguna se
 * equivocaría. Aquí está la única.
 *
 * ── No promete rendimiento ─────────────────────────────────────────────────
 * La evidencia sobre fuerza e hipertrofia según la fase es débil e
 * inconsistente. Todo lo que dice esta tarjeta va en términos de síntomas y
 * bienestar, que es donde sí hay consenso.
 */

import { View, Text, StyleSheet, Pressable } from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useAuthStore } from '@/store/authStore'
import { tieneCiclo } from '@/features/salud/acceso'
import { useCiclo } from '@/features/salud/ciclo/useCiclo'
import { FASE } from '@/theme/salud/cicloClaro'
import { base, space, radius, family, type as tipo } from '@/theme/salud/tokens'
import { elegir } from '@/utils/haptica'
import { FASES, type FichaFase } from '@/nucleo/ciclo/recomendaciones'

type Donde = 'nutricion' | 'entrena'

/**
 * Qué decir en cada fase, según dónde se pinte.
 *
 * Una frase, no un párrafo: esto va dentro de una pantalla que ya tiene su
 * propio trabajo que hacer, y si ocupa más se convierte en un estorbo que se
 * aprende a saltar.
 *
 * ── Las frases ya no viven aquí ────────────────────────────────────────────
 * Estaban escritas en este fichero, y eran la segunda de tres copias de lo
 * mismo: la guía larga en el servidor, esta línea, y otra pareja de frases en
 * la portada del ciclo. Ya decían cosas distintas de la fase lútea. Ahora las
 * tres salen de `nucleo/ciclo/recomendaciones.ts`.
 */
const CUAL: Record<Donde, (f: FichaFase) => string> = {
  nutricion: f => f.notaNutricion,
  entrena: f => f.notaEntreno,
}

export function NotaDeFase({ donde }: { donde: Donde }) {
  const user = useAuthStore(s => s.user)
  const { prediccion, modo } = useCiclo()

  // Las tres puertas, en orden de coste: la llave, el modo y el historial.
  if (!tieneCiclo(user)) return null
  if (!modo.predice) return null
  if (!prediccion) return null

  const fase = prediccion.fase
  const tono = FASE[fase]

  return (
    <Pressable
      onPress={() => { elegir(); router.push('/salud/ciclo') }}
      style={({ pressed }) => [s.caja, { borderColor: `${tono.arco}44` }, pressed && s.pulsado]}
      accessibilityRole="button"
      accessibilityLabel={`Fase ${tono.etiqueta}, día ${prediccion.diaDeCiclo}. Abrir el ciclo.`}
    >
      <View style={[s.punto, { backgroundColor: tono.arco }]} />
      <View style={s.texto}>
        <Text style={s.cabecera}>
          <Text style={{ color: tono.arco }}>{tono.etiqueta.toUpperCase()}</Text>
          <Text style={s.dia}>{`  ·  DÍA ${prediccion.diaDeCiclo}`}</Text>
        </Text>
        <Text style={s.frase}>{CUAL[donde](FASES[fase])}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={base.textLow} />
    </Pressable>
  )
}

const s = StyleSheet.create({
  caja: {
    flexDirection: 'row', alignItems: 'center', gap: space.sm,
    padding: space.md, borderRadius: radius.lg,
    backgroundColor: base.surface2,
    borderWidth: 1,
  },
  pulsado: { opacity: 0.75 },
  punto: { width: 8, height: 8, borderRadius: 4 },
  texto: { flex: 1, gap: 3 },
  cabecera: { fontFamily: family.uiSemi, fontSize: tipo.ui.xs, letterSpacing: 1.6 },
  dia: { color: base.textLow },
  frase: {
    fontFamily: family.ui, fontSize: tipo.ui.sm,
    color: base.textMid, lineHeight: tipo.ui.sm * 1.5,
  },
})

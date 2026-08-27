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
import type { Phase } from '@/features/salud/ciclo/fases'

type Donde = 'nutricion' | 'entrena'

/**
 * Qué decir en cada fase, según dónde se pinte.
 *
 * Una frase, no un párrafo: esto va dentro de una pantalla que ya tiene su
 * propio trabajo que hacer, y si ocupa más se convierte en un estorbo que se
 * aprende a saltar.
 */
const TEXTO: Record<Donde, Record<Phase, string>> = {
  nutricion: {
    menstrual: 'Hierro y magnesio ayudan estos días: lentejas, espinaca, semillas de calabaza.',
    folicular: 'Buen momento para proteína y carbohidratos complejos; el gasto sube con la energía.',
    ovulatoria: 'Mantén proteína y complejos. Buen día para comer variado, sin restricciones.',
    lutea: 'Es normal tener más hambre: el gasto basal sube en esta fase. Fibra y complejos sostienen mejor que restringir.',
  },
  entrena: {
    menstrual: 'Si el cuerpo pide bajar el ritmo, bájalo. Caminar, movilidad o yoga cuentan.',
    folicular: 'Suele haber más energía. Si la sientes, es buen momento para progresar cargas.',
    ovulatoria: 'Punto alto de energía en muchas personas. Alta intensidad si el cuerpo acompaña.',
    lutea: 'Hacia el final de la fase la intensidad suele costar más. El cardio moderado ayuda al ánimo.',
  },
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
        <Text style={s.frase}>{TEXTO[donde][fase]}</Text>
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

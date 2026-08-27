/**
 * EN CASA · «¿QUÉ TIENES?»
 * ════════════════════════
 * La hoja donde el usuario dice qué hay en su casa. De aquí sale el filtro de
 * toda la sección.
 *
 * ── Se puede contestar «nada» y no es un callejón ───────────────────────────
 * Con el inventario vacío quedan 34 ejercicios de peso corporal, que es una
 * sección entera. Por eso el botón de abajo nunca se bloquea y el texto lo
 * dice: sin material también hay con qué entrenar. Un formulario que te obliga
 * a marcar algo para poder salir es un formulario que se contesta mintiendo.
 *
 * ── Se dice cuánto desbloquea cada cosa ─────────────────────────────────────
 * «Mancuernas · 56 ejercicios» convierte una casilla en una decisión informada.
 * Sin el número, marcar o no marcar da igual y la gente marca a bulto.
 */

import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { Colors, Spacing } from '@/constants/theme'
import { useCasaMaterial, APAREJOS, DESBLOQUEA, Aparejo } from '@/store/casaMaterialStore'

/** Los que salen siempre, tengas lo que tengas. */
const SIEMPRE = 34

export function MaterialCasa({ abierto, onCerrar }: { abierto: boolean; onCerrar: () => void }) {
  const { tengo, alternar, marcarPreguntado } = useCasaMaterial()

  const total = SIEMPRE + tengo.reduce((n, a) => n + (DESBLOQUEA[a] ?? 0), 0)

  const cerrar = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    marcarPreguntado()
    onCerrar()
  }

  return (
    <Modal visible={abierto} animationType="slide" transparent onRequestClose={cerrar}>
      <View style={s.fondo}>
        <View style={s.hoja}>
          <View style={s.asa} />

          <Text style={s.titulo}>¿Qué tienes en casa?</Text>
          <Text style={s.sub}>
            Marca solo lo que de verdad tengas a mano. Con esto te propongo ejercicios que
            puedes hacer hoy, no una lista bonita que no sirve.
          </Text>

          <ScrollView style={{ flexGrow: 0 }} showsVerticalScrollIndicator={false}>
            <ListaAparejos />
          </ScrollView>

          <View style={s.resumen}>
            <Ionicons name="body-outline" size={15} color={Colors.neon.w3} />
            <Text style={s.resumenTxt}>
              {tengo.length === 0
                ? `Sin material tienes ${SIEMPRE} ejercicios de peso corporal. Sobra para entrenar.`
                : `Podrás hacer ${total} ejercicios, contando los ${SIEMPRE} de peso corporal.`}
            </Text>
          </View>

          <TouchableOpacity style={s.boton} onPress={cerrar} activeOpacity={0.88}>
            <Text style={s.botonTxt}>
              {tengo.length === 0 ? 'Empezar sin material' : 'Listo'}
            </Text>
          </TouchableOpacity>

          <Text style={s.pie}>Se puede cambiar cuando quieras desde «Tu material».</Text>
        </View>
      </View>
    </Modal>
  )
}


/**
 * La lista de aparejos, suelta.
 *
 * Vive fuera de la hoja porque se usa en DOS sitios y tienen que ser el mismo:
 * aquí, para cambiarlo rápido, y como primer paso de «Editar mi semana», que
 * es donde de verdad se pregunta la primera vez. Dos copias de esta lista
 * acabarían con un aparejo en una y no en la otra.
 */
export function ListaAparejos() {
  const { tengo, alternar } = useCasaMaterial()
  return (
    <>
      {APAREJOS.map(a => {
        const on = tengo.includes(a.id)
        return (
          <TouchableOpacity
            key={a.id}
            style={[s.fila, on && s.filaOn]}
            onPress={() => { void Haptics.selectionAsync(); alternar(a.id as Aparejo) }}
            activeOpacity={0.85}
          >
            <View style={[s.icono, on && s.iconoOn]}>
              <Ionicons
                name={a.icono as keyof typeof Ionicons.glyphMap}
                size={17}
                color={on ? '#fff' : Colors.neon.w3}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.nombre}>{a.nombre}</Text>
              <Text style={s.pista}>{a.sub} · {DESBLOQUEA[a.id]} ejercicios</Text>
            </View>
            <Ionicons
              name={on ? 'checkmark-circle' : 'ellipse-outline'}
              size={21}
              color={on ? Colors.neon.red : 'rgba(255,255,255,0.22)'}
            />
          </TouchableOpacity>
        )
      })}
    </>
  )
}

/** Cuántos ejercicios te quedan con lo que has marcado. Lo usan los dos sitios. */
export function cuantosCon(tengo: Aparejo[]) {
  return SIEMPRE + tengo.reduce((n, a) => n + (DESBLOQUEA[a] ?? 0), 0)
}

export { SIEMPRE as EJERCICIOS_SIN_MATERIAL }

const s = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: 'rgba(5,5,5,0.66)', justifyContent: 'flex-end' },
  hoja: {
    maxHeight: '88%',
    backgroundColor: Colors.neon.void,
    borderTopLeftRadius: 26, borderTopRightRadius: 26,
    paddingHorizontal: Spacing[4], paddingBottom: Spacing[6],
    borderTopWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.14)',
  },
  asa: {
    width: 38, height: 4, borderRadius: 2, alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.22)', marginTop: 9, marginBottom: 15,
  },
  titulo: { fontSize: 23, fontWeight: '800', color: '#fff', letterSpacing: -0.6 },
  sub: { fontSize: 13, color: Colors.neon.w2, lineHeight: 19, marginTop: 7, marginBottom: 15 },
  fila: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 11, paddingHorizontal: 12, borderRadius: 15, marginBottom: 7,
    backgroundColor: 'rgba(255,255,255,0.045)',
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.08)',
  },
  filaOn: { backgroundColor: 'rgba(255,92,0,0.1)', borderColor: 'rgba(255,92,0,0.4)' },
  icono: {
    width: 36, height: 36, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  iconoOn: { backgroundColor: Colors.neon.red },
  nombre: { fontSize: 14, fontWeight: '700', color: '#fff', letterSpacing: -0.25 },
  pista: { fontSize: 11, color: Colors.neon.w3, marginTop: 2 },
  resumen: {
    flexDirection: 'row', gap: 9, alignItems: 'flex-start',
    marginTop: 9, marginBottom: 13, paddingHorizontal: 3,
  },
  resumenTxt: { flex: 1, fontSize: 11.5, color: Colors.neon.w2, lineHeight: 17 },
  boton: {
    height: 52, borderRadius: 26, backgroundColor: Colors.neon.red,
    alignItems: 'center', justifyContent: 'center',
  },
  botonTxt: { fontSize: 15.5, fontWeight: '800', color: '#fff', letterSpacing: -0.2 },
  pie: { fontSize: 10.5, color: Colors.neon.w4, textAlign: 'center', marginTop: 10 },
})

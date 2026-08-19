import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { GlassCard, GlassProgress } from '@/components/ui/Glass'
import { Colors, Spacing, Typography } from '@/constants/theme'
import { useNutritionStore } from '@/store/nutritionStore'
import { confirmar, elegir, logro } from '@/utils/haptica'

const WATER_TARGET = 8

/**
 * Contador de vasos de agua — usa el mismo `nutritionStore` que Inicio,
 * así que registrar aquí o en Inicio siempre queda sincronizado.
 */
export function WaterWidget() {
  const { waterGlasses, addWater, removeWater } = useNutritionStore()
  const pct = waterGlasses / WATER_TARGET

  /* El vaso que cierra la meta se siente distinto a los siete anteriores. Es
     el gesto que más veces al día se repite en toda la app, así que es donde
     más se nota que el móvil conteste — y donde antes no contestaba nada. */
  const beber = () => { addWater(); waterGlasses + 1 >= WATER_TARGET ? logro() : confirmar() }
  const quitar = () => { if (waterGlasses > 0) { removeWater(); elegir() } }

  return (
    <GlassCard>
      <View style={w.row}>
        <View style={w.iconBox}>
          <Ionicons name="water" size={20} color={Colors.primary[400]} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={w.title}>Hidratación</Text>
          <Text style={w.val}>{waterGlasses}<Text style={w.sub}> / {WATER_TARGET} vasos</Text></Text>
        </View>
        <View style={w.btnRow}>
          <TouchableOpacity style={w.btn} onPress={quitar} activeOpacity={0.7}>
            <Ionicons name="remove" size={16} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>
          <TouchableOpacity style={[w.btn, w.btnAdd]} onPress={beber} activeOpacity={0.7}>
            <Ionicons name="add" size={16} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
      <GlassProgress pct={pct} color={Colors.primary[400]} height={5} style={{ marginTop: Spacing[3] }} />
    </GlassCard>
  )
}

const w = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing[3] },
  iconBox: {
    width: 40, height: 40, borderRadius: 13,
    backgroundColor: `${Colors.primary[500]}1f`, borderWidth: 1, borderColor: `${Colors.primary[500]}30`,
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: 11, fontWeight: '800', color: 'rgba(255,255,255,0.5)', letterSpacing: 0.5, textTransform: 'uppercase' },
  val: { fontSize: Typography.fontSize.xl, fontWeight: '900', color: '#fff', marginTop: 2 },
  sub: { fontSize: Typography.fontSize.sm, fontWeight: '600', color: 'rgba(255,255,255,0.4)' },
  btnRow: { flexDirection: 'row', gap: 8 },
  btn: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  btnAdd: { backgroundColor: `${Colors.primary[500]}30`, borderColor: `${Colors.primary[500]}40` },
})

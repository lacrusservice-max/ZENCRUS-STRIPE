/**
 * AL AIRE LIBRE · AJUSTES
 * ═══════════════════════
 * Sin fondo teñido y sin adornos: los ajustes son un sitio rápido, no un sitio
 * para mirar.
 *
 * Cada interruptor de aquí cambia algo de verdad. `avisosVoz` NO está porque la
 * app no tiene `expo-speech` ni `expo-av` y no habría nada que hacer sonar; una
 * palanca que no hace nada estropea la confianza en todas las demás.
 */

import { View, Text, StyleSheet, Pressable, ScrollView, Switch } from 'react-native'
import { router } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { RunningColors } from '@/constants/running-tokens'
import { Tarjeta, Etiqueta, Chip } from '@/components/outdoor/Material'
import { Cabecera } from '@/components/outdoor/Cabecera'
import { useOutdoorAjustes } from '@/store/outdoorAjustesStore'
import { useOutdoorStore } from '@/store/outdoorStore'

export default function Ajustes() {
  const a = useOutdoorAjustes()
  const historial = useOutdoorStore(s => s.historial)

  const palanca = (
    k: 'pausaAutomatica' | 'pantallaEncendida' | 'barometro' | 'contarEnGastoDelDia' | 'ocultarInicio',
    titulo: string,
    sub: string,
    desactivado?: string
  ) => (
    <View style={s.fila}>
      <View style={{ flex: 1 }}>
        <Text style={[s.titulo, desactivado && { color: 'rgba(255,255,255,0.4)' }]}>{titulo}</Text>
        <Text style={s.sub}>{desactivado ?? sub}</Text>
      </View>
      <Switch
        value={desactivado ? false : a[k]}
        disabled={!!desactivado}
        onValueChange={v => { Haptics.selectionAsync(); a.set(k, v) }}
        trackColor={{ false: 'rgba(255,255,255,0.14)', true: RunningColors.signal.base }}
        thumbColor="#fff"
      />
    </View>
  )

  return (
    <View style={s.raiz}>
      <Cabecera titulo="Ajustes" sub="Al aire libre" />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 15, paddingBottom: 30 }}>
        <Etiqueta style={{ marginBottom: 9 }}>Medidas</Etiqueta>
        <Tarjeta>
          <View style={s.fila}>
            <View style={{ flex: 1 }}>
              <Text style={s.titulo}>Unidades</Text>
              <Text style={s.sub}>Distancias y ritmo en toda la sección</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 5 }}>
              {(['km', 'mi'] as const).map(u => (
                <Pressable key={u} onPress={() => { Haptics.selectionAsync(); a.set('unidades', u) }}>
                  <Chip activo={a.unidades === u}>{u === 'km' ? 'Kilómetros' : 'Millas'}</Chip>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={s.borde} />
          <View style={s.fila}>
            <View style={{ flex: 1 }}>
              <Text style={s.titulo}>Parcial cada</Text>
              <Text style={s.sub}>Cada cuánto se corta un tramo</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 5 }}>
              {[500, 1000, 5000].map(m => (
                <Pressable key={m} onPress={() => { Haptics.selectionAsync(); a.set('parcialCada', m) }}>
                  <Chip activo={a.parcialCada === m}>{m >= 1000 ? `${m / 1000} km` : `${m} m`}</Chip>
                </Pressable>
              ))}
            </View>
          </View>
        </Tarjeta>

        <Etiqueta style={{ marginTop: 16, marginBottom: 9 }}>Durante la salida</Etiqueta>
        <Tarjeta>
          {palanca('pausaAutomatica', 'Pausa automática', 'Se pausa sola si dejas de avanzar 12 segundos')}
          <View style={s.borde} />
          {palanca('pantallaEncendida', 'Pantalla siempre encendida', 'Mientras grabas, para no despertarla con las manos sudadas')}
          <View style={s.borde} />
          {palanca(
            'barometro',
            'Barómetro para la altura',
            'Mejor dato de desnivel que el GPS',
            'Aún no escrito: la altura sale del GPS'
          )}
        </Tarjeta>

        <Etiqueta style={{ marginTop: 16, marginBottom: 9 }}>Fuera de la sección</Etiqueta>
        <Tarjeta>
          {palanca('contarEnGastoDelDia', 'Contar en el gasto del día', 'Las kcal de tus salidas suben el techo que calcula ZENA')}
          <View style={s.borde} />
          {palanca('ocultarInicio', 'Ocultar el inicio de mis rutas', `Recorta los primeros ${a.metrosOcultos} m al compartir`)}
        </Tarjeta>
        <Text style={s.nota}>
          Tu casa suele estar en el primer punto de casi todas tus salidas. Recortarlo es la
          diferencia entre compartir un recorrido y compartir tu portal.
        </Text>

        <Etiqueta style={{ marginTop: 16, marginBottom: 9 }}>Datos</Etiqueta>
        <Tarjeta>
          <View style={s.fila}>
            <View style={{ flex: 1 }}>
              <Text style={s.titulo}>Actividades guardadas</Text>
              <Text style={s.sub}>
                {historial.length === 0
                  ? 'Ninguna todavía'
                  : `${historial.length} · ${(historial.reduce((x, h) => x + h.puntos.length, 0)).toLocaleString('es-MX')} puntos de GPS`}
              </Text>
            </View>
          </View>
          <View style={s.borde} />
          <Pressable onPress={() => router.push('/aire-libre/material' as never)} style={s.fila}>
            <View style={{ flex: 1 }}>
              <Text style={s.titulo}>Material</Text>
              <Text style={s.sub}>Zapatillas y bicis, con sus kilómetros</Text>
            </View>
            <Text style={s.flecha}>›</Text>
          </Pressable>
        </Tarjeta>

        <Text style={s.nota}>
          Los avisos de voz necesitan una dependencia nativa que la app aún no lleva
          (<Text style={s.mono}>expo-speech</Text>) y un dev build nuevo. Mientras tanto, las
          sesiones avisan con vibración y en pantalla.
        </Text>
      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: RunningColors.surface.void },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  // Va SUELTO entre dos filas, nunca combinado con `fila`: lleva `height`
  // y aplasta cualquier fila a la que se le añada en el array de estilos.
  borde: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.09)', marginVertical: 4 },
  titulo: { fontSize: 13, fontWeight: '600', color: '#fff', letterSpacing: -0.2 },
  sub: { fontSize: 10.5, color: 'rgba(255,255,255,0.38)', marginTop: 2, lineHeight: 15 },
  flecha: { fontSize: 18, color: 'rgba(255,255,255,0.26)' },
  nota: { fontSize: 10.5, color: 'rgba(255,255,255,0.32)', lineHeight: 15.5, marginTop: 10, paddingHorizontal: 3 },
  mono: { color: 'rgba(255,255,255,0.6)' },
})

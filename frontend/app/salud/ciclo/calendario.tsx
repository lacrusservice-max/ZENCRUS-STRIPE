/**
 * CICLO · CALENDARIO
 * ═══════════════════════════════════════════════════════════════════════════
 * La pantalla 07 del mockup: meses encadenados hacia abajo, los días de
 * sangrado en granate, la ventana fértil en agua, y hoy con su marco.
 *
 * ── Lo registrado y lo previsto NO se pintan igual ─────────────────────────
 * En el mockup los dos son el mismo rectángulo lleno. Aquí no, y es la única
 * licencia que me tomo con el diseño: un día de sangrado registrado es un
 * HECHO —lo marcó ella— y un día de periodo previsto es una APUESTA del
 * motor. Pintarlos idénticos convierte una predicción en un dato, y el día que
 * la regla se retrase tres días la app parecerá estar mintiendo sobre el
 * pasado. Lo registrado va lleno; lo previsto, con el contorno punteado.
 *
 * ── Doce meses atrás y tres adelante ───────────────────────────────────────
 * Hacia atrás, porque el calendario es sobre todo un sitio para CORREGIR:
 * «me bajó el martes y no lo apunté». Hacia delante solo tres, porque la banda
 * de incertidumbre crece con la raíz del número de ciclos y a partir del
 * cuarto la predicción es tan ancha que enseñarla es ruido.
 */

import { useCallback, useMemo, useRef } from 'react'
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native'
import { router } from 'expo-router'
import { useCicloStore } from '@/store/cicloStore'
import { useCiclo } from '@/features/salud/ciclo/useCiclo'
import { construirMes, type DiaCalendario } from '@/features/salud/ciclo/calendario'
import { DIAS_SEMANA, nombreMes } from '@/features/salud/ciclo/formato'
import { hoyLocal } from '@/utils/fechas'
import { ALTO_BARRA } from '@/components/salud/ciclo/BarraCiclo'
import { Pantalla, Icono } from '@/components/salud/ciclo/Claro'
import {
  FONDO, ACENTO, TEXTO, FUENTE, SUP, SOMBRA, RADIO, TABULAR,
} from '@/theme/salud/cicloClaro'
import { elegir } from '@/utils/haptica'

/** Cuántos meses se pueden recorrer. Ver el encabezado del archivo. */
const ATRAS = 12
const ADELANTE = 3

/**
 * Por qué esto es un `ScrollView` y no una `FlatList`.
 *
 * Con `FlatList` hay que decirle a `getItemLayout` cuánto mide cada mes para
 * poder abrir la pantalla en el actual. Se intentó de dos maneras y las dos
 * fallaron: con el número a mano, la lista abría dos meses por delante; y
 * midiendo el primero y corrigiendo, tampoco, porque **los meses NO miden todos
 * lo mismo** — el mes que contiene hoy lleva la etiqueta «HOY» debajo del día y
 * eso le añade una fila más alta que a los demás. Cualquier estimación estaba
 * condenada de antemano.
 *
 * Aquí el mes actual dice dónde está —su propio `onLayout`— y se salta a esa
 * `y` exacta. Sin estimar nada.
 *
 * Y se puede permitir: son dieciséis meses, no dieciséis mil. La virtualización
 * ahorraría unas seiscientas vistas pequeñas, y a cambio traía este problema.
 */

const mayuscula = (t: string): string => t.charAt(0).toUpperCase() + t.slice(1)

export default function CalendarioCiclo() {
  const logs = useCicloStore(s => s.logs)
  const hoy = hoyLocal()
  const { periodos, prediccion, marco } = useCiclo()
  const lista = useRef<ScrollView>(null)
  /* Una sola vez: si se saltara cada vez que el mes actual se re-mide, la
     pantalla se negaría a dejarse desplazar. */
  const yaSaltado = useRef(false)

  const alSituarseElMesActual = useCallback((y: number) => {
    if (yaSaltado.current) return
    yaSaltado.current = true
    lista.current?.scrollTo({ y: Math.max(0, y - 12), animated: false })
  }, [])

  /* La lista de meses, del más antiguo al más nuevo. Se calcula una vez: si se
     recalculara en cada pintada, `initialScrollIndex` saltaría solo. */
  const meses = useMemo(() => {
    const [a, m] = [Number(hoy.slice(0, 4)), Number(hoy.slice(5, 7))]
    const out: { año: number; mes: number }[] = []
    for (let k = -ATRAS; k <= ADELANTE; k++) {
      const d = new Date(a, m - 1 + k, 1)
      out.push({ año: d.getFullYear(), mes: d.getMonth() + 1 })
    }
    return out
  }, [hoy])

  const añoHoy = Number(hoy.slice(0, 4))
  const mesHoy = Number(hoy.slice(5, 7))

  return (
    <Pantalla fondo={FONDO.calendario}>
      <ScrollView
        ref={lista}
        contentContainerStyle={[s.scroll, { paddingBottom: ALTO_BARRA + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        {meses.map(m => {
          const esActual = m.año === añoHoy && m.mes === mesHoy
          return (
            <Mes
              key={`${m.año}-${m.mes}`}
              año={m.año}
              mes={m.mes}
              esActual={esActual}
              onSituarse={esActual ? alSituarseElMesActual : undefined}
              logs={logs}
              periodos={periodos}
              prediccion={prediccion}
              marco={marco}
              hoy={hoy}
            />
          )
        })}
      </ScrollView>

      {/* El lápiz del mockup: entra al registro de HOY, no del día que se esté
          mirando — para eso se toca el día. */}
      <Pressable
        onPress={() => { elegir(); router.push('/salud/ciclo/registrar') }}
        style={({ pressed }) => [s.lapiz, { bottom: ALTO_BARRA + 22 }, pressed && s.pulsado]}
        accessibilityRole="button"
        accessibilityLabel="Registrar hoy"
      >
        <Icono nombre="dashboard_editar" tam={24} style={s.lapizIc} />
      </Pressable>
    </Pantalla>
  )
}

/* ── Un mes ─────────────────────────────────────────────────────────────── */

function Mes({ año, mes, esActual, onSituarse, logs, periodos, prediccion, marco, hoy }: {
  año: number
  mes: number
  esActual: boolean
  /** Solo lo recibe el mes actual: es el que dice dónde hay que abrir. */
  onSituarse?: (y: number) => void
  logs: Parameters<typeof construirMes>[0]['logs']
  periodos: Parameters<typeof construirMes>[0]['periodos']
  prediccion: Parameters<typeof construirMes>[0]['prediccion']
  marco: Parameters<typeof construirMes>[0]['marco']
  hoy: string
}) {
  const datos = useMemo(
    () => construirMes({ año, mes, logs, periodos, prediccion, marco, hoy }),
    [año, mes, logs, periodos, prediccion, marco, hoy])

  return (
    <View
      style={s.mes}
      onLayout={e => onSituarse?.(e.nativeEvent.layout.y)}
    >
      <View style={s.mesCab}>
        {/* `nombreMes` da «noviembre» en minúscula, que es lo correcto dentro
            de una frase y se ve mal como titular. */}
        <Text style={s.mesNombre}>{mayuscula(nombreMes(mes))}</Text>
        <Text style={s.mesAño}>{año}</Text>
        <View style={s.flex} />
        {esActual ? (
          <View style={s.pildoraActual}>
            <Text style={s.pildoraActualTxt}>Mes actual</Text>
          </View>
        ) : null}
      </View>

      <View style={s.tarjeta}>
        <View style={s.semana}>
          {DIAS_SEMANA.map((d, i) => (
            <Text key={`${d}${i}`} style={s.diaSemana}>{d}</Text>
          ))}
        </View>
        <View style={s.rejilla}>
          {datos.dias.map(d => <Celda key={d.fecha} d={d} />)}
        </View>
      </View>
    </View>
  )
}

/* ── Un día ─────────────────────────────────────────────────────────────── */

function Celda({ d }: { d: DiaCalendario }) {
  if (!d.delMes) return <View style={s.celda} />

  /* Un nivel 0 significa «hoy no sangré», que es un dato y NO debe pintarse de
     granate. Solo cuenta a partir de 1. */
  const sangro = (d.sangrado ?? 0) > 0
  const previsto = !sangro && d.periodoPredicho
  const fertil = !sangro && !previsto && d.fertil
  /* Dentro de la ventana, el núcleo va más fuerte. La diferencia de tono es lo
     único que distingue «probablemente» de «quizá», y sin ella los dos se leen
     igual de seguros. */
  const nucleo = fertil && d.fertilNucleo

  const abrir = () => {
    elegir()
    router.push({ pathname: '/salud/ciclo/registrar', params: { fecha: d.fecha } })
  }

  return (
    <Pressable
      onPress={abrir}
      style={s.celda}
      accessibilityRole="button"
      accessibilityLabel={etiquetaDe(d, sangro, previsto, fertil)}
    >
      <View style={[
        s.caja,
        sangro && s.cajaSangrado,
        previsto && s.cajaPrevisto,
        fertil && s.cajaFertil,
        nucleo && s.cajaFertilNucleo,
        d.hoy && s.cajaHoy,
      ]}>
        {/* El corazón del día de ovulación, como en el mockup. */}
        {d.ovulacionPredicha ? <View style={s.corazon} /> : null}
        <Text style={[
          s.numero,
          sangro && s.numeroSangrado,
          previsto && s.numeroPrevisto,
          fertil && s.numeroFertil,
          nucleo && s.numeroFertilNucleo,
          d.futuro && !sangro && !previsto && !fertil && s.numeroFuturo,
        ]}>
          {d.numero}
        </Text>
        {/* El punto de actividad: hubo registro ese día. */}
        {d.registros > 0 && !sangro ? <View style={s.punto} /> : null}
      </View>
      {d.hoy ? <Text style={s.hoyTxt}>HOY</Text> : null}
    </Pressable>
  )
}

function etiquetaDe(d: DiaCalendario, sangro: boolean, previsto: boolean, fertil: boolean): string {
  const partes = [`${d.numero}`]
  if (sangro) partes.push('sangrado registrado')
  else if (previsto) partes.push('periodo previsto')
  else if (d.fertilNucleo) partes.push('días más fértiles estimados')
  else if (fertil) partes.push('ventana fértil estimada, con margen')
  if (d.ovulacionPredicha) partes.push('ovulación estimada')
  if (d.hoy) partes.push('hoy')
  return partes.join(', ')
}

const s = StyleSheet.create({
  scroll: { paddingHorizontal: 20, paddingTop: 14 },
  flex: { flex: 1 },
  pulsado: { opacity: 0.75, transform: [{ scale: 0.96 }] },

  mes: { marginBottom: 26 },
  mesCab: { flexDirection: 'row', alignItems: 'baseline', gap: 9, marginBottom: 12 },
  mesNombre: {
    fontFamily: FUENTE.titulo, fontSize: 28, color: TEXTO.fuerte, letterSpacing: -0.8,
  },
  mesAño: { fontFamily: FUENTE.fuerte, fontSize: 20, color: '#B0A4CE', ...TABULAR },
  pildoraActual: {
    paddingHorizontal: 13, paddingVertical: 7, borderRadius: 999,
    backgroundColor: ACENTO.morado, alignSelf: 'center',
  },
  pildoraActualTxt: { fontFamily: FUENTE.fuerte, fontSize: 12.5, color: '#FFFFFF' },

  tarjeta: {
    backgroundColor: SUP.tarjeta, borderRadius: RADIO.tarjeta,
    paddingHorizontal: 10, paddingVertical: 14, ...SOMBRA,
  },
  semana: { flexDirection: 'row', marginBottom: 8 },
  diaSemana: {
    flex: 1, textAlign: 'center',
    fontFamily: FUENTE.fuerte, fontSize: 12.5, color: '#9A8FBA',
  },
  rejilla: { flexDirection: 'row', flexWrap: 'wrap' },

  /* Siete columnas exactas. Con `flex: 1` sobre 42 celdas React Native reparte
     los restos de forma desigual y las semanas quedan descuadradas entre sí. */
  celda: { width: `${100 / 7}%`, alignItems: 'center', paddingVertical: 3 },
  caja: {
    width: 40, height: 40, borderRadius: RADIO.celda,
    alignItems: 'center', justifyContent: 'center',
  },
  cajaSangrado: { backgroundColor: ACENTO.periodo },
  cajaPrevisto: {
    borderWidth: 1.5, borderStyle: 'dashed', borderColor: ACENTO.periodo,
  },
  cajaFertil: { backgroundColor: '#EDF8F8' },
  cajaFertilNucleo: { backgroundColor: ACENTO.fertilSuave },
  cajaHoy: { borderWidth: 2, borderColor: ACENTO.morado, borderStyle: 'solid' },

  numero: { fontFamily: FUENTE.fuerte, fontSize: 15, color: TEXTO.fuerte, ...TABULAR },
  numeroSangrado: { color: '#FFFFFF' },
  numeroPrevisto: { color: ACENTO.periodo },
  numeroFertil: { color: '#7CBFC2' },
  numeroFertilNucleo: { color: ACENTO.fertil },
  numeroFuturo: { color: '#B6ACCB' },

  corazon: {
    position: 'absolute', top: 1, right: 4,
    width: 7, height: 7, borderRadius: 4,
    backgroundColor: ACENTO.fertil,
  },
  punto: {
    position: 'absolute', bottom: 3,
    width: 4, height: 4, borderRadius: 2,
    backgroundColor: ACENTO.morado,
  },
  hoyTxt: {
    fontFamily: FUENTE.fuerte, fontSize: 9.5, letterSpacing: 0.6,
    color: ACENTO.morado, marginTop: 2,
  },

  lapiz: {
    position: 'absolute', right: 22,
    width: 62, height: 62, borderRadius: 31,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: ACENTO.morado,
    shadowColor: ACENTO.morado, shadowOpacity: 0.4,
    shadowRadius: 16, shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  lapizIc: { tintColor: '#FFFFFF' },
})

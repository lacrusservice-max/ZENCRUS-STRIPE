/**
 * CICLO · ESTADÍSTICAS
 * ═══════════════════════════════════════════════════════════════════════════
 * La pantalla 11 del mockup: las tres cifras de cabecera, las barras de los
 * últimos ciclos, los síntomas más frecuentes, la energía por fase y el
 * patrón del mes.
 *
 * ── El selector 3M / 6M / 1A recorta de verdad ─────────────────────────────
 * No es decorativo. Cambia la ventana de ciclos sobre la que se calcula todo,
 * incluidos los porcentajes de síntomas. Un selector que no mueve los números
 * es peor que no tenerlo: enseña que la app finge.
 *
 * ── Los porcentajes se calculan sobre días REGISTRADOS ─────────────────────
 * No sobre días transcurridos. Si en octubre solo apuntó ocho días, «cólicos
 * el 83 %» significa 83 % de esos ocho, no del mes. Dividir entre los días del
 * mes castigaría a quien registra poco inventando una mejoría que no existe.
 *
 * ── Y cuando no hay muestra suficiente, se dice ────────────────────────────
 * Con menos de dos ciclos completos no hay variación que medir. La tarjeta lo
 * admite en vez de enseñar «Regular · variación ±0 días», que es lo que sale
 * de un solo dato y suena a certeza.
 */

import { useMemo, useState } from 'react'
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native'
import { useCicloStore } from '@/store/cicloStore'
import { useCiclo } from '@/features/salud/ciclo/useCiclo'
import { serieCiclos, MUESTRA_MINIMA } from '@/features/salud/ciclo/historial'
import { insightDelDia } from '@/features/salud/ciclo/insight'
import { nombreMes } from '@/features/salud/ciclo/formato'
import { hoyLocal, aFechaLocal, diasEntre } from '@/utils/fechas'
import { ALTO_BARRA } from '@/components/salud/ciclo/BarraCiclo'
import { Pantalla, Tarjeta, Seccion, Icono, Azulejo } from '@/components/salud/ciclo/Claro'
import {
  FONDO, FASE, ACENTO, TEXTO, FUENTE, SUP, SOMBRA, TABULAR, HUECO,
} from '@/theme/salud/cicloClaro'
import { PHASE_ORDER, type Phase } from '@/features/salud/ciclo/fases'
import { elegir } from '@/utils/haptica'
import type { Regularidad } from '@/features/salud/ciclo/prediccion'
import type { NombreIcono } from '@/features/salud/ciclo/iconos'

/* ── El selector de ventana ─────────────────────────────────────────────── */

const VENTANAS = [
  { id: '3M', meses: 3, etiqueta: '3M' },
  { id: '6M', meses: 6, etiqueta: '6M' },
  { id: '1A', meses: 12, etiqueta: '1A' },
] as const

const REGULARIDAD: Record<Regularidad, { texto: string; color: string }> = {
  sin_datos:       { texto: 'Sin datos',   color: TEXTO.suave },
  regular:         { texto: 'Regular',     color: ACENTO.verde },
  algo_irregular:  { texto: 'Algo irregular', color: ACENTO.naranja },
  irregular:       { texto: 'Irregular',   color: ACENTO.rojo },
}

export default function EstadisticasCiclo() {
  const [ventana, setVentana] = useState<typeof VENTANAS[number]['id']>('6M')
  const logs = useCicloStore(s => s.logs)
  const hoy = hoyLocal()
  const { periodos, estadisticas, prediccion, marco, anomalias } = useCiclo()

  const meses = VENTANAS.find(v => v.id === ventana)!.meses

  /* La ventana en días, contada hacia atrás desde hoy. Se usa una fecha límite
     y no «los últimos N ciclos» porque el selector habla de meses: en un ciclo
     de 21 días entran más ciclos en 6 meses que en uno de 34, y eso es
     precisamente lo que la usuaria quiere ver. */
  const desde = useMemo(() => {
    const d = new Date(`${hoy}T00:00:00`)
    d.setMonth(d.getMonth() - meses)
    return aFechaLocal(d)
  }, [hoy, meses])

  const enVentana = useMemo(
    () => periodos.filter(p => p.inicio >= desde),
    [periodos, desde])

  const serie = useMemo(
    () => serieCiclos(enVentana, estadisticas.media).filter(c => c.duracion !== null),
    [enVentana, estadisticas.media])

  /* ── Síntomas más frecuentes ───────────────────────────────────────────
     Se cuentan sobre los días CON registro dentro de la ventana. */
  const sintomas = useMemo(() => frecuenciaSintomas(logs, desde, hoy), [logs, desde, hoy])

  /* ── Energía media por fase ────────────────────────────────────────────
     Un día sin registrar NO cuenta como energía 0: se salta. Rellenar con
     ceros hundiría la media de cualquier fase mal registrada e inventaría un
     bajón que nunca ocurrió. */
  const porFase = useMemo(
    () => energiaPorFase(logs, desde, hoy, periodos, marco.duracion, marco.limites),
    [logs, desde, hoy, periodos, marco])

  const insight = useMemo(
    () => insightDelDia({ logs, periodos, hoy, prediccion, anomalias }),
    [logs, periodos, hoy, prediccion, anomalias])

  const bastante = estadisticas.ciclos >= MUESTRA_MINIMA
  const reg = REGULARIDAD[estadisticas.regularidad]

  return (
    <Pantalla fondo={FONDO.estadisticas}>
      <ScrollView
        contentContainerStyle={[s.scroll, { paddingBottom: ALTO_BARRA + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Cabecera ─────────────────────────────────────────────────── */}
        <View style={s.cab}>
          <View style={s.flex}>
            <Text style={s.titulo}>Estadísticas</Text>
            <Text style={s.subtitulo}>
              {enVentana.length === 0
                ? 'Todavía sin ciclos en esta ventana'
                : enVentana.length === 1
                  ? 'Basado en tu último ciclo'
                  : `Basado en tus últimos ${enVentana.length} ciclos`}
            </Text>
          </View>
          <View style={s.selector}>
            {VENTANAS.map(v => {
              const on = v.id === ventana
              return (
                <Pressable
                  key={v.id}
                  onPress={() => { elegir(); setVentana(v.id) }}
                  style={[s.selBoton, on && s.selBotonOn]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                >
                  <Text style={[s.selTxt, on && s.selTxtOn]}>{v.etiqueta}</Text>
                </Pressable>
              )
            })}
          </View>
        </View>

        {/* ── Las tres cifras ──────────────────────────────────────────── */}
        <View style={s.cifras}>
          <Cifra
            icono="cycle_duracion"
            valor={diasODia(estadisticas.media)}
            pie="ciclo promedio"
          />
          <Cifra
            icono="cycle_gota_color"
            valor={diasODia(estadisticas.mediaSangrado)}
            pie="de periodo"
          />
          <Cifra
            icono={bastante ? 'stats_check' : 'cycle_regular'}
            valor={bastante ? reg.texto : '—'}
            color={bastante ? reg.color : TEXTO.suave}
            pie={
              bastante && estadisticas.desviacion !== null
                ? `variación ±${estadisticas.desviacion.toFixed(estadisticas.desviacion < 10 ? 1 : 0)} días`
                : `faltan ${MUESTRA_MINIMA - estadisticas.ciclos} ciclos`
            }
          />
        </View>

        {/* ── Duración de los últimos ciclos ───────────────────────────── */}
        <Tarjeta style={s.tarjeta}>
          <Seccion icono="nav_estadisticas" fondo={ACENTO.moradoFondo}
                   titulo="Duración de tus últimos ciclos" />
          {serie.length ? (
            <Barras serie={serie} media={estadisticas.media} />
          ) : (
            <Vacio texto="Cuando cierres tu primer ciclo completo aparecerá aquí la barra." />
          )}
        </Tarjeta>

        {/* ── Síntomas más frecuentes ──────────────────────────────────── */}
        <Tarjeta style={s.tarjeta}>
          <Seccion
            icono="wellness_sintomas" fondo={ACENTO.rojoSuave}
            titulo="Síntomas más frecuentes"
            derecha={
              <Text style={s.contador}>
                {sintomas.dias} {sintomas.dias === 1 ? 'día' : 'días'}
              </Text>
            }
          />
          {sintomas.top.length ? (
            <View style={s.listaSintomas}>
              {sintomas.top.map(x => (
                <View key={x.etiqueta} style={s.filaSintoma}>
                  <View style={s.filaSintomaCab}>
                    <Text style={s.sintomaNm} numberOfLines={1}>{x.etiqueta}</Text>
                    <Text style={s.sintomaPct}>{Math.round(x.pct)}%</Text>
                  </View>
                  <View style={s.pista}>
                    <View style={[s.relleno, { width: `${Math.max(2, x.pct)}%` }]} />
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <Vacio texto="Todavía no has marcado síntomas en esta ventana." />
          )}
        </Tarjeta>

        {/* ── Energía por fase ─────────────────────────────────────────── */}
        <Tarjeta style={s.tarjeta}>
          <Seccion icono="wellness_energia" fondo={ACENTO.tealSuave}
                   titulo="Energía y ánimo por fase" />
          <View style={s.fases}>
            {PHASE_ORDER.map(f => {
              const d = porFase[f]
              return (
                <View key={f} style={s.faseCol}>
                  <View style={[s.punto, { backgroundColor: FASE[f].color }]} />
                  <Text style={[s.faseNivel, { color: d ? TEXTO.fuerte : TEXTO.suave }]}>
                    {d ? nivelTexto(d.energia) : '—'}
                  </Text>
                  <Text style={s.faseNm}>{FASE[f].etiqueta}</Text>
                  <Text style={s.faseApoyo}>
                    {d ? `${d.n} ${d.n === 1 ? 'día' : 'días'}` : 'sin datos'}
                  </Text>
                </View>
              )
            })}
          </View>
        </Tarjeta>

        {/* ── El patrón del mes ────────────────────────────────────────── */}
        {insight ? (
          <View style={s.insight}>
            <Azulejo icono="stats_insight" fondo={SUP.tarjeta} tam={44} />
            <View style={s.flex}>
              <Text style={s.insightTit}>Tu patrón de este mes</Text>
              <Text style={s.insightTxt}>{insight.texto}</Text>
              {insight.apoyo > 0 ? (
                <Text style={s.insightApoyo}>
                  Observado {insight.apoyo} {insight.apoyo === 1 ? 'vez' : 'veces'}
                </Text>
              ) : null}
            </View>
          </View>
        ) : null}
      </ScrollView>
    </Pantalla>
  )
}

/* ── Piezas ────────────────────────────────────────────────────────────── */

function Cifra({ icono, valor, pie, color }: {
  icono: NombreIcono
  valor: string
  pie: string
  color?: string
}) {
  return (
    <View style={s.cifra}>
      <Icono nombre={icono} tam={20} />
      <Text style={[s.cifraNum, color ? { color } : null]} numberOfLines={1}
            adjustsFontSizeToFit minimumFontScale={0.6}>
        {valor}
      </Text>
      <Text style={s.cifraPie} numberOfLines={2}>{pie}</Text>
    </View>
  )
}

/**
 * Las barras de duración.
 *
 * La altura es proporcional a la duración, pero NO desde cero: entre 26 y 30
 * días hay poca diferencia y desde cero todas las barras se verían iguales.
 * Se escala dentro del rango real de la muestra, con la media como línea de
 * puntos para que la comparación tenga referencia.
 */
function Barras({ serie, media }: {
  serie: { inicio: string; duracion: number | null }[]
  media: number | null
}) {
  const valores = serie.map(c => c.duracion!).filter(Number.isFinite)
  const min = Math.min(...valores)
  const max = Math.max(...valores)
  const rango = Math.max(1, max - min)
  const alto = (v: number) => 40 + ((v - min) / rango) * 76

  return (
    <View style={s.barras}>
      {serie.map((c, i) => {
        const ultima = i === serie.length - 1
        return (
          <View key={c.inicio} style={s.barraCol}>
            <Text style={[s.barraNum, ultima && s.barraNumOn]}>{c.duracion}</Text>
            <View style={[
              s.barra,
              { height: alto(c.duracion!) },
              ultima && s.barraOn,
            ]} />
            <Text style={[s.barraMes, ultima && s.barraMesOn]}>
              {nombreMes(Number(c.inicio.slice(5, 7))).slice(0, 3)}
            </Text>
          </View>
        )
      })}
      {/* La media, en línea de puntos, a la altura que le tocaría si fuera una
          barra más. `PIE_MES` es lo que ocupa la etiqueta del mes debajo de la
          barra: sin sumarlo, la línea aparecería cruzando los nombres. */}
      {media !== null && valores.length > 1 ? (
        <View
          style={[s.mediaLinea, { bottom: PIE_MES + alto(media) }]}
          pointerEvents="none"
        />
      ) : null}
    </View>
  )
}

/** Alto de la etiqueta del mes más su hueco, medido contra los estilos de abajo. */
const PIE_MES = 22

function Vacio({ texto }: { texto: string }) {
  return <Text style={s.vacio}>{texto}</Text>
}

/* ── Cálculos ──────────────────────────────────────────────────────────── */

/** «1 día», no «1 días»: el plural mal puesto delata a una app sin cuidar. */
const diasODia = (n: number | null): string => {
  if (n === null) return '—'
  const r = Math.round(n)
  return `${r} ${r === 1 ? 'día' : 'días'}`
}

const nivelTexto = (v: number): string =>
  v >= 4.2 ? 'Muy alta' : v >= 3.4 ? 'Alta' : v >= 2.6 ? 'Media' : v >= 1.8 ? 'Baja' : 'Muy baja'

/**
 * Con qué frecuencia aparece cada síntoma, sobre los días CON registro.
 *
 * Se apoya en `dolor` —que trae zona e intensidad— y en el resto de trackers
 * de la ventana. Un día cuenta una sola vez por síntoma aunque lo haya
 * marcado dos veces.
 */
function frecuenciaSintomas(
  logs: Record<string, { dolor?: unknown; digestion?: unknown; piel?: unknown }>,
  desde: string, hasta: string,
): { dias: number; top: { etiqueta: string; pct: number }[] } {
  const cuenta = new Map<string, number>()
  let dias = 0

  for (const [fecha, dia] of Object.entries(logs)) {
    if (fecha < desde || fecha > hasta) continue
    const marcas = new Set<string>()

    const dolor = dia.dolor as { zones?: { id: string }[] } | undefined
    dolor?.zones?.forEach(z => marcas.add(ETIQUETA_ZONA[z.id] ?? z.id))

    const dig = dia.digestion as { tags?: string[] } | undefined
    dig?.tags?.forEach(t => marcas.add(ETIQUETA_TAG[t] ?? t))

    const piel = dia.piel as { tags?: string[] } | undefined
    piel?.tags?.forEach(t => marcas.add(ETIQUETA_TAG[t] ?? t))

    if (!marcas.size && !Object.keys(dia).length) continue
    dias++
    marcas.forEach(m => cuenta.set(m, (cuenta.get(m) ?? 0) + 1))
  }

  const top = [...cuenta.entries()]
    .map(([etiqueta, n]) => ({ etiqueta, pct: dias ? (n / dias) * 100 : 0 }))
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 4)

  return { dias, top }
}

const ETIQUETA_ZONA: Record<string, string> = {
  abdomen_bajo: 'Cólicos',
  cabeza: 'Dolor de cabeza / Migraña',
  lumbar: 'Dolor lumbar',
  pecho: 'Sensibilidad en senos',
  ovarios: 'Dolor de ovarios',
  piernas: 'Dolor muscular',
  articulaciones: 'Dolor articular',
  vulva: 'Molestia vulvar',
}

const ETIQUETA_TAG: Record<string, string> = {
  hinchazon: 'Inflamación abdominal',
  nauseas: 'Náuseas',
  diarrea: 'Diarrea',
  estrenimiento: 'Estreñimiento',
  acne: 'Acné',
  grasa: 'Piel grasa',
  seca: 'Piel seca',
}

/**
 * Energía media por fase dentro de la ventana.
 *
 * A cada día registrado se le calcula su día de ciclo mirando en qué periodo
 * cae, y de ahí su fase. Los días anteriores al primer periodo conocido se
 * descartan: no se sabe en qué fase estaban y adivinarlo contaminaría la media.
 */
function energiaPorFase(
  logs: Record<string, { energia?: unknown }>,
  desde: string, hasta: string,
  periodos: { inicio: string }[],
  duracion: number,
  limites: Record<Phase, number>,
): Partial<Record<Phase, { energia: number; n: number }>> {
  const suma: Partial<Record<Phase, { total: number; n: number }>> = {}
  const inicios = periodos.map(p => p.inicio).sort()

  for (const [fecha, dia] of Object.entries(logs)) {
    if (fecha < desde || fecha > hasta) continue
    const val = (dia.energia as { level?: number } | undefined)?.level
    if (typeof val !== 'number') continue

    const inicio = [...inicios].reverse().find(i => i <= fecha)
    if (!inicio) continue

    const diaCiclo = diasEntre(inicio, fecha) + 1
    if (diaCiclo < 1 || diaCiclo > duracion + 7) continue

    const fase = faseDeDia(diaCiclo, limites, duracion)
    const acc = suma[fase] ?? { total: 0, n: 0 }
    acc.total += val
    acc.n++
    suma[fase] = acc
  }

  const salida: Partial<Record<Phase, { energia: number; n: number }>> = {}
  for (const f of PHASE_ORDER) {
    const a = suma[f]
    if (a && a.n > 0) salida[f] = { energia: a.total / a.n, n: a.n }
  }
  return salida
}

function faseDeDia(dia: number, limites: Record<Phase, number>, duracion: number): Phase {
  const d = ((dia - 1) % Math.max(1, duracion)) + 1
  let cual: Phase = 'menstrual'
  for (const f of PHASE_ORDER) if (d >= limites[f]) cual = f
  return cual
}

const s = StyleSheet.create({
  scroll: { paddingHorizontal: 20, paddingTop: 14, gap: HUECO.md },
  flex: { flex: 1 },

  cab: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  titulo: {
    fontFamily: FUENTE.titulo, fontSize: 31, color: TEXTO.fuerte, letterSpacing: -0.9,
  },
  subtitulo: {
    fontFamily: FUENTE.medio, fontSize: 14, color: TEXTO.medio, marginTop: 3,
  },
  selector: {
    flexDirection: 'row', borderRadius: 999, padding: 4,
    backgroundColor: ACENTO.moradoFondo, marginTop: 4,
  },
  selBoton: {
    paddingHorizontal: 13, height: 32, borderRadius: 999,
    alignItems: 'center', justifyContent: 'center',
  },
  selBotonOn: { backgroundColor: ACENTO.morado },
  selTxt: { fontFamily: FUENTE.fuerte, fontSize: 13, color: TEXTO.medio },
  selTxtOn: { color: '#FFFFFF' },

  cifras: { flexDirection: 'row', gap: 10 },
  cifra: {
    flex: 1, alignItems: 'center', gap: 4,
    paddingVertical: 14, paddingHorizontal: 6, borderRadius: 20,
    backgroundColor: SUP.tarjeta, ...SOMBRA,
  },
  cifraNum: {
    fontFamily: FUENTE.titulo, fontSize: 18, color: TEXTO.fuerte, ...TABULAR,
  },
  cifraPie: {
    fontFamily: FUENTE.cuerpo, fontSize: 11, color: TEXTO.medio, textAlign: 'center',
  },

  tarjeta: { gap: 16 },
  contador: { fontFamily: FUENTE.medio, fontSize: 12.5, color: TEXTO.suave },

  barras: { flexDirection: 'row', alignItems: 'flex-end', gap: 9, paddingTop: 4 },
  barraCol: { flex: 1, alignItems: 'center', gap: 6 },
  barraNum: { fontFamily: FUENTE.fuerte, fontSize: 13, color: TEXTO.suave, ...TABULAR },
  barraNumOn: { color: ACENTO.morado },
  barra: { width: '100%', borderRadius: 10, backgroundColor: ACENTO.moradoSuave },
  barraOn: { backgroundColor: ACENTO.morado },
  barraMes: { fontFamily: FUENTE.medio, fontSize: 12, color: TEXTO.suave },
  barraMesOn: { fontFamily: FUENTE.fuerte, color: ACENTO.morado },
  mediaLinea: {
    position: 'absolute', left: 0, right: 0, height: 1,
    borderTopWidth: 1, borderStyle: 'dashed', borderColor: '#C6BBDE',
  },

  listaSintomas: { gap: 14 },
  filaSintoma: { gap: 7 },
  filaSintomaCab: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sintomaNm: { flex: 1, fontFamily: FUENTE.fuerte, fontSize: 14.5, color: TEXTO.fuerte },
  sintomaPct: { fontFamily: FUENTE.fuerte, fontSize: 14.5, color: TEXTO.medio, ...TABULAR },
  pista: { height: 9, borderRadius: 5, backgroundColor: '#F3E9EC', overflow: 'hidden' },
  relleno: { height: '100%', borderRadius: 5, backgroundColor: ACENTO.rojo },

  fases: { flexDirection: 'row' },
  faseCol: { flex: 1, alignItems: 'center', gap: 5 },
  punto: { width: 11, height: 11, borderRadius: 6, marginBottom: 3 },
  faseNivel: { fontFamily: FUENTE.titulo, fontSize: 14.5 },
  faseNm: { fontFamily: FUENTE.medio, fontSize: 12, color: TEXTO.suave },
  faseApoyo: { fontFamily: FUENTE.suave, fontSize: 10.5, color: TEXTO.suave },

  insight: {
    flexDirection: 'row', gap: 14, padding: 18, borderRadius: 24,
    backgroundColor: ACENTO.moradoFondo,
  },
  insightTit: { fontFamily: FUENTE.titulo, fontSize: 16, color: TEXTO.fuerte },
  insightTxt: {
    fontFamily: FUENTE.medio, fontSize: 14, lineHeight: 21,
    color: '#5B4B86', marginTop: 5,
  },
  insightApoyo: {
    fontFamily: FUENTE.suave, fontSize: 11.5, color: TEXTO.suave, marginTop: 6,
  },

  vacio: {
    fontFamily: FUENTE.cuerpo, fontSize: 13.5, color: TEXTO.suave,
    lineHeight: 20,
  },
})

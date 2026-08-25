/**
 * CICLO · PANTALLA PRINCIPAL
 * ═══════════════════════════════════════════════════════════════════════════
 * Lo que se abre todos los días. Un elemento manda —La Cinta y su cifra— y
 * todo lo demás está callado hasta que se busca.
 *
 * ── Lo que cambió respecto a la primera versión ────────────────────────────
 * La primera dibujaba un día de ciclo inventado: `new Date().getDate() % 28`.
 * Funcionaba como maqueta y era indefendible como producto — el número que
 * más mira la usuaria no salía de su cuerpo, salía del día del mes. Ahora todo
 * viene del motor: periodos deducidos de su sangrado, fases sobre SU duración
 * y predicción con banda.
 *
 * ── Y si no hay datos, se dice ─────────────────────────────────────────────
 * Sin un solo periodo registrado no hay nada honesto que enseñar, así que no
 * se enseña nada: un vacío que explica qué falta y un botón para empezar. Es
 * mejor pantalla que una llena de ceros.
 */

import { useEffect, useMemo, useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, Pressable, AccessibilityInfo,
} from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { Cinta } from '@/components/salud/Cinta'
import {
  Eyebrow, Seccion, Tira, Destino, Filete, Vacio, Placa,
} from '@/components/salud/piezas'
import { useCicloStore } from '@/store/cicloStore'
import { useCiclo } from '@/features/salud/ciclo/useCiclo'
import { insightDelDia } from '@/features/salud/ciclo/insight'
import { publicarPrediccion } from '@/features/salud/ciclo/publicar'
import { rangoCorto } from '@/features/salud/ciclo/formato'
import { nivelConfianza } from '@/features/salud/ciclo/prediccion'
import { TRACKER_META, type TrackerKind } from '@/features/salud/trackers'
import { hoyLocal, diasEntre } from '@/utils/fechas'
import { base, space, radius, family, type as tipo, numeric } from '@/theme/salud/tokens'
import { Screen, ScreenHeader } from '@/components/ui/Screen'
import { TabBar } from '@/constants/layout'

/** Los que se ofrecen de un toque en la portada. El resto vive en el panel. */
const RAPIDOS: TrackerKind[] = ['sangrado', 'dolor', 'animo', 'energia']

export default function CicloInicio() {
  const load = useCicloStore(s => s.load)
  const cargado = useCicloStore(s => s.cargado)
  const logs = useCicloStore(s => s.logs)
  const [reduce, setReduce] = useState(false)

  const ciclo = useCiclo()
  const { prediccion, marco, tema, modo, estadisticas: est, anomalias } = ciclo

  useEffect(() => {
    void load()
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduce)
  }, [load])

  /* La predicción se sube para que ZENA y el informe clínico puedan leerla sin
     recalcularla. Como mucho una vez al día y solo si cambió: ver publicar.ts. */
  useEffect(() => { void publicarPrediccion(prediccion) }, [prediccion])

  const hoy = hoyLocal()
  const registroHoy = logs[hoy] ?? {}
  const registrados = Object.keys(registroHoy).length

  const insight = useMemo(
    () => insightDelDia({ logs, periodos: ciclo.periodos, prediccion, anomalias, hoy }),
    [logs, ciclo.periodos, prediccion, anomalias, hoy],
  )

  /* La Cinta trabaja en días de ciclo, no en fechas.
     La escala se estira por dos motivos, y los dos importan:
       · si hay retraso, para que el día 34 no se aplaste contra el final de un
         ciclo de 28 —justo el día en que ese número es la información—;
       · hasta el borde alto de la banda, porque si no Skia recorta la mitad
         derecha del intervalo y la incertidumbre se ve MENOR de lo que es.
         Con un solo ciclo registrado la banda mide ±7 días sobre una escala de
         28: recortarla sería el único caso en que esta pantalla mentiría. */
  const cinta = useMemo(() => {
    if (!prediccion) return null
    const inicio = ciclo.periodos[ciclo.periodos.length - 1].inicio
    const enDias = (f: string) => diasEntre(inicio, f) + 1
    const banda = {
      low: enDias(prediccion.proximoPeriodo.low),
      likely: enDias(prediccion.proximoPeriodo.likely),
      high: enDias(prediccion.proximoPeriodo.high),
    }
    return {
      dia: prediccion.diaDeCiclo,
      duracion: Math.max(marco.duracion, prediccion.diaDeCiclo, banda.high),
      banda,
    }
  }, [prediccion, marco.duracion, ciclo.periodos])

  if (!cargado) return <Screen tint={tema.accent}><View /></Screen>

  const faltan = prediccion ? diasEntre(hoy, prediccion.proximoPeriodo.likely) : null

  return (
    <Screen tint={tema.accent}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: TabBar.scrollInset }}>
        <ScreenHeader
          back
          eyebrow="Zencrus · Ciclo"
          title="Tu ciclo"
          icon="ellipse"
          color={tema.accent}
          right={
            <Pressable
              onPress={() => router.push('/salud/ciclo/ajustes')}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Ajustes del ciclo"
            >
              <Ionicons name="options-outline" size={20} color={base.textMid} />
            </Pressable>
          }
        />

        {!ciclo.hayDatos ? (
          <Vacio
            tono={tema.accent}
            icono="water-outline"
            titulo="Todavía no sé cuándo empieza tu ciclo"
            texto="Marca los días que sangres y el resto se calcula solo: fases, predicción y patrones. No hace falta rellenar nada más."
            accion="Marcar mi primer día"
            onAccion={() => router.push('/salud/ciclo/registrar')}
          />
        ) : (
          <>
            {/* ── El instrumento ────────────────────────────────────────── */}
            {cinta && (
              <Cinta
                diaDeCiclo={cinta.dia}
                duracion={cinta.duracion}
                fase={prediccion!.fase}
                limites={marco.limites}
                prediccion={cinta.banda}
                reduceMotion={reduce}
              />
            )}

            <View style={s.lectura}>
              {prediccion ? (
                <>
                  <View style={s.cifraFila}>
                    <Text style={[s.gigante, { color: tema.accent }]}>
                      {faltan != null && faltan >= 0 ? faltan : prediccion.retraso}
                    </Text>
                    <Text style={s.gianteSub}>
                      {faltan != null && faltan >= 0
                        ? (faltan === 1 ? 'día para tu\npróximo periodo' : 'días para tu\npróximo periodo')
                        : (prediccion.retraso === 1 ? 'día de retraso\nsobre lo previsto' : 'días de retraso\nsobre lo previsto')}
                    </Text>
                  </View>

                  {/* La fecha NUNCA viaja sola: la banda y la confianza van con ella. */}
                  <Pressable
                    onPress={() => router.push('/salud/ciclo/prediccion')}
                    style={({ pressed }) => [s.banda, pressed && { opacity: 0.7 }]}
                    accessibilityRole="button"
                    accessibilityLabel={`Predicción ${rangoCorto(prediccion.proximoPeriodo.low, prediccion.proximoPeriodo.high)}, confianza ${nivelConfianza(prediccion.confianza)}`}
                  >
                    <View style={[s.pastilla, { backgroundColor: `${tema.accent}1F` }]}>
                      <Text style={[s.pastillaTxt, { color: tema.accent }]}>
                        {rangoCorto(prediccion.proximoPeriodo.low, prediccion.proximoPeriodo.high)}
                      </Text>
                    </View>
                    <Text style={s.bandaNota}>
                      confianza {nivelConfianza(prediccion.confianza)} · {prediccion.confianza} %
                    </Text>
                    <Ionicons name="information-circle-outline" size={14} color={base.textLow} />
                  </Pressable>
                </>
              ) : (
                <Placa style={s.sinPrediccion}>
                  <Eyebrow color={tema.accent}>{modo.label}</Eyebrow>
                  <Text style={s.sinPrediccionTxt}>{modo.motivo}</Text>
                </Placa>
              )}
            </View>

            {/* ── Hoy ───────────────────────────────────────────────────── */}
            <Seccion
              eyebrow="Hoy"
              titulo={registrados ? `${registrados} registrado${registrados > 1 ? 's' : ''}` : 'Sin registrar'}
              color={tema.accent}
              right={
                <Pressable
                  onPress={() => router.push('/salud/ciclo/registrar')}
                  style={({ pressed }) => [s.mas, { backgroundColor: tema.accent }, pressed && { opacity: 0.75 }]}
                  accessibilityRole="button"
                  accessibilityLabel="Abrir el registro de hoy"
                >
                  <Ionicons name={registrados ? 'create-outline' : 'add'} size={16} color="#fff" />
                  <Text style={s.masTxt}>{registrados ? 'Editar' : 'Registrar'}</Text>
                </Pressable>
              }
            >
              <View style={s.rapidos}>
                {RAPIDOS.map(k => {
                  const puesto = k in registroHoy
                  return (
                    <Pressable
                      key={k}
                      onPress={() => router.push({ pathname: '/salud/ciclo/registrar', params: { foco: k } })}
                      style={({ pressed }) => [
                        s.rapido,
                        puesto && { backgroundColor: `${tema.accent}26` },
                        pressed && { opacity: 0.72 },
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={`${TRACKER_META[k].label}${puesto ? ', registrado' : ', sin registrar'}`}
                    >
                      <Ionicons
                        name={puesto ? 'checkmark-circle' : 'ellipse-outline'}
                        size={15}
                        color={puesto ? tema.accent : base.textLow}
                      />
                      <Text style={[s.rapidoTxt, puesto && { color: base.textHi }]}>
                        {TRACKER_META[k].label}
                      </Text>
                    </Pressable>
                  )
                })}
              </View>
            </Seccion>

            {/* ── El insight, con su apoyo a la vista ───────────────────── */}
            {insight && (
              <Seccion eyebrow="Lo que veo en tus datos" color={tema.accent}>
                <Text style={s.insight}>{insight.texto}</Text>
                {insight.apoyo > 0 ? (
                  <Text style={s.apoyo}>
                    sobre {insight.apoyo} {insight.apoyo === 1 ? 'observación tuya' : 'observaciones tuyas'}
                  </Text>
                ) : null}
              </Seccion>
            )}

            {/* ── Sus números ──────────────────────────────────────────── */}
            <Seccion eyebrow="Tu ciclo en números" color={tema.accent}>
              <Placa>
                <Tira
                  color={tema.accent}
                  datos={[
                    { valor: est.media ?? null, unidad: 'd', etiqueta: 'duración media' },
                    { valor: est.desviacion != null ? `±${est.desviacion}` : null, unidad: 'd', etiqueta: 'variación' },
                    { valor: est.usados || null, etiqueta: est.usados === 1 ? 'ciclo medido' : 'ciclos medidos' },
                  ]}
                />
                {est.usados < 3 ? (
                  <Text style={s.avisoMuestra}>
                    Con menos de tres ciclos estas cifras se mueven mucho. No son tu ciclo todavía, son lo que se ve hasta ahora.
                  </Text>
                ) : null}
              </Placa>
            </Seccion>

            {/* ── Señales ──────────────────────────────────────────────── */}
            {anomalias.length > 0 && (
              <Seccion
                eyebrow="Vale la pena mirar"
                nota="Esto no es un diagnóstico: son cosas que aparecen en tu propio registro."
                color={tema.accent}
              >
                {anomalias.slice(0, 3).map(a => (
                  <Placa key={a.tipo} style={s.senal}>
                    <View style={[
                      s.senalBarra,
                      { backgroundColor: a.nivel === 'consulta' ? base.warn : base.textLow },
                    ]} />
                    <View style={s.flex}>
                      <Text style={s.senalTxt}>{a.mensaje}</Text>
                      {a.pregunta ? (
                        <Text style={s.senalPregunta}>Para consulta: «{a.pregunta}»</Text>
                      ) : null}
                    </View>
                  </Placa>
                ))}
              </Seccion>
            )}
          </>
        )}

        {/* ── Destinos ───────────────────────────────────────────────── */}
        <Seccion eyebrow="Ir a" color={tema.accent}>
          <Placa style={s.destinos}>
            <Destino
              titulo="Calendario"
              nota="Tus fases mes a mes"
              icono="calendar-outline"
              tono={tema.accent}
              onPress={() => router.push('/salud/ciclo/calendario')}
            />
            <Filete />
            <Destino
              titulo="Historial"
              nota="Duración, regularidad y patrones"
              icono="stats-chart-outline"
              tono={tema.accent}
              dato={est.ciclos ? `${est.ciclos}` : undefined}
              onPress={() => router.push('/salud/ciclo/historial')}
            />
            <Filete />
            <Destino
              titulo="Temperatura basal"
              nota="Confirma la ovulación mirando atrás"
              icono="thermometer-outline"
              tono={tema.accent}
              onPress={() => router.push('/salud/ciclo/temperatura')}
            />
            <Filete />
            {/* El diferenciador del módulo: ninguna app de ciclo tiene la otra
                mitad de estos datos. Ver ciclo/correlacion.ts. */}
            <Destino
              titulo="Cómo te afecta"
              nota="Tu ciclo cruzado con entreno, comida y descanso"
              icono="git-compare-outline"
              tono={tema.accent}
              onPress={() => router.push('/salud/ciclo/correlaciones')}
            />
          </Placa>
        </Seccion>
      </ScrollView>
    </Screen>
  )
}

const s = StyleSheet.create({
  flex: { flex: 1 },

  lectura: { marginHorizontal: space.lg, marginTop: space.lg },
  cifraFila: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  gigante: {
    fontFamily: family.dataMedium,
    fontSize: tipo.data.hero,
    lineHeight: tipo.data.hero * 1.02,
    ...numeric,
  },
  gianteSub: {
    fontFamily: family.ui,
    fontSize: tipo.ui.md,
    color: base.textMid,
    lineHeight: tipo.ui.md * 1.35,
    flex: 1,
  },

  banda: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.md },
  pastilla: { paddingHorizontal: space.sm + 2, paddingVertical: 5, borderRadius: radius.pill },
  pastillaTxt: { fontFamily: family.uiSemi, fontSize: tipo.ui.sm },
  bandaNota: { fontFamily: family.ui, fontSize: tipo.ui.xs, color: base.textLow, flex: 1 },

  sinPrediccion: { marginTop: 0, gap: 6 },
  sinPrediccionTxt: {
    fontFamily: family.ui, fontSize: tipo.ui.sm, color: base.textMid,
    lineHeight: tipo.ui.sm * 1.55,
  },

  mas: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: space.md - 2, height: 34, borderRadius: radius.pill,
  },
  masTxt: { fontFamily: family.uiSemi, fontSize: tipo.ui.sm, color: '#fff' },

  rapidos: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.md },
  rapido: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: space.md - 3, paddingVertical: space.sm + 1,
    borderRadius: radius.pill, backgroundColor: base.surface2,
  },
  rapidoTxt: { fontFamily: family.uiMedium, fontSize: tipo.ui.sm, color: base.textMid },

  /* Fraunces y no Inter: es la única voz editorial del módulo, y esta frase es
     lo único de la pantalla que se lee como una frase y no como un dato. */
  insight: {
    fontFamily: family.display,
    fontSize: tipo.display.sm,
    color: base.textHi,
    lineHeight: tipo.display.sm * 1.38,
    marginTop: space.md,
  },
  apoyo: { fontFamily: family.ui, fontSize: tipo.ui.xs, color: base.textLow, marginTop: space.sm },

  avisoMuestra: {
    fontFamily: family.ui, fontSize: tipo.ui.xs, color: base.textLow,
    marginTop: space.md, lineHeight: tipo.ui.xs * 1.5,
  },

  senal: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  senalBarra: { width: 3, alignSelf: 'stretch', borderRadius: 2 },
  senalTxt: {
    fontFamily: family.ui, fontSize: tipo.ui.sm, color: base.textHi,
    lineHeight: tipo.ui.sm * 1.5,
  },
  senalPregunta: {
    fontFamily: family.ui, fontSize: tipo.ui.xs, color: base.textMid,
    marginTop: 6, fontStyle: 'italic',
  },

  destinos: { paddingVertical: 2 },
})

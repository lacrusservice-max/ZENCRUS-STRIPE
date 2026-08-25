/**
 * CICLO · CÓMO SE CALCULA TU PREDICCIÓN
 * ═══════════════════════════════════════════════════════════════════════════
 * La pantalla que ninguna app de la categoría tiene.
 *
 * ── Por qué existe ────────────────────────────────────────────────────────
 * Flo, Clue y Ovia dan una fecha. Cuando falla —y falla, porque un ciclo no es
 * un reloj— la usuaria no tiene forma de saber si la app se equivocó, si su
 * cuerpo se salió de lo suyo o si nunca hubo base para ese número. La
 * conclusión práctica de eso es dejar de creerse la app.
 *
 * Aquí se enseña la cocina entera: con cuántos ciclos se calculó, cuánto varían
 * entre sí, de dónde sale la anchura de la banda y qué haría falta para que se
 * estreche. Una predicción que explica su propia incertidumbre se puede seguir
 * usando después de fallar; una fecha desnuda, no.
 */

import { useEffect } from 'react'
import { View, Text, StyleSheet, ScrollView, useWindowDimensions } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Seccion, Placa, Tira, Vacio, Filete } from '@/components/salud/piezas'
import { useCicloStore } from '@/store/cicloStore'
import { useCiclo } from '@/features/salud/ciclo/useCiclo'
import {
  nivelConfianza, confianzaProyectada, CICLOS_PARA_FUNDAR,
} from '@/features/salud/ciclo/prediccion'
import { diaLargo, rangoCorto } from '@/features/salud/ciclo/formato'
import { base, space, radius, family, type as tipo, numeric } from '@/theme/salud/tokens'
import { Screen, ScreenHeader } from '@/components/ui/Screen'

export default function ExplicarPrediccion() {
  const load = useCicloStore(s => s.load)
  const ciclo = useCiclo()
  const { prediccion: p, estadisticas: est, tema } = ciclo
  const { width } = useWindowDimensions()

  useEffect(() => { void load() }, [load])

  if (!p) {
    return (
      <Screen tint={tema.accent}>
        <ScreenHeader back eyebrow="Zencrus · Ciclo" title="La predicción" icon="analytics" color={tema.accent} />
        <Vacio
          tono={tema.accent}
          icono="analytics-outline"
          titulo="No hay predicción que explicar"
          texto={ciclo.modo.motivo ?? 'Todavía no hay un periodo registrado del que partir.'}
        />
      </Screen>
    )
  }

  const sube = confianzaProyectada(p.ciclosUsados, est.desviacion, 2)
  const anchoBanda = width - space.lg * 2 - space.md * 2

  return (
    <Screen tint={tema.accent}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 80 }}>
        <ScreenHeader
          back
          eyebrow="Zencrus · Ciclo"
          title="La predicción"
          subtitle="De dónde sale el número que ves en la portada."
          icon="analytics"
          color={tema.accent}
        />

        {/* ── La banda, dibujada ─────────────────────────────────────── */}
        <Seccion eyebrow="Tu próximo periodo" color={tema.accent}>
          <Placa>
            <Text style={s.rango}>{rangoCorto(p.proximoPeriodo.low, p.proximoPeriodo.high)}</Text>
            <Text style={s.probable}>más probable: {diaLargo(p.proximoPeriodo.likely)}</Text>

            <BandaDibujada ancho={anchoBanda} margen={p.margenDias} tono={tema.accent} />

            <Text style={s.leyendaBanda}>
              La anchura de esa franja ES la incertidumbre: ±{p.margenDias} {p.margenDias === 1 ? 'día' : 'días'}.
              Cuando se estreche, será porque el módulo sabe más de ti, no porque
              haya decidido sonar más seguro.
            </Text>
          </Placa>
        </Seccion>

        {/* ── Con qué se calculó ─────────────────────────────────────── */}
        <Seccion eyebrow="Con qué se calculó" color={tema.accent}>
          <Placa>
            <Tira
              color={tema.accent}
              datos={[
                { valor: p.ciclosUsados, etiqueta: p.ciclosUsados === 1 ? 'ciclo tuyo' : 'ciclos tuyos' },
                { valor: p.duracionUsada, unidad: 'd', etiqueta: 'duración usada' },
                { valor: est.desviacion != null ? `±${est.desviacion}` : null, unidad: 'd', etiqueta: 'cuánto varían' },
              ]}
            />
            {p.fuenteDuracion === 'poblacional' ? (
              <>
                <Filete />
                <Text style={s.avisoPoblacional}>
                  Todavía no hay ciclos completos tuyos, así que la duración usada
                  ({p.duracionUsada} días) es una media general y no la tuya. En cuanto
                  registres dos periodos, este número pasa a salir de tu cuerpo.
                </Text>
              </>
            ) : null}
          </Placa>
        </Seccion>

        {/* ── La confianza ───────────────────────────────────────────── */}
        <Seccion eyebrow="Confianza" titulo={`${p.confianza} % · ${nivelConfianza(p.confianza)}`} color={tema.accent}>
          <Placa>
            <Barra valor={p.confianza} tono={tema.accent} />
            <Text style={s.txt}>
              Depende de dos cosas y de ninguna más: cuántos ciclos hay medidos
              ({p.ciclosUsados}) y cuánto se parecen entre sí
              ({est.desviacion != null ? `varían ±${est.desviacion} días` : 'aún no se puede medir'}).
            </Text>
            {p.ciclosUsados < CICLOS_PARA_FUNDAR ? (
              <Text style={[s.txt, s.accion]}>
                Con {CICLOS_PARA_FUNDAR - p.ciclosUsados} {CICLOS_PARA_FUNDAR - p.ciclosUsados === 1 ? 'ciclo más' : 'ciclos más'} el
                modelo deja de apoyarse en medias generales. Con dos más, la confianza subiría
                a cerca del {sube} %.
              </Text>
            ) : (
              <Text style={[s.txt, s.accion]}>
                Con dos ciclos más subiría a cerca del {sube} %.
              </Text>
            )}
            <Filete />
            <Text style={s.nota}>
              Nunca llega al 100 %. Un viaje, una gripe o una semana mala mueven un
              ciclo, y ninguna cantidad de historial lo evita.
            </Text>
          </Placa>
        </Seccion>

        {/* ── La ovulación ───────────────────────────────────────────── */}
        <Seccion eyebrow="Ovulación y días fértiles" color={tema.accent}>
          <Placa>
            {p.ovulacion ? (
              <>
                <Text style={s.txt}>
                  Estimada {rangoCorto(p.ovulacion.low, p.ovulacion.high)}. Se cuenta hacia
                  atrás desde la regla prevista, porque lo estable de un ciclo es la
                  segunda mitad —unos 14 días— y no la primera.
                </Text>
                <Text style={s.txt}>
                  Por eso su banda es MÁS ancha que la del periodo: arrastra la
                  incertidumbre de la predicción y le suma la suya.
                </Text>
                {p.ventanaFertil ? (
                  <Text style={s.txt}>
                    La ventana fértil va del {diaLargo(p.ventanaFertil.inicio)} al{' '}
                    {diaLargo(p.ventanaFertil.fin)}: cinco días antes por lo que sobrevive
                    un espermatozoide y uno después por lo que dura el óvulo.
                  </Text>
                ) : null}
              </>
            ) : (
              <Text style={s.txt}>{p.motivoSuprimido}</Text>
            )}
            <Filete />
            <View style={s.aviso}>
              <Ionicons name="alert-circle-outline" size={17} color={base.warn} />
              <Text style={s.avisoTxt}>
                Esto no es un método anticonceptivo. Es una estimación informativa,
                y una estimación no evita un embarazo.
              </Text>
            </View>
          </Placa>
        </Seccion>

        {/* ── Lo que el modelo NO hace ───────────────────────────────── */}
        <Seccion eyebrow="Lo que este modelo no hace" color={tema.accent}>
          <Placa>
            <No txt="No da fechas exactas. Da un rango, porque es lo que el dato permite." />
            <No txt="No aprende de sus propias predicciones: solo cuentan los periodos que registras tú." />
            <No txt="No usa datos de otras usuarias para adivinar los tuyos." />
            <No txt="No diagnostica. Señala patrones de tu registro y sugiere qué preguntar." />
          </Placa>
          <Text style={s.pie}>Modelo {p.modelo}.</Text>
        </Seccion>
      </ScrollView>
    </Screen>
  )
}

// ── La banda, a escala ──────────────────────────────────────────────────────

/**
 * Dibuja el intervalo con los días alrededor, para que la anchura se vea en vez
 * de leerse. «±3 días» es un dato; esta figura es una intuición.
 */
function BandaDibujada({ ancho, margen, tono }: { ancho: number; margen: number; tono: string }) {
  const total = margen * 2 + 7          // margen de aire a cada lado
  const paso = ancho / total
  const dias = Array.from({ length: total }, (_, i) => i - Math.floor(total / 2))

  return (
    <View style={s.bandaWrap}>
      <View style={s.bandaFila}>
        {dias.map(d => {
          const dentro = Math.abs(d) <= margen
          const centro = d === 0
          return (
            <View
              key={d}
              style={[
                s.bandaTicK,
                { width: paso - 2, height: centro ? 34 : dentro ? 24 : 12 },
                centro
                  ? { backgroundColor: tono }
                  : dentro
                    ? { backgroundColor: `${tono}4D` }
                    : { backgroundColor: base.surface3 },
              ]}
            />
          )
        })}
      </View>
      <View style={s.bandaEje}>
        <Text style={s.bandaTxt}>−{margen} d</Text>
        <Text style={[s.bandaTxt, { color: tono }]}>más probable</Text>
        <Text style={s.bandaTxt}>+{margen} d</Text>
      </View>
    </View>
  )
}

function Barra({ valor, tono }: { valor: number; tono: string }) {
  return (
    <View style={s.barraFondo}>
      <View style={[s.barraRelleno, { width: `${valor}%`, backgroundColor: tono }]} />
    </View>
  )
}

function No({ txt }: { txt: string }) {
  return (
    <View style={s.no}>
      <Ionicons name="close" size={14} color={base.textLow} />
      <Text style={s.noTxt}>{txt}</Text>
    </View>
  )
}

const s = StyleSheet.create({
  rango: { fontFamily: family.displaySemi, fontSize: tipo.display.sm, color: base.textHi },
  probable: { fontFamily: family.ui, fontSize: tipo.ui.sm, color: base.textMid, marginTop: 3 },

  bandaWrap: { marginTop: space.lg },
  bandaFila: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 34 },
  bandaTicK: { borderRadius: 2 },
  bandaEje: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  bandaTxt: { fontFamily: family.data, fontSize: 10, color: base.textLow, ...numeric },
  leyendaBanda: {
    fontFamily: family.ui, fontSize: tipo.ui.xs, color: base.textLow,
    marginTop: space.md, lineHeight: tipo.ui.xs * 1.55,
  },

  txt: {
    fontFamily: family.ui, fontSize: tipo.ui.sm, color: base.textMid,
    lineHeight: tipo.ui.sm * 1.6, marginBottom: space.sm,
  },
  accion: { color: base.textHi },
  nota: {
    fontFamily: family.ui, fontSize: tipo.ui.xs, color: base.textLow,
    paddingTop: space.md - 2, lineHeight: tipo.ui.xs * 1.55,
  },
  avisoPoblacional: {
    fontFamily: family.ui, fontSize: tipo.ui.xs, color: base.textMid,
    paddingTop: space.md - 2, lineHeight: tipo.ui.xs * 1.6,
  },

  barraFondo: {
    height: 6, borderRadius: radius.sm, backgroundColor: base.surface3,
    overflow: 'hidden', marginBottom: space.md,
  },
  barraRelleno: { height: '100%', borderRadius: radius.sm },

  aviso: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-start', paddingTop: space.md - 2 },
  avisoTxt: {
    flex: 1, fontFamily: family.ui, fontSize: tipo.ui.xs, color: base.textMid,
    lineHeight: tipo.ui.xs * 1.55,
  },

  no: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-start', paddingBottom: space.md - 4 },
  noTxt: {
    flex: 1, fontFamily: family.ui, fontSize: tipo.ui.sm, color: base.textMid,
    lineHeight: tipo.ui.sm * 1.5,
  },
  pie: { fontFamily: family.data, fontSize: 10, color: base.textLow, marginTop: space.sm, ...numeric },
})

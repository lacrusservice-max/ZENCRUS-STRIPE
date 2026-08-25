/**
 * CICLO · CÓMO TE AFECTA
 * ═══════════════════════════════════════════════════════════════════════════
 * La pantalla que ninguna app de ciclo puede tener: qué le pasa a tu
 * entrenamiento, tu comida y tu descanso según la fase.
 *
 * ── Por qué solo puede existir aquí ────────────────────────────────────────
 * Hace falta el ciclo Y el resto de la vida, todos los días, durante meses.
 * Flo tiene lo primero y nada de lo segundo; una app de entrenamiento tiene lo
 * segundo y nada de lo primero. ZENCRUS ya tenía las dos mitades guardadas en
 * cinco sitios distintos, y esto es ponerlas en la misma tabla.
 *
 * ── Enseña también lo que NO sale ──────────────────────────────────────────
 * Las métricas que se miraron y no dieron un efecto claro aparecen igual,
 * marcadas como tales. Esconderlas dejaría la pantalla enseñando solo lo que
 * por casualidad salió significativo, que es el sesgo de publicación aplicado
 * al cuerpo de una persona.
 *
 * ── Y no explica el porqué ─────────────────────────────────────────────────
 * Describir lo observado —«tu volumen baja un 9 % en lútea»— es un hecho de su
 * registro. Explicarlo —«por la progesterona»— es medicina que estos datos no
 * sostienen. La pantalla se queda en lo primero, a propósito.
 */

import { useEffect, useMemo, useState } from 'react'
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Seccion, Placa, Vacio, Eyebrow, Filete } from '@/components/salud/piezas'
import { useCicloStore } from '@/store/cicloStore'
import { useCiclo } from '@/features/salud/ciclo/useCiclo'
import { reunirSeries } from '@/features/salud/ciclo/series'
import {
  correlacionar, redactar, MIN_CICLOS, MIN_OBSERVACIONES,
  type Serie, type Correlacion,
} from '@/features/salud/ciclo/correlacion'
import { PHASES, base, space, family, type as tipo, numeric } from '@/theme/salud/tokens'
import { Screen, ScreenHeader } from '@/components/ui/Screen'

export default function Correlaciones() {
  const load = useCicloStore(s => s.load)
  const ciclo = useCiclo()
  const tono = ciclo.tema.accent

  const [series, setSeries] = useState<Serie[] | null>(null)

  useEffect(() => {
    void load()
    void reunirSeries().then(setSeries)
  }, [load])

  const hallazgos = useMemo(
    () => series
      ? correlacionar({ series, periodos: ciclo.periodos, marco: ciclo.marco })
      : [],
    [series, ciclo.periodos, ciclo.marco],
  )

  const claros = hallazgos.filter(h => h.claro)
  const dudosos = hallazgos.filter(h => !h.claro)
  const ciclosCerrados = ciclo.periodos.filter(p => p.duracionCiclo != null).length

  return (
    <Screen tint={tono}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 80 }}>
        <ScreenHeader
          back
          eyebrow="Zencrus · Ciclo"
          title="Cómo te afecta"
          subtitle="Tu ciclo cruzado con tu entrenamiento, tu comida y tu descanso."
          icon="git-compare"
          color={tono}
        />

        {series == null ? (
          <View style={s.cargando}><ActivityIndicator color={base.textLow} /></View>
        ) : ciclosCerrados < MIN_CICLOS ? (
          <Vacio
            tono={tono}
            icono="git-compare-outline"
            titulo="Todavía no hay con qué cruzar"
            texto={`Hacen falta ${MIN_CICLOS} ciclos cerrados para que una diferencia signifique algo y no sea un mes raro. Llevas ${ciclosCerrados}.`}
          />
        ) : !hallazgos.length ? (
          <Vacio
            tono={tono}
            icono="git-compare-outline"
            titulo="Aún faltan días con dato"
            texto={`Cada fase necesita al menos ${MIN_OBSERVACIONES} días con dato para poder compararse con tu media. Sigue entrenando y registrando como siempre: esto se llena solo.`}
          />
        ) : (
          <>
            {claros.length > 0 && (
              <Seccion
                eyebrow="Lo que se ve"
                nota="Cada diferencia va con su intervalo y con cuántos días la sostienen."
                color={tono}
              >
                {claros.map(h => <Hallazgo key={`${h.metric}-${h.phase}`} h={h} />)}
              </Seccion>
            )}

            {dudosos.length > 0 && (
              <Seccion
                eyebrow="Lo que se miró y no dio nada"
                nota="Está aquí a propósito: enseñar solo lo que sale es la mejor forma de encontrar patrones que no existen."
                color={tono}
              >
                <Placa>
                  {dudosos.slice(0, 8).map((h, i) => (
                    <View key={`${h.metric}-${h.phase}`}>
                      {i > 0 ? <Filete /> : null}
                      <Text style={s.dudoso}>
                        {h.label} {NOMBRE[h.phase]}: sin diferencia clara ({h.n} días).
                      </Text>
                    </View>
                  ))}
                </Placa>
              </Seccion>
            )}

            <Seccion eyebrow="Cómo se calcula" color={tono}>
              <Placa>
                <Text style={s.txt}>
                  Cada fase se compara con TU media, no con la de nadie más. Solo
                  se cuenta si hay al menos {MIN_OBSERVACIONES} días con dato en esa
                  fase y de {MIN_CICLOS} ciclos distintos: un solo mes malo no es
                  un patrón.
                </Text>
                <Text style={s.txt}>
                  El intervalo tiene que excluir el cero para que la diferencia se
                  dé por buena. Si lo cruza, la respuesta honesta es «no se ve
                  efecto» — y aparece arriba, en la segunda lista.
                </Text>
                <Filete />
                <View style={s.aviso}>
                  <Ionicons name="information-circle-outline" size={17} color={base.textMid} />
                  <Text style={s.avisoTxt}>
                    Que dos cosas vayan juntas no dice que una cause la otra. Si
                    tu volumen baja en lútea puede ser la fase, o que la lútea te
                    caiga siempre en semana de descarga. Eso no está en estos datos.
                  </Text>
                </View>
              </Placa>
            </Seccion>
          </>
        )}
      </ScrollView>
    </Screen>
  )
}

const NOMBRE: Record<string, string> = {
  menstrual: 'durante la regla',
  folicular: 'en folicular',
  ovulatoria: 'en ovulación',
  lutea: 'en lútea',
}

/**
 * Un hallazgo, con su intervalo dibujado.
 *
 * La barra parte del centro —la línea base— y se extiende hacia el lado del
 * efecto; el trazo más claro es el intervalo. Que se vea la anchura, y no solo
 * el número, es lo que impide leer «−9 %» como si fuera exacto.
 */
/* El color sale de la fase del propio hallazgo, no del tema de hoy: en esta
   pantalla conviven las cuatro fases y teñirlas todas del color de hoy
   borraría de qué fase habla cada tarjeta. */
function Hallazgo({ h }: { h: Correlacion }) {
  const fase = PHASES[h.phase]
  const escala = Math.max(20, Math.abs(h.ciLow), Math.abs(h.ciHigh))
  const pct = (v: number) => 50 + (v / escala) * 50

  return (
    <Placa>
      <View style={s.cab}>
        <Eyebrow color={fase.accent}>{fase.label}</Eyebrow>
        <Text style={[s.efecto, { color: h.efectoPct < 0 ? base.warn : base.ok }]}>
          {h.efectoPct > 0 ? '+' : ''}{h.efectoPct} %
        </Text>
      </View>

      <Text style={s.frase}>{redactar(h)}</Text>

      <View style={s.grafica}>
        <View style={s.eje} />
        <View style={s.centroEje} />
        <View
          style={[
            s.intervalo,
            {
              left: `${Math.min(pct(h.ciLow), pct(h.ciHigh))}%`,
              width: `${Math.abs(pct(h.ciHigh) - pct(h.ciLow))}%`,
              backgroundColor: `${fase.accent}55`,
            },
          ]}
        />
        <View style={[s.marca, { left: `${pct(h.efectoPct)}%`, backgroundColor: fase.accent }]} />
      </View>
      <View style={s.ejeTxtFila}>
        <Text style={s.ejeTxt}>−{Math.round(escala)} %</Text>
        <Text style={s.ejeTxt}>tu media</Text>
        <Text style={s.ejeTxt}>+{Math.round(escala)} %</Text>
      </View>
    </Placa>
  )
}

const s = StyleSheet.create({
  cargando: { paddingVertical: space.xxxl, alignItems: 'center' },

  cab: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  efecto: { fontFamily: family.dataMedium, fontSize: tipo.data.md, ...numeric },
  frase: {
    fontFamily: family.ui, fontSize: tipo.ui.sm, color: base.textHi,
    lineHeight: tipo.ui.sm * 1.55, marginTop: space.sm,
  },

  grafica: { height: 22, marginTop: space.md, justifyContent: 'center' },
  eje: { height: 1, backgroundColor: base.hairline },
  centroEje: {
    position: 'absolute', left: '50%', width: 1, height: 22, backgroundColor: base.surface3,
  },
  intervalo: { position: 'absolute', height: 10, borderRadius: 5 },
  marca: { position: 'absolute', width: 3, height: 18, borderRadius: 2, marginLeft: -1.5 },
  ejeTxtFila: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  ejeTxt: { fontFamily: family.data, fontSize: 9.5, color: base.textLow, ...numeric },

  dudoso: {
    fontFamily: family.ui, fontSize: tipo.ui.xs, color: base.textMid,
    paddingVertical: space.sm + 2, lineHeight: tipo.ui.xs * 1.5,
  },

  txt: {
    fontFamily: family.ui, fontSize: tipo.ui.sm, color: base.textMid,
    lineHeight: tipo.ui.sm * 1.6, marginBottom: space.sm,
  },
  aviso: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-start', paddingTop: space.md - 2 },
  avisoTxt: {
    flex: 1, fontFamily: family.ui, fontSize: tipo.ui.xs, color: base.textMid,
    lineHeight: tipo.ui.xs * 1.55,
  },
})

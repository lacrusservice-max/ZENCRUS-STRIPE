/**
 * CICLO · TEMPERATURA BASAL
 * ═══════════════════════════════════════════════════════════════════════════
 * La única señal con la que una app puede CONFIRMAR que hubo ovulación. Y solo
 * mirando hacia atrás: cuando el escalón se ve, ya pasó.
 *
 * ── Esto no es un método anticonceptivo ────────────────────────────────────
 * Natural Cycles tiene autorización de la FDA para presentarse así; ZENCRUS no
 * la tiene. La diferencia no es de matiz: quien confunda una gráfica bonita
 * con un anticonceptivo se puede quedar embarazada. Por eso la advertencia
 * está en la pantalla, no escondida en unos términos, y por eso este módulo
 * dice «ovulaste» y jamás «hoy no puedes quedarte embarazada».
 *
 * ── Se enseña el método, no solo el resultado ──────────────────────────────
 * La línea de cobertura, las tres lecturas altas y el porqué. Una app de salud
 * que dice «confiado en nuestro algoritmo» pide fe; una que enseña la regla
 * permite comprobarla, que es lo que se le debe a alguien sobre su cuerpo.
 */

import { useEffect, useMemo, useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, Pressable, useWindowDimensions,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Seccion, Placa, Vacio, Filete, Tira } from '@/components/salud/piezas'
import { GraficaTemperatura } from '@/components/salud/GraficaTemperatura'
import { ReglaTemperatura } from '@/components/salud/ReglaTemperatura'
import { useCicloStore } from '@/store/cicloStore'
import { useCiclo } from '@/features/salud/ciclo/useCiclo'
import { curvaTemperatura, type LecturaTemperatura } from '@/features/salud/ciclo/temperatura'
import { diaLargo } from '@/features/salud/ciclo/formato'
import { base, space, radius, family, type as tipo } from '@/theme/salud/tokens'
import { hoyLocal } from '@/utils/fechas'
import { confirmar, elegir } from '@/utils/haptica'
import { Screen, ScreenHeader } from '@/components/ui/Screen'

export default function Temperatura() {
  const load = useCicloStore(s => s.load)
  const logs = useCicloStore(s => s.logs)
  const registrar = useCicloStore(s => s.registrar)
  const { width } = useWindowDimensions()
  const ciclo = useCiclo()
  const hoy = hoyLocal()

  useEffect(() => { void load() }, [load])

  const deHoy = logs[hoy]?.temperatura_basal
  const [alterada, setAlterada] = useState<boolean>(deHoy?.disturbed ?? false)

  /* Solo las lecturas del ciclo en curso: la línea de cobertura se traza sobre
     las seis anteriores, y si se colaran las del ciclo pasado —que terminan
     altas, en fase lútea— la línea saldría por las nubes y no habría escalón
     que detectar nunca. */
  const inicioCiclo = ciclo.periodos[ciclo.periodos.length - 1]?.inicio
  const lecturas = useMemo<LecturaTemperatura[]>(() => {
    return Object.keys(logs)
      .filter(f => logs[f].temperatura_basal && (!inicioCiclo || f >= inicioCiclo))
      .sort()
      .map(f => ({
        fecha: f,
        celsius: logs[f].temperatura_basal!.celsius,
        disturbed: logs[f].temperatura_basal!.disturbed,
      }))
  }, [logs, inicioCiclo])

  const curva = useMemo(() => curvaTemperatura(lecturas), [lecturas])
  const tono = ciclo.tema.accent
  const apartadas = lecturas.filter(l => l.disturbed).length

  const guardar = async (celsius: number, disturbed = alterada) => {
    const ok = await registrar('temperatura_basal', { celsius, disturbed })
    if (ok) confirmar()
  }

  return (
    <Screen tint={tono}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 80 }}>
        <ScreenHeader
          back
          eyebrow="Zencrus · Ciclo"
          title="Temperatura basal"
          icon="thermometer"
          color={tono}
        />

        {/* ── El registro de hoy, arriba: es a lo que se entra ────────── */}
        <Seccion
          eyebrow="Hoy"
          nota="Al despertar, antes de levantarte y a la misma hora. Si te la tomas a otra hora o dormiste mal, márcalo abajo."
          color={tono}
        >
          <Placa>
            <ReglaTemperatura
              valor={deHoy?.celsius ?? null}
              onChange={v => void guardar(v)}
              tono={tono}
            />
            <Filete />
            <Pressable
              onPress={() => {
                elegir()
                const v = !alterada
                setAlterada(v)
                if (deHoy) void guardar(deHoy.celsius, v)
              }}
              style={({ pressed }) => [s.marcar, pressed && s.pulsado]}
              accessibilityRole="switch"
              accessibilityState={{ checked: alterada }}
            >
              <Ionicons
                name={alterada ? 'checkbox' : 'square-outline'}
                size={18}
                color={alterada ? tono : base.textLow}
              />
              <View style={s.flex}>
                <Text style={s.marcarTxt}>Esta lectura no cuenta</Text>
                <Text style={s.marcarNota}>
                  Fiebre, alcohol, mala noche u otra hora. Se guarda, pero se aparta del cálculo.
                </Text>
              </View>
            </Pressable>
          </Placa>
        </Seccion>

        {/* ── La curva ───────────────────────────────────────────────── */}
        {curva && curva.puntos.length >= 2 ? (
          <Seccion eyebrow="Este ciclo" color={tono}>
            <Placa>
              <GraficaTemperatura
                curva={curva}
                ancho={width - space.lg * 2 - space.md * 2}
                tono={tono}
              />
            </Placa>

            {curva.cambio ? (
              <Placa style={s.veredicto} tono={`${tono}14`}>
                <Ionicons name="checkmark-circle" size={20} color={tono} />
                <View style={s.flex}>
                  <Text style={s.veredictoTitulo}>Ovulación confirmada</Text>
                  <Text style={s.veredictoTxt}>
                    Tu temperatura superó la línea de cobertura ({curva.cambio.lineaCobertura.toFixed(2)} °C)
                    tres días seguidos. Eso sitúa la ovulación alrededor del {diaLargo(curva.cambio.fechaOvulacion)},
                    y quedó confirmada el {diaLargo(curva.cambio.fechaConfirmacion)}.
                  </Text>
                </View>
              </Placa>
            ) : (
              <Placa style={s.veredicto}>
                <Ionicons name="ellipsis-horizontal-circle-outline" size={20} color={base.textMid} />
                <View style={s.flex}>
                  <Text style={s.veredictoTitulo}>Todavía sin escalón</Text>
                  <Text style={s.veredictoTxt}>
                    {curva.puntos.length < 9
                      ? `Hacen falta al menos nueve lecturas para poder trazar la línea y ver el salto. Llevas ${curva.puntos.length}.`
                      : 'Las lecturas de estos días no han subido lo suficiente ni se han mantenido tres días arriba. Puede que aún no hayas ovulado en este ciclo.'}
                  </Text>
                </View>
              </Placa>
            )}

            <Placa>
              <Tira
                color={tono}
                datos={[
                  { valor: curva.puntos.length, etiqueta: 'lecturas válidas' },
                  { valor: apartadas || null, etiqueta: 'apartadas' },
                  {
                    valor: curva.cambio ? `+${curva.cambio.salto.toFixed(2)}` : null,
                    unidad: '°C', etiqueta: 'escalón',
                  },
                ]}
              />
            </Placa>
          </Seccion>
        ) : (
          <Vacio
            tono={tono}
            icono="thermometer-outline"
            titulo="Aún no hay curva"
            texto="Con nueve mañanas seguidas se puede trazar la línea de cobertura y ver si hubo escalón. Es el único modo de confirmar una ovulación sin analítica."
          />
        )}

        {/* ── El método, explicado ───────────────────────────────────── */}
        <Seccion eyebrow="Cómo se lee" titulo="La regla de los tres sobre seis" color={tono}>
          <Placa>
            <Paso n={1} txt="Se traza la línea de cobertura en el punto más alto de las seis lecturas anteriores." />
            <Paso n={2} txt="Hacen falta tres lecturas seguidas por encima de esa línea." />
            <Paso n={3} txt="La tercera debe superarla por al menos dos décimas de grado." />
            <Filete />
            <Text style={s.nota}>
              La ovulación se sitúa el día ANTES de la primera subida: la progesterona
              tarda en calentar. Es el criterio del método sintotérmico, el mismo que
              usará cualquier profesional que lea tu informe.
            </Text>
          </Placa>
        </Seccion>

        {/* ── El aviso, visible ──────────────────────────────────────── */}
        <Seccion color={tono}>
          <Placa style={s.aviso}>
            <Ionicons name="alert-circle-outline" size={18} color={base.warn} />
            <Text style={s.avisoTxt}>
              Esto no es un método anticonceptivo. La temperatura confirma que ya
              ovulaste; no dice cuándo vas a ovular ni en qué días no puedes quedarte
              embarazada.
            </Text>
          </Placa>
        </Seccion>
      </ScrollView>
    </Screen>
  )
}

function Paso({ n, txt }: { n: number; txt: string }) {
  return (
    <View style={s.paso}>
      <Text style={s.pasoN}>{n}</Text>
      <Text style={s.pasoTxt}>{txt}</Text>
    </View>
  )
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  pulsado: { opacity: 0.7 },

  marcar: { flexDirection: 'row', gap: space.sm + 2, alignItems: 'flex-start', paddingTop: space.md - 2 },
  marcarTxt: { fontFamily: family.uiMedium, fontSize: tipo.ui.sm, color: base.textHi },
  marcarNota: {
    fontFamily: family.ui, fontSize: tipo.ui.xs, color: base.textLow,
    marginTop: 2, lineHeight: tipo.ui.xs * 1.45,
  },

  veredicto: { flexDirection: 'row', gap: space.sm + 2, alignItems: 'flex-start' },
  veredictoTitulo: { fontFamily: family.uiSemi, fontSize: tipo.ui.md, color: base.textHi },
  veredictoTxt: {
    fontFamily: family.ui, fontSize: tipo.ui.sm, color: base.textMid,
    marginTop: 4, lineHeight: tipo.ui.sm * 1.55,
  },

  paso: { flexDirection: 'row', gap: space.sm + 2, paddingBottom: space.md - 2 },
  pasoN: {
    fontFamily: family.dataMedium, fontSize: tipo.ui.sm, color: base.textLow,
    width: 16, textAlign: 'center',
  },
  pasoTxt: {
    flex: 1, fontFamily: family.ui, fontSize: tipo.ui.sm, color: base.textMid,
    lineHeight: tipo.ui.sm * 1.5,
  },
  nota: {
    fontFamily: family.ui, fontSize: tipo.ui.xs, color: base.textLow,
    paddingTop: space.md - 2, lineHeight: tipo.ui.xs * 1.55,
  },

  aviso: { flexDirection: 'row', gap: space.sm + 2, alignItems: 'flex-start', borderRadius: radius.lg },
  avisoTxt: {
    flex: 1, fontFamily: family.ui, fontSize: tipo.ui.sm, color: base.textMid,
    lineHeight: tipo.ui.sm * 1.55,
  },
})

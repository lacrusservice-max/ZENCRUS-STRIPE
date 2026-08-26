/**
 * CICLO · EL ALTA
 * ═══════════════════════════════════════════════════════════════════════════
 * Las pantallas 03, 04 y 05 del mockup: seguridad, predicción y bienvenida.
 *
 * ── Son DOS pasos y no tres ────────────────────────────────────────────────
 * El mockup marca «Paso 2 de 3» y «Paso 3 de 3» porque su paso 1 era crear la
 * cuenta. Eso ya vive en la app principal y no se duplica, así que aquí el
 * contador empieza de nuevo. Dejar «paso 2 de 3» sin un paso 1 visible haría
 * pensar que algo se saltó.
 *
 * ── Un solo interruptor de biometría, no tres ──────────────────────────────
 * El mockup enseña Face ID, huella y PIN por separado. En iOS y Android quien
 * decide cuál se pide es el sistema según lo que tenga el teléfono: la app pide
 * «identifícate» y le contestan con la cara, con el dedo o con el código.
 * Pintar tres interruptores que en realidad son el mismo sería enseñar un
 * control que no controla nada — de los tres, dos no harían nada al tocarlos.
 *
 * ── Lo que se pregunta se GUARDA ───────────────────────────────────────────
 * La duración del ciclo y del sangrado van a `declared_cycle_days` y
 * `declared_period_days` (migración 021), separadas de las medias calculadas,
 * y el motor las usa como punto de partida mientras no haya historial.
 * Preguntar algo y tirarlo es lo que hace que una app se sienta falsa.
 */

import { useMemo, useState } from 'react'
import { View, Text, StyleSheet, Pressable, ScrollView, Switch } from 'react-native'
import { router } from 'expo-router'
import { useCicloStore } from '@/store/cicloStore'
import { usePrivacyStore } from '@/store/privacyStore'
import { DIAS_SEMANA, nombreMes } from '@/features/salud/ciclo/formato'
import { hoyLocal, aFechaLocal } from '@/utils/fechas'
import { Pantalla, Tarjeta, Chip, Azulejo, Icono, BotonPrincipal } from '@/components/salud/ciclo/Claro'
import {
  FONDO, ACENTO, TEXTO, FUENTE, SUP, RADIO, TABULAR,
} from '@/theme/salud/cicloClaro'
import { elegir, confirmar } from '@/utils/haptica'

const ANTICONCEPTIVOS = [
  { id: '', et: 'Ninguno' },
  { id: 'pildora', et: 'Píldora' },
  { id: 'diu_hormonal', et: 'DIU hormonal' },
  { id: 'diu_cobre', et: 'DIU de cobre' },
  { id: 'implante', et: 'Implante' },
  { id: 'inyeccion', et: 'Inyección' },
  { id: 'parche', et: 'Parche' },
  { id: 'anillo', et: 'Anillo' },
  { id: 'barrera', et: 'Preservativo u otro de barrera' },
]

export default function AltaCiclo() {
  const [paso, setPaso] = useState(0)

  const bloqueo = usePrivacyStore(s => s.menstrualLockEnabled)
  const setBloqueo = usePrivacyStore(s => s.setMenstrualLock)
  const [discreto, setDiscreto] = useState(false)

  const declararInicio = useCicloStore(s => s.declararInicio)
  const setDeclarado = useCicloStore(s => s.setDeclarado)

  const hoy = hoyLocal()
  const [ultimaRegla, setUltimaRegla] = useState<string | null>(null)
  const [duracion, setDuracion] = useState(28)
  const [sangrado, setSangrado] = useState(5)
  const [regular, setRegular] = useState<boolean | null>(null)
  const [anticonceptivo, setAnticonceptivo] = useState('')

  const terminarPrediccion = async () => {
    confirmar()
    if (ultimaRegla) await declararInicio(ultimaRegla)
    await setDeclarado({
      duracionDeclarada: duracion,
      sangradoDeclarado: sangrado,
      anticonceptivo: anticonceptivo || null,
    })
    setPaso(2)
  }

  if (paso === 0) {
    return (
      <Alto fondo={FONDO.seguridad} titulo="Tus datos, tan seguros" resalte="como los quieras">
        <Tarjeta style={s.tarjeta}>
          <Progreso paso={0} />
          <Text style={s.tituloCard}>Acceso seguro</Text>

          <View style={s.fila}>
            <Azulejo icono="auth_faceid" fondo={ACENTO.tealSuave} tam={44} />
            <View style={s.flex}>
              <Text style={s.filaTit}>Pedir tu identidad al entrar</Text>
              <Text style={s.filaTxt}>
                Cara, huella o el código del teléfono: lo elige tu móvil según lo
                que tenga. Se pide cada vez que abres esta sección, aunque el
                teléfono ya esté desbloqueado.
              </Text>
            </View>
            <Switch
              value={bloqueo}
              onValueChange={v => { elegir(); setBloqueo(v) }}
              trackColor={{ false: '#DCD6E8', true: '#10ABC1AA' }}
              thumbColor={bloqueo ? '#10ABC1' : '#FFFFFF'}
            />
          </View>

          <View style={s.discreto}>
            <Azulejo icono="auth_discreto" fondo="#FFFFFF" tam={40} />
            <View style={s.flex}>
              <Text style={s.filaTit}>Modo discreto</Text>
              <Text style={s.filaTxt}>
                Oculta los nombres de síntomas y del periodo en las
                notificaciones. En la pantalla de bloqueo solo verás «ZENCRUS».
              </Text>
            </View>
            <Switch
              value={discreto}
              onValueChange={v => { elegir(); setDiscreto(v) }}
              trackColor={{ false: '#F3D6DE', true: `${ACENTO.rojo}AA` }}
              thumbColor={discreto ? ACENTO.rojo : '#FFFFFF'}
            />
          </View>

          <BotonPrincipal texto="Continuar →" onPress={() => { elegir(); setPaso(1) }} />
        </Tarjeta>
      </Alto>
    )
  }

  if (paso === 1) {
    return (
      <Alto fondo={FONDO.prediccion} titulo="Personalicemos tu" resalte="predicción del ciclo">
        <Tarjeta style={s.tarjeta}>
          <Progreso paso={1} />

          <Campo icono="cycle_calendario" fondo={ACENTO.naranjaSuave}
                 titulo="Fecha de tu última menstruación">
            <MiniCalendario hoy={hoy} elegida={ultimaRegla} onElegir={setUltimaRegla} />
          </Campo>

          <Campo icono="cycle_duracion" fondo={ACENTO.naranjaSuave}
                 titulo="Duración promedio de tu ciclo">
            <Regleta desde={21} hasta={35} valor={duracion} onValor={setDuracion} unidad="días" />
          </Campo>

          <Campo icono="cycle_gota_color" fondo={ACENTO.rojoSuave}
                 titulo="Duración promedio del sangrado">
            <View style={s.chips}>
              {[3, 4, 5, 6, 7].map(n => (
                <Chip
                  key={n}
                  texto={n === 7 ? '7+ días' : String(n)}
                  color={ACENTO.naranja}
                  activo={sangrado === n}
                  onPress={() => setSangrado(n)}
                />
              ))}
            </View>
          </Campo>

          <Campo icono="cycle_regular" fondo={ACENTO.naranjaSuave} titulo="¿Tu ciclo es regular?">
            <View style={s.chips}>
              <Chip texto="Regular" color="#1F1A22" activo={regular === true}
                    onPress={() => setRegular(regular === true ? null : true)} />
              <Chip texto="Irregular" color="#1F1A22" activo={regular === false}
                    onPress={() => setRegular(regular === false ? null : false)} />
            </View>
            <Text style={s.letraChica}>
              Solo cambia el tono de lo que te decimos al principio. Después manda
              lo que midamos de tus ciclos, no lo que marques aquí.
            </Text>
          </Campo>

          <Campo icono="cycle_anticonceptivo" fondo={ACENTO.naranjaSuave}
                 titulo="¿Usas algún método anticonceptivo?">
            <View style={s.chips}>
              {ANTICONCEPTIVOS.map(a => (
                <Chip key={a.id || 'ninguno'} texto={a.et} color={ACENTO.naranja}
                      activo={anticonceptivo === a.id}
                      onPress={() => setAnticonceptivo(a.id)} />
              ))}
            </View>
          </Campo>

          <BotonPrincipal texto="Continuar →" onPress={() => void terminarPrediccion()} />
        </Tarjeta>
      </Alto>
    )
  }

  return (
    <Pantalla salida={false} fondo={FONDO.bienvenida}>
      <ScrollView contentContainerStyle={s.scrollFin} showsVerticalScrollIndicator={false}>
        <View style={s.avatar}>
          <Icono nombre="community_decorativo" tam={64} />
        </View>
        <Text style={s.finTit}>¡Todo listo!</Text>
        <View style={s.finPildora}>
          <Text style={s.finPildoraTxt}>conoce tu app</Text>
        </View>

        <Tarjeta style={s.tarjetaFin}>
          {[
            { icono: 'cycle_duracion', fondo: ACENTO.naranjaSuave, tit: 'Predicciones',
              txt: 'Anticipa tu periodo y tu ventana fértil con predicciones basadas en tu ciclo.' },
            { icono: 'mood_badge', fondo: ACENTO.rosaSuave, tit: 'Registro de síntomas',
              txt: 'Registra síntomas y estado de ánimo cada día para conocer mejor tu cuerpo.' },
            { icono: 'wellness_nutricion', fondo: ACENTO.verdeSuave, tit: 'Nutrición y entrenamiento',
              txt: 'Recibe recomendaciones para cada fase, cuidando tu salud integral.' },
          ].map(f => (
            <View key={f.tit} style={s.finFila}>
              <Azulejo icono={f.icono as never} fondo={f.fondo} tam={52} />
              <View style={s.flex}>
                <Text style={s.finFilaTit}>{f.tit}</Text>
                <Text style={s.finFilaTxt}>{f.txt}</Text>
              </View>
            </View>
          ))}
        </Tarjeta>

        <BotonPrincipal
          texto="Ir a mi panel →"
          onPress={() => { confirmar(); router.replace('/salud/ciclo') }}
        />
      </ScrollView>
    </Pantalla>
  )
}

/* ── Piezas ────────────────────────────────────────────────────────────── */

function Alto({ fondo, titulo, resalte, children }: {
  fondo: string
  titulo: string
  resalte: string
  children: React.ReactNode
}) {
  return (
    <Pantalla fondo={fondo}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <Text style={s.cabecera}>{titulo}</Text>
        <View style={s.cabPildora}>
          <Text style={[s.cabPildoraTxt, { color: fondo }]}>{resalte}</Text>
        </View>
        {children}
      </ScrollView>
    </Pantalla>
  )
}

function Progreso({ paso }: { paso: number }) {
  return (
    <View style={s.progreso}>
      <Text style={s.progresoTxt}>Paso {paso + 1} de 2</Text>
      <View style={s.progresoBarras}>
        {[0, 1].map(n => (
          <View key={n} style={[s.progresoBarra, n <= paso && s.progresoBarraOn]} />
        ))}
      </View>
    </View>
  )
}

function Campo({ icono, fondo, titulo, children }: {
  icono: string
  fondo: string
  titulo: string
  children: React.ReactNode
}) {
  return (
    <View style={s.campo}>
      <View style={s.campoCab}>
        <Azulejo icono={icono as never} fondo={fondo} tam={44} />
        <Text style={s.campoTit}>{titulo}</Text>
      </View>
      {children}
    </View>
  )
}

/**
 * La regleta de días.
 *
 * El mockup pone un deslizador. No hay ninguno en el proyecto, y traer una
 * dependencia nativa por un control de quince valores no compensa: una tira que
 * engancha se toca igual de bien con el pulgar, no obliga a apuntar a un punto
 * de dos milímetros y encima deja leer los números.
 */
function Regleta({ desde, hasta, valor, onValor, unidad }: {
  desde: number
  hasta: number
  valor: number
  onValor: (v: number) => void
  unidad: string
}) {
  const valores = useMemo(
    () => Array.from({ length: hasta - desde + 1 }, (_, i) => desde + i),
    [desde, hasta])

  return (
    <View style={s.regleta}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
                  contentContainerStyle={s.regletaTira}>
        {valores.map(n => {
          const on = n === valor
          return (
            <Pressable
              key={n}
              onPress={() => { elegir(); onValor(n) }}
              style={[s.regletaItem, on && s.regletaItemOn]}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
            >
              <Text style={[s.regletaTxt, on && s.regletaTxtOn]}>{n}</Text>
            </Pressable>
          )
        })}
      </ScrollView>
      <Text style={s.regletaPie}>{valor} {unidad}</Text>
    </View>
  )
}

/**
 * El calendario del alta.
 *
 * Solo hacia atrás y solo tres meses: la última regla ya pasó —una fecha futura
 * no es un dato, es un error de dedo— y más de tres meses atrás no se recuerda
 * con precisión. Bloquear el futuro evita el fallo silencioso de declarar un
 * inicio que aún no ha ocurrido, que dejaría al motor prediciendo hacia atrás.
 */
function MiniCalendario({ hoy, elegida, onElegir }: {
  hoy: string
  elegida: string | null
  onElegir: (f: string) => void
}) {
  const [atras, setAtras] = useState(0)

  const { año, mes, celdas } = useMemo(() => {
    const base = new Date(Number(hoy.slice(0, 4)), Number(hoy.slice(5, 7)) - 1 - atras, 1)
    const a = base.getFullYear()
    const m = base.getMonth()
    // Lunes primero: `getDay()` da 0 para domingo.
    const primero = (new Date(a, m, 1).getDay() + 6) % 7
    const largo = new Date(a, m + 1, 0).getDate()
    const out: (string | null)[] = Array(primero).fill(null)
    for (let d = 1; d <= largo; d++) out.push(aFechaLocal(new Date(a, m, d)))
    return { año: a, mes: m + 1, celdas: out }
  }, [hoy, atras])

  return (
    <View style={s.mini}>
      <View style={s.miniCab}>
        <Pressable onPress={() => { elegir(); setAtras(n => Math.min(3, n + 1)) }}
                   hitSlop={12} disabled={atras >= 3}
                   accessibilityLabel="Mes anterior">
          <Text style={[s.miniFlecha, atras >= 3 && s.miniFlechaOff]}>‹</Text>
        </Pressable>
        <Text style={s.miniMes}>
          {nombreMes(mes).charAt(0).toUpperCase() + nombreMes(mes).slice(1)} {año}
        </Text>
        <Pressable onPress={() => { elegir(); setAtras(n => Math.max(0, n - 1)) }}
                   hitSlop={12} disabled={atras === 0}
                   accessibilityLabel="Mes siguiente">
          <Text style={[s.miniFlecha, atras === 0 && s.miniFlechaOff]}>›</Text>
        </Pressable>
      </View>
      <View style={s.miniSemana}>
        {DIAS_SEMANA.map((d, i) => (
          <Text key={`${d}${i}`} style={s.miniDiaSemana}>{d}</Text>
        ))}
      </View>
      <View style={s.miniRejilla}>
        {celdas.map((f, i) => {
          if (!f) return <View key={`v${i}`} style={s.miniCelda} />
          const futuro = f > hoy
          const on = f === elegida
          return (
            <Pressable
              key={f}
              onPress={() => { if (!futuro) { elegir(); onElegir(f) } }}
              disabled={futuro}
              style={s.miniCelda}
              accessibilityRole="button"
              accessibilityState={{ selected: on, disabled: futuro }}
            >
              <View style={[s.miniCaja, on && s.miniCajaOn]}>
                <Text style={[s.miniNum, futuro && s.miniNumOff, on && s.miniNumOn]}>
                  {Number(f.slice(8, 10))}
                </Text>
              </View>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  scroll: { paddingHorizontal: 20, paddingTop: 26, paddingBottom: 34, alignItems: 'center' },
  scrollFin: { paddingHorizontal: 20, paddingTop: 30, paddingBottom: 34, gap: 14 },
  flex: { flex: 1 },

  cabecera: {
    fontFamily: FUENTE.titulo, fontSize: 28, color: '#FFFFFF',
    textAlign: 'center', letterSpacing: -0.6,
  },
  cabPildora: {
    backgroundColor: '#FFFFFF', paddingHorizontal: 22, paddingVertical: 10,
    borderRadius: 999, marginTop: 10, marginBottom: 26,
  },
  cabPildoraTxt: { fontFamily: FUENTE.titulo, fontSize: 22, letterSpacing: -0.4 },

  tarjeta: { alignSelf: 'stretch', gap: 22, padding: 20 },
  tituloCard: { fontFamily: FUENTE.titulo, fontSize: 21, color: TEXTO.fuerte },

  progreso: { gap: 9 },
  progresoTxt: {
    fontFamily: FUENTE.fuerte, fontSize: 13.5, color: TEXTO.suave, textAlign: 'center',
  },
  progresoBarras: { flexDirection: 'row', gap: 7 },
  progresoBarra: { flex: 1, height: 4, borderRadius: 3, backgroundColor: '#E4DCF2' },
  progresoBarraOn: { backgroundColor: ACENTO.morado },

  fila: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  filaTit: { fontFamily: FUENTE.fuerte, fontSize: 15.5, color: TEXTO.fuerte },
  filaTxt: {
    fontFamily: FUENTE.cuerpo, fontSize: 12.5, lineHeight: 18,
    color: TEXTO.medio, marginTop: 3,
  },
  discreto: {
    flexDirection: 'row', alignItems: 'center', gap: 13,
    padding: 14, borderRadius: 20,
    backgroundColor: '#FDF0F3',
    borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#F1B9C6',
  },

  campo: { gap: 12 },
  campoCab: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  campoTit: {
    flex: 1, fontFamily: FUENTE.fuerte, fontSize: 16, color: TEXTO.fuerte, lineHeight: 21,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  letraChica: {
    fontFamily: FUENTE.suave, fontSize: 12, lineHeight: 17, color: TEXTO.suave,
  },

  regleta: { gap: 8 },
  regletaTira: { gap: 8, paddingVertical: 2 },
  regletaItem: {
    width: 48, height: 48, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: SUP.tarjeta,
    borderWidth: 1.5, borderColor: SUP.bordeChip,
  },
  regletaItemOn: { backgroundColor: ACENTO.naranja, borderColor: ACENTO.naranja },
  regletaTxt: { fontFamily: FUENTE.fuerte, fontSize: 16, color: TEXTO.medio, ...TABULAR },
  regletaTxtOn: { color: '#FFFFFF' },
  regletaPie: {
    fontFamily: FUENTE.titulo, fontSize: 17, color: ACENTO.naranja, textAlign: 'center',
  },

  mini: { gap: 8 },
  miniCab: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  miniFlecha: { fontFamily: FUENTE.fuerte, fontSize: 26, color: TEXTO.fuerte, paddingHorizontal: 12 },
  miniFlechaOff: { color: '#D6CFE4' },
  miniMes: { fontFamily: FUENTE.fuerte, fontSize: 16, color: TEXTO.fuerte },
  miniSemana: { flexDirection: 'row' },
  miniDiaSemana: {
    flex: 1, textAlign: 'center',
    fontFamily: FUENTE.fuerte, fontSize: 11.5, color: TEXTO.suave,
  },
  miniRejilla: { flexDirection: 'row', flexWrap: 'wrap' },
  miniCelda: { width: `${100 / 7}%`, alignItems: 'center', paddingVertical: 2 },
  miniCaja: {
    width: 34, height: 34, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  miniCajaOn: { backgroundColor: ACENTO.periodo },
  miniNum: { fontFamily: FUENTE.fuerte, fontSize: 14, color: TEXTO.fuerte, ...TABULAR },
  miniNumOff: { color: '#D2CADF' },
  miniNumOn: { color: '#FFFFFF' },

  avatar: {
    width: 96, height: 96, borderRadius: 48, alignSelf: 'center',
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  finTit: {
    fontFamily: FUENTE.titulo, fontSize: 30, color: '#FFFFFF',
    textAlign: 'center', marginTop: 6,
  },
  finPildora: {
    alignSelf: 'center', backgroundColor: '#FFFFFF',
    paddingHorizontal: 22, paddingVertical: 9, borderRadius: 999, marginBottom: 14,
  },
  finPildoraTxt: { fontFamily: FUENTE.titulo, fontSize: 20, color: '#E4677E' },
  tarjetaFin: { gap: 20, padding: 20, borderRadius: RADIO.tarjeta },
  finFila: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  finFilaTit: { fontFamily: FUENTE.titulo, fontSize: 16.5, color: TEXTO.fuerte },
  finFilaTxt: {
    fontFamily: FUENTE.cuerpo, fontSize: 13.5, lineHeight: 20,
    color: TEXTO.medio, marginTop: 4,
  },
})

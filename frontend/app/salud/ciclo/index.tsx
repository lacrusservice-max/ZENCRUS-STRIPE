/**
 * CICLO · INICIO
 * ═══════════════════════════════════════════════════════════════════════════
 * La pantalla 06 del mockup, tal cual: saludo, tres cifras, el anillo de
 * fases, el registro rápido y las dos tarjetas de nutrición y entrenamiento.
 *
 * ── Ninguna cifra está inventada ───────────────────────────────────────────
 * El mockup enseña «Día 3», «28 días de ciclo», «22 nov». Es una maqueta y
 * puede permitírselo; esta pantalla no. Todo sale de `useCiclo()`: los
 * periodos se deducen de su sangrado, las fases se cuentan sobre SU duración
 * y la fecha del próximo periodo trae banda de predicción. Donde el motor no
 * sabe, va un guion — nunca un número plausible.
 *
 * ── Y si no hay historial, se dice ─────────────────────────────────────────
 * Sin un solo periodo registrado no hay anillo honesto que dibujar. En vez de
 * pintarlo con un ciclo de 28 de mentira, la pantalla lo admite y ofrece
 * empezar. Un anillo falso el primer día destruye la confianza en todos los
 * números que vengan después.
 */

import { useMemo, useState } from 'react'
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native'
import { router } from 'expo-router'
import { useAuthStore } from '@/store/authStore'
import { useCicloStore } from '@/store/cicloStore'
import { useCiclo } from '@/features/salud/ciclo/useCiclo'
import { rachaRegistro } from '@/features/salud/ciclo/historial'
import { diaCorto, diaLargo } from '@/features/salud/ciclo/formato'
import { hoyLocal } from '@/utils/fechas'
import { AnilloFases, VolverAHoy } from '@/components/salud/ciclo/AnilloFases'
import { fraseDelDia } from '@/features/salud/ciclo/frase'
import { diasEntre } from '@/utils/fechas'
import { ALTO_BARRA } from '@/components/salud/ciclo/BarraCiclo'
import {
  Pantalla, Tarjeta, Azulejo, Icono, BotonPrincipal,
} from '@/components/salud/ciclo/Claro'
import {
  FONDO, FASE, ACENTO, TEXTO, FUENTE, HUECO, SUP, SOMBRA, RADIO, TABULAR,
} from '@/theme/salud/cicloClaro'
import { PHASE_ORDER } from '@/features/salud/ciclo/fases'
import { elegir } from '@/utils/haptica'
import type { NombreIcono } from '@/features/salud/ciclo/iconos'

/* Los cuatro accesos del «registro rápido». Cada uno abre el registro diario
   en el paso donde vive ese dato, en vez de obligar a recorrer los tres. */
const RAPIDO: { id: string; etiqueta: string; icono: NombreIcono; fondo: string; paso: number }[] = [
  { id: 'flujo',   etiqueta: 'Flujo',   icono: 'cycle_gota_color',     fondo: ACENTO.rojoSuave,   paso: 0 },
  { id: 'animo',   etiqueta: 'Ánimo',   icono: 'mood_badge',           fondo: ACENTO.naranjaSuave, paso: 1 },
  { id: 'energia', etiqueta: 'Energía', icono: 'wellness_energia',     fondo: ACENTO.tealSuave,   paso: 1 },
  { id: 'notas',   etiqueta: 'Notas',   icono: 'dashboard_editar',     fondo: ACENTO.moradoFondo, paso: 2 },
]

export default function InicioCiclo() {
  /* Solo el nombre de pila: «Hola, Eunice Martínez Delgado» no cabe y además
     no es como se saluda a nadie. */
  const nombre = useAuthStore(s => (s.user?.full_name ?? '').trim().split(/\s+/)[0] ?? '')
  const logs = useCicloStore(s => s.logs)
  const hoy = hoyLocal()
  const { hayDatos, prediccion, marco, estadisticas, periodos } = useCiclo()

  /* Un PRIMITIVO, no `getDia(hoy)`: un selector que construye un objeto
     devuelve uno nuevo en cada llamada y Zustand entra en bucle infinito. */
  const sangradoHoy = useCicloStore(
    s => (s.logs[hoy]?.sangrado as { level?: number } | undefined)?.level ?? null)

  /* Qué día del periodo es hoy, si está sangrando. Se cuenta desde el inicio
     del último periodo abierto, no desde el primer día que marcó: si se saltó
     el día 1 y apuntó el 2, sigue siendo su día 2. */
  const periodoEnCurso = useMemo(() => {
    if (!sangradoHoy) return null
    const ult = [...periodos].reverse().find(p => p.inicio <= hoy)
    return ult ? diasEntre(ult.inicio, hoy) + 1 : null
  }, [sangradoHoy, periodos, hoy])

  const racha = useMemo(() => rachaRegistro(logs, hoy), [logs, hoy])

  /* Cuántos días quedan de la fase en curso. Se cuenta hasta el límite de la
     fase siguiente; en la última se cierra contra el final del ciclo. */
  const restanFase = useMemo(() => {
    if (!prediccion) return null
    const i = PHASE_ORDER.indexOf(prediccion.fase)
    const sig = PHASE_ORDER[(i + 1) % PHASE_ORDER.length]
    const fin = i === PHASE_ORDER.length - 1
      ? marco.duracion + 1
      : marco.limites[sig]
    return Math.max(0, fin - prediccion.diaDeCiclo)
  }, [prediccion, marco])

  const faltaOvulacion = useMemo(() => {
    if (!prediccion) return null
    const d = marco.diaOvulacion - prediccion.diaDeCiclo
    return d > 0 ? d : null
  }, [prediccion, marco])

  /* ── La rueda ────────────────────────────────────────────────────────────
     El día que mira la burbuja, que puede no ser hoy. Se reengancha a hoy
     cuando cambia la predicción —al cruzar la medianoche o tras registrar—
     para no dejarla mirando un día que ya no significa lo mismo. */
  const [diaMirado, setDiaMirado] = useState<number | null>(null)
  const [moviendoRueda, setMoviendoRueda] = useState(false)
  const diaSeleccionado = diaMirado ?? prediccion?.diaDeCiclo ?? 1

  /* La frase de arriba va SIEMPRE sobre hoy, nunca sobre la burbuja: si se
     moviera al explorar, bastaría dejarla en el día 20 para leer «estás en tu
     ventana fértil» un día que no lo estás. */
  const frase = useMemo(() => fraseDelDia({
    sangradoHoy,
    diaDePeriodo: periodoEnCurso,
    diaDeCiclo: prediccion?.diaDeCiclo ?? null,
    diasParaLaRegla: prediccion ? diasEntre(hoy, prediccion.proximoPeriodo.likely) : null,
    marco: prediccion ? marco : null,
  }), [sangradoHoy, periodoEnCurso, prediccion, marco, hoy])

  const abrirRegistro = (paso: number) => {
    elegir()
    router.push({ pathname: '/salud/ciclo/registrar', params: { paso: String(paso) } })
  }

  return (
    <Pantalla fondo={FONDO.portada}>
      <ScrollView
        contentContainerStyle={[s.scroll, { paddingBottom: ALTO_BARRA + 40 }]}
        showsVerticalScrollIndicator={false}
        /* En iOS ningún PanResponder le gana a un ScrollView que lo contiene:
           sin esto la rueda no se deja arrastrar y parece rota. */
        scrollEnabled={!moviendoRueda}
      >
        {/* ── Saludo ───────────────────────────────────────────────────── */}
        <View style={s.cab}>
          <View style={s.flex}>
            <Text style={s.hola} numberOfLines={1}>
              {nombre ? `Hola, ${nombre}` : 'Hola'}
            </Text>
            <Text style={s.fecha}>{diaLargo(hoy)}</Text>
          </View>
          <Pressable
            onPress={() => { elegir(); router.push('/salud/ciclo/ajustes') }}
            style={({ pressed }) => [s.campana, pressed && s.pulsado]}
            accessibilityRole="button"
            accessibilityLabel="Avisos del ciclo"
          >
            <Icono nombre="dashboard_notificacion" tam={21} />
          </Pressable>
        </View>

        {/* ── Las tres cifras ──────────────────────────────────────────── */}
        <View style={s.cifras}>
          <Cifra icono="stats_racha" valor={racha ? String(racha) : '—'} pie="días de racha" />
          <Cifra
            icono="cycle_duracion"
            valor={estadisticas.media ? String(Math.round(estadisticas.media)) : '—'}
            pie="días de ciclo"
          />
          <Cifra
            icono="cycle_calendario"
            valor={prediccion ? diaCorto(prediccion.proximoPeriodo.likely) : '—'}
            pie="próx. periodo"
          />
        </View>

        {/* ── El anillo ────────────────────────────────────────────────── */}
        <Tarjeta style={s.tarjetaAnillo}>
          {hayDatos && prediccion ? (
            <>
              <Text style={[s.frase, TONO_FRASE[frase.tono]]}>{frase.texto}</Text>

              <AnilloFases
                marco={marco}
                diaDeCiclo={prediccion.diaDeCiclo}
                diaSeleccionado={diaSeleccionado}
                onDia={setDiaMirado}
                onArrastre={setMoviendoRueda}
                subtitulo={
                  diaSeleccionado === prediccion.diaDeCiclo && restanFase !== null
                    ? `${restanFase} ${restanFase === 1 ? 'día restante' : 'días restantes'} de fase`
                    : ''
                }
              />

              {diaMirado !== null && diaMirado !== prediccion.diaDeCiclo
                ? <VolverAHoy onPress={() => setDiaMirado(null)} />
                : null}
              <View style={s.leyenda}>
                {PHASE_ORDER.map(f => (
                  <View key={f} style={s.leyendaItem}>
                    <View style={[s.punto, { backgroundColor: FASE[f].arco }]} />
                    <Text style={s.leyendaTxt}>{FASE[f].etiqueta}</Text>
                  </View>
                ))}
              </View>
              <Text style={s.pieAnillo}>
                {faltaOvulacion
                  ? `A ${faltaOvulacion} ${faltaOvulacion === 1 ? 'día' : 'días'} de tu próxima ovulación`
                  : `Ciclo de ${marco.duracion} días`}
              </Text>
            </>
          ) : (
            <View style={s.vacio}>
              <Azulejo icono="cycle_gota_color" fondo={ACENTO.rojoSuave} tam={58} />
              <Text style={s.vacioTit}>Todavía no puedo predecir</Text>
              <Text style={s.vacioTxt}>
                Necesito saber cuándo fue tu última regla para dibujar tus fases.
                Son dos pantallas y se puede cambiar todo después.
              </Text>
              <BotonPrincipal
                texto="Empezar"
                onPress={() => { elegir(); router.push('/salud/ciclo/alta') }}
              />
              {/* La salida para quien no quiera contestar nada: registrar el
                  sangrado de hoy también alimenta al motor, solo que tarda un
                  ciclo más en tener algo que decir. */}
              <Pressable onPress={() => abrirRegistro(0)} hitSlop={10}>
                <Text style={s.vacioSalto}>Prefiero solo registrar hoy</Text>
              </Pressable>
            </View>
          )}
        </Tarjeta>

        {/* ── Registro rápido ──────────────────────────────────────────── */}
        <Text style={s.rotulo}>Registro rápido de hoy</Text>
        <View style={s.rapido}>
          {RAPIDO.map(r => (
            <Pressable
              key={r.id}
              onPress={() => abrirRegistro(r.paso)}
              style={({ pressed }) => [s.rapidoItem, pressed && s.pulsado]}
              accessibilityRole="button"
              accessibilityLabel={`Registrar ${r.etiqueta}`}
            >
              <View style={[s.circulo, { backgroundColor: r.fondo }]}>
                <Icono nombre={r.icono} tam={26} />
              </View>
              <Text style={s.rapidoTxt}>{r.etiqueta}</Text>
            </Pressable>
          ))}
        </View>

        {/* ── Nutrición y entrenamiento ────────────────────────────────── */}
        <View style={s.consejos}>
          <Consejo
            tono={ACENTO.verdeSuave}
            icono="wellness_nutricion"
            iconoFondo="#C4E9D5"
            titulo="Nutrición de hoy"
            color={ACENTO.verde}
            texto={
              prediccion
                ? CONSEJO_NUTRICION[prediccion.fase]
                : 'Registra tu ciclo para recibir consejos por fase.'
            }
            onPress={() => router.push('/salud/ciclo/correlaciones')}
          />
          <Consejo
            tono={ACENTO.moradoFondo}
            icono="wellness_entrenamiento"
            iconoFondo="#DCD0F7"
            titulo="Entrena hoy"
            color={ACENTO.morado}
            texto={
              prediccion
                ? CONSEJO_ENTRENO[prediccion.fase]
                : 'Registra tu ciclo para recibir consejos por fase.'
            }
            onPress={() => router.push('/salud/ciclo/correlaciones')}
          />
        </View>
      </ScrollView>
    </Pantalla>
  )
}

/* ── Piezas de esta pantalla ───────────────────────────────────────────── */

function Cifra({ icono, valor, pie }: { icono: NombreIcono; valor: string; pie: string }) {
  return (
    <View style={s.cifra}>
      <Icono nombre={icono} tam={20} />
      <Text style={s.cifraNum} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
        {valor}
      </Text>
      <Text style={s.cifraPie} numberOfLines={1}>{pie}</Text>
    </View>
  )
}

function Consejo({ tono, icono, iconoFondo, titulo, texto, color, onPress }: {
  tono: string
  icono: NombreIcono
  iconoFondo: string
  titulo: string
  texto: string
  color: string
  onPress: () => void
}) {
  return (
    <Pressable
      onPress={() => { elegir(); onPress() }}
      style={({ pressed }) => [s.consejo, { backgroundColor: tono }, pressed && s.pulsado]}
      accessibilityRole="button"
    >
      <Azulejo icono={icono} fondo={iconoFondo} tam={42} />
      <Text style={s.consejoTit}>{titulo}</Text>
      <Text style={[s.consejoTxt, { color }]}>{texto}</Text>
      <Text style={[s.verMas, { color }]}>Ver más ›</Text>
    </Pressable>
  )
}

/**
 * El consejo de la tarjeta, por fase.
 *
 * Es un resumen de una línea de las tablas de la guía clínica; el desarrollo
 * completo —con el porqué fisiológico y las alternativas— vive en la pantalla
 * que se abre al tocar. Aquí cabe una frase, y una frase mal elegida es peor
 * que ninguna.
 */
const CONSEJO_NUTRICION: Record<string, string> = {
  menstrual:  'Prioriza hierro y magnesio: espinaca, lentejas y plátano.',
  folicular:  'Proteína magra y carbohidratos complejos: quinoa, avena, huevo.',
  ovulatoria: 'Mantén proteína y complejos; buen día para comidas variadas.',
  lutea:      'Fibra y complejos para estabilizar el azúcar y los antojos.',
}

const CONSEJO_ENTRENO: Record<string, string> = {
  menstrual:  'Entrena suave: yoga, caminata o estiramientos.',
  folicular:  'Buen momento para fuerza progresiva si te sientes con energía.',
  ovulatoria: 'Alta intensidad si el cuerpo acompaña; sin forzarlo.',
  lutea:      'Baja la intensidad hacia el final; el cardio moderado ayuda al ánimo.',
}

/** El color de la frase de arriba según lo que esté diciendo. */
const TONO_FRASE: Record<string, { color: string }> = {
  menstrual: { color: FASE.menstrual.texto },
  alerta:    { color: '#C2410C' },
  fertil:    { color: FASE.ovulatoria.texto },
  neutro:    { color: TEXTO.medio },
}

const s = StyleSheet.create({
  scroll: { paddingHorizontal: 20, paddingTop: 12, gap: HUECO.lg },
  flex: { flex: 1 },
  pulsado: { opacity: 0.75, transform: [{ scale: 0.985 }] },

  cab: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  hola: {
    fontFamily: FUENTE.titulo, fontSize: 30, color: TEXTO.fuerte,
    letterSpacing: -0.8,
  },
  fecha: { fontFamily: FUENTE.medio, fontSize: 15, color: TEXTO.medio, marginTop: 2 },
  campana: {
    width: 50, height: 50, borderRadius: 25,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: SUP.tarjeta, ...SOMBRA,
  },

  cifras: { flexDirection: 'row', gap: 11 },
  cifra: {
    flex: 1, alignItems: 'center', gap: 3,
    paddingVertical: 15, borderRadius: 20,
    backgroundColor: SUP.tarjeta, ...SOMBRA,
  },
  cifraNum: {
    fontFamily: FUENTE.titulo, fontSize: 21, color: TEXTO.fuerte, ...TABULAR,
  },
  cifraPie: { fontFamily: FUENTE.cuerpo, fontSize: 11.5, color: TEXTO.medio },

  tarjetaAnillo: { paddingVertical: 22, gap: 14 },
  frase: {
    fontFamily: FUENTE.titulo, fontSize: 18, textAlign: 'center',
    letterSpacing: -0.3, paddingHorizontal: 8,
  },
  leyenda: {
    flexDirection: 'row', flexWrap: 'wrap',
    justifyContent: 'center', gap: 14, rowGap: 6,
  },
  leyendaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  punto: { width: 9, height: 9, borderRadius: 5 },
  leyendaTxt: { fontFamily: FUENTE.cuerpo, fontSize: 12.5, color: TEXTO.medio },
  pieAnillo: {
    fontFamily: FUENTE.fuerte, fontSize: 15, color: TEXTO.fuerte,
    textAlign: 'center',
  },

  vacio: { alignItems: 'center', gap: 12, paddingVertical: 14 },
  vacioTit: { fontFamily: FUENTE.titulo, fontSize: 19, color: TEXTO.fuerte },
  vacioTxt: {
    fontFamily: FUENTE.cuerpo, fontSize: 14, color: TEXTO.medio,
    textAlign: 'center', lineHeight: 21, marginBottom: 6,
  },
  vacioSalto: {
    fontFamily: FUENTE.fuerte, fontSize: 13.5, color: TEXTO.suave, marginTop: 4,
  },

  rotulo: {
    fontFamily: FUENTE.fuerte, fontSize: 17, color: TEXTO.fuerte,
    marginBottom: -6,
  },
  rapido: { flexDirection: 'row', justifyContent: 'space-between' },
  rapidoItem: { alignItems: 'center', gap: 8, width: 76 },
  circulo: {
    width: 68, height: 68, borderRadius: 34,
    alignItems: 'center', justifyContent: 'center',
  },
  rapidoTxt: { fontFamily: FUENTE.fuerte, fontSize: 13.5, color: TEXTO.fuerte },

  consejos: { flexDirection: 'row', gap: 12 },
  consejo: {
    flex: 1, borderRadius: RADIO.tarjeta, padding: 16, gap: 7,
  },
  consejoTit: {
    fontFamily: FUENTE.titulo, fontSize: 16.5, color: TEXTO.fuerte,
    marginTop: 4, letterSpacing: -0.2,
  },
  consejoTxt: { fontFamily: FUENTE.medio, fontSize: 13.5, lineHeight: 19 },
  verMas: { fontFamily: FUENTE.fuerte, fontSize: 13.5, marginTop: 2 },
})

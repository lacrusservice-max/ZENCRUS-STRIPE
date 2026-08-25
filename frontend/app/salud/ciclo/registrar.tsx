/**
 * CICLO · REGISTRO DIARIO
 * ═══════════════════════════════════════════════════════════════════════════
 * Las pantallas 08, 09 y 10 del mockup, en tres pasos: sangrado y síntomas;
 * ánimo, vida sexual, energía, nutrición y entrenamiento; piel, notas y el
 * resumen.
 *
 * ── Se guarda al tocar, no al final ────────────────────────────────────────
 * El mockup pone «Continuar →» y «Guardar registro», y eso invita a pensar que
 * nada se guarda hasta el último botón. Aquí cada toque escribe ya. La razón
 * es simple: esta pantalla se abre a menudo con una mano, medio dormida, a las
 * siete de la mañana, y se cierra a media captura. Con guardado al final, ese
 * cierre pierde todo lo marcado; con guardado al instante, no se pierde nada y
 * los botones solo llevan de un paso a otro.
 *
 * ── Tocar lo ya marcado lo APAGA ───────────────────────────────────────────
 * Todos los controles de aquí son reversibles sin salir. Un síntoma marcado
 * por error que no se puede quitar acaba siendo un dato falso permanente, y en
 * un historial que alimenta correlaciones un dato falso es peor que un hueco.
 *
 * ── El día se puede cambiar ────────────────────────────────────────────────
 * Llega por parámetro desde el calendario. Sin eso, «me bajó el martes y no lo
 * apunté» no tendría arreglo, que es el motivo por el que la gente abandona
 * este tipo de apps.
 */

import { useCallback, useState } from 'react'
import {
  View, Text, StyleSheet, Pressable, ScrollView, TextInput,
  KeyboardAvoidingView, Platform,
} from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { useCicloStore } from '@/store/cicloStore'
import { useCiclo } from '@/features/salud/ciclo/useCiclo'
import { rachaRegistro } from '@/features/salud/ciclo/historial'
import { diaLargo } from '@/features/salud/ciclo/formato'
import { hoyLocal } from '@/utils/fechas'
import {
  ANTOJOS, ESTADOS_ENTRENO, COLORES_SANGRADO, ZONAS_DOLOR,
  type TrackerKind,
} from '@/features/salud/trackers'
import {
  Pantalla, Tarjeta, Seccion, Chip, Intensidad, Icono, Azulejo, BotonPrincipal,
} from '@/components/salud/ciclo/Claro'
import {
  FONDO, ACENTO, TEXTO, FUENTE, SUP, SOMBRA, HUECO, TABULAR,
} from '@/theme/salud/cicloClaro'
import { elegir, confirmar } from '@/utils/haptica'
import type { NombreIcono } from '@/features/salud/ciclo/iconos'

/* ── Vocabulario de pantalla ───────────────────────────────────────────── */

/** Los cinco grados del mockup sobre la escala 0-5 del esquema. */
const NIVELES: { nivel: number; etiqueta: string; manchado?: boolean }[] = [
  { nivel: 1, etiqueta: 'Manchado', manchado: true },
  { nivel: 2, etiqueta: 'Ligero' },
  { nivel: 3, etiqueta: 'Moderado' },
  { nivel: 4, etiqueta: 'Abundante' },
  { nivel: 5, etiqueta: 'Muy abundante' },
]

const COLOR_ET: Record<typeof COLORES_SANGRADO[number], string> = {
  rojo_brillante: 'Rojo brillante',
  rojo_oscuro: 'Rojo oscuro',
  cafe: 'Café',
  otro: 'Otro',
}

/** Los síntomas de chip del mockup, con la zona del mapa corporal que los guarda. */
const SINTOMAS_CHIP: { id: typeof ZONAS_DOLOR[number]; etiqueta: string }[] = [
  { id: 'lumbar', etiqueta: 'Dolor lumbar' },
  { id: 'cabeza', etiqueta: 'Dolor de cabeza / Migraña' },
  { id: 'pecho', etiqueta: 'Sensibilidad en senos' },
  { id: 'ovarios', etiqueta: 'Dolor de ovarios' },
  { id: 'piernas', etiqueta: 'Dolor muscular' },
  { id: 'articulaciones', etiqueta: 'Dolor articular' },
]

const DIGESTIVOS = [
  { id: 'hinchazon', etiqueta: 'Inflamación abdominal' },
  { id: 'nauseas', etiqueta: 'Náuseas' },
  { id: 'diarrea', etiqueta: 'Diarrea' },
  { id: 'estrenimiento', etiqueta: 'Estreñimiento' },
]

const PIEL = [
  { id: 'acne', etiqueta: 'Acné' },
  { id: 'grasa', etiqueta: 'Piel grasa' },
  { id: 'seca', etiqueta: 'Piel seca' },
  { id: 'cabello_graso', etiqueta: 'Cabello graso' },
]

const ANIMOS: { id: string; etiqueta: string; icono: NombreIcono; valence: number; arousal: number }[] = [
  { id: 'feliz',     etiqueta: 'Feliz',     icono: 'mood_feliz',     valence: 0.8,  arousal: 0.4 },
  { id: 'tranquila', etiqueta: 'Tranquila', icono: 'mood_tranquila', valence: 0.4,  arousal: -0.5 },
  { id: 'sensible',  etiqueta: 'Sensible',  icono: 'mood_sensible',  valence: -0.2, arousal: 0.2 },
  { id: 'irritable', etiqueta: 'Irritable', icono: 'mood_irritable', valence: -0.5, arousal: 0.7 },
  { id: 'triste',    etiqueta: 'Triste',    icono: 'mood_triste',    valence: -0.8, arousal: -0.4 },
]

const ANTOJO_ET: Record<typeof ANTOJOS[number], string> = {
  dulce: 'Dulce', salado: 'Salado', carbohidratos: 'Carbohidratos',
  grasas: 'Grasas', proteinas: 'Proteínas', citricos: 'Cítricos', otro: 'Otro',
}

const ENTRENO_ET: Record<typeof ESTADOS_ENTRENO[number], string> = {
  no_entrene: 'No entrené hoy', con_energia: 'Con energía', cansada: 'Cansada',
  con_dolor: 'Con dolor / molestias', motivada: 'Motivada',
}

export default function RegistrarCiclo() {
  const params = useLocalSearchParams<{ fecha?: string; paso?: string }>()
  const fecha = params.fecha ?? hoyLocal()
  const [paso, setPaso] = useState(() => {
    const n = Number(params.paso)
    return Number.isFinite(n) ? Math.max(0, Math.min(2, n)) : 0
  })

  const registrar = useCicloStore(s => s.registrar)
  const borrarKind = useCicloStore(s => s.borrar)
  const logs = useCicloStore(s => s.logs)
  const dia = useCicloStore(s => s.getDia(fecha))
  const { prediccion } = useCiclo(fecha)

  const guardar = useCallback((kind: TrackerKind, value: unknown) => {
    void registrar(kind as never, value as never, fecha)
  }, [registrar, fecha])

  const quitar = useCallback((kind: TrackerKind) => {
    void borrarKind(kind, fecha)
  }, [borrarKind, fecha])

  /** Marca o desmarca dentro de una lista de etiquetas. */
  const alternar = useCallback((kind: TrackerKind, actuales: string[], id: string) => {
    const siguiente = actuales.includes(id)
      ? actuales.filter(x => x !== id)
      : [...actuales, id]
    if (siguiente.length) guardar(kind, { tags: siguiente })
    else quitar(kind)
  }, [guardar, quitar])

  const cerrar = () => { confirmar(); router.back() }

  const avanzar = () => {
    if (paso >= 2) { cerrar(); return }
    elegir()
    setPaso(p => p + 1)
  }

  return (
    <Pantalla fondo={FONDO.registro}>
      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* ── Cabecera ───────────────────────────────────────────────────── */}
        <View style={s.cab}>
          <Pressable
            onPress={() => (paso === 0 ? cerrar() : (elegir(), setPaso(p => p - 1)))}
            style={({ pressed }) => [s.redondo, pressed && s.pulsado]}
            accessibilityRole="button"
            accessibilityLabel={paso === 0 ? 'Cerrar' : 'Paso anterior'}
          >
            <Text style={s.flecha}>‹</Text>
          </Pressable>
          <View style={s.cabCentro}>
            <Text style={s.cabTit}>
              {fecha === hoyLocal() ? 'Registro de hoy' : 'Registro'}
            </Text>
            <Text style={s.cabPie} numberOfLines={1}>
              {diaLargo(fecha)} · Paso {paso + 1} de 3
            </Text>
          </View>
          <Pressable
            onPress={cerrar}
            style={({ pressed }) => [s.redondo, pressed && s.pulsado]}
            accessibilityRole="button"
            accessibilityLabel="Cerrar"
          >
            <Text style={s.equis}>✕</Text>
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {paso === 0 ? (
            <PasoSangrado dia={dia} guardar={guardar} quitar={quitar} alternar={alternar} />
          ) : paso === 1 ? (
            <PasoSentir dia={dia} guardar={guardar} quitar={quitar} alternar={alternar} />
          ) : (
            <PasoCierre
              dia={dia} guardar={guardar} quitar={quitar} alternar={alternar}
              racha={rachaRegistro(logs, hoyLocal())}
              esteMes={registrosDelMes(logs, fecha)}
            />
          )}
        </ScrollView>

        {/* ── Pie ────────────────────────────────────────────────────────── */}
        <View style={s.pie}>
          <View style={s.puntos}>
            {[0, 1, 2].map(n => (
              <View key={n} style={[s.punto, n === paso && s.puntoOn]} />
            ))}
          </View>
          <BotonPrincipal
            texto={paso === 2 ? 'Guardar registro' : 'Continuar →'}
            onPress={avanzar}
          />
          {prediccion ? (
            <Text style={s.diaDeCiclo}>Día {prediccion.diaDeCiclo} de tu ciclo</Text>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </Pantalla>
  )
}

/* ── Paso 1 · Sangrado y síntomas ──────────────────────────────────────── */

interface PropsPaso {
  dia: Record<string, unknown>
  guardar: (k: TrackerKind, v: unknown) => void
  quitar: (k: TrackerKind) => void
  alternar: (k: TrackerKind, actuales: string[], id: string) => void
}

function PasoSangrado({ dia, guardar, quitar, alternar }: PropsPaso) {
  const sangrado = dia.sangrado as
    { level?: number; spotting?: boolean; color?: string; fueraDePeriodo?: boolean } | undefined
  const dolor = (dia.dolor as { zones?: { id: string; intensity: number }[] } | undefined)?.zones ?? []
  const digestion = (dia.digestion as { tags?: string[] } | undefined)?.tags ?? []

  const colicos = dolor.find(z => z.id === 'abdomen_bajo')?.intensity ?? 0

  /* El dolor guarda zona e intensidad. Los chips no piden intensidad, así que
     entran con un 5 sobre 10 —«lo tuve»— en vez de inventar un número alto. */
  const alternarDolor = (id: string) => {
    const hay = dolor.some(z => z.id === id)
    const zonas = hay
      ? dolor.filter(z => z.id !== id)
      : [...dolor, { id, intensity: 5 }]
    if (zonas.length) guardar('dolor', { zones: zonas })
    else quitar('dolor')
  }

  const fijarColicos = (n: number) => {
    const otras = dolor.filter(z => z.id !== 'abdomen_bajo')
    /* La barra va de 1 a 5 y el esquema de 1 a 10: se escala para que el 5 de
       la barra sea el 10 del esquema, no un 5 tibio. */
    const zonas = n > 0 ? [...otras, { id: 'abdomen_bajo', intensity: n * 2 }] : otras
    if (zonas.length) guardar('dolor', { zones: zonas })
    else quitar('dolor')
  }

  return (
    <>
      <Tarjeta style={s.tarjeta}>
        <Seccion icono="cycle_gota_color" fondo={ACENTO.rojoSuave} titulo="Intensidad del sangrado" />
        <View style={s.chips}>
          {NIVELES.map(n => (
            <Chip
              key={n.nivel}
              texto={n.etiqueta}
              activo={sangrado?.level === n.nivel}
              onPress={() => {
                if (sangrado?.level === n.nivel) { quitar('sangrado'); return }
                guardar('sangrado', {
                  ...(sangrado ?? {}),
                  level: n.nivel,
                  spotting: n.manchado === true,
                })
              }}
            />
          ))}
        </View>
      </Tarjeta>

      <Tarjeta style={s.tarjeta}>
        <Seccion icono="cycle_gota_bn" fondo={ACENTO.rojoSuave} titulo="Color del sangrado" />
        <View style={s.chips}>
          {COLORES_SANGRADO.map(c => (
            <Chip
              key={c}
              texto={COLOR_ET[c]}
              activo={sangrado?.color === c}
              onPress={() => guardar('sangrado', {
                ...(sangrado ?? { level: 0 }),
                color: sangrado?.color === c ? undefined : c,
              })}
            />
          ))}
        </View>
        {/* Las dos casillas que cambian cómo se DEDUCEN los periodos, no solo
            cómo se pinta el día. Por eso van con su explicación al lado. */}
        <View style={s.chips}>
          <Chip
            texto="Sangrado fuera del periodo"
            activo={sangrado?.fueraDePeriodo === true}
            onPress={() => guardar('sangrado', {
              ...(sangrado ?? { level: 0 }),
              fueraDePeriodo: !sangrado?.fueraDePeriodo,
            })}
          />
          <Chip
            texto="Manchado antes o después"
            activo={sangrado?.spotting === true}
            onPress={() => guardar('sangrado', {
              ...(sangrado ?? { level: 0 }),
              spotting: !sangrado?.spotting,
            })}
          />
        </View>
        <Text style={s.letraChica}>
          Marcadas, este día no cuenta para calcular el inicio de tu periodo.
        </Text>
      </Tarjeta>

      <Tarjeta style={s.tarjeta}>
        <Seccion icono="wellness_sintomas" fondo={ACENTO.rojoSuave} titulo="Síntomas" />
        <Text style={s.subrotulo}>Cólicos</Text>
        <Intensidad
          valor={Math.round(colicos / 2)}
          onValor={fijarColicos}
          color={ACENTO.rojo}
          izquierda="Leve"
          derecha="Intenso"
        />
        <View style={[s.chips, { marginTop: 6 }]}>
          {SINTOMAS_CHIP.map(x => (
            <Chip
              key={x.id}
              texto={x.etiqueta}
              activo={dolor.some(z => z.id === x.id)}
              onPress={() => alternarDolor(x.id)}
            />
          ))}
          {DIGESTIVOS.map(x => (
            <Chip
              key={x.id}
              texto={x.etiqueta}
              activo={digestion.includes(x.id)}
              onPress={() => alternar('digestion', digestion, x.id)}
            />
          ))}
        </View>
      </Tarjeta>
    </>
  )
}

/* ── Paso 2 · Cómo te sientes ──────────────────────────────────────────── */

function PasoSentir({ dia, guardar, quitar, alternar }: PropsPaso) {
  const animo = dia.animo as { valence?: number; arousal?: number } | undefined
  const libido = dia.libido as { tags?: string[]; level?: number } | undefined
  const energia = (dia.energia as { level?: number } | undefined)?.level ?? 0
  const apetito = (dia.apetito as { level?: number } | undefined)?.level ?? 0
  const antojos = (dia.antojos as { tags?: string[] } | undefined)?.tags ?? []
  const entreno = (dia.entrenamiento as { estado?: string } | undefined)?.estado

  const animoActivo = ANIMOS.find(a =>
    animo && Math.abs((animo.valence ?? 0) - a.valence) < 0.05
         && Math.abs((animo.arousal ?? 0) - a.arousal) < 0.05)

  return (
    <>
      <Tarjeta style={s.tarjeta}>
        <Seccion icono="mood_badge" fondo={ACENTO.naranjaSuave} titulo="Estado de ánimo" />
        <View style={s.caras}>
          {ANIMOS.map(a => {
            const on = animoActivo?.id === a.id
            return (
              <Pressable
                key={a.id}
                onPress={() => {
                  elegir()
                  if (on) quitar('animo')
                  else guardar('animo', { valence: a.valence, arousal: a.arousal })
                }}
                style={s.cara}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
              >
                <View style={[s.caraCirculo, on && s.caraCirculoOn]}>
                  <Icono nombre={a.icono} tam={26} style={on ? s.caraIconoOn : undefined} />
                </View>
                <Text style={[s.caraTxt, on && s.caraTxtOn]}>{a.etiqueta}</Text>
              </Pressable>
            )
          })}
        </View>
      </Tarjeta>

      <Tarjeta style={s.tarjeta}>
        <Seccion icono="wellness_salud_corazon" fondo={ACENTO.rosaSuave} titulo="Vida sexual" />
        <View style={s.chips}>
          {[['protegido', 'Con protección'], ['sin_proteccion', 'Sin protección']].map(([id, et]) => (
            <Chip
              key={id}
              texto={et}
              color={ACENTO.rosa}
              activo={(libido?.tags ?? []).includes(id)}
              onPress={() => alternar('libido', libido?.tags ?? [], id)}
            />
          ))}
        </View>
        <Text style={s.subrotulo}>Deseo sexual</Text>
        <Intensidad
          valor={libido?.level ?? 0}
          onValor={n => {
            const tags = libido?.tags ?? []
            if (n === 0 && !tags.length) { quitar('libido'); return }
            guardar('libido', { ...(libido ?? {}), level: n || undefined, tags })
          }}
          color={ACENTO.rosa}
          izquierda="Bajo"
          derecha="Alto"
        />
      </Tarjeta>

      <Tarjeta style={s.tarjeta}>
        <Seccion icono="wellness_energia" fondo={ACENTO.tealSuave} titulo="Nivel de energía" />
        <Intensidad
          valor={energia}
          onValor={n => (n ? guardar('energia', { level: n }) : quitar('energia'))}
          color={ACENTO.teal}
          izquierda="Baja"
          derecha="Alta"
        />
      </Tarjeta>

      <Tarjeta style={s.tarjeta}>
        <Seccion icono="wellness_nutricion" fondo={ACENTO.verdeSuave} titulo="Nutrición" />
        <Text style={s.subrotulo}>Apetito</Text>
        <Intensidad
          valor={apetito}
          onValor={n => (n ? guardar('apetito', { level: n }) : quitar('apetito'))}
          color={ACENTO.verde}
          izquierda="Bajo"
          derecha="Alto"
        />
        <Text style={s.subrotulo}>Antojos</Text>
        <View style={s.chips}>
          {ANTOJOS.map(a => (
            <Chip
              key={a}
              texto={ANTOJO_ET[a]}
              color={ACENTO.verde}
              activo={antojos.includes(a)}
              onPress={() => alternar('antojos', antojos, a)}
            />
          ))}
        </View>
      </Tarjeta>

      <Tarjeta style={s.tarjeta}>
        <Seccion icono="wellness_entrenamiento" fondo={ACENTO.moradoFondo} titulo="Entrenamiento" />
        <Text style={s.subrotulo}>¿Cómo te sentiste durante tu entrenamiento?</Text>
        <View style={s.chips}>
          {ESTADOS_ENTRENO.map(e => (
            <Chip
              key={e}
              texto={ENTRENO_ET[e]}
              color={ACENTO.morado}
              activo={entreno === e}
              onPress={() => (entreno === e
                ? quitar('entrenamiento')
                : guardar('entrenamiento', { estado: e }))}
            />
          ))}
        </View>
      </Tarjeta>
    </>
  )
}

/* ── Paso 3 · Piel, notas y cierre ─────────────────────────────────────── */

function PasoCierre({ dia, guardar, quitar, alternar, racha, esteMes }: PropsPaso & {
  racha: number
  esteMes: number
}) {
  const piel = (dia.piel as { tags?: string[] } | undefined)?.tags ?? []
  const notaGuardada = (dia.notas as { texto?: string } | undefined)?.texto ?? ''
  const [nota, setNota] = useState(notaGuardada)

  return (
    <>
      <Tarjeta style={s.tarjeta}>
        <Seccion icono="wellness_piel" fondo={ACENTO.verdeSuave} titulo="Piel y cabello" />
        <View style={s.chips}>
          {PIEL.map(x => (
            <Chip
              key={x.id}
              texto={x.etiqueta}
              color={ACENTO.verde}
              activo={piel.includes(x.id)}
              onPress={() => alternar('piel', piel, x.id)}
            />
          ))}
          <Chip
            texto="Ninguno"
            color={ACENTO.verde}
            activo={piel.length === 0 && !!dia.piel}
            onPress={() => quitar('piel')}
          />
        </View>
      </Tarjeta>

      <Tarjeta style={s.tarjeta}>
        <Seccion icono="dashboard_editar" fondo={ACENTO.moradoFondo} titulo="Notas adicionales" />
        <TextInput
          value={nota}
          onChangeText={setNota}
          /* Se guarda al salir del campo y no en cada letra: escribir dispara
             una escritura por pulsación, y la cola de sincronización acabaría
             con cuarenta versiones de la misma frase. */
          onBlur={() => {
            const t = nota.trim()
            if (t) guardar('notas', { texto: t.slice(0, 1000) })
            else if (notaGuardada) quitar('notas')
          }}
          placeholder="Hoy me sentí más cansada de lo normal, dormí poco…"
          placeholderTextColor={TEXTO.suave}
          style={s.nota}
          multiline
          maxLength={1000}
          textAlignVertical="top"
        />
      </Tarjeta>

      <Tarjeta style={[s.tarjeta, s.cierre]}>
        <Azulejo icono="stats_check" fondo={ACENTO.verdeSuave} tam={62} icono_tam={30} />
        <Text style={s.cierreTit}>¡Registro completo!</Text>
        <Text style={s.cierreTxt}>
          Gracias por registrar tus datos de hoy. Nos ayudan a afinar tus
          predicciones de ciclo y tus recomendaciones de nutrición y entrenamiento.
        </Text>
        <View style={s.cierreCifras}>
          <View style={s.cierreCifra}>
            <Icono nombre="stats_racha" tam={22} />
            <Text style={s.cierreNum}>{racha} {racha === 1 ? 'día' : 'días'}</Text>
            <Text style={s.cierrePie}>de racha</Text>
          </View>
          <View style={s.cierreCifra}>
            <Icono nombre="cycle_calendario" tam={22} />
            <Text style={s.cierreNum}>{esteMes}</Text>
            <Text style={s.cierrePie}>registros este mes</Text>
          </View>
        </View>
      </Tarjeta>
    </>
  )
}

/** Cuántos días de este mes tienen algún registro. */
function registrosDelMes(logs: Record<string, unknown>, fecha: string): number {
  const prefijo = fecha.slice(0, 7)
  return Object.keys(logs).filter(f => f.startsWith(prefijo)).length
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  pulsado: { opacity: 0.72, transform: [{ scale: 0.96 }] },

  cab: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 20, paddingTop: 6, paddingBottom: 14,
  },
  redondo: {
    width: 46, height: 46, borderRadius: 23,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: SUP.tarjeta, ...SOMBRA,
  },
  flecha: { fontFamily: FUENTE.fuerte, fontSize: 26, color: TEXTO.fuerte, marginTop: -4 },
  equis: { fontFamily: FUENTE.medio, fontSize: 19, color: TEXTO.medio },
  cabCentro: { flex: 1, alignItems: 'center' },
  cabTit: { fontFamily: FUENTE.titulo, fontSize: 20, color: TEXTO.fuerte },
  cabPie: { fontFamily: FUENTE.medio, fontSize: 12.5, color: TEXTO.suave, marginTop: 2 },

  scroll: { paddingHorizontal: 20, paddingBottom: 24, gap: HUECO.md },
  tarjeta: { gap: 14 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  subrotulo: {
    fontFamily: FUENTE.fuerte, fontSize: 14.5, color: TEXTO.fuerte, marginBottom: -4,
  },
  letraChica: {
    fontFamily: FUENTE.suave, fontSize: 12, lineHeight: 17, color: TEXTO.suave,
  },

  caras: { flexDirection: 'row', justifyContent: 'space-between' },
  cara: { alignItems: 'center', gap: 7, width: 62 },
  caraCirculo: {
    width: 58, height: 58, borderRadius: 29,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: SUP.bordeChip,
  },
  caraCirculoOn: { backgroundColor: ACENTO.naranja, borderColor: ACENTO.naranja },
  caraIconoOn: { tintColor: '#FFFFFF' },
  caraTxt: { fontFamily: FUENTE.medio, fontSize: 12, color: TEXTO.medio },
  caraTxtOn: { fontFamily: FUENTE.fuerte, color: ACENTO.naranja },

  nota: {
    minHeight: 96, borderRadius: 18, padding: 14,
    fontFamily: FUENTE.cuerpo, fontSize: 14.5, lineHeight: 21, color: TEXTO.fuerte,
    borderWidth: 1.5, borderColor: SUP.bordeChip,
  },

  cierre: { alignItems: 'center', backgroundColor: '#F6F2FC' },
  cierreTit: { fontFamily: FUENTE.titulo, fontSize: 21, color: TEXTO.fuerte },
  cierreTxt: {
    fontFamily: FUENTE.cuerpo, fontSize: 13.5, lineHeight: 20,
    color: TEXTO.medio, textAlign: 'center',
  },
  cierreCifras: { flexDirection: 'row', gap: 12, alignSelf: 'stretch' },
  cierreCifra: {
    flex: 1, alignItems: 'center', gap: 3,
    paddingVertical: 14, borderRadius: 18, backgroundColor: SUP.tarjeta,
  },
  cierreNum: { fontFamily: FUENTE.titulo, fontSize: 18, color: TEXTO.fuerte, ...TABULAR },
  cierrePie: {
    fontFamily: FUENTE.cuerpo, fontSize: 11.5, color: TEXTO.suave, textAlign: 'center',
  },

  pie: { paddingHorizontal: 20, paddingBottom: 16, paddingTop: 10, gap: 12 },
  puntos: { flexDirection: 'row', justifyContent: 'center', gap: 7 },
  punto: { width: 8, height: 8, borderRadius: 4, backgroundColor: ACENTO.moradoSuave },
  puntoOn: { width: 22, backgroundColor: ACENTO.morado },
  diaDeCiclo: {
    fontFamily: FUENTE.medio, fontSize: 12.5, color: TEXTO.suave, textAlign: 'center',
  },
})
